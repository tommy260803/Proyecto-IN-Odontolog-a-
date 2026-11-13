import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '../db';
import { loadBuyerAgentRules } from './buyerAgentRulesService';

if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  if (!process.env.GEMINI_API_KEY) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  }
}

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
] as const;
const DEFAULT_TIMEOUT_MS = 15000;

export interface ChatbotMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatbotCollectedData {
  nombre?: string | null;
  telefono?: string | null;
  dni?: string | null;
  email?: string | null;
  sede_nombre?: string | null;
  servicio_nombre?: string | null;
  horario_nombre?: string | null;
  motivo_consulta?: string | null;
  autoriza_contacto?: boolean | null;
}

export interface BuyerChatbotResponse {
  reply: string;
  intent: 'ORIENTACION' | 'FAQ' | 'INTERES_CONTACTO' | 'LISTO_PARA_REGISTRO';
  extracted: ChatbotCollectedData;
  suggestedActions: string[];
  readyToRegister: boolean;
  source: 'gemini' | 'fallback';
}

interface CatalogContext {
  servicios: Array<{ id: number; nombre: string; descripcion: string }>;
  sedes: Array<{ id: number; nombre: string; direccion: string }>;
}

async function loadCatalogContext(): Promise<CatalogContext> {
  try {
    const [servicios, sedes] = await Promise.all([
      prisma.servicios.findMany({
        where: { activo: true },
        select: { id_servicio: true, nombre: true, descripcion: true },
        take: 25,
      }),
      prisma.sedes.findMany({
        where: { activo: true },
        select: { id_sede: true, nombre: true, direccion: true },
        take: 15,
      }),
    ]);

    return {
      servicios: servicios.map((s) => ({
        id: s.id_servicio,
        nombre: s.nombre,
        descripcion: s.descripcion || '',
      })),
      sedes: sedes.map((s) => ({
        id: s.id_sede,
        nombre: s.nombre,
        direccion: s.direccion || '',
      })),
    };
  } catch {
    return {
      servicios: [
        { id: 1, nombre: 'Evaluación Odontológica Integral', descripcion: 'Diagnóstico clínico completo' },
        { id: 2, nombre: 'Ortodoncia', descripcion: 'Brackets y alineadores invisibles' },
        { id: 3, nombre: 'Endodoncia', descripcion: 'Tratamiento de conductos y alivio de dolor agudo' },
        { id: 4, nombre: 'Implantes Dentales', descripcion: 'Reemplazo fijo de piezas dentales' },
        { id: 5, nombre: 'Estética Dental', descripcion: 'Carillas, blanqueamiento y diseño de sonrisa' },
        { id: 6, nombre: 'Limpieza Dental y Profilaxis', descripcion: 'Prevención e higiene bucal' },
      ],
      sedes: [
        { id: 1, nombre: 'Sede Centro', direccion: 'Trujillo Centro' },
        { id: 2, nombre: 'Sede Norte', direccion: 'Trujillo Norte' },
      ],
    };
  }
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 9) return digits.slice(-9);
  if (digits.length >= 7) return digits;
  return null;
}

function normalizeDni(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) return digits;
  return null;
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
  return null;
}

function hasValidName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && !/^\d+$/.test(trimmed);
}

function mergeCollectedData(
  prev: ChatbotCollectedData | undefined,
  next: ChatbotCollectedData | undefined
): ChatbotCollectedData {
  const merged: ChatbotCollectedData = {
    nombre: next?.nombre?.trim() || prev?.nombre?.trim() || null,
    telefono: normalizePhone(next?.telefono) || normalizePhone(prev?.telefono) || null,
    dni: normalizeDni(next?.dni) || normalizeDni(prev?.dni) || null,
    email: normalizeEmail(next?.email) || normalizeEmail(prev?.email) || null,
    sede_nombre: next?.sede_nombre?.trim() || prev?.sede_nombre?.trim() || null,
    servicio_nombre: next?.servicio_nombre?.trim() || prev?.servicio_nombre?.trim() || null,
    horario_nombre: next?.horario_nombre?.trim() || prev?.horario_nombre?.trim() || null,
    motivo_consulta: next?.motivo_consulta?.trim() || prev?.motivo_consulta?.trim() || null,
    autoriza_contacto:
      typeof next?.autoriza_contacto === 'boolean'
        ? next.autoriza_contacto
        : typeof prev?.autoriza_contacto === 'boolean'
          ? prev.autoriza_contacto
          : null,
  };
  return merged;
}

