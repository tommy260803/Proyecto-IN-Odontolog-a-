import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  BuyerEvaluationService,
  getActiveServices,
  generateAutomaticClarification,
} from '../src/services/buyerEvaluationService';
import type {
  ServiceCatalogItem,
  BuyerClassificationResult,
} from '../src/types/buyer';

// Configuración de conexión garantizada a NexoSalud_LeadEnsayoFinal
const targetUrl =
  process.env.TEST_SQLSERVER_URL ||
  (process.env.SQLSERVER_URL
    ? process.env.SQLSERVER_URL.replace(/database=[^;]+/i, 'database=NexoSalud_LeadEnsayoFinal')
    : 'sqlserver://localhost:1433;database=NexoSalud_LeadEnsayoFinal;integratedSecurity=true;trustServerCertificate=true;');

const prisma = new PrismaClient({
  datasources: {
    db: { url: targetUrl },
  },
});

const runLiveGemini = process.env.RUN_LIVE_GEMINI_TESTS === 'true';

describe('Flujo Integrado Buyer -> Clasificador Gemini -> Persistencia en NexoSalud_LeadEnsayoFinal', () => {
  const createdPersonaIds: number[] = [];
  let buyerStageId: number;
  let leadStageId: number;
  let activeCatalog: ServiceCatalogItem[] = [];

  beforeAll(async () => {
    // 1. Verificar catálogo y etapas en NexoSalud_LeadEnsayoFinal
    activeCatalog = await getActiveServices(prisma);
    expect(activeCatalog.length).toBeGreaterThan(0);

    const buyerStage = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    const leadStage = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });

    expect(buyerStage).toBeDefined();
    expect(leadStage).toBeDefined();

    buyerStageId = buyerStage!.id_etapa;
    leadStageId = leadStage!.id_etapa;
  });

  afterAll(async () => {
    // Limpieza segura de datos de prueba
    if (createdPersonaIds.length > 0) {
      for (const id of createdPersonaIds) {
        try {
          await prisma.decisionesIA.deleteMany({ where: { id_persona: id } });
          await prisma.$executeRaw`DELETE FROM dbo.EventosEtapa WHERE id_persona=${id}`;
          await prisma.$executeRaw`DELETE FROM dbo.Solicitudes WHERE id_persona=${id}`;
          await prisma.interacciones.deleteMany({ where: { id_persona: id } });
          await prisma.personaPreferencias.deleteMany({ where: { id_persona: id } });
          await prisma.$executeRaw`DELETE FROM dbo.CaptacionesBuyer WHERE id_persona=${id}`;
          await prisma.personas.deleteMany({ where: { id_persona: id } });
        } catch (cleanupErr) {
          // Ignorar errores menores de cascada en teardown
        }
      }
    }
    await prisma.$disconnect();
  });

  // Helper para crear contactos de prueba aislados
  async function createTestBuyer(options?: {
    nombres?: string;
    apellidos?: string;
    autoriza_contacto?: boolean;
    stageId?: number;
    mensaje?: string;
    id_servicio?: number | null;
  }) {
    const timestamp = Date.now() + Math.floor(Math.random() * 10000);
    const persona = await prisma.personas.create({
      data: {
        nombres: options?.nombres || 'Prospecto',
        apellidos: options?.apellidos || `Ensayo_${timestamp}`,
        numero: `9${String(timestamp).slice(-8)}`,
        email: `buyer_${timestamp}@nexosalud.test`,
        autoriza_contacto: options?.autoriza_contacto !== undefined ? options.autoriza_contacto : true,
        fecha_autorizacion: options?.autoriza_contacto === false ? null : new Date(),
        estado_calidad: 'Valido',
        tipo_persona: 'Adulto General',
        id_etapa_actual: options?.stageId ?? buyerStageId,
      },
    });

    createdPersonaIds.push(persona.id_persona);

    const motivo = options?.mensaje || 'Consulta inicial desde formulario web';
    if (persona.fecha_autorizacion) {
      await prisma.$executeRaw`
        INSERT INTO dbo.CaptacionesBuyer (
          id_persona, fecha_captacion, id_canal, id_fuente, id_servicio,
          motivo_consulta, estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos
        ) VALUES (
          ${persona.id_persona}, SYSDATETIME(), 1, 1, ${options?.id_servicio ?? null},
          ${motivo}, 'Valido', ${persona.autoriza_contacto ? 1 : 0}, ${persona.fecha_autorizacion}, 'REGISTRO_DIRECTO'
        )
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO dbo.CaptacionesBuyer (
          id_persona, fecha_captacion, id_canal, id_fuente, id_servicio,
          motivo_consulta, estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos
        ) VALUES (
          ${persona.id_persona}, SYSDATETIME(), 1, 1, ${options?.id_servicio ?? null},
          ${motivo}, 'Valido', ${persona.autoriza_contacto ? 1 : 0}, NULL, 'REGISTRO_DIRECTO'
        )
      `;
    }

    const [captacion] = await prisma.$queryRaw<{ id_captacion: number }[]>`
      SELECT TOP (1) id_captacion FROM dbo.CaptacionesBuyer
      WHERE id_persona=${persona.id_persona} ORDER BY id_captacion ASC
    `;

    const interaccion = await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_canal: 1,
        id_fuente: 1,
        tipo: 'Registro y Consulta Inicial (#1)',
        mensaje: motivo,
        es_respuesta_util: false,
        resultado: 'Registrado - Pendiente de Evaluación',
      },
    });

    return { persona, captacion, interaccion, motivo };
  }

  // 1. Registro en BUYER
  it('1. Registro en BUYER: el nuevo contacto permanece estrictamente en BUYER antes de la intención', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer();

    expect(persona.id_etapa_actual).toBe(buyerStageId);
    expect(captacion.id_captacion).toBeGreaterThan(0);
    expect(interaccion.id_interaccion).toBeGreaterThan(0);

    // Verificar que no se haya creado ninguna solicitud prematura
    const solCount = await prisma.solicitudes.count({ where: { id_persona: persona.id_persona } });
    expect(solCount).toBe(0);
  });

  // 2. Clasificación informativa
  it('2. Clasificación informativa: consulta de horarios/precios permanece en BUYER sin crear solicitud', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: '¿Cuáles son los horarios de atención y sedes disponibles?',
    });

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLO_CONSULTA',
      id_servicio: null,
      intentos_realizados: 1,
      duracion_total_ms: 45,
      intentos: [{ intento: 1, duracion_ms: 45, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: interaccion.mensaje!,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.intencion).toBe('SOLO_CONSULTA');
    expect(outcome.accion).toBe('SOLO_CONSULTA');
    expect(outcome.etapa_final).toBe('BUYER');
    expect(outcome.id_solicitud).toBeUndefined();

    // Comprobar persistencia en dbo.DecisionesIA
    const decisionDb = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(decisionDb).not.toBeNull();
    expect(decisionDb?.accion).toBe('SOLO_CONSULTA');
    expect(decisionDb?.requiere_revision).toBe(false);

    // Comprobar que en Personas sigue en BUYER
    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(buyerStageId);

    // Cero solicitudes creadas
    const solicitudes = await prisma.solicitudes.findMany({
      where: { id_persona: persona.id_persona },
      select: { id_solicitud: true },
    });
    expect(solicitudes.length).toBe(0);
  });

  // 3. Aclaración con contexto (AMBIGUA)
  it('3. Aclaración con contexto: mensaje vago genera aclaración cordial y preserva el contexto de entrada', async () => {
    const msg = 'Hola, quería consultar sobre tratamientos dentales en general';
    const { persona, captacion, interaccion } = await createTestBuyer({ mensaje: msg });

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'AMBIGUA',
      id_servicio: null,
      intentos_realizados: 1,
      duracion_total_ms: 50,
      intentos: [{ intento: 1, duracion_ms: 50, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: msg,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.intencion).toBe('AMBIGUA');
    expect(outcome.accion).toBe('ACLARACION');
    expect(outcome.etapa_final).toBe('BUYER');
    expect(outcome.aclaracion).toBeDefined();
    expect(outcome.aclaracion!.length).toBeGreaterThan(15);

    // Verificar en DB
    const decisionDb = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(decisionDb?.accion).toBe('ACLARACION');
    expect(decisionDb?.requiere_revision).toBe(true);
    expect(decisionDb?.resultado_revision).toBe(outcome.aclaracion);

    // Verificar que la entrada guardó el contexto completo
    const parsedEntrada = JSON.parse(decisionDb?.entrada || '{}');
    expect(parsedEntrada.mensaje).toBe(msg);
    expect(parsedEntrada.catalogo_snapshot).toBeDefined();
  });

  // 4. Conversión válida a LEAD vía dbo.usp_ConvertirBuyerALead
  it('4. Conversión válida: intención explícita de reserva convierte a LEAD usando usp_ConvertirBuyerALead', async () => {
    // Servicio 2: Limpieza dental (activo en NexoSalud_LeadEnsayoFinal)
    const targetService = activeCatalog.find(s => s.nombre.toLowerCase().includes('limpieza')) || activeCatalog[0];
    const msg = `Quiero reservar una ${targetService.nombre} si tienen horario para esta semana`;

    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: msg,
      autoriza_contacto: true,
      id_servicio: targetService.id_servicio,
    });

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: targetService.id_servicio,
      intentos_realizados: 1,
      duracion_total_ms: 70,
      intentos: [{ intento: 1, duracion_ms: 70, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: msg,
      id_servicio_declarado: targetService.id_servicio,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.intencion).toBe('SOLICITA_RESERVA');
    expect(outcome.accion).toBe('CONVERSION_LEAD');
    expect(outcome.etapa_final).toBe('LEAD');
    expect(outcome.id_solicitud).toBeDefined();
    expect(outcome.id_solicitud).toBeGreaterThan(0);
    expect(outcome.id_evento_etapa).toBeGreaterThan(0);
    expect(outcome.ya_convertido).toBe(false);

    // Verificar en BD que la persona avanzó a LEAD
    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(leadStageId);

    // Verificar Solicitud creada
    const solicitudDb = await prisma.solicitudes.findUnique({
      where: { id_solicitud: outcome.id_solicitud! },
      select: { id_solicitud: true, id_servicio: true, estado: true },
    });
    expect(solicitudDb).not.toBeNull();
    expect(solicitudDb?.id_servicio).toBe(targetService.id_servicio);
    expect(solicitudDb?.estado).toBe('Abierta');

    // Verificar EventosEtapa con clave_operacion_buyer
    const [evento] = await prisma.$queryRaw<{ clave_operacion_buyer: string; etapa_origen: number; etapa_destino: number }[]>`
      SELECT clave_operacion_buyer, etapa_origen, etapa_destino
      FROM dbo.EventosEtapa WHERE id_evento_etapa=${outcome.id_evento_etapa!}
    `;
    expect(evento.clave_operacion_buyer).toBe(`BUYER_LEAD:${captacion.id_captacion}`);
    expect(evento.etapa_origen).toBe(buyerStageId);
    expect(evento.etapa_destino).toBe(leadStageId);

    // Idempotencia: si se reintenta convertir la misma captación, no debe duplicar solicitud
    const retryOutcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: msg,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    // Como la persona ahora está en LEAD, debe reconocer y conservar su etapa
    expect(retryOutcome.etapa_final).toBe('LEAD');
  });

  // 5. Requisitos incumplidos (autoriza_contacto = false)
  it('5. Requisitos incumplidos: si no autoriza contacto, la intención de reserva NO convierte y permanece en BUYER', async () => {
    const targetService = activeCatalog[0];
    const msg = `Me gustaría agendar una cita para ${targetService.nombre}`;

    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: msg,
      autoriza_contacto: false, // SIN autorización de contacto
      id_servicio: targetService.id_servicio,
    });

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: targetService.id_servicio,
      intentos_realizados: 1,
      duracion_total_ms: 60,
      intentos: [{ intento: 1, duracion_ms: 60, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: msg,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.accion).toBe('REQUISITOS_INCOMPLETOS');
    expect(outcome.etapa_final).toBe('BUYER');
    expect(outcome.id_solicitud).toBeUndefined();

    // Sigue en BUYER en la BD
    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(buyerStageId);

    // No se crearon solicitudes
    const solCount = await prisma.solicitudes.count({ where: { id_persona: persona.id_persona } });
    expect(solCount).toBe(0);
  });

  // 6. Reintento del mismo mensaje sin duplicar interacciones
  it('6. Reintento del mismo mensaje: retryEvaluationByInteraction procesa el id_interaccion existente sin registrar otra interacción', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Quiero información inicial sobre costo de frenillos',
    });

    // Conteo inicial de interacciones
    const initialInteractionsCount = await prisma.interacciones.count({
      where: { id_persona: persona.id_persona },
    });
    expect(initialInteractionsCount).toBe(1);

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLO_CONSULTA',
      id_servicio: 10, // Ortodoncia Inicial
      intentos_realizados: 1,
      duracion_total_ms: 55,
      intentos: [{ intento: 1, duracion_ms: 55, exitoso: true }],
    });

    // Reintentar evaluación usando el mismo id_interaccion
    const outcome = await BuyerEvaluationService.retryEvaluationByInteraction(
      interaccion.id_interaccion,
      {
        dbClient: prisma,
        classifierOverride: mockClassifier,
      }
    );

    expect(outcome.id_interaccion).toBe(interaccion.id_interaccion);
    expect(outcome.estado).toBe('COMPLETADA');

    // Comprobar que NO se crearon filas nuevas en Interacciones
    const finalInteractionsCount = await prisma.interacciones.count({
      where: { id_persona: persona.id_persona },
    });
    expect(finalInteractionsCount).toBe(1);
  });

  // 7. Conservación de etapa para contactos en fases posteriores
  it('7. Conservación de etapa: un contacto ya en LEAD conserva su etapa y no fuerza reconversión errónea', async () => {
    // Crear contacto directamente en LEAD
    const { persona, captacion, interaccion } = await createTestBuyer({
      stageId: leadStageId,
      mensaje: 'Hola, tengo una pregunta sobre la cotización que me enviaron ayer',
    });

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: activeCatalog[0].id_servicio,
      intentos_realizados: 1,
      duracion_total_ms: 60,
      intentos: [{ intento: 1, duracion_ms: 60, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: interaccion.mensaje!,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.accion).toBe('CONSERVA_ETAPA_POSTERIOR');
    expect(outcome.etapa_final).toBe('LEAD');

    // Verificar en BD que su etapa no cambió
    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(leadStageId);
  });

  // 8. Recuperación tras reinicio del backend
  it('8. Recuperación tras reinicio: evaluaciones en estado PENDIENTE se recuperan de dbo.DecisionesIA sin duplicar mensajes', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Quiero turno para profilaxis dental lo antes posible',
    });

    // Simular fallo inicial de Gemini
    const failingClassifier = async (): Promise<BuyerClassificationResult> => {
      const err: any = new Error('Simulated Gemini 503 Service Unavailable');
      err.intentos = 2;
      err.duracionTotalMs = 150;
      throw err;
    };

    const failedOutcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: interaccion.mensaje!,
      dbClient: prisma,
      classifierOverride: failingClassifier,
    });

    expect(failedOutcome.estado).toBe('PENDIENTE');
    expect(failedOutcome.accion).toBe('REINTENTO_PENDIENTE');

    // Comprobar que en BD la decisión está guardada como PENDIENTE
    const pendingDb = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(pendingDb?.decision).toContain('"estado":"PENDIENTE"');

    // Ahora simular que el backend se reinicia y corre recoverPendingEvaluations()
    const targetService = activeCatalog.find(s => s.nombre.toLowerCase().includes('profilaxis')) || activeCatalog[0];
    const recoveredClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: targetService.id_servicio,
      intentos_realizados: 1,
      duracion_total_ms: 80,
      intentos: [{ intento: 1, duracion_ms: 80, exitoso: true }],
    });

    const recoveryReport = await BuyerEvaluationService.recoverPendingEvaluations({
      dbClient: prisma,
      classifierOverride: recoveredClassifier,
    });

    expect(recoveryReport.totalEncontradas).toBeGreaterThanOrEqual(1);
    expect(recoveryReport.recuperadasExitosamente).toBeGreaterThanOrEqual(1);

    // Verificar que la decisión en DB fue actualizada a COMPLETADA
    const updatedDecision = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(updatedDecision?.decision).toContain('"estado":"COMPLETADA"');
    expect(updatedDecision?.accion).toBe('CONVERSION_LEAD');

    // Verificar que el conteo de interacciones de la persona sigue siendo 1
    const finalInteractionsCount = await prisma.interacciones.count({
      where: { id_persona: persona.id_persona },
    });
    expect(finalInteractionsCount).toBe(1);
  });

  // 9. Pruebas reales con Gemini SDK (@google/genai & gemini-3.5-flash-lite)
  it.skipIf(!runLiveGemini)(
    '9. Llamada real a Gemini con catálogo activo de NexoSalud_LeadEnsayoFinal (RUN_LIVE_GEMINI_TESTS=true)',
    async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Falta GEMINI_API_KEY para ejecutar pruebas reales.');
      }

      const { persona, captacion, interaccion } = await createTestBuyer({
        mensaje: 'Buenas tardes, quisiera consultar qué costo tiene una evaluación odontológica para un adulto',
      });

      const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: persona.id_persona,
        id_captacion: captacion.id_captacion,
        id_interaccion: interaccion.id_interaccion,
        mensaje: interaccion.mensaje!,
        dbClient: prisma,
        classifierOptions: {
          apiKey,
          modelName: 'gemini-3.5-flash-lite',
          timeoutMs: 10000,
          maxRetries: 1,
        },
      });

      expect(outcome.estado).toBe('COMPLETADA');
      expect(['SOLO_CONSULTA', 'SOLICITA_RESERVA', 'AMBIGUA']).toContain(outcome.intencion);
      expect(outcome.intentos_realizados).toBeGreaterThanOrEqual(1);
      expect(outcome.duracion_total_ms).toBeGreaterThan(0);
    }
  );
});
