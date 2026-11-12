import crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../db';
import { classifyBuyerMessage } from './buyerMessageClassifier';
import { registerLeadIntake } from './leadIntake';
import type {
  ServiceCatalogItem,
  BuyerClassificationResult,
  BuyerClassifierOptions,
  BuyerEvaluationOutcome,
  BuyerIntention,
  BuyerEvaluationStatus,
  BuyerEvaluationAction,
  BuyerClarificationContext,
} from '../types/buyer';

/**
 * Consulta el catálogo de servicios clínicos activos en la base de datos OLTP.
 */
export async function getActiveServices(
  db: PrismaClient | Prisma.TransactionClient = defaultPrisma
): Promise<ServiceCatalogItem[]> {
  const services = await db.servicios.findMany({
    where: { activo: true },
    select: {
      id_servicio: true,
      nombre: true,
      descripcion: true,
    },
    orderBy: { id_servicio: 'asc' },
  });

  return services.map(s => ({
    id_servicio: s.id_servicio,
    nombre: s.nombre,
    descripcion: s.descripcion,
  }));
}

/**
 * Genera una aclaración automática contextual y desprovista de promesas o
 * compromisos horarios fijos no acreditados.
 */
export function generateAutomaticClarification(
  mensaje: string,
  catalog: ServiceCatalogItem[]
): string {
  const lower = mensaje.toLowerCase();

  if (
    lower.includes('precio') ||
    lower.includes('costo') ||
    lower.includes('tarifa') ||
    lower.includes('cuanto') ||
    lower.includes('cuánto')
  ) {
    const serviceNames = catalog.slice(0, 5).map(s => s.nombre).join(', ');
    return `Con gusto te compartimos nuestra información de precios. Para darte el valor exacto, ¿en qué tratamiento estás interesado? Contamos con: ${serviceNames}.`;
  }

  if (
    lower.includes('horario') ||
    lower.includes('atencion') ||
    lower.includes('atención') ||
    lower.includes('abierto')
  ) {
    return 'Nuestras sedes atienden en turnos de mañana y tarde según disponibilidad de cada sede. ¿Te gustaría consultar por una sede en particular o coordinar una cita de evaluación?';
  }

  if (
    lower.includes('dolor') ||
    lower.includes('molestia') ||
    lower.includes('urgencia') ||
    lower.includes('emergencia')
  ) {
    return 'Lamentamos la molestia que sientes. Te recomendamos una Evaluación Odontológica para que un especialista pueda revisar tu caso. ¿Deseas que coordinemos una cita de evaluación?';
  }

  return 'Gracias por escribir a NexoSalud. ¿Deseas solicitar una cita de reserva para algún tratamiento específico o necesitas consultar información sobre nuestros servicios odontológicos?';
}

/**
 * Resuelve una solicitud mencionada explícitamente en el texto del contacto
 * y comprueba estrictamente su existencia y pertenencia en SQL.
 * Una referencia dudosa (que no existe, fuera de rango o pertenece a otra persona)
 * o no explícita debe quedar pendiente. Evita seleccionar simplemente la última solicitud abierta.
 */
