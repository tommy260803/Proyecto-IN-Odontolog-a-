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
1. Asistir al operador interno con una recomendación estratégica según el estado del paciente.
2. Redactar los mensajes de notificación al paciente (WhatsApp y Correo).

Reglas de Negocio según el Estado:
- Si el estado es PENDING, REJECTED o REVERTED: Redacta recordatorios persuasivos y claros de cobro para regularizar el abono pendiente antes de la cita (indicando Yape y Tarjeta).
- Si el estado es IN_REVIEW: Sugiere al operador verificar el comprobante adjunto y conciliar con el banco.
- Si el estado es VALIDATED: ¡El pago ya fue aprobado! Tu recomendación interna debe ser indicar que el paciente está listo para ser pasado a CUSTOMER. Los mensajes de WhatsApp y Correo deben ser de CONFIRMACIÓN DE CITA Y PAGO RECIBIDO (agradecimiento y confirmación de turno), NUNCA de cobro de deuda.

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (sin bloques markdown adicionales ni texto fuera del JSON):
{
  "internalRecommendation": "Análisis y recomendación concisa para el operador interno (máximo 2 oraciones).",
  "whatsappMessage": "Mensaje personalizado para WhatsApp (de cobro persuasivo si está pendiente/rechazado, o de confirmación alegre si está validado).",
  "emailSubject": "Asunto claro y formal para el correo electrónico.",
  "emailBody": "Cuerpo del correo formal y detallado con la información correspondiente al estado del paciente."
}`;
}

function buildUserPrompt(ctx: PayerContext): string {
  const stateLabel = STATE_LABELS[ctx.state] || ctx.state;
  const isValidated = ctx.state === 'VALIDATED';
  const incidents = ctx.incidentsCount > 0
    ? `Incidencias previas: ${ctx.incidentsCount} (${ctx.lastIncidentReason || 'Rechazo previo'}).`
    : 'Sin incidencias.';

  return `Genera las comunicaciones para el siguiente paciente:
- Paciente: ${ctx.patientName}
- Teléfono: ${ctx.phone || 'No registrado'}
- Correo: ${ctx.email || 'No registrado'}
- Estado actual del Pago: ${stateLabel} ${isValidated ? '(YA PAGADO Y APROBADO)' : ''}
- Monto: S/ ${ctx.amountToPay.toFixed(2)}
- Servicio / Tratamiento: ${ctx.serviceName || 'Consulta Odontológica'}
- Cita: ${ctx.reservationDate || 'Por coordinar'} a las ${ctx.reservationTime || 'hora acordada'}
- Sede: ${ctx.branch || 'Sede Principal'}
- Especialista: Dr/a. ${ctx.professional || 'Especialista de Turno'}
- ${incidents}

${isValidated ? 'IMPORTANTE: El paciente YA PAGÓ. Genera un mensaje de CONFIRMACIÓN DE CITA y agradecimiento, NO le cobres.' : ''}

Genera el JSON con: internalRecommendation, whatsappMessage, emailSubject, emailBody.`;
}

function parseAiResponse(raw: string, ctx: PayerContext): AiCollectionResult {
  const isValidated = ctx.state === 'VALIDATED';

  try {
    const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (parsed.internalRecommendation && parsed.whatsappMessage) {
      return {
        internalRecommendation: parsed.internalRecommendation,
        whatsappMessage: parsed.whatsappMessage,
        emailSubject: parsed.emailSubject || (isValidated ? `Confirmación de Pago y Cita Odontológica - NexoSalud` : `Recordatorio de Pago de Cita Odontológica - NexoSalud`),
        emailBody: parsed.emailBody || parsed.whatsappMessage,
      };
    }
  } catch (e) {
    // Si falla el parseo estricto de JSON, extraer por fallback
  }

  if (isValidated) {
    return {
      internalRecommendation: `El pago de S/ ${ctx.amountToPay.toFixed(2)} ha sido validado y aprobado exitosamente. El paciente está listo para ser transferido a la etapa CUSTOMER para su atención médica.`,
      whatsappMessage: `¡Hola ${ctx.patientName}! Te confirmamos que tu pago de S/ ${ctx.amountToPay.toFixed(2)} para tu cita del ${ctx.reservationDate || 'próximo turno'} (${ctx.serviceName || 'Atención Odontológica'}) ha sido validado con éxito. ¡Te esperamos en NexoSalud!`,
      emailSubject: `Confirmación de Pago y Cita Odontológica - NexoSalud`,
      emailBody: `Estimado(a) ${ctx.patientName},\n\nLe confirmamos que hemos recibido y validado exitosamente su pago de S/ ${ctx.amountToPay.toFixed(2)} correspondiente a su cita de ${ctx.serviceName || 'Tratamiento Odontológico'}.\n\nSu atención médica está 100% confirmada para el día ${ctx.reservationDate || 'programado'} en nuestra ${ctx.branch || 'Sede Principal'}.\n\n¡Muchas gracias por su confianza!\n\nAtentamente,\nClínica Odontológica NexoSalud`,
    };
  }

  // Fallback estructurado para pagos pendientes
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