type ConversationStep =
  | 'PEDIR_NOMBRE_TELEFONO'
  | 'PEDIR_DNI_CORREO'
  | 'PEDIR_SEDE'
  | 'PEDIR_HORARIO'
  | 'PEDIR_AUTORIZACION'
  | 'LISTO_PARA_REGISTRO';

function determineNextStep(
  messages: ChatbotMessage[],
  merged: ChatbotCollectedData
): ConversationStep {
  if (!hasValidName(merged.nombre) || !normalizePhone(merged.telefono)) {
    return 'PEDIR_NOMBRE_TELEFONO';
  }

  // Revisar qué preguntas complementarias ya realizó el asistente en turnos previos
  const modelMsgs = messages.filter((m) => m.role === 'model').map((m) => m.text.toLowerCase());
  const alreadyAskedDniOrEmail =
    Boolean(merged.dni || merged.email) ||
    modelMsgs.some((t) => /\b(dni|documento|correo|email)\b/.test(t));

  if (!alreadyAskedDniOrEmail) {
    return 'PEDIR_DNI_CORREO';
  }

  const alreadyAskedSede =
    Boolean(merged.sede_nombre) ||
    modelMsgs.some((t) => /\bsede\b/.test(t));

  if (!alreadyAskedSede) {
    return 'PEDIR_SEDE';
  }

  const alreadyAskedHorario =
    Boolean(merged.horario_nombre) ||
    modelMsgs.some((t) => /\b(horario|ma[ñn]anas|tardes|noches)\b/.test(t));

  if (!alreadyAskedHorario) {
    return 'PEDIR_HORARIO';
  }

  if (merged.autoriza_contacto !== true) {
    return 'PEDIR_AUTORIZACION';
  }

  return 'LISTO_PARA_REGISTRO';
}

function sanitizeSuggestedActions(
  actions: string[],
  merged: ChatbotCollectedData,
  catalog: CatalogContext,
  nextStep: ConversationStep
): string[] {
  const sedeNames = catalog.sedes.map((s) => s.nombre.toLowerCase());
  const filtered = actions.filter((action) => {
    const low = action.toLowerCase();
    if (merged.sede_nombre) {
      if (sedeNames.some((sn) => low.includes(sn) || sn.includes(low)) || /\bsede\b/.test(low)) {
        return false;
      }
    }
    if (merged.horario_nombre) {
      if (/\b(ma[ñn]ana|tarde|noche|horario)\b/.test(low)) {
        return false;
      }
    }
    if (merged.autoriza_contacto === true && /autoriz/.test(low)) {
      return false;
    }
    return true;
  });

  if (nextStep === 'PEDIR_DNI_CORREO') {
    return ['Prefiero omitir por ahora'];
  }
  if (nextStep === 'PEDIR_SEDE') {
    return catalog.sedes.slice(0, 3).map((s) => s.nombre);
  }
  if (nextStep === 'PEDIR_HORARIO') {
    return ['En la mañana', 'En la tarde', 'En la noche'];
  }
  if (nextStep === 'PEDIR_AUTORIZACION') {
    return ['Sí, autorizo el contacto'];
  }

  return filtered.slice(0, 3);
}