export async function resolveExplicitSolicitud(
  texto: string,
  id_persona: number,
  db: PrismaClient | Prisma.TransactionClient
): Promise<{ resolved: boolean; id_solicitud: number | null; motivoDuda?: string }> {
  // Regex para encontrar menciones numéricas explícitas: #123, solicitud 123, OP-123, ref 123
  const regex = /(?:#|solicitud\s*(?:#|n[úu]m(?:ero)?\s*)?|op-?\s*|ref(?:erencia)?\s*:?\s*#?)\s*(\d{1,10})\b/i;
  const match = texto.match(regex);

  if (!match) {
    return {
      resolved: false,
      id_solicitud: null,
      motivoDuda: 'Sin identificador numérico explícito de solicitud (referencia no comprobable)',
    };
  }

  const candidateId = parseInt(match[1], 10);
  if (isNaN(candidateId) || candidateId <= 0 || candidateId > 2_147_483_647) {
    return {
      resolved: false,
      id_solicitud: null,
      motivoDuda: `Identificador numérico inválido o fuera de rango: ${match[1]}`,
    };
  }

  // Comprobar existencia y pertenencia en dbo.Solicitudes
  const solicitudes = await (db as any).$queryRaw<{ id_solicitud: number; id_persona: number; estado: string }[]>`
    SELECT id_solicitud, id_persona, estado
    FROM dbo.Solicitudes
    WHERE id_solicitud = ${candidateId}
  `;

  if (!solicitudes || solicitudes.length === 0) {
    return {
      resolved: false,
      id_solicitud: null,
      motivoDuda: `Solicitud #${candidateId} no encontrada en la base de datos (referencia dudosa)`,
    };
  }

  const solicitud = solicitudes[0];
  if (solicitud.id_persona !== id_persona) {
    return {
      resolved: false,
      id_solicitud: null,
      motivoDuda: `Solicitud #${candidateId} pertenece a otra persona (${solicitud.id_persona} != ${id_persona})`,
    };
  }

  return { resolved: true, id_solicitud: solicitud.id_solicitud };
}

/**
 * Evalúa si un mensaje de un contacto en etapa avanzada (LEAD/PAYER) posee
 * evidencia contextual suficiente para asociarlo a una oportunidad abierta previa.
 */
export function hasContextualEvidenceForOpportunity(
  mensaje: string,
  motivoConsulta?: string | null
): boolean {
  const text = `${mensaje} ${motivoConsulta || ''}`.toLowerCase();
  const hasExplicitCode = /#\d+|op-\d+|solicitud\s*#?\d+|caso\s*#?\d+/i.test(text);
  const hasFollowUpTerms =
    /(mi\s+cotizaci[oó]n|mi\s+presupuesto|mi\s+propuesta|seguimiento|el\s+doctor\s+que\s+me\s+atendi[oó]|la\s+cita\s+que\s+tengo|mi\s+turno\s+pendiente)/i.test(
      text
    );
  return hasExplicitCode || hasFollowUpTerms;
}

export interface EvaluateBuyerInteractionInput {
  id_persona: number;
  id_captacion: number;
  id_interaccion: number;
  mensaje: string;
  id_servicio_declarado?: number | null;
  motivo_consulta?: string | null;
  sede_preferida?: string | null;
  pref_id_horario?: string | number | null;
  contextoConversacional?: BuyerClarificationContext;
  dbClient?: PrismaClient | Prisma.TransactionClient;
  classifierOverride?: (
    mensaje: string,
    catalogo: ServiceCatalogItem[]
  ) => Promise<BuyerClassificationResult>;
  classifierOptions?: BuyerClassifierOptions;
}

export interface HorarioCatalogItem {
  id_horario: number;
  hora_inicio?: any;
  hora_fin?: any;
  dia_semana?: number;
  nombre?: string;
}

export interface ScheduleDiscrepancy {
  detectada: boolean;
  mensajeIndica?: string;
  preferenciaRegistrada?: string;
  detalle?: string;
}

export type ShiftTurno = 'Mañana' | 'Tarde' | 'Noche';

function extractHour(val: any): number | null {
  if (val == null) return null;
  if (val instanceof Date) {
    const iso = val.toISOString();
    const m = iso.match(/T(\d{2}):/);
    if (m) return parseInt(m[1], 10);
    return val.getUTCHours();
  }
  if (typeof val === 'string') {
    const m = val.match(/(?:T|\b)(\d{2}):(\d{2})/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

export function resolveShiftFromPreference(
  prefHorario?: string | number | null,
  catalogHorarios?: HorarioCatalogItem[]
): { turno: ShiftTurno; label: string } | null {
  if (prefHorario === undefined || prefHorario === null || prefHorario === '') {
    return null;
  }

  const str = String(prefHorario).trim();

  if (catalogHorarios && catalogHorarios.length > 0) {
    const item = catalogHorarios.find(h => String(h.id_horario) === str);
    if (item) {
      const hour = extractHour(item.hora_inicio);
      if (hour !== null) {
        if (hour >= 6 && hour < 13) {
          return { turno: 'Mañana', label: item.nombre || 'Mañana (08:00 - 13:00)' };
        }
        if (hour >= 13 && hour < 18) {
          return { turno: 'Tarde', label: item.nombre || 'Tarde (13:00 - 18:00)' };
        }
        return { turno: 'Noche', label: item.nombre || 'Noche (18:00 - 21:00)' };
      }
      if (item.nombre) {
        if (/mañana/i.test(item.nombre)) return { turno: 'Mañana', label: item.nombre };
        if (/tarde/i.test(item.nombre)) return { turno: 'Tarde', label: item.nombre };
        if (/noche/i.test(item.nombre)) return { turno: 'Noche', label: item.nombre };
      }
    }
    // Si se proporciona catálogo de horarios y el ID no existe en él, se resuelve como desconocido.
    // Se elimina el fallback numérico 1/2/3 para IDs ausentes.
    return null;
  }

  // Si no se proporcionó catálogo de horarios (o está vacío),
  // solo resolver si la cadena textual contiene explícitamente el nombre del turno.
  // Eliminado el fallback numérico '1' / '2' / '3'.
  if (/mañana/i.test(str)) {
    return { turno: 'Mañana', label: 'Mañana (08:00 - 13:00)' };
  }
  if (/tarde/i.test(str)) {
    return { turno: 'Tarde', label: 'Tarde (13:00 - 18:00)' };
  }
  if (/noche/i.test(str)) {
    return { turno: 'Noche', label: 'Noche (18:00 - 21:00)' };
  }

  return null;
}

interface ShiftMention {
  turno: ShiftTurno;
  negated: boolean;
  affirmed: boolean;
  rawText: string;
}

/**
 * Detecta discrepancias explícitas entre el mensaje del paciente y las preferencias de horario registradas.
 * - Distingue "mañana" como fecha (tomorrow) de "por la mañana" como turno.
 * - Respeta negaciones y alternativas ("no puedo por la tarde; prefiero por la mañana").
 * - Si el mensaje acepta mañana O tarde y el formulario indica tarde (o mañana), no declara conflicto.
 * - Detecta conflictos en ambos sentidos entre mañana, tarde y noche (los 6 pares).
 * - Utiliza los horarios reales del catálogo (Horarios) sin asumir IDs 1/2/3.
 * - Un ID ausente del catálogo se resuelve como desconocido sin declarar discrepancia errónea.
 * - Si no puede resolverse un turno con certeza, no inventa una contradicción inexistente.
 */
export function detectScheduleDiscrepancy(
  mensaje: string,
  prefHorario?: string | number | null,
  catalogHorarios?: HorarioCatalogItem[]
): ScheduleDiscrepancy {
  if (!mensaje || prefHorario === undefined || prefHorario === null || prefHorario === '') {
    return { detectada: false };
  }

  const resolvedPref = resolveShiftFromPreference(prefHorario, catalogHorarios);
  if (!resolvedPref) {
    return { detectada: false };
  }

  let text = mensaje.toLowerCase();

  // 1. Limpieza de saludos, despedidas y expresiones temporales no vinculadas a turnos
  text = text.replace(/\b(hasta\s+mañana|hasta\s+manana|nos\s+vemos\s+mañana|nos\s+vemos\s+manana)\b/gi, ' [farewell] ');
  text = text.replace(/\b(más\s+tarde|mas\s+tarde|hasta\s+la\s+tarde|hasta\s+más\s+tarde|hasta\s+mas\s+tarde)\b/gi, ' [postpone] ');
  text = text.replace(/\b(buenas\s+tardes|buenos\s+días|buenos\s+dias|buenas\s+noches)\b/gi, ' [greeting] ');

  // 2. Detección de expresiones de flexibilidad total
  if (/\b(?:cualquier\s+(?:turno|horario)|cualquiera\s+de\s+los\s+(?:dos\s+)?turnos|en\s+cualquier\s+momento|me\s+da\s+igual|sin\s+preferencia\s+de\s+turno)\b/i.test(text)) {
    return { detectada: false };
  }

  // 3. Detección de alternativas / disyunciones explícitas (e.g. "mañana o tarde", "por la mañana o por la tarde")
  const isMananaOrTarde = /(?:(?:por\s+la\s+|en\s+la\s+|de\s+)?mañana|matutin[oa])\s*(?:,|\/|\s+o\s+|\s+u\s+|\s+o\s+bien\s+)\s*(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?tarde|vespertin[oa])/i.exec(text)
    || /(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?tarde|vespertin[oa])\s*(?:,|\/|\s+o\s+|\s+u\s+|\s+o\s+bien\s+)\s*(?:(?:por\s+la\s+|en\s+la\s+|de\s+)?mañana|matutin[oa])/i.exec(text);

  if (isMananaOrTarde) {
    const idx = isMananaOrTarde.index;
    const windowBefore = text.substring(Math.max(0, idx - 40), idx);
    const isNegated = /\b(?:no\s+puedo|no\s+podr[ií]a|no\s+tengo\s+tiempo|no\s+dispongo|imposible|dif[ií]cil|complicado|no)\b/i.test(windowBefore);

    if (!isNegated) {
      if (resolvedPref.turno === 'Mañana' || resolvedPref.turno === 'Tarde') {
        return { detectada: false };
      } else {
        return {
          detectada: true,
          mensajeIndica: 'Mañana o Tarde',
          preferenciaRegistrada: resolvedPref.label,
          detalle: `Discrepancia explícita: el mensaje indica disponibilidad por la mañana o tarde, mientras que la preferencia registrada en el formulario es ${resolvedPref.label}. Se debe solicitar aclaración al paciente conservando ambos datos.`,
        };
      }
    }
  }

  const isTardeOrNoche = /(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?tarde|vespertin[oa])\s*(?:,|\/|\s+o\s+|\s+u\s+|\s+o\s+bien\s+)\s*(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?noche|nocturn[oa])/i.exec(text)
    || /(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?noche|nocturn[oa])\s*(?:,|\/|\s+o\s+|\s+u\s+|\s+o\s+bien\s+)\s*(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?tarde|vespertin[oa])/i.exec(text);

  if (isTardeOrNoche) {
    const idx = isTardeOrNoche.index;
    const windowBefore = text.substring(Math.max(0, idx - 40), idx);
    const isNegated = /\b(?:no\s+puedo|no\s+podr[ií]a|no\s+tengo\s+tiempo|no\s+dispongo|imposible|dif[ií]cil|complicado|no)\b/i.test(windowBefore);

    if (!isNegated) {
      if (resolvedPref.turno === 'Tarde' || resolvedPref.turno === 'Noche') {
        return { detectada: false };
      } else {
        return {
          detectada: true,
          mensajeIndica: 'Tarde o Noche',
          preferenciaRegistrada: resolvedPref.label,
          detalle: `Discrepancia explícita: el mensaje indica disponibilidad por la tarde o noche, mientras que la preferencia registrada en el formulario es ${resolvedPref.label}. Se debe solicitar aclaración al paciente conservando ambos datos.`,
        };
      }
    }
  }

  const isMananaOrNoche = /(?:(?:por\s+la\s+|en\s+la\s+|de\s+)?mañana|matutin[oa])\s*(?:,|\/|\s+o\s+|\s+u\s+|\s+o\s+bien\s+)\s*(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?noche|nocturn[oa])/i.exec(text)
    || /(?:(?:por\s+la\s+|en\s+la\s+|de\s+|a\s+la\s+)?noche|nocturn[oa])\s*(?:,|\/|\s+o\s+|\s+u\s+|\s+o\s+bien\s+)\s*(?:(?:por\s+la\s+|en\s+la\s+|de\s+)?mañana|matutin[oa])/i.exec(text);

  if (isMananaOrNoche) {
    const idx = isMananaOrNoche.index;
    const windowBefore = text.substring(Math.max(0, idx - 40), idx);
    const isNegated = /\b(?:no\s+puedo|no\s+podr[ií]a|no\s+tengo\s+tiempo|no\s+dispongo|imposible|dif[ií]cil|complicado|no)\b/i.test(windowBefore);

    if (!isNegated) {
      if (resolvedPref.turno === 'Mañana' || resolvedPref.turno === 'Noche') {
        return { detectada: false };
      } else {
        return {
          detectada: true,
          mensajeIndica: 'Mañana o Noche',
          preferenciaRegistrada: resolvedPref.label,
          detalle: `Discrepancia explícita: el mensaje indica disponibilidad por la mañana o noche, mientras que la preferencia registrada en el formulario es ${resolvedPref.label}. Se debe solicitar aclaración al paciente conservando ambos datos.`,
        };
      }
    }
  }

  // 4. Extraer menciones individuales de turnos con sus contextos
  const shiftRegexes: { turno: ShiftTurno; regex: RegExp }[] = [
    {
      turno: 'Mañana',
      regex: /\b(?:por\s+la\s+mañana|por\s+las\s+mañanas|en\s+la\s+mañana|en\s+las\s+mañanas|de\s+mañana|turno\s+(?:de\s+la\s+|en\s+la\s+)?mañana|horario\s+(?:de\s+la\s+|en\s+la\s+)?mañana|mañana\s+temprano|temprano\s+en\s+la\s+mañana|matutino|matutina)\b/gi,
    },
    {
      turno: 'Tarde',
      regex: /\b(?:por\s+la\s+tarde|por\s+las\s+tardes|en\s+la\s+tarde|en\s+las\s+tardes|de\s+tarde|a\s+la\s+tarde|turno\s+(?:de\s+la\s+|en\s+la\s+)?tarde|horario\s+(?:de\s+la\s+|en\s+la\s+)?tarde|vespertino|vespertina)\b/gi,
    },
    {
      turno: 'Noche',
      regex: /\b(?:por\s+la\s+noche|por\s+las\s+noches|en\s+la\s+noche|en\s+las\s+noches|de\s+noche|a\s+la\s+noche|turno\s+(?:de\s+la\s+|en\s+la\s+)?noche|horario\s+(?:de\s+la\s+|en\s+la\s+)?noche|nocturno|nocturna)\b/gi,
    },
  ];

  const mentions: ShiftMention[] = [];

  for (const { turno, regex } of shiftRegexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const idx = match.index;
      const matchLen = match[0].length;

      const prevWindow = text.substring(Math.max(0, idx - 50), idx);
      const nextWindow = text.substring(idx + matchLen, Math.min(text.length, idx + matchLen + 35));

      const isNegatedBefore = /\b(?:no\s+puedo|no\s+podr[ií]a|no\s+tengo\s+tiempo|no\s+dispongo|no\s+me\s+queda|no\s+me\s+sirve|no\s+quiero|no\s+alcanzo|no\s+estoy|imposible|se\s+me\s+complica|se\s+complica|dif[ií]cil|dificil|complicado|no)\b\s*[^.,;!?]*$/i.test(prevWindow);
      const isNegatedAfter = /^\s*\b(?:no\s+puedo|no\s+podr[ií]a|no\s+tengo\s+tiempo|no\s+dispongo|imposible|no\s+me\s+sirve|no\s+me\s+queda|se\s+me\s+complica|no\s+me\s+conviene|no)\b/i.test(nextWindow);

      const isAffirmed = /\b(?:prefiero|preferir[ií]a|mejor|quisiera|deseo|solicito|me\s+conviene|me\s+queda\s+bien|por\s+favor|favor)\b\s*[^.,;!?]*$/i.test(prevWindow);

      mentions.push({
        turno,
        negated: isNegatedBefore || isNegatedAfter,
        affirmed: isAffirmed,
        rawText: match[0],
      });
    }
  }

  // Si no se detectó ninguna mención explícita de turno, no inferir discrepancia
  if (mentions.length === 0) {
    return { detectada: false };
  }

  // Determinar turnos no negados
  const nonNegated = mentions.filter(m => !m.negated);
  const affirmedMention = mentions.find(m => m.affirmed && !m.negated);

  // Si hay una mención afirmativa inequívoca
  if (affirmedMention) {
    if (affirmedMention.turno !== resolvedPref.turno) {
      return {
        detectada: true,
        mensajeIndica: affirmedMention.turno,
        preferenciaRegistrada: resolvedPref.label,
        detalle: `Discrepancia explícita: el mensaje solicita atención por la ${affirmedMention.turno.toLowerCase()}, mientras que la preferencia registrada en el formulario es ${resolvedPref.label}. Se debe solicitar aclaración al paciente conservando ambos datos.`,
      };
    } else {
      return { detectada: false };
    }
  }

  // Si hay menciones no negadas: comprobar si la preferencia registrada coincide con alguna de ellas
  if (nonNegated.length > 0) {
    const acceptable = new Set(nonNegated.map(m => m.turno));
    if (acceptable.has(resolvedPref.turno)) {
      // Coincide con uno de los turnos aceptables mencionados
      return { detectada: false };
    }

    // Ninguno de los turnos aceptados coincide con el formulario
    const firstRequested = nonNegated[0].turno;
    return {
      detectada: true,
      mensajeIndica: firstRequested,
      preferenciaRegistrada: resolvedPref.label,
      detalle: `Discrepancia explícita: el mensaje solicita atención por la ${firstRequested.toLowerCase()}, mientras que la preferencia registrada en el formulario es ${resolvedPref.label}. Se debe solicitar aclaración al paciente conservando ambos datos.`,
    };
  }

  const negatedRegistered = mentions.find(m => m.negated && m.turno === resolvedPref.turno);
  if (negatedRegistered) {
    return {
      detectada: true,
      mensajeIndica: `No puede ${negatedRegistered.turno.toLowerCase()}`,
      preferenciaRegistrada: resolvedPref.label,
      detalle: `Discrepancia explícita: el mensaje indica que no puede en el turno ${negatedRegistered.turno.toLowerCase()}, mientras que la preferencia registrada en el formulario es ${resolvedPref.label}. Se debe solicitar aclaración al paciente conservando ambos datos.`,
    };
  }

  return { detectada: false };
}

/**
 * Genera una huella determinista (fingerprint) del contexto evaluado.
 * Permite identificar cuándo una evaluación previa sigue vigente o quedó desactualizada
 * tras modificaciones en preferencias clínicas, horario o mensaje.
 */
export function computeEvaluationContextFingerprint(params: {
  mensaje: string;
  id_servicio_declarado?: number | null;
  pref_id_horario?: string | number | null;
  sede_preferida?: string | null;
}): string {
  const normMessage = (params.mensaje || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const sId = params.id_servicio_declarado != null ? String(params.id_servicio_declarado) : '';
  const hId = params.pref_id_horario != null ? String(params.pref_id_horario).trim() : '';
  const sede = (params.sede_preferida || '').trim().toLowerCase();

  const raw = `msg:${normMessage}|svc:${sId}|hor:${hId}|sede:${sede}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

/**
 * Servicio central de orquestación y persistencia del flujo Buyer.
 * Gestiona idempotencia, clasificación semántica, aclaraciones en dos turnos,
 * transiciones hacia LEAD y entrega confirmada mediante registerLeadIntake.
 */
export class BuyerEvaluationService {
  /**
   * Mapa en memoria para serializar peticiones concurrentes sobre el mismo id_interaccion.
   */
  private static inFlightEvaluations = new Map<number, Promise<BuyerEvaluationOutcome>>();

  /**
   * Ejecuta la evaluación completa de un mensaje Buyer persistido previamente.
   */
  public static async evaluateBuyerInteraction(
    input: EvaluateBuyerInteractionInput
  ): Promise<BuyerEvaluationOutcome> {
    const { id_interaccion } = input;

    // Protección concurrente: si ya hay una evaluación en curso para esta interacción, esperar la misma
    const existingPromise = this.inFlightEvaluations.get(id_interaccion);
    if (existingPromise) {
      return existingPromise;
    }

    const evaluationPromise = this.executeEvaluationCore(input).finally(() => {
      this.inFlightEvaluations.delete(id_interaccion);
    });

    this.inFlightEvaluations.set(id_interaccion, evaluationPromise);
    return evaluationPromise;
  }

  private static async executeEvaluationCore(
    input: EvaluateBuyerInteractionInput
  ): Promise<BuyerEvaluationOutcome> {
    const db = (input.dbClient || defaultPrisma) as PrismaClient;
    const { id_persona, id_captacion, id_interaccion, mensaje } = input;

    // 1. Obtener catálogo activo real de servicios desde la base de datos
    const catalog = await getActiveServices(db);

    // 2. Obtener estado de la persona y etapa actual
    const person = await db.personas.findUnique({
      where: { id_persona },
      include: { Etapa: true },
    });

    if (!person) {
      throw new Error(`Persona con ID ${id_persona} no encontrada.`);
    }

    const currentStageName = person.Etapa?.nombre || 'BUYER';
    const isAdvancedStage = ['PAYER', 'CUSTOMER', 'TURNED'].includes(currentStageName);

    // Resolver preferencia de horario vigente (respetando fecha_fin y determinismo)
    let prefHorario = input.pref_id_horario;
    if (prefHorario === undefined || prefHorario === null) {
      const now = new Date();
      const prefRecord = await (db as any).personaPreferencias.findFirst({
        where: {
          id_persona,
          OR: [
            { fecha_fin: null },
            { fecha_fin: { gt: now } },
          ],
        },
        orderBy: { id_preferencia: 'desc' },
        select: { id_horario: true, fecha_fin: true },
      });
      prefHorario = prefRecord?.id_horario ?? null;
    }

    // Catálogo real de horarios para no asumir IDs 1/2/3
    let catalogHorarios: HorarioCatalogItem[] = [];
    try {
      if ((db as any).horarios?.findMany) {
        catalogHorarios = await (db as any).horarios.findMany();
      }
    } catch {}

    const currentContextFingerprint = computeEvaluationContextFingerprint({
      mensaje,
      id_servicio_declarado: input.id_servicio_declarado,
      pref_id_horario: prefHorario,
      sede_preferida: input.sede_preferida,
    });

    // Preparar contexto persistente
    const inputPayload = JSON.stringify({
      mensaje,
      id_persona,
      id_captacion,
      id_interaccion,
      motivo_consulta: input.motivo_consulta || null,
      sede_preferida: input.sede_preferida || null,
      id_servicio_declarado: input.id_servicio_declarado || null,
      pref_id_horario: prefHorario || null,
      contextFingerprint: currentContextFingerprint,
      contextoConversacional: input.contextoConversacional || null,
      catalogo_snapshot: catalog.map(c => ({ id: c.id_servicio, nombre: c.nombre })),
      fecha_evaluacion: new Date().toISOString(),
    });

    // 2. Localizar registro previo de evaluación en dbo.DecisionesIA para esta interacción
    let latestDecision = await db.decisionesIA.findFirst({
      where: {
        agente: 'BUYER',
        id_interaccion,
      },
      orderBy: { id_decision: 'desc' },
    });

    let prevFingerprint: string | undefined;
    let prevParsedDecision: any = {};
    if (latestDecision) {
      try {
        prevParsedDecision = JSON.parse(latestDecision.decision || '{}');
        prevFingerprint = prevParsedDecision.contextFingerprint;
        if (!prevFingerprint && latestDecision.entrada) {
          const prevEntrada = JSON.parse(latestDecision.entrada);
          prevFingerprint = prevEntrada.contextFingerprint || computeEvaluationContextFingerprint({
            mensaje: prevEntrada.mensaje || mensaje,
            id_servicio_declarado: prevEntrada.id_servicio_declarado,
            pref_id_horario: prevEntrada.pref_id_horario,
            sede_preferida: prevEntrada.sede_preferida,
          });
        }
      } catch {}
    }

    const isMatchingContext = !prevFingerprint || prevFingerprint === currentContextFingerprint;

    let prevAttempts = prevParsedDecision.intentosRealizados ?? prevParsedDecision.intentos_realizados ?? 0;
    let prevErrorHistory: string[] = Array.isArray(prevParsedDecision.historial_errores)
      ? prevParsedDecision.historial_errores
      : (prevParsedDecision.error ? [prevParsedDecision.error] : []);

    // =========================================================================
    // PASO A: REPETICIÓN DESPUÉS DE EVALUACIÓN COMPLETADA (Idempotencia pura)
    // Comprobar la decisión completada ANTES de cualquier recuperación de eventos.
    // Conserva huella, IDs, historial y estado de entrega sin llamadas a Gemini.
    // =========================================================================
    if (latestDecision && prevParsedDecision.estado === 'COMPLETADA' && isMatchingContext) {
      let entregaLeadEstado = prevParsedDecision.entregaLeadEstado ?? 'NO_APLICA';

      // Si la conversión estaba confirmada pero la entrega a LEAD quedó pendiente, intentar confirmarla
      if (
        (latestDecision.accion === 'CONVERSION_LEAD' || prevParsedDecision.accion === 'CONVERSION_LEAD') &&
        entregaLeadEstado === 'PENDIENTE' &&
        prevParsedDecision.id_solicitud
      ) {
        try {
          const leadIntake = await registerLeadIntake(prevParsedDecision.id_solicitud, db as any);
          if (leadIntake?.id_solicitud) {
            entregaLeadEstado = 'CONFIRMADA';
            prevParsedDecision.entregaLeadEstado = 'CONFIRMADA';
            await db.decisionesIA.update({
              where: { id_decision: latestDecision.id_decision },
              data: {
                decision: JSON.stringify(prevParsedDecision),
                requiere_revision: false,
                resultado_revision: `Conversión completada; entrega a LEAD confirmada (Solicitud #${prevParsedDecision.id_solicitud}).`,
              },
            });
          }
        } catch {}
      }

      return {
        id_persona,
        id_captacion,
        id_interaccion,
        id_decision: latestDecision.id_decision,
        estado: 'COMPLETADA',
        intencion: prevParsedDecision.intencion ?? null,
        id_servicio: prevParsedDecision.id_servicio ?? null,
        accion: (latestDecision.accion as BuyerEvaluationAction) || 'SOLO_CONSULTA',
        etapa_final: person?.Etapa?.nombre || (latestDecision.accion === 'CONVERSION_LEAD' ? 'LEAD' : 'BUYER'),
        id_solicitud: prevParsedDecision.id_solicitud ?? null,
        id_evento_etapa: prevParsedDecision.id_evento_etapa ?? null,
        ya_convertido: true,
        aclaracion: latestDecision.resultado_revision ?? null,
        discrepancia_horario: prevParsedDecision.discrepancia_horario || null,
        historial_errores: prevParsedDecision.historial_errores || (prevParsedDecision.error ? [prevParsedDecision.error] : undefined),
        intentosRealizados: prevParsedDecision.intentosRealizados ?? prevParsedDecision.intentos_realizados ?? 1,
        intentos_realizados: prevParsedDecision.intentosRealizados ?? prevParsedDecision.intentos_realizados ?? 1,
        duracionTotalMs: prevParsedDecision.duracionTotalMs ?? prevParsedDecision.duracion_total_ms ?? 0,
        duracion_total_ms: prevParsedDecision.duracionTotalMs ?? prevParsedDecision.duracion_total_ms ?? 0,
        entregaLeadEstado,
        contextFingerprint: prevFingerprint || currentContextFingerprint,
      };
    }

    // =========================================================================
    // PASO B: RECUPERACIÓN DE CAÍDA TRAS COMMIT SQL (usp_ConvertirBuyerALead)
    // Cubre una caída ocurrida inmediatamente después de confirmar la conversión en SQL
    // pero antes de completar la decisión o interacción.
    // Requiere identidad persistida de operación vinculada a la interacción.
    // Si no existe evidencia suficiente, NO adjudica una conversión histórica al mensaje nuevo.
    // =========================================================================
    if (!isAdvancedStage) {
      const existingConversions = await (db as any).$queryRaw<{
        id_evento_etapa: number;
        id_solicitud: number;
        id_persona: number;
        id_captacion: number;
        clave_operacion_buyer?: string | null;
      }[]>`
        SELECT TOP 1 id_evento_etapa, id_solicitud, id_persona, id_captacion, clave_operacion_buyer
        FROM dbo.EventosEtapa
        WHERE id_captacion = ${id_captacion}
          AND (
            clave_operacion_buyer = ${`BUYER_LEAD:${id_captacion}`} OR
            clave_operacion_buyer = ${`BUYER_LEAD:${id_captacion}:${id_interaccion}`}
          )
        ORDER BY id_evento_etapa DESC
      `;

      if (existingConversions.length > 0 && existingConversions[0].id_solicitud) {
        const conv = existingConversions[0];

        // Verificar si otra interacción consumió ya esta solicitud (conversión de un mensaje anterior)
        const otherInteractionWithSameSolicitud = await (db as any).interacciones.findFirst({
          where: {
            id_persona,
            id_solicitud: conv.id_solicitud,
            NOT: { id_interaccion },
          },
        });

        // Verificar si esta interacción específica estaba en proceso de conversión
        const thisInteraction = await (db as any).interacciones.findUnique({
          where: { id_interaccion },
          select: { id_solicitud: true, mensaje: true },
        });

        // Identidad persistida de operación vinculada a la interacción:
        // 1. La interacción ya tiene asignada esta solicitud específica (id_solicitud === conv.id_solicitud)
        // 2. O la decisión previa de esta interacción ya registraba la misma solicitud o evento
        // 3. O la decisión previa de esta interacción estaba explícitamente en curso de conversión ('CONVERSION_EN_CURSO')
        //    o con acción CONVERSION_LEAD vinculada a la operación de esta interacción
        // 4. O la clave de operación del evento contiene el identificador de esta interacción específica
        const hasLinkedSolicitud = Boolean(thisInteraction?.id_solicitud && thisInteraction.id_solicitud === conv.id_solicitud);
        const hasDecisionSolicitud = Boolean(prevParsedDecision?.id_solicitud && prevParsedDecision.id_solicitud === conv.id_solicitud);
        const hasConversionInProgress = Boolean(
          latestDecision && (
            prevParsedDecision?.estado === 'CONVERSION_EN_CURSO' ||
            (latestDecision.accion === 'CONVERSION_LEAD' && (
              prevParsedDecision?.operacion_id === `BUYER_LEAD:${id_captacion}:${id_interaccion}` ||
              prevParsedDecision?.intencion === 'SOLICITA_RESERVA'
            ))
          )
        );
        const hasMatchingOperationKey = Boolean(
          conv.clave_operacion_buyer && conv.clave_operacion_buyer === `BUYER_LEAD:${id_captacion}:${id_interaccion}`
        );

        const hasPersistedOperationEvidence = Boolean(
          hasLinkedSolicitud ||
          hasDecisionSolicitud ||
          hasConversionInProgress ||
          hasMatchingOperationKey
        );

        if (!otherInteractionWithSameSolicitud && hasPersistedOperationEvidence) {
          let entregaLeadConfirmada = false;
          try {
            const leadIntake = await registerLeadIntake(conv.id_solicitud, db as any);
            if (leadIntake?.id_solicitud) {
              entregaLeadConfirmada = true;
            }
          } catch (handoffErr: any) {
            console.warn(
              `[BuyerEvaluationService] registerLeadIntake en recuperación de commit previo (id_solicitud=${conv.id_solicitud}): ${handoffErr?.message}`
            );
          }

          await (db as any).$executeRaw`
            UPDATE dbo.Interacciones
            SET id_solicitud = ${conv.id_solicitud},
                resultado = 'Conversión a LEAD confirmada (recuperada tras commit previo)'
            WHERE id_interaccion = ${id_interaccion}
          `;

          const attemptsCount = (prevParsedDecision.intentosRealizados ?? prevParsedDecision.intentos_realizados ?? 0) + 1;
          const decisionPayload = JSON.stringify({
            estado: 'COMPLETADA',
            intencion: 'SOLICITA_RESERVA',
            id_servicio: input.id_servicio_declarado ?? null,
            id_solicitud: conv.id_solicitud,
            id_evento_etapa: conv.id_evento_etapa,
            entregaLeadEstado: entregaLeadConfirmada ? 'CONFIRMADA' : 'PENDIENTE',
            recuperadaDeCommitPrevio: true,
            historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
            intentosRealizados: attemptsCount,
            intentos_realizados: attemptsCount,
            duracionTotalMs: 0,
            duracion_total_ms: 0,
            contextFingerprint: currentContextFingerprint,
          });

          let recoveredDecisionId: number;
          if (!latestDecision) {
            const created = await (db as any).decisionesIA.create({
              data: {
                agente: 'BUYER',
                id_persona,
                id_captacion,
                id_interaccion,
                fecha_hora: new Date(),
                entrada: inputPayload,
                regla_aplicada: 'recuperacion-commit-previo',
                decision: decisionPayload,
                accion: 'CONVERSION_LEAD',
                requiere_revision: !entregaLeadConfirmada,
                resultado_revision: `Conversión recuperada desde commit previo en SQL (Solicitud #${conv.id_solicitud}). Entrega ${entregaLeadConfirmada ? 'confirmada' : 'pendiente'} en LEAD.`,
              },
            });
            recoveredDecisionId = created.id_decision;
          } else {
            recoveredDecisionId = latestDecision.id_decision;
            await (db as any).decisionesIA.update({
              where: { id_decision: latestDecision.id_decision },
              data: {
                decision: decisionPayload,
                accion: 'CONVERSION_LEAD',
                requiere_revision: !entregaLeadConfirmada,
                resultado_revision: `Conversión recuperada desde commit previo en SQL (Solicitud #${conv.id_solicitud}). Entrega ${entregaLeadConfirmada ? 'confirmada' : 'pendiente'} en LEAD.`,
              },
            });
          }

          return {
            id_persona,
            id_captacion,
            id_interaccion,
            id_decision: recoveredDecisionId,
            estado: 'COMPLETADA',
            intencion: 'SOLICITA_RESERVA',
            id_servicio: input.id_servicio_declarado ?? null,
            accion: 'CONVERSION_LEAD',
            etapa_final: 'LEAD',
            id_solicitud: conv.id_solicitud,
            id_evento_etapa: conv.id_evento_etapa,
            ya_convertido: true,
            aclaracion: null,
            historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
            intentosRealizados: attemptsCount,
            intentos_realizados: attemptsCount,
            duracionTotalMs: 0,
            duracion_total_ms: 0,
            entregaLeadEstado: entregaLeadConfirmada ? 'CONFIRMADA' : 'PENDIENTE',
            contextFingerprint: currentContextFingerprint,
          };
        }
      }
    }

    // =========================================================================
    // PASO C: REUTILIZACIÓN DE EVALUACIÓN PENDIENTE VS NUEVA VERSIÓN POR CAMBIO DE CONTEXTO
    // 1. Si existe una decisión PENDIENTE para la misma interacción y mismo contextFingerprint,
    //    se REUTILIZA esa decisión. Conserva intentos y errores de forma auditable.
    // 2. Si el contexto cambió realmente, se marca la versión anterior como REEMPLAZADA
    //    (para evitar que la recuperación la reprocese indefinidamente) y se crea una nueva.
    // =========================================================================
    let decisionRecord: any;

    const isPendingStatus = latestDecision && (
      prevParsedDecision.estado === 'PENDIENTE' ||
      prevParsedDecision.estado === 'CONVERSION_EN_CURSO' ||
      latestDecision.accion === 'REINTENTO_PENDIENTE' ||
      latestDecision.decision?.includes('"estado":"PENDIENTE"')
    );

    if (isPendingStatus && isMatchingContext) {
      // Reutilizar la decisión pendiente existente (mismo mensaje y contexto)
      decisionRecord = latestDecision;
      prevAttempts = prevParsedDecision.intentosRealizados ?? prevParsedDecision.intentos_realizados ?? 0;
      prevErrorHistory = Array.isArray(prevParsedDecision.historial_errores)
        ? prevParsedDecision.historial_errores
        : (prevParsedDecision.error ? [prevParsedDecision.error] : []);

      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            ...prevParsedDecision,
            estado: 'PENDIENTE',
            reintento_en_curso: true,
            contextFingerprint: currentContextFingerprint,
          }),
          resultado_revision: `Reintento en curso (intento previo: ${prevAttempts})`,
        },
      });
    } else {
      // Si el contexto cambió realmente frente a versiones previas, marcar pendientes anteriores como REEMPLAZADAS
      if (latestDecision && !isMatchingContext) {
        try {
          const stalePending = await (db as any).decisionesIA.findMany({
            where: {
              agente: 'BUYER',
              id_interaccion,
              OR: [
                { decision: { contains: '"estado":"PENDIENTE"' } },
                { accion: 'REINTENTO_PENDIENTE' },
              ],
            },
          });
          for (const sp of stalePending) {
            let spDec: any = {};
            try { spDec = JSON.parse(sp.decision || '{}'); } catch {}
            await (db as any).decisionesIA.update({
              where: { id_decision: sp.id_decision },
              data: {
                accion: 'REEMPLAZADA',
                requiere_revision: false,
                decision: JSON.stringify({
                  ...spDec,
                  estado: 'REEMPLAZADA',
                  reemplazada_por_cambio_contexto: true,
                }),
                resultado_revision: 'Evaluación descartada: contexto modificado por nueva versión',
              },
            });
          }
        } catch {}
      }

      // Crear un nuevo registro de decisión
      decisionRecord = await db.decisionesIA.create({
        data: {
          agente: 'BUYER',
          id_persona,
          id_captacion,
          id_interaccion,
          fecha_hora: new Date(),
          entrada: inputPayload,
          regla_aplicada: input.classifierOptions?.modelName || 'gemini-3.5-flash-lite',
          decision: JSON.stringify({
            estado: 'PENDIENTE',
            intencion: null,
            id_servicio: null,
            intentosRealizados: 0,
            duracionTotalMs: 0,
            contextFingerprint: currentContextFingerprint,
            version_anterior_id: latestDecision ? latestDecision.id_decision : null,
          }),
          accion: 'REINTENTO_PENDIENTE',
          requiere_revision: true,
          resultado_revision: latestDecision && !isMatchingContext
            ? 'Evaluación encolada con contexto vigente (nueva versión tras cambio de contexto)'
            : 'Evaluación encolada con contexto vigente',
        },
      });
    }

    // VALIDACIÓN DE PERTENENCIA DEL CONTEXTO (Punto 2)
    let safeContext = input.contextoConversacional;
    if (safeContext?.idInteraccionPrevia) {
      const prevInt = await (db as any).interacciones.findUnique({
        where: { id_interaccion: Number(safeContext.idInteraccionPrevia) },
        select: { id_persona: true, mensaje: true },
      });
      if (prevInt && prevInt.id_persona !== id_persona) {
        console.warn(
          `[BuyerEvaluationService] Rechazo de contexto cruzado: id_interaccion_previa=${safeContext.idInteraccionPrevia} pertenece a persona ${prevInt.id_persona}, no a ${id_persona}`
        );
        safeContext = undefined;
      }
    }

    // 3. Ejecutar clasificación fuera de la transacción SQL
    // Si hay contexto de aclaración, enriquecer el prompt con: mensaje anterior, pregunta del agente y respuesta actual (Punto 2)
    let textToClassify = mensaje;
    if (safeContext) {
      const parts: string[] = [];
      if (safeContext.mensajeAnterior) {
        parts.push(`Mensaje anterior del paciente: "${safeContext.mensajeAnterior}"`);
      }
      if (safeContext.aclaracionPrevia) {
        parts.push(`Pregunta u orientación del agente: "${safeContext.aclaracionPrevia}"`);
      }
      parts.push(`Respuesta actual del paciente: "${mensaje}"`);
      textToClassify = parts.join('\n');
    }

    let classification: BuyerClassificationResult;
    try {
      if (input.classifierOverride) {
        classification = await input.classifierOverride(textToClassify, catalog);
      } else {
        classification = await classifyBuyerMessage(textToClassify, catalog, input.classifierOptions);
      }
    } catch (classifyErr: any) {
      const sanitizedError = String(classifyErr?.message || 'Error desconocido al clasificar mensaje').slice(0, 250);
      const additionalAttempts = classifyErr?.intentosRealizados ?? classifyErr?.intentos ?? 1;
      const currentAttempt = prevAttempts + additionalAttempts;
      const totalDuration = classifyErr?.duracionTotalMs ?? 0;
      const updatedErrorHistory = [...prevErrorHistory, sanitizedError];

      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            estado: 'PENDIENTE',
            intencion: null,
            id_servicio: null,
            error: sanitizedError,
            historial_errores: updatedErrorHistory,
            intentosRealizados: currentAttempt,
            intentos_realizados: currentAttempt,
            duracionTotalMs: totalDuration,
            duracion_total_ms: totalDuration,
            contextFingerprint: currentContextFingerprint,
          }),
          accion: 'REINTENTO_PENDIENTE',
          requiere_revision: true,
          resultado_revision: `Fallo clasificador (intento ${currentAttempt}): ${sanitizedError}`,
        },
      });

      return {
        id_persona,
        id_captacion,
        id_interaccion,
        id_decision: decisionRecord.id_decision,
        estado: 'PENDIENTE',
        intencion: null,
        id_servicio: null,
        accion: 'REINTENTO_PENDIENTE',
        etapa_final: 'BUYER',
        error: sanitizedError,
        intentosRealizados: currentAttempt,
        intentos_realizados: currentAttempt,
        duracionTotalMs: totalDuration,
        duracion_total_ms: totalDuration,
        entregaLeadEstado: 'PENDIENTE',
        contextFingerprint: currentContextFingerprint,
      };
    }

    const { intencion, id_servicio, duracionTotalMs } = classification;
    const intentosRealizados = prevAttempts + (classification.intentosRealizados || 1);

    // Detectar discrepancias explícitas de horario entre mensaje y preferencias del catálogo
    const scheduleDiscrepancy = detectScheduleDiscrepancy(mensaje, prefHorario, catalogHorarios);

    // 5. Orquestar decisiones según la intención detectada
    if (intencion === 'SOLICITA_RESERVA') {
      // REGLA 2: NO seleccionar el primer servicio o ID 1 como sustituto de un servicio desconocido.
      // Si el servicio no pertenece al catálogo activo y no hay id_servicio_declarado válido, PEDIR ACLARACIÓN.
      let effectiveServiceId: number | null = null;
      if (id_servicio && catalog.some(s => s.id_servicio === id_servicio)) {
        effectiveServiceId = id_servicio;
      } else if (input.id_servicio_declarado && catalog.some(s => s.id_servicio === input.id_servicio_declarado)) {
        effectiveServiceId = input.id_servicio_declarado;
      }

      if (scheduleDiscrepancy.detectada) {
        // Discrepancia explícita entre mensaje y preferencia de horario:
        // Conservar ambos datos sin modificarlos silenciosamente y solicitar aclaración.
        const aclaracionDiscrepancia = `Detectamos tu interés en agendar una cita. En tu mensaje indicas preferencia por el turno ${scheduleDiscrepancy.mensajeIndica}, pero en el formulario registraste ${scheduleDiscrepancy.preferenciaRegistrada}. ¿En cuál de los dos horarios prefieres que coordinemos tu atención?`;

        await db.decisionesIA.update({
          where: { id_decision: decisionRecord.id_decision },
          data: {
            decision: JSON.stringify({
              estado: 'COMPLETADA',
              intencion,
              id_servicio: effectiveServiceId,
              discrepancia_horario: scheduleDiscrepancy,
              historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
              intentosRealizados,
              intentos_realizados: intentosRealizados,
              duracionTotalMs,
              duracion_total_ms: duracionTotalMs,
              contextFingerprint: currentContextFingerprint,
            }),
            accion: 'ACLARACION',
            requiere_revision: true,
            resultado_revision: scheduleDiscrepancy.detalle,
          },
        });

        await db.$executeRaw`
          UPDATE dbo.Interacciones
          SET resultado='Aclaración requerida (discrepancia de horario)'
          WHERE id_interaccion=${id_interaccion}
        `;

        return {
          id_persona,
          id_captacion,
          id_interaccion,
          id_decision: decisionRecord.id_decision,
          estado: 'COMPLETADA',
          intencion,
          id_servicio: effectiveServiceId,
          accion: 'ACLARACION',
          etapa_final: currentStageName,
          aclaracion: aclaracionDiscrepancia,
          discrepancia_horario: scheduleDiscrepancy,
          historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
          intentosRealizados,
          intentos_realizados: intentosRealizados,
          duracionTotalMs,
          duracion_total_ms: duracionTotalMs,
          entregaLeadEstado: 'NO_APLICA',
          contextFingerprint: currentContextFingerprint,
        };
      }

      if (!effectiveServiceId) {
        // Servicio desconocido o no especificado: PEDIR ACLARACIÓN explícita
        const serviceNames = catalog.map(s => s.nombre).join(', ');
        const aclaracionServicio = `Deseas agendar una cita, pero necesitamos confirmar el tratamiento específico. ¿En cuál de nuestros servicios estás interesado? Contamos con: ${serviceNames}.`;

        await db.decisionesIA.update({
          where: { id_decision: decisionRecord.id_decision },
          data: {
            decision: JSON.stringify({
              estado: 'COMPLETADA',
              intencion: 'AMBIGUA',
              id_servicio: null,
              historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
              intentosRealizados,
              intentos_realizados: intentosRealizados,
              duracionTotalMs,
              duracion_total_ms: duracionTotalMs,
              contextFingerprint: currentContextFingerprint,
            }),
            accion: 'ACLARACION',
            requiere_revision: true,
            resultado_revision: aclaracionServicio,
          },
        });

        await db.$executeRaw`
          UPDATE dbo.Interacciones
          SET resultado='Aclaración de servicio requerida'
          WHERE id_interaccion=${id_interaccion}
        `;

        return {
          id_persona,
          id_captacion,
          id_interaccion,
          id_decision: decisionRecord.id_decision,
          estado: 'COMPLETADA',
          intencion: 'AMBIGUA',
          id_servicio: null,
          accion: 'ACLARACION',
          etapa_final: currentStageName,
          aclaracion: aclaracionServicio,
          historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
          intentosRealizados,
          intentos_realizados: intentosRealizados,
          duracionTotalMs,
          duracion_total_ms: duracionTotalMs,
          entregaLeadEstado: 'NO_APLICA',
          contextFingerprint: currentContextFingerprint,
        };
      }

      // Validar si el contacto cumple requisitos de contacto y autorización para LEAD
      const hasConsent = person.autoriza_contacto === true;
      const isValidQuality = person.estado_calidad === 'Valido';
      const hasName = Boolean(person.nombres?.trim() && person.apellidos?.trim());
      const hasContactMethod = Boolean(person.numero?.trim() || person.email?.trim());
      const meetsConversionRules = hasConsent && isValidQuality && hasName && hasContactMethod;

      if (!meetsConversionRules) {
        // Requisitos incompletos: permanece en BUYER
        await db.decisionesIA.update({
          where: { id_decision: decisionRecord.id_decision },
          data: {
            decision: JSON.stringify({
              estado: 'COMPLETADA',
              intencion,
              id_servicio: effectiveServiceId,
              historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
              intentosRealizados,
              intentos_realizados: intentosRealizados,
              duracionTotalMs,
              duracion_total_ms: duracionTotalMs,
              contextFingerprint: currentContextFingerprint,
            }),
            accion: 'REQUISITOS_INCOMPLETOS',
            requiere_revision: true,
            resultado_revision: 'Intención de reserva detectada, pero requiere autorización o datos de contacto válidos.',
          },
        });

        return {
          id_persona,
          id_captacion,
          id_interaccion,
          id_decision: decisionRecord.id_decision,
          estado: 'COMPLETADA',
          intencion,
          id_servicio: effectiveServiceId,
          accion: 'REQUISITOS_INCOMPLETOS',
          etapa_final: currentStageName,
          historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
          intentosRealizados,
          intentos_realizados: intentosRealizados,
          duracionTotalMs,
          duracion_total_ms: duracionTotalMs,
          entregaLeadEstado: 'NO_APLICA',
          contextFingerprint: currentContextFingerprint,
        };
      }

      // REGLA 5 (Punto 3): Si el contacto ya está en una etapa posterior (LEAD, PAYER, CUSTOMER, TURNED)
      if (currentStageName !== 'BUYER') {
        const resolution = await resolveExplicitSolicitud(
          `${mensaje} ${input.motivo_consulta || ''}`,
          id_persona,
          db
        );

        if (resolution.resolved && resolution.id_solicitud) {
          // Solicitud explícita resuelta y comprobada su pertenencia
          await (db as any).$executeRaw`
            UPDATE dbo.Interacciones
            SET id_solicitud = ${resolution.id_solicitud},
                resultado = ${`Mensaje vinculado a solicitud explícita #${resolution.id_solicitud}`}
            WHERE id_interaccion = ${id_interaccion}
          `;

          await (db as any).decisionesIA.update({
            where: { id_decision: decisionRecord.id_decision },
            data: {
              decision: JSON.stringify({
                estado: 'COMPLETADA',
                intencion,
                id_servicio: effectiveServiceId,
                id_solicitud: resolution.id_solicitud,
                historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
                intentosRealizados,
                intentos_realizados: intentosRealizados,
                duracionTotalMs,
                duracion_total_ms: duracionTotalMs,
                contextFingerprint: currentContextFingerprint,
              }),
              accion: 'CONSERVA_ETAPA_POSTERIOR',
              requiere_revision: false,
              resultado_revision: `Contacto en etapa ${currentStageName}. Solicitud explícita #${resolution.id_solicitud} verificada y vinculada. Se conserva etapa.`,
            },
          });

          return {
            id_persona,
            id_captacion,
            id_interaccion,
            id_decision: decisionRecord.id_decision,
            estado: 'COMPLETADA',
            intencion,
            id_servicio: effectiveServiceId,
            accion: 'CONSERVA_ETAPA_POSTERIOR',
            etapa_final: currentStageName,
            id_solicitud: resolution.id_solicitud,
            historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            entregaLeadEstado: 'NO_APLICA',
            contextFingerprint: currentContextFingerprint,
          };
        } else {
          // Referencia dudosa o nueva solicitud sin código verificado:
          // Se mantiene como SOLICITUD_PENDIENTE_APERTURA evitando vincular ciegamente la última solicitud
          await (db as any).decisionesIA.update({
            where: { id_decision: decisionRecord.id_decision },
            data: {
              decision: JSON.stringify({
                estado: 'COMPLETADA',
                intencion,
                id_servicio: effectiveServiceId,
                historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
                intentosRealizados,
                intentos_realizados: intentosRealizados,
                duracionTotalMs,
                duracion_total_ms: duracionTotalMs,
                motivoPendiente: resolution.motivoDuda || 'Referencia dudosa a solicitud o nueva oportunidad pendiente',
                contextFingerprint: currentContextFingerprint,
              }),
              accion: 'SOLICITUD_PENDIENTE_APERTURA',
              requiere_revision: true,
              resultado_revision: `Contacto en etapa ${currentStageName}. ${resolution.motivoDuda || 'Referencia dudosa a solicitud'}. Queda pendiente de apertura formal.`,
            },
          });

          return {
            id_persona,
            id_captacion,
            id_interaccion,
            id_decision: decisionRecord.id_decision,
            estado: 'COMPLETADA',
            intencion,
            id_servicio: effectiveServiceId,
            accion: 'SOLICITUD_PENDIENTE_APERTURA',
            etapa_final: currentStageName,
            id_solicitud: null,
            historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            entregaLeadEstado: 'NO_APLICA',
            contextFingerprint: currentContextFingerprint,
          };
        }
      }

      // El contacto está en BUYER y solicita reserva con requisitos cumplidos:
      const motivoLead = String(mensaje || input.motivo_consulta || 'Solicitud de reserva Buyer').slice(0, 200);

      // Persistir intención de conversión y clave de operación antes de invocar el SP (para recuperación en caso de caída)
      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            estado: 'CONVERSION_EN_CURSO',
            intencion,
            id_servicio: effectiveServiceId,
            operacion_id: `BUYER_LEAD:${id_captacion}:${id_interaccion}`,
            historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            contextFingerprint: currentContextFingerprint,
          }),
          accion: 'CONVERSION_LEAD',
          resultado_revision: `Conversión a LEAD en curso para interacción #${id_interaccion}...`,
        },
      });

      // Ejecutar conversión vía dbo.usp_ConvertirBuyerALead
      const [conversionResult] = await db.$queryRaw<{
        id_evento_etapa: number;
        id_solicitud: number;
        ya_convertido: number;
      }[]>`
        EXEC dbo.usp_ConvertirBuyerALead
          @id_captacion=${id_captacion},
          @id_servicio=${effectiveServiceId},
          @motivo=${motivoLead}
      `;

      if (!conversionResult?.id_solicitud) {
        throw new Error('La conversión de Buyer a Lead no retornó un id_solicitud válido.');
      }

      // Actualizar enlace en Interacciones
      await db.$executeRaw`
        UPDATE dbo.Interacciones
        SET id_solicitud=${conversionResult.id_solicitud}, resultado='Convertido a LEAD'
        WHERE id_interaccion=${id_interaccion}
      `;

      // REGLA 6: Persistir entrega pendiente antes de llamar a registerLeadIntake
      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            estado: 'COMPLETADA',
            intencion,
            id_servicio: effectiveServiceId,
            historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            id_solicitud: conversionResult.id_solicitud,
            id_evento_etapa: conversionResult.id_evento_etapa,
            entregaLeadEstado: 'PENDIENTE',
            contextFingerprint: currentContextFingerprint,
          }),
          accion: 'CONVERSION_LEAD',
          requiere_revision: true,
          resultado_revision: `Conversión confirmada en SQL (Solicitud #${conversionResult.id_solicitud}). Entrega a LEAD en curso.`,
        },
      });

      // Llamar a registerLeadIntake fuera de la transacción SQL
      let entregaLeadConfirmada = false;
      try {
        const leadIntake = await registerLeadIntake(conversionResult.id_solicitud, db as any);
        if (leadIntake?.id_solicitud) {
          entregaLeadConfirmada = true;
          await db.decisionesIA.update({
            where: { id_decision: decisionRecord.id_decision },
            data: {
              decision: JSON.stringify({
                estado: 'COMPLETADA',
                intencion,
                id_servicio: effectiveServiceId,
                historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
                intentosRealizados,
                intentos_realizados: intentosRealizados,
                duracionTotalMs,
                duracion_total_ms: duracionTotalMs,
                id_solicitud: conversionResult.id_solicitud,
                id_evento_etapa: conversionResult.id_evento_etapa,
                entregaLeadEstado: 'CONFIRMADA',
                contextFingerprint: currentContextFingerprint,
              }),
              requiere_revision: false,
              resultado_revision: `Conversión confirmada y entregada al Agente LEAD (Solicitud #${conversionResult.id_solicitud}, Entrada #${leadIntake.id_solicitud}).`,
            },
          });
        }
      } catch (handoffErr: any) {
        // En caso de caída de LEAD o pérdida de respuesta, la entrega queda registrada como PENDIENTE
        console.warn(
          `[BuyerEvaluationService] registerLeadIntake falló o perdió respuesta para id_solicitud=${conversionResult.id_solicitud}: ${handoffErr?.message}`
        );
      }

      return {
        id_persona,
        id_captacion,
        id_interaccion,
        id_decision: decisionRecord.id_decision,
        estado: 'COMPLETADA',
        intencion,
        id_servicio: effectiveServiceId,
        accion: 'CONVERSION_LEAD',
        etapa_final: 'LEAD',
        id_solicitud: conversionResult.id_solicitud,
        id_evento_etapa: conversionResult.id_evento_etapa,
        ya_convertido: Boolean(conversionResult.ya_convertido),
        historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
        intentosRealizados,
        intentos_realizados: intentosRealizados,
        duracionTotalMs,
        duracion_total_ms: duracionTotalMs,
        entregaLeadEstado: entregaLeadConfirmada ? 'CONFIRMADA' : 'PENDIENTE',
        contextFingerprint: currentContextFingerprint,
      };
    }

    if (intencion === 'AMBIGUA') {
      const aclaracion = generateAutomaticClarification(mensaje, catalog);

      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            estado: 'COMPLETADA',
            intencion: 'AMBIGUA',
            id_servicio: null,
            historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            contextFingerprint: currentContextFingerprint,
          }),
          accion: 'ACLARACION',
          requiere_revision: true,
          resultado_revision: aclaracion,
        },
      });

      await db.$executeRaw`
        UPDATE dbo.Interacciones
        SET resultado='Aclaración requerida'
        WHERE id_interaccion=${id_interaccion}
      `;

      return {
        id_persona,
        id_captacion,
        id_interaccion,
        id_decision: decisionRecord.id_decision,
        estado: 'COMPLETADA',
        intencion: 'AMBIGUA',
        id_servicio: null,
        accion: 'ACLARACION',
        etapa_final: currentStageName,
        aclaracion,
        historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
        intentosRealizados,
        intentos_realizados: intentosRealizados,
        duracionTotalMs,
        duracion_total_ms: duracionTotalMs,
        entregaLeadEstado: 'NO_APLICA',
        contextFingerprint: currentContextFingerprint,
      };
    }

    // intencion === 'SOLO_CONSULTA'
    await db.decisionesIA.update({
      where: { id_decision: decisionRecord.id_decision },
      data: {
        decision: JSON.stringify({
          estado: 'COMPLETADA',
          intencion: 'SOLO_CONSULTA',
          id_servicio,
          historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
          intentosRealizados,
          intentos_realizados: intentosRealizados,
          duracionTotalMs,
          duracion_total_ms: duracionTotalMs,
          contextFingerprint: currentContextFingerprint,
        }),
        accion: 'SOLO_CONSULTA',
        requiere_revision: false,
        resultado_revision: `Consulta informativa registrada; el contacto permanece en etapa ${currentStageName}.`,
      },
    });

    await db.$executeRaw`
      UPDATE dbo.Interacciones
      SET resultado='Consulta Informativa'
      WHERE id_interaccion=${id_interaccion}
    `;

    return {
      id_persona,
      id_captacion,
      id_interaccion,
      id_decision: decisionRecord.id_decision,
      estado: 'COMPLETADA',
      intencion: 'SOLO_CONSULTA',
      id_servicio,
      accion: 'SOLO_CONSULTA',
      etapa_final: currentStageName,
      historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined,
      intentosRealizados,
      intentos_realizados: intentosRealizados,
      duracionTotalMs,
      duracion_total_ms: duracionTotalMs,
      entregaLeadEstado: 'NO_APLICA',
      contextFingerprint: currentContextFingerprint,
    };
  }

  /**
   * Reintenta la evaluación de un mensaje específico a partir de su id_interaccion.
   * Evita registrar una nueva interacción y reutiliza el identificador existente.
   */
  public static async retryEvaluationByInteraction(
    id_interaccion: number,
    options?: {
      dbClient?: PrismaClient;
      classifierOverride?: (
        mensaje: string,
        catalogo: ServiceCatalogItem[]
      ) => Promise<BuyerClassificationResult>;
      classifierOptions?: BuyerClassifierOptions;
    }
  ): Promise<BuyerEvaluationOutcome> {
    const db = options?.dbClient || defaultPrisma;

    const interaction = await db.interacciones.findUnique({
      where: { id_interaccion },
    });

    if (!interaction) {
      throw new Error(`Interacción con ID ${id_interaccion} no encontrada.`);
    }

    const [capture] = await db.$queryRaw<{ id_captacion: number; id_servicio: number | null; motivo_consulta: string | null }[]>`
      SELECT TOP (1) id_captacion, id_servicio, motivo_consulta
      FROM dbo.CaptacionesBuyer
      WHERE id_persona=${interaction.id_persona}
      ORDER BY id_captacion ASC
    `;

    if (!capture) {
      throw new Error(`No se encontró captación Buyer asociada a la persona ${interaction.id_persona}.`);
    }

    // RECONSTRUCCIÓN DESDE LA ENTRADA PERSISTIDA (Punto 2):
    // Reconstruye el servicio declarado, contexto y motivo desde la decisión previa
    const priorDecision = await db.decisionesIA.findFirst({
      where: { agente: 'BUYER', id_interaccion },
      orderBy: { id_decision: 'desc' },
    });

    let reconstructedServiceId: number | null = capture.id_servicio;
    let reconstructedContext: BuyerClarificationContext | null = null;
    let reconstructedMotivo: string | null = capture.motivo_consulta;

    if (priorDecision?.entrada) {
      try {
        const parsedEntrada = JSON.parse(priorDecision.entrada);
        if (parsedEntrada.id_servicio_declarado !== undefined) {
          reconstructedServiceId = parsedEntrada.id_servicio_declarado;
        }
        if (parsedEntrada.contextoConversacional) {
          reconstructedContext = parsedEntrada.contextoConversacional;
        }
        if (parsedEntrada.motivo_consulta) {
          reconstructedMotivo = parsedEntrada.motivo_consulta;
        }
      } catch {
        // En caso de parse corrupto, conservar valores de captura
      }
    }

    return this.evaluateBuyerInteraction({
      id_persona: interaction.id_persona,
      id_captacion: capture.id_captacion,
      id_interaccion: interaction.id_interaccion,
      mensaje: interaction.mensaje || '',
      id_servicio_declarado: reconstructedServiceId,
      motivo_consulta: reconstructedMotivo,
      contextoConversacional: reconstructedContext || undefined,
      dbClient: db,
      classifierOverride: options?.classifierOverride,
      classifierOptions: options?.classifierOptions,
    });
  }

  /**
   * Recupera entregas a LEAD que quedaron en estado PENDIENTE tras confirmarse la conversión en SQL.
   */
  public static async recoverPendingLeadDeliveries(options?: {
    dbClient?: PrismaClient;
  }): Promise<{
    recuperadas: number;
    errores: number;
  }> {
    const db = options?.dbClient || defaultPrisma;
    const pendingConversions = await db.decisionesIA.findMany({
      where: {
        agente: 'BUYER',
        accion: 'CONVERSION_LEAD',
        decision: { contains: '"entregaLeadEstado":"PENDIENTE"' },
      },
    });

    let recuperadas = 0;
    let errores = 0;

    for (const dec of pendingConversions) {
      try {
        const parsed = JSON.parse(dec.decision || '{}');
        const requestId = parsed.id_solicitud;
        if (!requestId) continue;

        const intake = await registerLeadIntake(requestId, db as any);
        if (intake?.id_solicitud) {
          parsed.entregaLeadEstado = 'CONFIRMADA';
          await db.decisionesIA.update({
            where: { id_decision: dec.id_decision },
            data: {
              decision: JSON.stringify(parsed),
              requiere_revision: false,
              resultado_revision: `Entrega recuperada y confirmada en LEAD (Solicitud #${requestId}).`,
            },
          });
          recuperadas++;
        }
      } catch (e) {
        errores++;
      }
    }

    return { recuperadas, errores };
  }

  /**
   * Recupera evaluaciones en estado PENDIENTE de forma persistente.
   * Reanuda clasificaciones pendientes y entregas a LEAD tras reiniciar el backend.
   */
  public static async recoverPendingEvaluations(options?: {
    dbClient?: PrismaClient;
    classifierOverride?: (
      mensaje: string,
      catalogo: ServiceCatalogItem[]
    ) => Promise<BuyerClassificationResult>;
    classifierOptions?: BuyerClassifierOptions;
  }): Promise<{
    totalEncontradas: number;
    recuperadasExitosamente: number;
    fallidas: number;
    entregasLeadRecuperadas: number;
    resultados: BuyerEvaluationOutcome[];
  }> {
    const db = options?.dbClient || defaultPrisma;

    // 1. Recuperar entregas a LEAD pendientes de confirmación
    const handoffRecovery = await this.recoverPendingLeadDeliveries({ dbClient: db });

    // 2. Buscar decisiones de BUYER pendientes de clasificación
    const pendingDecisions = await db.decisionesIA.findMany({
      where: {
        agente: 'BUYER',
        OR: [
          { decision: { contains: '"estado":"PENDIENTE"' } },
          { accion: 'REINTENTO_PENDIENTE' },
        ],
        id_interaccion: { not: null },
      },
      orderBy: { id_decision: 'asc' },
    });

    const resultados: BuyerEvaluationOutcome[] = [];
    let exitosas = 0;
    let fallidas = 0;

    for (const dec of pendingDecisions) {
      if (!dec.id_interaccion) continue;

      try {
        const resultado = await this.retryEvaluationByInteraction(dec.id_interaccion, options);
        resultados.push(resultado);
        if (resultado.estado === 'COMPLETADA') {
          exitosas++;
        } else {
          fallidas++;
        }
      } catch (err: any) {
        fallidas++;
        resultados.push({
          id_persona: dec.id_persona || 0,
          id_captacion: dec.id_captacion || 0,
          id_interaccion: dec.id_interaccion,
          id_decision: dec.id_decision,
          estado: 'FALLIDA',
          intencion: null,
          id_servicio: null,
          accion: 'REINTENTO_PENDIENTE',
          etapa_final: 'BUYER',
          error: err?.message || 'Error en recuperación',
          intentosRealizados: 1,
          duracionTotalMs: 0,
          entregaLeadEstado: 'PENDIENTE',
        });
      }
    }

    return {
      totalEncontradas: pendingDecisions.length,
      recuperadasExitosamente: exitosas,
      fallidas,
      entregasLeadRecuperadas: handoffRecovery.recuperadas,
      resultados,
    };
  }
}
