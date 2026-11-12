import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { CanvaService } from '../services/canvaService';

export const canvaOAuthRouter = Router();

const scopes = [
  'brandtemplate:content:read', 'brandtemplate:meta:read', 'design:content:read',
  'design:content:write', 'design:meta:read', 'asset:read', 'asset:write',
].join(' ');
const cookieName = 'nexosalud_canva_state';
const oauthLifetime = 10 * 60_000;
const pending = new Map<string, { verifier: string; redirectUri: string; expires: number }>();

function canvaConfig() {
  const clientId = process.env.CANVA_CLIENT_ID?.trim();
  const clientSecret = process.env.CANVA_CLIENT_SECRET?.trim();
  const callback = URL.parse(process.env.CANVA_REDIRECT_URI ?? 'http://127.0.0.1:3001/api/canva/callback');
  const frontend = URL.parse(process.env.FRONTEND_URL ?? 'http://localhost:5173');
  if (!clientId || !clientSecret || !frontend || !['http:', 'https:'].includes(frontend.protocol) ||
      frontend.username || frontend.password || !callback || callback.pathname !== '/api/canva/callback' ||
      callback.username || callback.password || callback.search || callback.hash ||
      (callback.protocol !== 'https:' &&
        (callback.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(callback.hostname)))) {
    return null;
  }
  return { clientId, clientSecret, callback, frontend };
}

function allowConnection(req: Request, callback: URL) {
  if (callback.protocol === 'https:') return true;
  return req.get('Host') === callback.host &&
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') &&
    !req.get('Forwarded') && !req.get('X-Forwarded-For');
}

function showResult(res: Response, frontend: URL, status: 'connected' | 'cancelled' | 'failed') {
  const next = new URL('/lead', frontend);
  next.searchParams.set('canva', status);
  res.redirect(303, next.href);
}

canvaOAuthRouter.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  next();
});

canvaOAuthRouter.get('/auth-url', (_req, res) => {
  const config = canvaConfig();
  if (!config) return res.status(503).json({ error: 'Revisa la configuración de Canva en el backend.' });
  res.json({ authUrl: new URL('/api/canva/connect', config.callback).href });
});

canvaOAuthRouter.get('/connect', (req, res) => {
  const config = canvaConfig();
  if (!config) return res.status(503).send('Revisa la configuración de Canva en el backend.');
  if (!allowConnection(req, config.callback)) return res.sendStatus(403);

  const now = Date.now();
  for (const [state, attempt] of pending) {
    if (attempt.expires <= now) pending.delete(state);
  }
  if (pending.size >= 128) return res.status(429).send('Espera unos minutos e intenta conectar Canva nuevamente.');

  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  pending.set(state, { verifier, redirectUri: config.callback.href, expires: now + oauthLifetime });
  res.cookie(cookieName, state, {
    httpOnly: true, secure: config.callback.protocol === 'https:', sameSite: 'lax',
    path: config.callback.pathname, maxAge: oauthLifetime,
  });

  const authorize = new URL('https://www.canva.com/api/oauth/authorize');
  authorize.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.callback.href,
    response_type: 'code', code_challenge_method: 'S256', code_challenge: challenge, scope: scopes, state,
  }).toString();
  res.redirect(authorize.href);
});

canvaOAuthRouter.get('/callback', async (req, res) => {
  const config = canvaConfig();
  if (!config) return res.status(503).send('Revisa la configuración de Canva en el backend.');
  if (!allowConnection(req, config.callback)) return res.sendStatus(403);

  const { state, code, error } = req.query;
  const browserState = req.headers.cookie?.match(/(?:^|;\s*)nexosalud_canva_state=([\w-]{43})(?:;|$)/)?.[1];
  const attempt = typeof state === 'string' && state === browserState ? pending.get(state) : undefined;
  if (!attempt || attempt.expires <= Date.now() || attempt.redirectUri !== config.callback.href) {
    return showResult(res, config.frontend, 'failed');
  }
  pending.delete(browserState!);
  res.clearCookie(cookieName, {
    httpOnly: true, secure: config.callback.protocol === 'https:', sameSite: 'lax', path: config.callback.pathname,
  });
  if (error === 'access_denied') return showResult(res, config.frontend, 'cancelled');
  if (error || typeof code !== 'string' || !code) return showResult(res, config.frontend, 'failed');

  try {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return showResult(res, config.frontend, 'failed');
    const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token || !data.refresh_token || !data.expires_in) {
      return showResult(res, config.frontend, 'failed');
    }
    await CanvaService.setTokens(data.access_token, data.refresh_token, data.expires_in);
    return showResult(res, config.frontend, 'connected');
  } catch {
    return showResult(res, config.frontend, 'failed');
  }
});
