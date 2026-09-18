const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS = ['groq/compound-mini', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PayerContext {
  patientName: string;
  phone?: string;
  email?: string;
  state: string;
  amountToPay: number;
  serviceName?: string;
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

export interface AiCollectionResult {
  internalRecommendation: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
}

const STATE_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de pago (No ha registrado abono)',
  IN_REVIEW: 'Comprobante enviado (En revisión administrativa)',
  VALIDATED: 'Pago validado y aprobado',
  REJECTED: 'Pago rechazado por inconsistencia',
  REVERTED: 'Pago revertido manualmente',
};

function buildSystemPrompt(): string {
  return `Eres el Agente Inteligente de Cobranzas y Comunicaciones de NexoSalud (Clínica Odontológica).
Tu objetivo es doble:
1. Asistir al operador interno con una recomendación estratégica de cobranza.
2. Redactar los mensajes de notificación al paciente (WhatsApp y Correo) con un tono profesional, empático, claro y persuasivo.

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (sin bloques markdown adicionales ni texto fuera del JSON):
{
  "internalRecommendation": "Análisis y recomendación concisa para el operador interno (máximo 2 oraciones).",
  "whatsappMessage": "Mensaje personalizado y persuasivo para enviar por WhatsApp al paciente, incluyendo saludo con su nombre, recordatorio de su cita/tratamiento, monto a abonar y canales disponibles (Yape/Tarjeta).",
  "emailSubject": "Asunto claro y formal para el correo electrónico.",
  "emailBody": "Cuerpo del correo formal y detallado con la información del servicio, monto, fecha/hora y llamada a la acción para regularizar el pago."
}`;
}

function buildUserPrompt(ctx: PayerContext): string {
  const stateLabel = STATE_LABELS[ctx.state] || ctx.state;
  const incidents = ctx.incidentsCount > 0
    ? `Incidencias previas: ${ctx.incidentsCount} (${ctx.lastIncidentReason || 'Rechazo previo'}).`
    : 'Sin incidencias.';

  return `Genera las comunicaciones de cobranza para el siguiente paciente:
- Paciente: ${ctx.patientName}
- Teléfono: ${ctx.phone || 'No registrado'}
- Correo: ${ctx.email || 'No registrado'}
- Estado actual: ${stateLabel}
- Monto a abonar: S/ ${ctx.amountToPay.toFixed(2)}
- Servicio / Tratamiento: ${ctx.serviceName || 'Consulta Odontológica'}
- Cita: ${ctx.reservationDate || 'Por coordinar'} a las ${ctx.reservationTime || 'hora acordada'}
- Sede: ${ctx.branch || 'Sede Principal'}
- Especialista: Dr/a. ${ctx.professional || 'Especialista de Turno'}
- ${incidents}

Genera el JSON con: internalRecommendation, whatsappMessage, emailSubject, emailBody.`;
}

function parseAiResponse(raw: string, ctx: PayerContext): AiCollectionResult {
  try {
    const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (parsed.internalRecommendation && parsed.whatsappMessage) {
      return {
        internalRecommendation: parsed.internalRecommendation,
        whatsappMessage: parsed.whatsappMessage,
        emailSubject: parsed.emailSubject || `Recordatorio de Pago de Cita Odontológica - NexoSalud`,
        emailBody: parsed.emailBody || parsed.whatsappMessage,
      };
    }
  } catch {
    // Si falla el parseo estricto de JSON, retornar fallback con datos del paciente
  }

  return {
    internalRecommendation: raw.length > 200 ? raw.substring(0, 200) + '...' : raw,
    whatsappMessage: `Hola ${ctx.patientName}, te saludamos de la Clínica Odontológica NexoSalud. Te recordamos que tienes una cita programada para el ${ctx.reservationDate || 'próximo turno'} (${ctx.serviceName || 'Tratamiento Odontológico'}). Para confirmar tu atención, puedes abonar los S/ ${ctx.amountToPay.toFixed(2)} pendientes mediante Yape o Tarjeta. ¡Quedamos atentos!`,
    emailSubject: `Recordatorio de Pago - Cita Odontológica NexoSalud`,
    emailBody: `Estimado(a) ${ctx.patientName},\n\nLe saludamos cordialmente de la Clínica Odontológica NexoSalud.\n\nNos comunicamos para recordarle que mantiene un saldo pendiente de S/ ${ctx.amountToPay.toFixed(2)} correspondiente a su cita de ${ctx.serviceName || 'Tratamiento Odontológico'} programada para el día ${ctx.reservationDate || 'próximamente'} en nuestra ${ctx.branch || 'Sede'}.\n\nPuede realizar el pago mediante nuestra pasarela en línea con Yape o Tarjeta de Débito/Crédito.\n\nAtentamente,\nEquipo de Recaudación - NexoSalud`,
  };
}

export async function callGroqAssistant(ctx: PayerContext): Promise<AiCollectionResult> {
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
          temperature: 0.4,
          max_tokens: 600,
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
        return parseAiResponse(content, ctx);
      }
    } catch (e: any) {
      lastError = e.message || 'Error de conexión';
    }
  }

  throw new Error(lastError || 'No se pudo obtener respuesta de los modelos de Groq.');
}