function buildFallbackResponse(
  messages: ChatbotMessage[],
  prevCollected: ChatbotCollectedData | undefined,
  catalog: CatalogContext
): BuyerChatbotResponse {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.text?.trim() || '';
  const lower = lastUserMsg.toLowerCase();
  const extracted: ChatbotCollectedData = { ...(prevCollected || {}) };

  // Detectar teléfono (9 dígitos) y DNI (8 dígitos) en el último mensaje
  const phoneMatch = lastUserMsg.match(/(?:\+?51[\s-]?)?(9\d[\d\s-]{7,10})/);
  if (phoneMatch) {
    const clean = normalizePhone(phoneMatch[1]);
    if (clean) extracted.telefono = clean;
  }
  const dniMatch = lastUserMsg.match(/\b(\d{8})\b/);
  if (dniMatch && dniMatch[1] !== extracted.telefono) {
    extracted.dni = dniMatch[1];
  }
  const emailMatch = lastUserMsg.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch) {
    const cleanMail = normalizeEmail(emailMatch[0]);
    if (cleanMail) extracted.email = cleanMail;
  }

  // Detectar autorización explícita
  if (
    /\b(autorizo|acepto|s[ií],?\s*autorizo|de acuerdo|conforme|autorizaci[oó]n)\b/i.test(lower)
  ) {
    extracted.autoriza_contacto = true;
  }

  // Detectar sede del catálogo
  for (const s of catalog.sedes) {
    const sLow = s.nombre.toLowerCase();
    if (lower.includes(sLow) || lower.includes(sLow.replace('sede ', ''))) {
      extracted.sede_nombre = s.nombre;
      break;
    }
  }

  // Detectar preferencia horaria (mañana, tarde, noche)
  if (/\b(ma[ñn]ana|ma[ñn]anas)\b/i.test(lower)) {
    extracted.horario_nombre = 'Mañana';
  } else if (/\b(tarde|tardes)\b/i.test(lower)) {
    extracted.horario_nombre = 'Tarde';
  } else if (/\b(noche|noches)\b/i.test(lower)) {
    extracted.horario_nombre = 'Noche';
  }

  // Detectar posible nombre si dijo "me llamo X" o "soy X"
  const nameMatch = lastUserMsg.match(/(?:me llamo|soy|mi nombre es)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i);
  if (nameMatch?.[1]) {
    extracted.nombre = nameMatch[1].trim();
  }

  let reply = '';
  let intent: BuyerChatbotResponse['intent'] = 'ORIENTACION';
  let suggestedActions: string[] = [];

  if (/(dolor|duele|frio|frío|calor|sensibilidad|hincha|emergencia|muela)/i.test(lower)) {
    extracted.servicio_nombre =
      catalog.servicios.find((s) => /endodon|operator|evaluaci/i.test(s.nombre))?.nombre ||
      'Endodoncia / Evaluación';
    extracted.motivo_consulta = extracted.motivo_consulta || lastUserMsg;
    reply =
      'Siento mucho que estés pasando por esa molestia. El dolor o sensibilidad al frío suele estar relacionado con caries profunda o inflamación del nervio, por lo que una evaluación con posible atención en Operatoria o Endodoncia te ayudará a aliviarlo pronto. ¿Te gustaría que un asesor te contacte para orientarte y coordinar tu atención? Si es así, indícame tu nombre completo y número de celular.';
    intent = 'ORIENTACION';
    suggestedActions = ['Sí, quiero que me contacten', '¿Qué sedes tienen?'];
  } else if (/(sede|donde|dónde|ubicaci|direcci|trujillo|horario)/i.test(lower)) {
    const sedesList = catalog.sedes.map((s) => `• ${s.nombre}${s.direccion ? ` (${s.direccion})` : ''}`).join('\n');
    reply = `Contamos con las siguientes sedes para atenderte:\n${sedesList}\nAtendemos de lunes a sábado. ¿Cuál te queda más cerca o en qué tratamiento estás interesado?`;
    intent = 'FAQ';
    suggestedActions = catalog.sedes.slice(0, 3).map((s) => s.nombre);
  } else if (/(servicio|tratamiento|especialidad|ortodoncia|implante|limpieza|carilla|precio|costo|financiamiento)/i.test(lower)) {
    const svcList = catalog.servicios.slice(0, 5).map((s) => `• ${s.nombre}`).join('\n');
    reply = `En NexoSalud ofrecemos:\n${svcList}\nTambién contamos con evaluación diagnóstica y opciones de financiamiento directo en cuotas para ortodoncia e implantes. ¿Sobre cuál te gustaría recibir orientación o deseas que te contactemos?`;
    intent = 'FAQ';
    suggestedActions = ['Quiero que me contacten', ...catalog.servicios.slice(0, 2).map((s) => s.nombre)];
  } else {
    intent = 'INTERES_CONTACTO';
    extracted.motivo_consulta = extracted.motivo_consulta || lastUserMsg;
  }

  const merged = mergeCollectedData(prevCollected, extracted);
  const nextStep = determineNextStep(messages, merged);
  const ready =
    hasValidName(merged.nombre) &&
    Boolean(normalizePhone(merged.telefono)) &&
    merged.autoriza_contacto === true;

  if (!reply) {
    if (ready) {
      intent = 'LISTO_PARA_REGISTRO';
      reply = `¡Muchas gracias, ${merged.nombre}! Ya tengo tus datos y tu autorización. Estoy registrando tu solicitud para que nuestro equipo te oriente pronto.`;
    } else if (nextStep === 'PEDIR_NOMBRE_TELEFONO') {
      reply = 'Con gusto te ayudamos. ¿Me compartes tu nombre completo y tu número de celular?';
    } else if (nextStep === 'PEDIR_DNI_CORREO') {
      reply = 'Gracias. ¿Me podrías brindar también tu DNI y correo electrónico para completar tu ficha? (Si prefieres omitirlo por ahora, avísame).';
    } else if (nextStep === 'PEDIR_SEDE') {
      reply = '¿En qué sede prefieres atenderte?';
    } else if (nextStep === 'PEDIR_HORARIO') {
      reply = '¿Qué horario se te adecua mejor: en las mañanas, tardes o noches?';
    } else {
      reply = 'Por último, ¿nos autorizas a contactarte para brindarte información sobre tu consulta según la Ley N.° 29733?';
    }
  }

  return {
    reply,
    intent,
    extracted: merged,
    suggestedActions: sanitizeSuggestedActions(suggestedActions, merged, catalog, nextStep),
    readyToRegister: ready,
    source: 'fallback',
  };
}

