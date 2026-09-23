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

export interface AiCollectionStrategy {
  id: 'FRIENDLY' | 'URGENCY' | 'RESCUE_50';
  title: string;
  badge: string;
  description: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
}

export interface RiskAnalysis {
  score: number; // 0 to 100
  level: 'BAJO' | 'MODERADO' | 'ALTO';
  color: 'emerald' | 'amber' | 'rose';
  explanation: string;
  factors: string[];
}

export interface AiCollectionResult {
  risk: RiskAnalysis;
  internalRecommendation: string;
  selectedStrategyId: 'FRIENDLY' | 'URGENCY' | 'RESCUE_50';
  strategies: {
    friendly: AiCollectionStrategy;
    urgency: AiCollectionStrategy;
    rescue: AiCollectionStrategy;
  };
  // Retrocompatibilidad
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

/**
 * Motor Heurístico de Scoring de Riesgo de Impago (Business Intelligence)
 * Política de Cierre: 00:00 hrs del día de la cita (Cancelación y Liberación)
 */
export function calculatePayerRisk(ctx: PayerContext): RiskAnalysis {
  let score = 20; // Base risk
  const factors: string[] = [];

  if (ctx.state === 'VALIDATED') {
    return {
      score: 0,
      level: 'BAJO',
      color: 'emerald',
      explanation: 'El pago ya fue completado y conciliado exitosamente.',
      factors: ['Pago 100% aprobado y validado'],
    };
  }

  // Factor 0: Citas vencidas o pasadas de las 00:00 hrs del día de la cita
  if (ctx.reservationDate) {
    try {
      const apptDate = new Date(ctx.reservationDate);
      const appointmentDayStart = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate(), 0, 0, 0, 0);
      const now = new Date();
      const hoursUntilMidnight = (appointmentDayStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Si ya son las 00:00 hrs del día de la cita o ya pasó la fecha
      if (now >= appointmentDayStart || hoursUntilMidnight <= 0 || ctx.state === 'REJECTED' && ctx.lastIncidentReason?.includes('AUTO_CANCELACION')) {
        return {
          score: 0,
          level: 'BAJO',
          color: 'emerald',
          explanation: 'Cita vencida y cancelada automáticamente por el cron job al llegar a las 00:00 hrs. El sillón fue liberado.',
          factors: [
            'Plazo límite superado (00:00 hrs del día de la cita)',
            'Sillón clínico liberado automáticamente en sistema',
            'Sin deuda activa por cobrar'
          ],
        };
      }

      // Factor de Tiempo hasta la medianoche límite
      if (hoursUntilMidnight <= 24 && hoursUntilMidnight > 0) {
        score += 30;
        factors.push('Cita de mañana: plazo límite de abono vence hoy a las 23:59 (urgencia crítica)');
      } else if (hoursUntilMidnight <= 48 && hoursUntilMidnight > 24) {
        score += 15;
        factors.push('Cita programada en 2 días (etapa preventiva)');
      }
    } catch {
      // Ignore date parse errors
    }
  }

  // Factor 1: Incidencias previas o rechazos
  if (ctx.incidentsCount > 0) {
    score += 35;
    factors.push(`${ctx.incidentsCount} incidencia(s) previa(s) de pago rechazada(s)`);
  }

  // Factor 2: Estado del pago
  if (ctx.state === 'REJECTED') {
    score += 25;
    factors.push('Comprobante rechazado pendiente de subsanar');
  } else if (ctx.state === 'PENDING') {
    score += 15;
    factors.push('Sin registro de comprobante preliminar');
  } else if (ctx.state === 'IN_REVIEW') {
    score -= 10;
    factors.push('Comprobante ya enviado por el paciente');
  }

  // Factor 3: Monto del tratamiento (tickets altos tienen mayor riesgo de desistimiento)
  if (ctx.amountToPay >= 300) {
    score += 20;
    factors.push(`Ticket alto (S/ ${ctx.amountToPay.toFixed(2)}) con mayor elasticidad`);
  } else if (ctx.amountToPay >= 150) {
    score += 10;
    factors.push(`Ticket intermedio (S/ ${ctx.amountToPay.toFixed(2)})`);
  }

  // Normalizar score entre 5 y 98
  score = Math.max(5, Math.min(98, score));

  let level: 'BAJO' | 'MODERADO' | 'ALTO' = 'BAJO';
  let color: 'emerald' | 'amber' | 'rose' = 'emerald';
  let explanation = 'Baja probabilidad de inasistencia. Requiere confirmación de rutina.';

  if (score >= 65) {
    level = 'ALTO';
    color = 'rose';
    explanation = 'Alta probabilidad de inasistencia o fuga. Se recomienda activar estrategia de urgencia o seña fraccionada.';
  } else if (score >= 35) {
    level = 'MODERADO';
    color = 'amber';
    explanation = 'Riesgo moderado. Requiere recordatorio persuasivo antes de liberar el sillón odontológico a las 00:00.';
  }

  return {
    score,
    level,
    color,
    explanation,
    factors,
  };
}

/**
 * Generador de Estrategias Multicanal Heurísticas
 */
export function generateHeuristicStrategies(ctx: PayerContext, risk: RiskAnalysis): AiCollectionResult['strategies'] {
  const halfAmount = (ctx.amountToPay / 2).toFixed(2);
  const fullAmount = ctx.amountToPay.toFixed(2);
  const doctor = ctx.professional ? `Esp. ${ctx.professional.replace(/^(Dr\.|Dra\.|Dr\/a\.)\s*/i, '')}` : 'el especialista de turno';
  const service = ctx.serviceName || 'Atención Odontológica';
  const branch = ctx.branch || 'Sede Principal';
  const dateStr = ctx.reservationDate || 'la fecha acordada';
  const timeStr = ctx.reservationTime || 'la hora indicada';

  // 1. Friendly (Preventivo)
  const friendly: AiCollectionStrategy = {
    id: 'FRIENDLY',
    title: '1. Recordatorio Amigable (Preventivo)',
    badge: 'Tono Cordial',
    description: 'Ideal para pacientes en riesgo bajo/medio. Confirma detalles y ofrece medios de pago digitales.',
    whatsappMessage: `¡Hola ${ctx.patientName}! 👋 Te saludamos de la Clínica Odontológica NexoSalud.\n\nTe recordamos que tienes una cita programada de *${service}* con el *${doctor}* para el *${dateStr}* a las *${timeStr}* en nuestra *${branch}*.\n\nPuedes asegurar tu turno realizando tu abono de *S/ ${fullAmount}* mediante Yape, Plin o Transferencia bancaria.\n\n¿Deseas que te enviemos nuestro código QR de Yape? ¡Quedamos atentos para recibirte! 🦷✨`,
    emailSubject: `Recordatorio de Cita Odontológica y Pago - NexoSalud (${ctx.patientName})`,
    emailBody: `Estimado(a) ${ctx.patientName},\n\nEsperamos que se encuentre muy bien. Le saludamos cordialmente de la Clínica Odontológica NexoSalud.\n\nLe recordamos los detalles de su próxima atención odontológica:\n• Tratamiento: ${service}\n• Especialista: ${doctor}\n• Fecha y Hora: ${dateStr} - ${timeStr}\n• Sede: ${branch}\n• Monto por regularizar: S/ ${fullAmount}\n\nPuede realizar el abono a través de nuestros canales autorizados (Yape, Plin o Tarjeta) para garantizar la disponibilidad del sillón clínico.\n\nAtentamente,\nEquipo de Recaudación y Atención - NexoSalud`,
  };

  // 2. Urgency (Urgencia Clínica)
  const urgency: AiCollectionStrategy = {
    id: 'URGENCY',
    title: '2. Urgencia Clínica (Sillón Reservado)',
    badge: 'Escasez de Cupo',
    description: 'Enfatiza el bloqueo temporal del sillón clínico con el especialista antes de liberar el horario.',
    whatsappMessage: `Hola ${ctx.patientName} ⚠️ Te informamos que el sillón odontológico del *${doctor}* para tu cita de *${service}* (${dateStr} - ${timeStr}) se encuentra *reservado temporalmente*.\n\nPara evitar que el sistema libere automáticamente el cupo a otro paciente en lista de espera, por favor confirma tu abono de *S/ ${fullAmount}* antes de las 5:00 PM.\n\nPuedes abonar al instante por Yape o Tarjeta aquí. ¡Muchas gracias por tu comprensión! ⏱️`,
    emailSubject: `URGENTE: Confirmación Requerida para su Cita Odontológica - NexoSalud`,
    emailBody: `Estimado(a) ${ctx.patientName},\n\nLe informamos que su turno para el tratamiento de ${service} con el ${doctor} programado para el día ${dateStr} a las ${timeStr} en nuestra ${branch} se encuentra actualmente en estado de RESERVA TEMPORAL.\n\nCon el objetivo de garantizar la preparación de los materiales y no perjudicar la agenda quirúrgica/clínica, requerimos la validación de su abono de S/ ${fullAmount}.\n\nEn caso de no registrar el abono con anticipación, el sillón odontológico será puesto a disposición de otros pacientes en espera.\n\nAtentamente,\nAdministración Clínica - NexoSalud`,
  };

  // 3. Rescue (Seña Fraccionada 50%)
  const rescue: AiCollectionStrategy = {
    id: 'RESCUE_50',
    title: '3. Rescate con Facilidad (Seña 50%)',
    badge: 'Plan de Rescate',
    description: 'Reduce la fricción de pago ofreciendo congelar el cupo con solo el 50% de anticipo.',
    whatsappMessage: `Hola ${ctx.patientName} 👋 Queremos asegurarnos de que no pierdas tu atención de *${service}* con el *${doctor}*.\n\nPara brindarte mayor facilidad, puedes *congelar tu cupo hoy abonando únicamente el 50% (S/ ${halfAmount})* por Yape o Plin, y cancelas la diferencia el mismo día en clínica.\n\n¿Te gustaría que te facilitemos los datos bancarios para reservar tu turno ahora mismo? 🌟`,
    emailSubject: `Facilidad de Pago para su Cita de ${service} - NexoSalud`,
    emailBody: `Estimado(a) ${ctx.patientName},\n\nEn NexoSalud nos comprometemos con su salud dental. Entendemos que pueden presentarse imprevistos, por lo que queremos ofrecerle una alternativa flexible para mantener su cita de ${service} con el ${doctor}.\n\nPuede congelar formalmente su horario abonando hoy únicamente un anticipo del 50% (S/ ${halfAmount}), pudiendo cancelar el saldo restante el mismo día de su consulta en recepción.\n\nPor favor contáctenos a la brevedad si desea acogerse a esta modalidad.\n\nAtentamente,\nCoordinación de Pagos - NexoSalud`,
  };

  return { friendly, urgency, rescue };
}

function buildSystemPrompt(): string {
  return `Eres el Agente de Inteligencia de Negocios y Cobranzas de NexoSalud (Clínica Odontológica).
Tu objetivo es analizar la situación del paciente en etapa PAYER y generar:
1. Recomendación estratégica interna para el cajero/recepcionista.
2. 3 estrategias persuasivas personalizadas de cobranza:
   - FRIENDLY: Tono cordial y preventivo.
   - URGENCY: Tono de urgencia clínica (sillón reservado temporalmente con el especialista).
   - RESCUE_50: Tono con facilidad de seña al 50% para evitar la pérdida de la cita.

Reglas:
- Si el estado es VALIDATED, ¡el pago ya está aprobado! Felicita al paciente y confirma su cita con el Esp., NUNCA cobres.
- Siempre usa "Esp." para referirse al odontólogo/especialista.

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "internalRecommendation": "Análisis y recomendación concisa para el operador interno.",
  "strategies": {
    "friendly": {
      "whatsappMessage": "Mensaje para WhatsApp",
      "emailSubject": "Asunto de correo",
      "emailBody": "Cuerpo de correo"
    },
    "urgency": {
      "whatsappMessage": "Mensaje de urgencia para WhatsApp",
      "emailSubject": "Asunto de urgencia",
      "emailBody": "Cuerpo de urgencia"
    },
    "rescue": {
      "whatsappMessage": "Mensaje de rescate con 50% para WhatsApp",
      "emailSubject": "Asunto de rescate",
      "emailBody": "Cuerpo de rescate"
    }
  }
}`;
}

function buildUserPrompt(ctx: PayerContext, risk: RiskAnalysis): string {
  const stateLabel = STATE_LABELS[ctx.state] || ctx.state;
  const isValidated = ctx.state === 'VALIDATED';

  return `Analiza y genera comunicaciones para el siguiente paciente:
- Paciente: ${ctx.patientName}
- Teléfono: ${ctx.phone || 'No registrado'}
- Correo: ${ctx.email || 'No registrado'}
- Estado: ${stateLabel} ${isValidated ? '(PAGO APROBADO)' : ''}
- Monto Total: S/ ${ctx.amountToPay.toFixed(2)} (50% = S/ ${(ctx.amountToPay / 2).toFixed(2)})
- Servicio: ${ctx.serviceName || 'Tratamiento Dental'}
- Cita: ${ctx.reservationDate || 'Fecha próxima'} - ${ctx.reservationTime || 'Hora asignada'}
- Sede: ${ctx.branch || 'Sede Principal'}
- Especialista: Esp. ${ctx.professional?.replace(/^(Dr\.|Dra\.|Dr\/a\.)\s*/i, '') || 'de Turno'}
- Score de Riesgo Calculado: ${risk.score}% (${risk.level})
- Factores de Riesgo: ${risk.factors.join(', ') || 'Sin factores de riesgo'}

Genera el JSON con: internalRecommendation y el objeto strategies con friendly, urgency y rescue.`;
}

export async function callGroqAssistant(ctx: PayerContext): Promise<AiCollectionResult> {
  const risk = calculatePayerRisk(ctx);
  const fallbackStrategies = generateHeuristicStrategies(ctx, risk);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  let defaultRecommendation = '';
  if (ctx.state === 'VALIDATED') {
    defaultRecommendation = `El pago de S/ ${ctx.amountToPay.toFixed(2)} fue validado exitosamente. Paciente listo para transferir a CUSTOMER.`;
  } else if (risk.score === 0) {
    defaultRecommendation = `La cita se encuentra cancelada por vencimiento del plazo límite (00:00 hrs). El sillón fue liberado en la agenda clínica. No aplica cobranza ni recordatorio de pago.`;
  } else {
    defaultRecommendation = `Paciente con ${risk.level.toLowerCase()} riesgo de fuga (${risk.score}%). Se sugiere activar la estrategia de ${risk.score >= 65 ? 'Rescate 50% o Urgencia' : 'Recordatorio Preventivo'}.`;
  }

  const fallbackResult: AiCollectionResult = {
    risk,
    internalRecommendation: defaultRecommendation,
    selectedStrategyId: risk.score >= 65 ? 'RESCUE_50' : (risk.score >= 40 ? 'URGENCY' : 'FRIENDLY'),
    strategies: fallbackStrategies,
    whatsappMessage: fallbackStrategies.friendly.whatsappMessage,
    emailSubject: fallbackStrategies.friendly.emailSubject,
    emailBody: fallbackStrategies.friendly.emailBody,
  };

  if (!apiKey || apiKey === 'tu_groq_api_key_aqui') {
    return fallbackResult;
  }

  const messages: GroqMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(ctx, risk) },
  ];

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
          max_tokens: 1000,
          stream: false,
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) continue;

      const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.strategies?.friendly && parsed.strategies?.urgency) {
        return {
          risk,
          internalRecommendation: parsed.internalRecommendation || defaultRecommendation,
          selectedStrategyId: risk.score >= 65 ? 'RESCUE_50' : (risk.score >= 40 ? 'URGENCY' : 'FRIENDLY'),
          strategies: {
            friendly: {
              ...fallbackStrategies.friendly,
              whatsappMessage: parsed.strategies.friendly.whatsappMessage || fallbackStrategies.friendly.whatsappMessage,
              emailSubject: parsed.strategies.friendly.emailSubject || fallbackStrategies.friendly.emailSubject,
              emailBody: parsed.strategies.friendly.emailBody || fallbackStrategies.friendly.emailBody,
            },
            urgency: {
              ...fallbackStrategies.urgency,
              whatsappMessage: parsed.strategies.urgency.whatsappMessage || fallbackStrategies.urgency.whatsappMessage,
              emailSubject: parsed.strategies.urgency.emailSubject || fallbackStrategies.urgency.emailSubject,
              emailBody: parsed.strategies.urgency.emailBody || fallbackStrategies.urgency.emailBody,
            },
            rescue: {
              ...fallbackStrategies.rescue,
              whatsappMessage: parsed.strategies.rescue?.whatsappMessage || fallbackStrategies.rescue.whatsappMessage,
              emailSubject: parsed.strategies.rescue?.emailSubject || fallbackStrategies.rescue.emailSubject,
              emailBody: parsed.strategies.rescue?.emailBody || fallbackStrategies.rescue.emailBody,
            },
          },
          whatsappMessage: parsed.strategies.friendly.whatsappMessage || fallbackStrategies.friendly.whatsappMessage,
          emailSubject: parsed.strategies.friendly.emailSubject || fallbackStrategies.friendly.emailSubject,
          emailBody: parsed.strategies.friendly.emailBody || fallbackStrategies.friendly.emailBody,
        };
      }
    } catch {
      // Try next model or fallback
    }
  }

  return fallbackResult;
}
