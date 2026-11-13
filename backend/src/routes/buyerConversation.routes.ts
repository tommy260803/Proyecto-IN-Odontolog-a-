import { Router, type Request } from 'express';
import { prisma } from '../db';
import { getLeadStaffIdentity, leadStaffAuthEnabled } from '../services/leadStaffAuth';
import { BuyerChatError, BuyerConversationService } from '../services/buyerConversationService';
import { assignedBuyerRequest } from '../services/buyerChatAccess';

export function createBuyerConversationRouter(deps = {
  service: new BuyerConversationService(),
  enabled: leadStaffAuthEnabled,
  identity: (req: Request) => getLeadStaffIdentity(req, prisma),
  assigned: (personId: number, actorId: number) => assignedBuyerRequest(prisma, personId, actorId),
}) {
  const router = Router({ mergeParams: true });
  const number = (v: unknown) => typeof v === 'string' && /^[1-9]\d{0,9}$/.test(v) && Number(v) <= 2147483647 ? Number(v) : 0;
  router.use(async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      if (!deps.enabled()) return res.sendStatus(404);
      const identity = await deps.identity(req);
      if (!identity) return res.status(401).json({ error: 'Se requiere sesión vigente de personal.' });
      const personId = number(req.params.id);
      if (!personId) return res.status(400).json({ error: 'Persona inválida.' });
      if (identity.rol !== 'Administrador' && (identity.rol !== 'Negociador' || !await deps.assigned(personId, identity.id_usuario))) {
        return res.status(403).json({ error: 'No tienes acceso administrativo a esta persona.' });
      }
      res.locals.personId = personId; res.locals.actorId = identity.id_usuario;
      next();
    } catch { res.status(503).json({ error: 'No se pudo verificar la sesión.' }); }
  });
  const route = (action: (req: Request, locals: Record<string, any>) => Promise<any>) => async (req: Request, res: import('express').Response) => {
    try {
      const data = await action(req, res.locals);
      res.status(data.status && data.status !== 'COMPLETADA' ? 202 : 200).json(data);
    } catch (e) {
      if (e instanceof BuyerChatError) return res.status(e.status).json({ code: e.code, error: e.message });
      res.status(503).json({ code: 'CHAT_UNAVAILABLE', error: 'El turno no se pudo completar. Consulta el historial y reutiliza la clave.' });
    }
  };
  router.get('/', route((req, l) => {
    const after = req.query.after === undefined ? '0' : req.query.after;
    const limit = req.query.limit === undefined ? '20' : req.query.limit;
    if (typeof after !== 'string' || !/^\d+$/.test(after) || !Number.isSafeInteger(Number(after)) ||
      typeof limit !== 'string' || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 50) {
      throw new BuyerChatError(400, 'INVALID_PAGE', 'after debe ser cursor entero y limit debe estar entre 1 y 50.');
    }
    return deps.service.list(l.personId, Number(after), Number(limit));
  }));
  router.get('/:conversationId', route((req, l) => {
    const raw = req.query.after;
    if (raw !== undefined && (!/^\d+$/.test(String(raw)) || !Number.isSafeInteger(Number(raw)))) throw new BuyerChatError(400, 'INVALID_CURSOR', 'Cursor inválido.');
    return deps.service.history(l.personId, String(req.params.conversationId), Number(raw || 0));
  }));
  router.post('/messages', route((req, l) => {
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).some(k => !['conversationId','message','origin'].includes(k))) {
      throw new BuyerChatError(400, 'INVALID_BODY', 'Solo se aceptan conversationId, message y origin; el contexto se reconstruye en SQL.');
    }
    return deps.service.send(l.personId, l.actorId, req.get('Idempotency-Key') || '', {
      ...(body.conversationId !== undefined ? { conversationId: body.conversationId } : {}), message: body.message, origin: body.origin,
    });
  }));
  router.post('/:conversationId/turns/:turnId/retry', route((req, l) => {
    if (req.body && Object.keys(req.body).length) throw new BuyerChatError(400, 'INVALID_BODY', 'Retry no acepta mensaje ni contexto.');
    const turn = number(req.params.turnId);
    if (!turn) throw new BuyerChatError(400, 'INVALID_TURN', 'Turno inválido.');
    return deps.service.retry(l.personId, String(req.params.conversationId), turn);
  }));
  return router;
}
