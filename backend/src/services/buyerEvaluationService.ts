import { PrismaClient, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../db';
import { classifyBuyerMessage } from './buyerMessageClassifier';
import type {
  ServiceCatalogItem,
  BuyerClassificationResult,
  BuyerClassifierOptions,
  BuyerEvaluationOutcome,
  BuyerIntention,
  BuyerEvaluationStatus,
  BuyerEvaluationAction,
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
 * Genera una aclaración automática cordial y contextual cuando la intención
 * es AMBIGUA o falta información para determinar el servicio y la reserva.
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

  if (lower.includes('horario') || lower.includes('atencion') || lower.includes('atención') || lower.includes('abierto')) {
    return 'Atendemos de lunes a sábado de 8:00 AM a 8:00 PM. ¿Te gustaría coordinar una cita de evaluación odontológica o consultar por alguna sede en particular?';
  }

  if (lower.includes('dolor') || lower.includes('molestia') || lower.includes('urgencia') || lower.includes('emergencia')) {
    return 'Lamentamos la molestia que sientes. Te recomendamos una Evaluación Odontológica prioritaria para que el especialista te revise hoy mismo. ¿Deseas que te reservemos un turno?';
  }

  return 'Gracias por escribir a NexoSalud. ¿Deseas solicitar una cita de reserva para algún tratamiento específico o necesitas consultar información sobre nuestros servicios odontológicos?';
}

export interface EvaluateBuyerInteractionInput {
  id_persona: number;
  id_captacion: number;
  id_interaccion: number;
  mensaje: string;
  id_servicio_declarado?: number | null;
  motivo_consulta?: string | null;
  sede_preferida?: string | null;
  dbClient?: PrismaClient | Prisma.TransactionClient;
  classifierOverride?: (
    mensaje: string,
    catalogo: ServiceCatalogItem[]
  ) => Promise<BuyerClassificationResult>;
  classifierOptions?: BuyerClassifierOptions;
}

/**
 * Servicio central de orquestación y persistencia del flujo Buyer.
 * Registra la evaluación en dbo.DecisionesIA, ejecuta Gemini fuera de la transacción SQL,
 * gestiona transiciones hacia LEAD vía dbo.usp_ConvertirBuyerALead y asegura la recuperabilidad.
 */
export class BuyerEvaluationService {
  /**
   * Ejecuta la evaluación completa de un mensaje Buyer persistido previamente.
   */
  public static async evaluateBuyerInteraction(
    input: EvaluateBuyerInteractionInput
  ): Promise<BuyerEvaluationOutcome> {
    const db = (input.dbClient || defaultPrisma) as PrismaClient;
    const { id_persona, id_captacion, id_interaccion, mensaje } = input;

    // 1. Obtener catálogo activo real de servicios
    const catalog = await getActiveServices(db);

    // Contexto de entrada persistente
    const inputPayload = JSON.stringify({
      mensaje,
      id_persona,
      id_captacion,
      id_interaccion,
      motivo_consulta: input.motivo_consulta || null,
      sede_preferida: input.sede_preferida || null,
      id_servicio_declarado: input.id_servicio_declarado || null,
      catalogo_snapshot: catalog.map(c => ({ id: c.id_servicio, nombre: c.nombre })),
      fecha_evaluacion: new Date().toISOString(),
    });

    // 2. Registrar o localizar registro de evaluación en dbo.DecisionesIA (Estado inicial: PENDIENTE)
    let decisionRecord = await db.decisionesIA.findFirst({
      where: {
        agente: 'BUYER',
        id_interaccion,
      },
      orderBy: { id_decision: 'desc' },
    });

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
          }),
          accion: 'REINTENTO_PENDIENTE',
          requiere_revision: true,
          resultado_revision: 'Evaluación pendiente de clasificación',
        },
      });
    }

    // 3. Ejecutar clasificación fuera de la transacción SQL
    let classification: BuyerClassificationResult;
    try {
      if (input.classifierOverride) {
        classification = await input.classifierOverride(mensaje, catalog);
      } else {
        classification = await classifyBuyerMessage(mensaje, catalog, input.classifierOptions);
      }
    } catch (classifyErr: any) {
      const sanitizedError = String(classifyErr?.message || 'Error desconocido al clasificar mensaje').slice(0, 250);
      const attemptsCount = classifyErr?.intentos ?? 1;
      const totalDuration = classifyErr?.duracionTotalMs ?? 0;

      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            estado: 'PENDIENTE',
            intencion: null,
            id_servicio: null,
            error: sanitizedError,
            intentos_realizados: attemptsCount,
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
        intentos_realizados: attemptsCount,
        duracion_total_ms: totalDuration,
      };
    }

    const { intencion, id_servicio, intentos_realizados, duracion_total_ms } = classification;

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
              id_servicio,
              intentos_realizados,
              duracion_total_ms,
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
          id_servicio,
          accion: 'REQUISITOS_INCOMPLETOS',
          etapa_final: currentStageName,
          intentos_realizados,
          duracion_total_ms,
        };
      }

      // Si el contacto ya está en una etapa posterior (LEAD, PAYER, CUSTOMER, TURNED)
      if (currentStageName !== 'BUYER') {
        // Conservar su etapa actual
        const existingOpenSolicitud = await db.solicitudes.findFirst({
          where: { id_persona, estado: 'Abierta' },
          select: { id_solicitud: true },
          orderBy: { id_solicitud: 'desc' },
        });

        if (existingOpenSolicitud) {
          await db.$executeRaw`
            UPDATE dbo.Interacciones
            SET id_solicitud=${existingOpenSolicitud.id_solicitud}, resultado='Mensaje asociado a oportunidad existente'
            WHERE id_interaccion=${id_interaccion}
          `;
        }

        await db.decisionesIA.update({
          where: { id_decision: decisionRecord.id_decision },
          data: {
            decision: JSON.stringify({
              estado: 'COMPLETADA',
              intencion,
              id_servicio,
              intentos_realizados,
              duracion_total_ms,
            }),
            accion: 'CONSERVA_ETAPA_POSTERIOR',
            requiere_revision: false,
            resultado_revision: `Contacto en etapa ${currentStageName}. Se conserva etapa; oportunidad vinculada o pendiente de contrato con LEAD.`,
          },
        });

        return {
          id_persona,
          id_captacion,
          id_interaccion,
          id_decision: decisionRecord.id_decision,
          estado: 'COMPLETADA',
          intencion,
          id_servicio,
          accion: 'CONSERVA_ETAPA_POSTERIOR',
          etapa_final: currentStageName,
          id_solicitud: existingOpenSolicitud?.id_solicitud ?? null,
          intentos_realizados,
          duracion_total_ms,
        };
      }

      // El contacto está en BUYER y solicita reserva con requisitos cumplidos:
      // Resolver servicio activo efectivo
      let effectiveServiceId = id_servicio;
      if (!effectiveServiceId || !catalog.some(s => s.id_servicio === effectiveServiceId)) {
        if (input.id_servicio_declarado && catalog.some(s => s.id_servicio === input.id_servicio_declarado)) {
          effectiveServiceId = input.id_servicio_declarado;
        } else {
          // Si no indicó servicio específico, asociar a Evaluación Odontológica (id_servicio: 1 o primer activo)
          effectiveServiceId = catalog[0]?.id_servicio ?? 1;
        }
      }

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

      // Registrar decisión exitosa
      await db.decisionesIA.update({
        where: { id_decision: decisionRecord.id_decision },
        data: {
          decision: JSON.stringify({
            estado: 'COMPLETADA',
            intencion,
            id_servicio: effectiveServiceId,
            intentos_realizados,
            duracion_total_ms,
          }),
          accion: 'CONVERSION_LEAD',
          requiere_revision: false,
          resultado_revision: `Conversión confirmada a LEAD (Solicitud #${conversionResult.id_solicitud}).`,
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
        accion: 'CONVERSION_LEAD',
        etapa_final: 'LEAD',
        id_solicitud: conversionResult.id_solicitud,
        id_evento_etapa: conversionResult.id_evento_etapa,
        ya_convertido: Boolean(conversionResult.ya_convertido),
        intentos_realizados,
        duracion_total_ms,
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
            intentos_realizados,
            duracion_total_ms,
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
        intentos_realizados,
        duracion_total_ms,
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
          intentos_realizados,
          duracion_total_ms,
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
      intentos_realizados,
      duracion_total_ms,
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
   * Recupera evaluaciones en estado PENDIENTE de forma persistente.
   * Permite reanudar el procesamiento tras reiniciar el backend sin duplicar interacciones.
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
    resultados: BuyerEvaluationOutcome[];
  }> {
    const db = options?.dbClient || defaultPrisma;

    // Buscar decisiones de BUYER pendientes
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
        });
      }
    }

    return {
      totalEncontradas: pendingDecisions.length,
      recuperadasExitosamente: exitosas,
      fallidas,
      resultados,
    };
  }
}
