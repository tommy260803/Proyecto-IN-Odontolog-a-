const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS = ['groq/compound-mini', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];


export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PayerContext {
  patientName: string;
  state: string;
  amountToPay: number;
  reservationDate?: string;
  reservationTime?: string;
  branch?: string;
  professional?: string;
  channel?: string;
  operationNumber?: string;
  declaredAmount?: number;
  hasReceipt: boolean;
  incidentsCount: number;
  lastIncidentReason?: string;
}

const STATE_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de pago',
  IN_REVIEW: 'Comprobante enviado, en revisión',
  VALIDATED: 'Pago validado y aprobado',
  REJECTED: 'Pago rechazado',
  REVERTED: 'Pago revertido manualmente',
};

function buildSystemPrompt(): string {
  return `Eres el Agente de Cobranza Inteligente de NexoSalud, una clínica odontológica. 
Tu rol es asistir al operador de cobranza analizando el estado del cobro de cada paciente y brindando recomendaciones concretas, claras y profesionales.

Reglas:
- Responde siempre en español, de forma concisa (máximo 3 oraciones).
- Sé directo y orientado a la acción.
- Adapta el tono al nivel de urgencia del caso.
- Si hay incidencias previas, menciona cuántas y sugiere una acción específica.
- No uses listas ni bullets, escribe en prosa fluida.
- No saludes ni te presentes en cada respuesta.`;
}

function buildUserPrompt(ctx: PayerContext): string {
  const stateLabel = STATE_LABELS[ctx.state] || ctx.state;
  const incidents = ctx.incidentsCount > 0
    ? `Ha tenido ${ctx.incidentsCount} incidencia(s) previas${ctx.lastIncidentReason ? ` (último motivo: "${ctx.lastIncidentReason}")` : ''}.`
    : 'Sin incidencias previas.';

  const paymentInfo = ctx.channel
    ? `Canal declarado: ${ctx.channel}. Número de operación: ${ctx.operationNumber || 'no especificado'}. Monto declarado: S/ ${ctx.declaredAmount?.toFixed(2) || 'no especificado'}.`
    : 'Aún no ha registrado información de pago.';

  const receiptInfo = ctx.hasReceipt
    ? 'El paciente adjuntó un comprobante de pago.'
    : 'No adjuntó comprobante de pago.';

  return `Analiza el siguiente caso de cobranza y dame una recomendación de acción:

Paciente: ${ctx.patientName}
Estado actual: ${stateLabel}
Monto a cobrar: S/ ${ctx.amountToPay.toFixed(2)}
Cita: ${ctx.reservationDate || 'no especificada'} ${ctx.reservationTime || ''} - Sede: ${ctx.branch || 'no especificada'} - Especialista: ${ctx.professional || 'no especificado'}
${paymentInfo}
${receiptInfo}
${incidents}

¿Qué acción recomiendas tomar ahora mismo?`;
}

export async function callGroqAssistant(ctx: PayerContext): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey || apiKey === 'tu_groq_api_key_aqui') {
    throw new Error('GROQ_API_KEY no configurada. Añade tu clave en el archivo .env del proyecto.');
  }

  const messages: GroqMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(ctx) },
  ];

  let lastError = '';

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 250,
          stream: false,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        lastError = err?.error?.message || `Error ${response.status} en modelo ${model}`;
        console.warn(`[Groq AI] Falló modelo ${model}:`, lastError);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        return content;
      }
    } catch (e: any) {
      lastError = e.message || 'Error de conexión';
    }
  }

  throw new Error(lastError || 'No se pudo obtener respuesta de los modelos de Groq.');
}

