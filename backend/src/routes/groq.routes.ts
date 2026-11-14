import { Router, Request, Response } from 'express';

const router = Router();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'groq/compound-mini',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b'
];

/**
 * GET /api/groq/status
 * Verifica de forma segura si la clave de Groq está configurada en el backend
 * SIN exponer la clave al navegador.
 */
router.get('/status', (req: Request, res: Response) => {
  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey !== 'tu_groq_api_key_aqui' && apiKey.trim().length > 10);
  
  res.json({
    configured: isConfigured,
    modelCount: DEFAULT_MODELS.length,
    defaultModels: DEFAULT_MODELS,
    secureProxy: true,
  });
});

/**
 * POST /api/groq/chat
 * Proxy seguro para inferencia con Groq.
 * Mantiene la GROQ_API_KEY estrictamente en el servidor backend.
 */
router.post('/chat', async (req: Request, res: Response) => {
  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

  if (!apiKey || apiKey === 'tu_groq_api_key_aqui' || apiKey.trim().length < 10) {
    return res.status(503).json({
      error: 'GROQ_API_KEY no configurada o inválida en backend/.env',
      configured: false
    });
  }

  const {
    model,
    models,
    messages,
    temperature = 0.4,
    max_tokens = 1000,
    stream = false,
    response_format
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'El campo "messages" es requerido y debe ser un arreglo de mensajes válido.'
    });
  }

  const candidateModels: string[] = Array.isArray(models) && models.length > 0
    ? models
    : (model ? [model] : DEFAULT_MODELS);

  let lastError: string = 'No se pudo contactar con los modelos de Groq';

  for (const candidate of candidateModels) {
    try {
      const payload: any = {
        model: candidate,
        messages,
        temperature,
        max_tokens,
        stream
      };

      if (response_format) {
        payload.response_format = response_format;
      }

      const groqResponse = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!groqResponse.ok) {
        const errorBody = await groqResponse.text().catch(() => '');
        lastError = `Modelo ${candidate} HTTP ${groqResponse.status}: ${errorBody}`;
        continue;
      }

      const data = await groqResponse.json();
      return res.json(data);
    } catch (err: any) {
      lastError = err.message || 'Error de red con Groq API';
    }
  }

  return res.status(502).json({
    error: 'Error al comunicarse con la API de Groq',
    details: lastError
  });
});

export default router;
