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
  contextoConversacional?: BuyerClarificationContext;
  dbClient?: PrismaClient | Prisma.TransactionClient;
  classifierOverride?: (
    mensaje: string,
    catalogo: ServiceCatalogItem[]
  ) => Promise<BuyerClassificationResult>;
  classifierOptions?: BuyerClassifierOptions;
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

    // Preparar contexto persistente
    const inputPayload = JSON.stringify({
      mensaje,
      id_persona,
      id_captacion,
      id_interaccion,
      motivo_consulta: input.motivo_consulta || null,
      sede_preferida: input.sede_preferida || null,
      id_servicio_declarado: input.id_servicio_declarado || null,
      contextoConversacional: input.contextoConversacional || null,
      catalogo_snapshot: catalog.map(c => ({ id: c.id_servicio, nombre: c.nombre })),
      fecha_evaluacion: new Date().toISOString(),
    });

    // 2. Localizar o registrar registro de evaluación en dbo.DecisionesIA
    let decisionRecord = await db.decisionesIA.findFirst({
      where: {
        agente: 'BUYER',
        id_interaccion,
      },
      orderBy: { id_decision: 'desc' },
    });

    // Si ya existe una decisión COMPLETADA para esta interacción, devolverla inmediatamente (idempotencia)
    if (decisionRecord && decisionRecord.decision?.includes('"estado":"COMPLETADA"')) {
      try {
        const parsed = JSON.parse(decisionRecord.decision);
        const person = await db.personas.findUnique({
          where: { id_persona },
          include: { Etapa: true },
        });
        return {
          id_persona,
          id_captacion,
          id_interaccion,
          id_decision: decisionRecord.id_decision,
          estado: 'COMPLETADA',
          intencion: parsed.intencion ?? null,
          id_servicio: parsed.id_servicio ?? null,
          accion: (decisionRecord.accion as BuyerEvaluationAction) || 'SOLO_CONSULTA',
          etapa_final: person?.Etapa?.nombre || 'BUYER',
          id_solicitud: parsed.id_solicitud ?? null,
          id_evento_etapa: parsed.id_evento_etapa ?? null,
          ya_convertido: true,
          aclaracion: decisionRecord.resultado_revision ?? null,
          intentosRealizados: parsed.intentosRealizados ?? parsed.intentos_realizados ?? 1,
          intentos_realizados: parsed.intentosRealizados ?? parsed.intentos_realizados ?? 1,
          duracionTotalMs: parsed.duracionTotalMs ?? parsed.duracion_total_ms ?? 0,
          duracion_total_ms: parsed.duracionTotalMs ?? parsed.duracion_total_ms ?? 0,
          entregaLeadEstado: parsed.entregaLeadEstado ?? 'NO_APLICA',
        };
      } catch {
        // En caso de parse corrupto, continuar reevaluación
      }
    }

    if (!decisionRecord) {
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
          }),
          accion: 'REINTENTO_PENDIENTE',
          requiere_revision: true,
          resultado_revision: 'Evaluación inicial encolada en transacción',
        },
      });
    }

    // 3. Ejecutar clasificación fuera de la transacción SQL
    // Si hay contexto de aclaración de dos turnos, enriquecer el prompt
    let textToClassify = mensaje;
    if (input.contextoConversacional?.mensajeAnterior) {
      textToClassify = `Consulta previa del paciente: "${input.contextoConversacional.mensajeAnterior}". Aclaración o respuesta actual: "${mensaje}"`;
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
      const attemptsCount = classifyErr?.intentosRealizados ?? classifyErr?.intentos ?? 1;
      const totalDuration = classifyErr?.duracionTotalMs ?? 0;

      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            estado: 'PENDIENTE',
            intencion: null,
            id_servicio: null,
            error: sanitizedError,
            intentosRealizados: attemptsCount,
            intentos_realizados: attemptsCount,
            duracionTotalMs: totalDuration,
            duracion_total_ms: totalDuration,
          }),
          accion: 'REINTENTO_PENDIENTE',
          requiere_revision: true,
          resultado_revision: `Fallo clasificador: ${sanitizedError}`,
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
        intentosRealizados: attemptsCount,
        intentos_realizados: attemptsCount,
        duracionTotalMs: totalDuration,
        duracion_total_ms: totalDuration,
        entregaLeadEstado: 'PENDIENTE',
      };
    }

    const { intencion, id_servicio, intentosRealizados, duracionTotalMs } = classification;

    // 4. Obtener estado de la persona y etapa actual
    const person = await db.personas.findUnique({
      where: { id_persona },
      include: { Etapa: true },
    });

    if (!person) {
      throw new Error(`Persona con ID ${id_persona} no encontrada.`);
    }

    const currentStageName = person.Etapa?.nombre || 'BUYER';

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
              intentosRealizados,
              intentos_realizados: intentosRealizados,
              duracionTotalMs,
              duracion_total_ms: duracionTotalMs,
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
          intentosRealizados,
          intentos_realizados: intentosRealizados,
          duracionTotalMs,
          duracion_total_ms: duracionTotalMs,
          entregaLeadEstado: 'NO_APLICA',
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
              intentosRealizados,
              intentos_realizados: intentosRealizados,
              duracionTotalMs,
              duracion_total_ms: duracionTotalMs,
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
          intentosRealizados,
          intentos_realizados: intentosRealizados,
          duracionTotalMs,
          duracion_total_ms: duracionTotalMs,
          entregaLeadEstado: 'NO_APLICA',
        };
      }

      // REGLA 5: Si el contacto ya está en una etapa posterior (LEAD, PAYER, CUSTOMER, TURNED)
      if (currentStageName !== 'BUYER') {
        const hasEvidence = hasContextualEvidenceForOpportunity(mensaje, input.motivo_consulta);

        if (hasEvidence) {
          // Vinculación únicamente cuando exista evidencia contextual
          const existingOpenSolicitud = await db.solicitudes.findFirst({
            where: { id_persona, estado: 'Abierta' },
            select: { id_solicitud: true },
            orderBy: { id_solicitud: 'desc' },
          });

          if (existingOpenSolicitud) {
            await db.$executeRaw`
              UPDATE dbo.Interacciones
              SET id_solicitud=${existingOpenSolicitud.id_solicitud}, resultado='Mensaje vinculado a oportunidad existente por evidencia contextual'
              WHERE id_interaccion=${id_interaccion}
            `;
          }

          await db.decisionesIA.update({
            where: { id_decision: decisionRecord.id_decision },
            data: {
              decision: JSON.stringify({
                estado: 'COMPLETADA',
                intencion,
                id_servicio: effectiveServiceId,
                intentosRealizados,
                intentos_realizados: intentosRealizados,
                duracionTotalMs,
                duracion_total_ms: duracionTotalMs,
              }),
              accion: 'CONSERVA_ETAPA_POSTERIOR',
              requiere_revision: false,
              resultado_revision: `Contacto en etapa ${currentStageName}. Se conserva etapa; mensaje vinculado a oportunidad abierta previa por evidencia contextual.`,
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
            id_solicitud: existingOpenSolicitud?.id_solicitud ?? null,
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            entregaLeadEstado: 'NO_APLICA',
          };
        } else {
          // Sin evidencia contextual hacia la oportunidad anterior: mantener nueva solicitud pendiente de apertura
          await db.decisionesIA.update({
            where: { id_decision: decisionRecord.id_decision },
            data: {
              decision: JSON.stringify({
                estado: 'COMPLETADA',
                intencion,
                id_servicio: effectiveServiceId,
                intentosRealizados,
                intentos_realizados: intentosRealizados,
                duracionTotalMs,
                duracion_total_ms: duracionTotalMs,
              }),
              accion: 'SOLICITUD_PENDIENTE_APERTURA',
              requiere_revision: true,
              resultado_revision: `Contacto en etapa ${currentStageName} solicitó nuevo servicio sin referencia a oportunidad previa. Pendiente de apertura de nueva solicitud por LEAD.`,
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
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            entregaLeadEstado: 'NO_APLICA',
          };
        }
      }

      // El contacto está en BUYER y solicita reserva con requisitos cumplidos:
      const motivoLead = String(mensaje || input.motivo_consulta || 'Solicitud de reserva Buyer').slice(0, 200);

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
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
            id_solicitud: conversionResult.id_solicitud,
            id_evento_etapa: conversionResult.id_evento_etapa,
            entregaLeadEstado: 'PENDIENTE',
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
                intentosRealizados,
                intentos_realizados: intentosRealizados,
                duracionTotalMs,
                duracion_total_ms: duracionTotalMs,
                id_solicitud: conversionResult.id_solicitud,
                id_evento_etapa: conversionResult.id_evento_etapa,
                entregaLeadEstado: 'CONFIRMADA',
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
        intentosRealizados,
        intentos_realizados: intentosRealizados,
        duracionTotalMs,
        duracion_total_ms: duracionTotalMs,
        entregaLeadEstado: entregaLeadConfirmada ? 'CONFIRMADA' : 'PENDIENTE',
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
            intentosRealizados,
            intentos_realizados: intentosRealizados,
            duracionTotalMs,
            duracion_total_ms: duracionTotalMs,
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
        intentosRealizados,
        intentos_realizados: intentosRealizados,
        duracionTotalMs,
        duracion_total_ms: duracionTotalMs,
        entregaLeadEstado: 'NO_APLICA',
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
          intentosRealizados,
          intentos_realizados: intentosRealizados,
          duracionTotalMs,
          duracion_total_ms: duracionTotalMs,
        }),
        accion: 'SOLO_CONSULTA',
        requiere_revision: false,
        resultado_revision: 'Consulta informativa registrada; el contacto permanece en etapa BUYER.',
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
      intentosRealizados,
      intentos_realizados: intentosRealizados,
      duracionTotalMs,
      duracion_total_ms: duracionTotalMs,
      entregaLeadEstado: 'NO_APLICA',
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

    return this.evaluateBuyerInteraction({
      id_persona: interaction.id_persona,
      id_captacion: capture.id_captacion,
      id_interaccion: interaction.id_interaccion,
      mensaje: interaction.mensaje || '',
      id_servicio_declarado: capture.id_servicio,
      motivo_consulta: capture.motivo_consulta,
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