export async function runBuyerChatbotTurn(params: {
  messages: ChatbotMessage[];
  collectedData?: ChatbotCollectedData;
}): Promise<BuyerChatbotResponse> {
  const { messages, collectedData } = params;
  const catalog = await loadCatalogContext();

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildFallbackResponse(messages, collectedData, catalog);
  }

  const client = new GoogleGenAI({ apiKey });
  const preStep = determineNextStep(messages, collectedData || {});
  const rulesConfig = await loadBuyerAgentRules();
  const activeChatbotRules = rulesConfig.chatbot.reglas.filter((r) => r.activa);

  const systemInstruction = `Eres el Asistente Virtual de Admisión y Orientación Odontológica de NexoSalud (etapa BUYER del método IMPULSE).

TONO CONFIGURADO PARA EL CHATBOT: ${rulesConfig.chatbot.tono}
BENEFICIOS GENERALES PERMITIDOS:
${rulesConfig.chatbot.beneficios_permitidos.map((b) => `- ${b}`).join('\n')}

REGLAS ESPECÍFICAS DEL CHATBOT (CONFIGURADAS EN LA APLICACIÓN):
${activeChatbotRules.map((r) => `- [${r.nombre} - ${r.tema}]: ${r.instruccion}`).join('\n')}

TU ROL Y LÍMITES ESTRICTOS:
1. Orientación empática: Si el usuario expresa síntomas (ej. "me duele una muela al tomar frío", "me sangran las encías", "quiero alinear mis dientes"), responde con calidez y empatía, explica brevemente qué especialidad podría ayudarlo (ej. Endodoncia/Operatoria para dolor al frío, Periodoncia para encías, Ortodoncia para alineación) sin emitir diagnósticos médicos definitivos.
2. FAQ inteligente: Responde dudas generales sobre las especialidades de la clínica, sedes disponibles, horarios (lunes a sábado), financiamiento directo en ortodoncia/implantes y protección de datos personales (Ley N.° 29733).
3. NO agendes citas definitivas ni cotices precios cerrados (eso corresponde a la etapa LEAD con un asesor). Tu objetivo en BUYER es orientar y capturar al prospecto interesado.
4. FLUJO ESTRICTO DE CAPTURA GRADUAL (sigue este orden cuando el usuario muestre interés en ser contactado o atenderse, pidiendo máximo 1 o 2 datos por turno):
   - Paso 1 (PEDIR_NOMBRE_TELEFONO): Pide primero el **nombre completo** y el **número de celular/WhatsApp**.
   - Paso 2 (PEDIR_DNI_CORREO): Una vez que tengas nombre y celular, pide de forma amable el **DNI** y **correo electrónico** (aclarando que si prefiere omitirlos por ahora, puede hacerlo).
   - Paso 3 (PEDIR_SEDE): Luego pregunta por la **sede de preferencia** (del catálogo real).
   - Paso 4 (PEDIR_HORARIO): Luego pregunta en qué **horario** se le adecua mejor (**mañanas, tardes o noches**; si no desea especificar, continúa igual).
   - Paso 5 (PEDIR_AUTORIZACION): SOLO cuando ya hayas consultado los pasos anteriores, pide en un mensaje breve su **autorización para contactarlo (Ley N.° 29733)**.
   IMPORTANTE: Si el usuario aún está haciendo preguntas informativas (FAQ o síntomas), respóndele primero con empatía antes de pasar al siguiente paso de captura. Cuando toque capturar datos, sigue estrictamente el paso sugerido: "${preStep}".
5. NUNCA pidas el consentimiento legal antes de haber consultado por DNI/correo, sede y horario (salvo que el usuario ya lo haya otorgado por iniciativa propia).
6. Sé breve, claro y cercano (máximo 3 líneas por respuesta). Habla en español.

CATÁLOGO REAL DE NEXOSALUD:
Servicios activos:
${JSON.stringify(catalog.servicios, null, 2)}

Sedes activas:
${JSON.stringify(catalog.sedes, null, 2)}

DATOS YA CAPTURADOS HASTA AHORA EN ESTA SESIÓN:
${JSON.stringify(collectedData || {}, null, 2)}`;

  const conversationText = messages
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'Paciente' : 'Asistente'}: ${m.text}`)
    .join('\n');

  const prompt = `Historial de conversación:\n${conversationText}\n\nGenera la siguiente respuesta del Asistente y actualiza los datos extraídos acumulativos del paciente.`;

  for (const modelName of CANDIDATE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          abortSignal: controller.signal,
          httpOptions: { timeout: DEFAULT_TIMEOUT_MS },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              intent: {
                type: Type.STRING,
                enum: ['ORIENTACION', 'FAQ', 'INTERES_CONTACTO', 'LISTO_PARA_REGISTRO'],
              },
              nombre: { type: Type.STRING, nullable: true },
              telefono: { type: Type.STRING, nullable: true },
              dni: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              sede_nombre: { type: Type.STRING, nullable: true },
              servicio_nombre: { type: Type.STRING, nullable: true },
              horario_nombre: { type: Type.STRING, nullable: true },
              motivo_consulta: { type: Type.STRING, nullable: true },
              autoriza_contacto: { type: Type.BOOLEAN, nullable: true },
              suggested_actions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              ready_to_register: { type: Type.BOOLEAN },
            },
            required: ['reply', 'intent', 'suggested_actions', 'ready_to_register'],
          },
        },
      });

      clearTimeout(timer);

      const rawText = response.text?.trim() || '{}';
      const parsed = JSON.parse(rawText) as Record<string, unknown>;

      const merged = mergeCollectedData(collectedData, {
        nombre: typeof parsed.nombre === 'string' ? parsed.nombre : null,
        telefono: typeof parsed.telefono === 'string' ? parsed.telefono : null,
        dni: typeof parsed.dni === 'string' ? parsed.dni : null,
        email: typeof parsed.email === 'string' ? parsed.email : null,
        sede_nombre: typeof parsed.sede_nombre === 'string' ? parsed.sede_nombre : null,
        servicio_nombre: typeof parsed.servicio_nombre === 'string' ? parsed.servicio_nombre : null,
        horario_nombre: typeof parsed.horario_nombre === 'string' ? parsed.horario_nombre : null,
        motivo_consulta: typeof parsed.motivo_consulta === 'string' ? parsed.motivo_consulta : null,
        autoriza_contacto:
          typeof parsed.autoriza_contacto === 'boolean' ? parsed.autoriza_contacto : null,
      });

      const nextStepAfterExtraction = determineNextStep(messages, merged);
      const isReady =
        hasValidName(merged.nombre) &&
        Boolean(normalizePhone(merged.telefono)) &&
        merged.autoriza_contacto === true;

      const rawSuggested = Array.isArray(parsed.suggested_actions)
        ? parsed.suggested_actions.filter((x): x is string => typeof x === 'string')
        : [];
      const suggestedActions = sanitizeSuggestedActions(
        rawSuggested,
        merged,
        catalog,
        nextStepAfterExtraction
      );

      const validIntents = ['ORIENTACION', 'FAQ', 'INTERES_CONTACTO', 'LISTO_PARA_REGISTRO'] as const;
      const intent = validIntents.includes(parsed.intent as any)
        ? (parsed.intent as BuyerChatbotResponse['intent'])
        : 'ORIENTACION';

      return {
        reply:
          typeof parsed.reply === 'string' && parsed.reply.trim()
            ? parsed.reply.trim()
            : 'Gracias por escribirnos. ¿En qué podemos orientarte hoy?',
        intent: isReady ? 'LISTO_PARA_REGISTRO' : intent,
        extracted: merged,
        suggestedActions: isReady ? [] : suggestedActions,
        readyToRegister: isReady,
        source: 'gemini',
      };
    } catch (err) {
      clearTimeout(timer);
      console.warn(
        `[BuyerChatbotService] Modelo ${modelName} no disponible:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return buildFallbackResponse(messages, collectedData, catalog);
}
