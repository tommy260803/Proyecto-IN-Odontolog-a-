import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import http from 'http';
import {
  BuyerEvaluationService,
  getActiveServices,
  generateAutomaticClarification,
} from '../src/services/buyerEvaluationService';
import { registerLeadIntake } from '../src/services/leadIntake';
import { buyerRouter } from '../src/routes/buyer.routes';
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

// Establecer en process.env para que '../db' y Prisma interno usen la misma base
process.env.SQLSERVER_URL = targetUrl;

const prisma = new PrismaClient({
  datasources: {
    db: { url: targetUrl },
  },
});

const runSqlTests = process.env.RUN_SQL_TESTS === 'true';
const runLiveGemini = process.env.RUN_LIVE_GEMINI_TESTS === 'true';

describe.skipIf(!runSqlTests)('Flujo Integrado Buyer -> Clasificador Gemini -> Persistencia en NexoSalud_LeadEnsayoFinal', () => {
  const createdPersonaIds: number[] = [];
  let buyerStageId: number;
  let leadStageId: number;
  let activeCatalog: ServiceCatalogItem[] = [];

  beforeAll(async () => {
    // Guarda QA: comprobar DB_NAME() antes de realizar cualquier escritura
    const [dbCheck] = await prisma.$queryRaw<{ current_db: string }[]>`SELECT DB_NAME() AS current_db`;
    const allowedDbs = ['NexoSalud_LeadEnsayoFinal', 'NexoSalud_LeadPruebas'];
    if (!allowedDbs.includes(dbCheck.current_db)) {
      throw new Error(
        `[Guarda QA] DB_NAME() = '${dbCheck.current_db}' no está en la lista de bases permitidas para pruebas: ${allowedDbs.join(', ')}`
      );
    }

    // Verificar catálogo y etapas en la base de datos de prueba
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
    // Limpieza segura y visible de datos de prueba
    const cleanupErrors: { id_persona: number; error: any }[] = [];
    if (createdPersonaIds.length > 0) {
      for (const id of createdPersonaIds) {
        try {
          await prisma.decisionesIA.deleteMany({ where: { id_persona: id } });
          await prisma.$executeRaw`DELETE FROM dbo.EntradasAgenteLead WHERE id_persona=${id}`;
          await prisma.$executeRaw`DELETE FROM dbo.EventosEtapa WHERE id_persona=${id}`;
          await prisma.$executeRaw`DELETE FROM dbo.Solicitudes WHERE id_persona=${id}`;
          await prisma.interacciones.deleteMany({ where: { id_persona: id } });
          await prisma.personaPreferencias.deleteMany({ where: { id_persona: id } });
          await prisma.$executeRaw`DELETE FROM dbo.CaptacionesBuyer WHERE id_persona=${id}`;
          await prisma.personas.deleteMany({ where: { id_persona: id } });
        } catch (cleanupErr: any) {
          cleanupErrors.push({ id_persona: id, error: cleanupErr?.message || cleanupErr });
        }
      }
    }

    if (cleanupErrors.length > 0) {
      console.error('⚠️ [Teardown] Errores visibles durante la limpieza de datos de prueba:', cleanupErrors);
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
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
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

    const decisionDb = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(decisionDb).not.toBeNull();
    expect(decisionDb?.accion).toBe('SOLO_CONSULTA');
    expect(decisionDb?.requiere_revision).toBe(false);

    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(buyerStageId);

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

    const decisionDb = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(decisionDb?.accion).toBe('ACLARACION');
    expect(decisionDb?.requiere_revision).toBe(true);
    expect(decisionDb?.resultado_revision).toBe(outcome.aclaracion);
  });

  // 4. Conversión válida a LEAD vía dbo.usp_ConvertirBuyerALead y registerLeadIntake
  it('4. Conversión válida: intención explícita de reserva convierte a LEAD usando usp_ConvertirBuyerALead', async () => {
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

    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(leadStageId);

    const solicitudDb = await prisma.solicitudes.findUnique({
      where: { id_solicitud: outcome.id_solicitud! },
      select: { id_solicitud: true, id_servicio: true, estado: true },
    });
    expect(solicitudDb).not.toBeNull();
    expect(solicitudDb?.id_servicio).toBe(targetService.id_servicio);
    expect(solicitudDb?.estado).toBe('Abierta');

    // Verificar entrega en dbo.EntradasAgenteLead
    const [intakeEntry] = await prisma.$queryRaw<{ id_solicitud: number }[]>`
      SELECT id_solicitud FROM dbo.EntradasAgenteLead WHERE id_solicitud=${outcome.id_solicitud!}
    `;
    expect(intakeEntry).toBeDefined();
    expect(intakeEntry.id_solicitud).toBe(outcome.id_solicitud!);
  });

  // 5. Requisitos incumplidos (autoriza_contacto = false)
  it('5. Requisitos incumplidos: si no autoriza contacto, la intención de reserva NO convierte y permanece en BUYER', async () => {
    const targetService = activeCatalog[0];
    const msg = `Me gustaría agendar una cita para ${targetService.nombre}`;

    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: msg,
      autoriza_contacto: false,
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

    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(buyerStageId);

    const solCount = await prisma.solicitudes.count({ where: { id_persona: persona.id_persona } });
    expect(solCount).toBe(0);
  });

  // 6. Reintento del mismo mensaje sin duplicar interacciones
  it('6. Reintento del mismo mensaje: retryEvaluationByInteraction procesa el id_interaccion existente sin registrar otra interacción', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Quiero información inicial sobre costo de frenillos',
    });

    const initialInteractionsCount = await prisma.interacciones.count({
      where: { id_persona: persona.id_persona },
    });
    expect(initialInteractionsCount).toBe(1);

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLO_CONSULTA',
      id_servicio: 10,
      intentos_realizados: 1,
      duracion_total_ms: 55,
      intentos: [{ intento: 1, duracion_ms: 55, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.retryEvaluationByInteraction(
      interaccion.id_interaccion,
      {
        dbClient: prisma,
        classifierOverride: mockClassifier,
      }
    );

    expect(outcome.id_interaccion).toBe(interaccion.id_interaccion);
    expect(outcome.estado).toBe('COMPLETADA');

    const finalInteractionsCount = await prisma.interacciones.count({
      where: { id_persona: persona.id_persona },
    });
    expect(finalInteractionsCount).toBe(1);
  });

  // 7. Contactos avanzados: vincular únicamente con evidencia contextual; solicitudes pendientes en caso contrario
  it('7a. Contactos avanzados sin evidencia: mantiene nueva solicitud pendiente de apertura sin vincular ciegamente', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      stageId: leadStageId,
      mensaje: 'Hola, tengo una pregunta sobre otro tratamiento estético',
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

    expect(outcome.accion).toBe('SOLICITUD_PENDIENTE_APERTURA');
    expect(outcome.etapa_final).toBe('LEAD');

    const personaDb = await prisma.personas.findUnique({ where: { id_persona: persona.id_persona } });
    expect(personaDb?.id_etapa_actual).toBe(leadStageId);
  });

  it('7b. Contactos avanzados con evidencia contextual: vincula la oportunidad existente y conserva etapa posterior', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      stageId: leadStageId,
      mensaje: 'Quiero confirmar mi cotización previa',
    });

    // Crear una solicitud previa para esa persona usando SQL directo compatible con el esquema de NexoSalud_LeadEnsayoFinal
    await prisma.$executeRaw`
      INSERT INTO dbo.Solicitudes (id_persona, id_servicio, estado, fecha_solicitud)
      VALUES (${persona.id_persona}, ${activeCatalog[0].id_servicio}, 'Abierta', SYSDATETIME())
    `;
    const [prevSol] = await prisma.$queryRaw<{ id_solicitud: number }[]>`
      SELECT TOP (1) id_solicitud FROM dbo.Solicitudes WHERE id_persona=${persona.id_persona} ORDER BY id_solicitud DESC
    `;

    const msgWithEvidence = `Quiero coordinar la fecha para mi solicitud #${prevSol.id_solicitud}`;
    const intEvidence = await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_canal: 1,
        id_fuente: 1,
        tipo: 'Mensaje con Evidencia',
        mensaje: msgWithEvidence,
        es_respuesta_util: false,
        resultado: 'Registrado',
      },
    });

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: activeCatalog[0].id_servicio,
      intentos_realizados: 1,
      duracion_total_ms: 50,
      intentos: [{ intento: 1, duracion_ms: 50, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: intEvidence.id_interaccion,
      mensaje: msgWithEvidence,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.accion).toBe('CONSERVA_ETAPA_POSTERIOR');
    expect(outcome.etapa_final).toBe('LEAD');
    expect(outcome.id_solicitud).toBe(prevSol.id_solicitud);
  });

  // 8. Recuperación tras reinicio del backend
  it('8. Recuperación tras reinicio: evaluaciones en estado PENDIENTE se recuperan de dbo.DecisionesIA sin duplicar mensajes', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Quiero turno para profilaxis dental lo antes posible',
    });

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

    const pendingDb = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(pendingDb?.decision).toContain('"estado":"PENDIENTE"');

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

    const updatedDecision = await prisma.decisionesIA.findFirst({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(updatedDecision?.decision).toContain('"estado":"COMPLETADA"');
    expect(updatedDecision?.accion).toBe('CONVERSION_LEAD');

    const finalInteractionsCount = await prisma.interacciones.count({
      where: { id_persona: persona.id_persona },
    });
    expect(finalInteractionsCount).toBe(1);
  });

  // 9. Entrega repetida a LEAD: registerLeadIntake es idempotente
  it('9. Entrega repetida a LEAD: registerLeadIntake llamado múltiples veces no produce error ni duplica filas', async () => {
    const targetService = activeCatalog[0];
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: `Reserva para ${targetService.nombre}`,
      autoriza_contacto: true,
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
      mensaje: interaccion.mensaje!,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.id_solicitud).toBeDefined();
    const solId = outcome.id_solicitud!;

    // Primera llamada ya fue realizada durante evaluateBuyerInteraction. Ejecutar segunda llamada directa:
    const secondCall = await registerLeadIntake(solId, prisma);
    expect(secondCall.id_solicitud).toBe(solId);

    // Ejecutar tercera llamada directa:
    const thirdCall = await registerLeadIntake(solId, prisma);
    expect(thirdCall.id_solicitud).toBe(solId);

    // Comprobar que en dbo.EntradasAgenteLead existe exactamente 1 registro para esta solicitud
    const entriesCount = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*) AS count FROM dbo.EntradasAgenteLead WHERE id_solicitud=${solId}
    `;
    expect(Number(entriesCount[0].count)).toBe(1);
  });

  // 10. Eliminación de sustituto: servicio desconocido pide aclaración sin forzar ID 1
  it('10. Servicio desconocido: intención de reserva sin servicio válido del catálogo pide aclaración y no asigna servicio 1', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Quiero agendar turno para una cirugía bariátrica urgente',
    });

    // Clasificador detecta intención de reserva pero con id_servicio nulo (no reconocido en catálogo dental)
    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: null,
      intentos_realizados: 1,
      duracion_total_ms: 40,
      intentos: [{ intento: 1, duracion_ms: 40, exitoso: true }],
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: interaccion.mensaje!,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(outcome.accion).toBe('ACLARACION');
    expect(outcome.etapa_final).toBe('BUYER');
    expect(outcome.id_solicitud).toBeUndefined();
    expect(outcome.aclaracion).toBeDefined();

    // Confirmar que NO se asignó servicio 1
    const solCount = await prisma.solicitudes.count({ where: { id_persona: persona.id_persona } });
    expect(solCount).toBe(0);
  });

  // 11. Aclaraciones en dos turnos: conservación de contexto y resolución
  it('11. Aclaraciones en dos turnos: turno 1 pide aclaración y turno 2 con id_interaccion_previa convierte a LEAD', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Hola, ¿qué servicios tienen para mejorar mi sonrisa?',
    });

    // Turno 1: clasificador devuelve AMBIGUA
    const turn1Classifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'AMBIGUA',
      id_servicio: null,
      intentos_realizados: 1,
      duracion_total_ms: 50,
      intentos: [{ intento: 1, duracion_ms: 50, exitoso: true }],
    });

    const turn1Outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: interaccion.mensaje!,
      dbClient: prisma,
      classifierOverride: turn1Classifier,
    });

    expect(turn1Outcome.accion).toBe('ACLARACION');
    expect(turn1Outcome.aclaracion).toBeDefined();

    // Turno 2: el usuario responde precisando el servicio
    const targetService = activeCatalog.find(s => s.nombre.toLowerCase().includes('blanqueamiento')) || activeCatalog[0];
    const turn2Msg = `Deseo reservar un ${targetService.nombre} para este viernes`;

    const turn2Interaccion = await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_canal: 1,
        id_fuente: 1,
        tipo: 'Respuesta Aclaración (#2)',
        mensaje: turn2Msg,
        es_respuesta_util: false,
        resultado: 'Pendiente de Evaluación Turno 2',
      },
    });

    const turn2Classifier = async (prompt: string): Promise<BuyerClassificationResult> => {
      // Verificar que el prompt contenga el contexto enriquecido del turno 1
      expect(prompt).toContain('Mensaje anterior del paciente:');
      expect(prompt).toContain('Pregunta u orientación del agente:');
      expect(prompt).toContain('Respuesta actual del paciente:');
      expect(prompt).toContain(interaccion.mensaje!);
      return {
        intencion: 'SOLICITA_RESERVA',
        id_servicio: targetService.id_servicio,
        intentos_realizados: 1,
        duracion_total_ms: 65,
        intentos: [{ intento: 1, duracion_ms: 65, exitoso: true }],
      };
    };

    const turn2Outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: turn2Interaccion.id_interaccion,
      mensaje: turn2Msg,
      contextoConversacional: {
        mensajeAnterior: interaccion.mensaje!,
        aclaracionPrevia: turn1Outcome.aclaracion,
        idInteraccionPrevia: interaccion.id_interaccion,
        turno: 2,
      },
      dbClient: prisma,
      classifierOverride: turn2Classifier,
    });

    expect(turn2Outcome.accion).toBe('CONVERSION_LEAD');
    expect(turn2Outcome.etapa_final).toBe('LEAD');
    expect(turn2Outcome.id_solicitud).toBeDefined();
  });

  // 12. Reenvíos concurrentes: protección mutex y persistencia única
  it('12. Reenvíos concurrentes: llamadas paralelas al mismo mensaje son serializadas y devuelven el resultado persistido', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Consulta simultánea de horarios de atención',
    });

    let callsCount = 0;
    const slowClassifier = async (): Promise<BuyerClassificationResult> => {
      callsCount++;
      await new Promise(r => setTimeout(r, 60));
      return {
        intencion: 'SOLO_CONSULTA',
        id_servicio: null,
        intentos_realizados: 1,
        duracion_total_ms: 60,
        intentos: [{ intento: 1, duracion_ms: 60, exitoso: true }],
      };
    };

    const [out1, out2] = await Promise.all([
      BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: persona.id_persona,
        id_captacion: captacion.id_captacion,
        id_interaccion: interaccion.id_interaccion,
        mensaje: interaccion.mensaje!,
        dbClient: prisma,
        classifierOverride: slowClassifier,
      }),
      BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: persona.id_persona,
        id_captacion: captacion.id_captacion,
        id_interaccion: interaccion.id_interaccion,
        mensaje: interaccion.mensaje!,
        dbClient: prisma,
        classifierOverride: slowClassifier,
      }),
    ]);

    expect(out1.estado).toBe('COMPLETADA');
    expect(out2.estado).toBe('COMPLETADA');
    expect(out1.accion).toBe('SOLO_CONSULTA');
    expect(out2.accion).toBe('SOLO_CONSULTA');
    // Solo se ejecutó una evaluación real gracias a la protección in-flight
    expect(callsCount).toBe(1);

    const decisionsCount = await prisma.decisionesIA.count({
      where: { id_interaccion: interaccion.id_interaccion },
    });
    expect(decisionsCount).toBe(1);
  });

  // 13. Rutas HTTP: POST /buyer/register y POST /buyer/evaluations/recover
  it('13. Rutas HTTP: POST /buyer/register y POST /buyer/evaluations/recover responden con código y contrato esperado', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/buyer', buyerRouter);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}/api/buyer`;

    try {
      const timestamp = Date.now() + Math.floor(Math.random() * 1000);
      const regRes = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombres: 'ClienteHttp',
          apellidos: `Ensayo_${timestamp}`,
          numero: `9${String(timestamp).slice(-8)}`,
          email: `http_${timestamp}@nexosalud.test`,
          consentimiento_atencion: true,
          autoriza_contacto: true,
          necesidad_declarada: '¿Qué costo tiene una consulta informativa?',
        }),
      });

      expect([200, 201]).toContain(regRes.status);
      const regBody = await regRes.json();
      expect(regBody.success).toBe(true);
      expect(regBody.data.id_interaccion).toBeGreaterThan(0);
      createdPersonaIds.push(regBody.data.id_persona);

      // Probar ruta de recuperación
      const recRes = await fetch(`${baseUrl}/evaluations/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(recRes.status).toBe(200);
      const recBody = await recRes.json();
      expect(recBody.success).toBe(true);
      expect(recBody.totalEncontradas).toBeDefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // 15. Caída post-commit: recupera conversión existente sin reclasificar y completa registerLeadIntake (Punto 1)
  it('15. Caída post-commit: recupera conversión BUYER -> LEAD existente sin reclasificar y completa registerLeadIntake', async () => {
    const targetService = activeCatalog[0];
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Quiero turno inmediato para profilaxis',
      autoriza_contacto: true,
      id_servicio: targetService.id_servicio,
    });

    // Simular que dbo.usp_ConvertirBuyerALead ya committed en SQL Server (caída inesperada justo tras el commit)
    const [conv] = await prisma.$queryRaw<{ id_solicitud: number; id_evento_etapa: number }[]>`
      EXEC dbo.usp_ConvertirBuyerALead
        @id_captacion=${captacion.id_captacion},
        @id_servicio=${targetService.id_servicio},
        @motivo='Cita de prueba post-commit'
    `;
    expect(conv.id_solicitud).toBeGreaterThan(0);

    // La interacción no tiene id_solicitud aún (simulando caída antes de actualizar)
    const intBefore = await prisma.interacciones.findUnique({ where: { id_interaccion: interaccion.id_interaccion } });
    expect(intBefore?.id_solicitud).toBeNull();

    // El clasificador NO debe invocarse (si se llama lanza error)
    const forbiddenClassifier = async (): Promise<BuyerClassificationResult> => {
      throw new Error('FALLO: El clasificador no debe ejecutarse si la conversión ya committed en SQL.');
    };

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: interaccion.mensaje!,
      id_servicio_declarado: targetService.id_servicio,
      dbClient: prisma,
      classifierOverride: forbiddenClassifier,
    });

    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.accion).toBe('CONVERSION_LEAD');
    expect(outcome.id_solicitud).toBe(conv.id_solicitud);
    expect(outcome.id_evento_etapa).toBe(conv.id_evento_etapa);
    expect(outcome.ya_convertido).toBe(true);
    expect(outcome.entregaLeadEstado).toBe('CONFIRMADA');

    // Comprobar que en dbo.Interacciones se actualizó id_solicitud
    const intAfter = await prisma.interacciones.findUnique({ where: { id_interaccion: interaccion.id_interaccion } });
    expect(intAfter?.id_solicitud).toBe(conv.id_solicitud);

    // Comprobar que en dbo.EntradasAgenteLead se completó la entrega
    const [entry] = await prisma.$queryRaw<{ id_solicitud: number }[]>`
      SELECT id_solicitud FROM dbo.EntradasAgenteLead WHERE id_solicitud=${conv.id_solicitud}
    `;
    expect(entry.id_solicitud).toBe(conv.id_solicitud);
  });

  // 16. Reconstrucción desde entrada persistida en reintento y enriquecimiento de prompt (Punto 2)
  it('16. Reconstrucción de contexto: reintento recupera servicio declarado y enriquece prompt con mensaje anterior, agente y respuesta', async () => {
    const targetService = activeCatalog.find(s => s.nombre.toLowerCase().includes('ortodoncia')) || activeCatalog[0];
    const { persona, captacion, interaccion } = await createTestBuyer({
      mensaje: 'Sí, confirmo que quiero iniciar tratamiento de brackets este sábado',
    });

    // Guardar una decisión PENDIENTE con servicio declarado y contexto conversacional previo
    await prisma.decisionesIA.create({
      data: {
        agente: 'BUYER',
        id_persona: persona.id_persona,
        id_captacion: captacion.id_captacion,
        id_interaccion: interaccion.id_interaccion,
        fecha_hora: new Date(),
        entrada: JSON.stringify({
          mensaje: interaccion.mensaje,
          id_servicio_declarado: targetService.id_servicio,
          contextoConversacional: {
            mensajeAnterior: '¿Cuánto cuesta colocarse brackets?',
            aclaracionPrevia: 'Contamos con evaluación de ortodoncia. ¿Deseas agendar cita?',
            idInteraccionPrevia: interaccion.id_interaccion,
            turno: 2,
          },
        }),
        regla_aplicada: 'test-retry',
        decision: JSON.stringify({ estado: 'PENDIENTE', intencion: null, id_servicio: null }),
        accion: 'REINTENTO_PENDIENTE',
        requiere_revision: true,
      },
    });

    let promptEvaluado = '';
    const mockClassifier = async (prompt: string): Promise<BuyerClassificationResult> => {
      promptEvaluado = prompt;
      return {
        intencion: 'SOLICITA_RESERVA',
        id_servicio: targetService.id_servicio,
        intentos_realizados: 1,
        duracion_total_ms: 50,
        intentos: [{ intento: 1, duracion_ms: 50, exitoso: true }],
      };
    };

    const outcome = await BuyerEvaluationService.retryEvaluationByInteraction(interaccion.id_interaccion, {
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    expect(promptEvaluado).toContain('Mensaje anterior del paciente: "¿Cuánto cuesta colocarse brackets?"');
    expect(promptEvaluado).toContain('Pregunta u orientación del agente: "Contamos con evaluación de ortodoncia. ¿Deseas agendar cita?"');
    expect(promptEvaluado).toContain('Respuesta actual del paciente: "Sí, confirmo que quiero iniciar tratamiento de brackets este sábado"');
    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.id_servicio).toBe(targetService.id_servicio);
    expect(outcome.accion).toBe('CONVERSION_LEAD');
  });

  // 17. Validación de pertenencia: rechaza contexto cruzado de otra persona (Punto 2)
  it('17. Validación de pertenencia: rechaza contexto cruzado cuando la interacción previa pertenece a otra persona', async () => {
    const { persona: personaA, interaccion: interaccionA } = await createTestBuyer({
      nombres: 'PersonaA',
      mensaje: 'Mensaje privado confidencial de Persona A',
    });
    const { persona: personaB, captacion: captacionB, interaccion: interaccionB } = await createTestBuyer({
      nombres: 'PersonaB',
      mensaje: 'Consulta legítima de Persona B',
    });

    let promptRecibido = '';
    const mockClassifier = async (prompt: string): Promise<BuyerClassificationResult> => {
      promptRecibido = prompt;
      return {
        intencion: 'SOLO_CONSULTA',
        id_servicio: null,
        intentos_realizados: 1,
        duracion_total_ms: 30,
        intentos: [{ intento: 1, duracion_ms: 30, exitoso: true }],
      };
    };

    // Persona B intenta enviar como contexto previo la interacción de Persona A
    await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: personaB.id_persona,
      id_captacion: captacionB.id_captacion,
      id_interaccion: interaccionB.id_interaccion,
      mensaje: interaccionB.mensaje!,
      contextoConversacional: {
        mensajeAnterior: interaccionA.mensaje!,
        aclaracionPrevia: 'Pregunta a Persona A',
        idInteraccionPrevia: interaccionA.id_interaccion, // Pertenece a Persona A!
        turno: 2,
      },
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });

    // El contexto de Persona A debe ser rechazado y no aparecer en el prompt de Persona B
    expect(promptRecibido).not.toContain(interaccionA.mensaje!);
    expect(promptRecibido).not.toContain('Mensaje privado confidencial de Persona A');
    expect(promptRecibido).toBe(interaccionB.mensaje!);
  });

  // 18. Resolución explícita de solicitud: comprueba pertenencia y evita última abierta (Punto 3)
  it('18. Resolución explícita de solicitud: vincula pertenencia comprobada y mantiene referencia dudosa en SOLICITUD_PENDIENTE_APERTURA', async () => {
    const { persona, captacion, interaccion } = await createTestBuyer({
      stageId: leadStageId,
      mensaje: 'Mensaje desde etapa LEAD',
    });

    // Crear Solicitud legítima propia en SQL Server
    await prisma.$executeRaw`
      INSERT INTO dbo.Solicitudes (id_persona, id_servicio, estado, fecha_solicitud)
      VALUES (${persona.id_persona}, ${activeCatalog[0].id_servicio}, 'Abierta', SYSDATETIME())
    `;
    const [solPropia] = await prisma.$queryRaw<{ id_solicitud: number }[]>`
      SELECT TOP (1) id_solicitud FROM dbo.Solicitudes WHERE id_persona=${persona.id_persona} ORDER BY id_solicitud DESC
    `;

    const mockClassifier = async (): Promise<BuyerClassificationResult> => ({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: activeCatalog[0].id_servicio,
      intentos_realizados: 1,
      duracion_total_ms: 40,
      intentos: [{ intento: 1, duracion_ms: 40, exitoso: true }],
    });

    // Caso A: Mensaje menciona explícitamente su propia solicitud -> vincula exitosamente
    const outcomeValido = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: interaccion.id_interaccion,
      mensaje: `Hola, quiero coordinar la fecha para mi solicitud #${solPropia.id_solicitud}`,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });
    expect(outcomeValido.accion).toBe('CONSERVA_ETAPA_POSTERIOR');
    expect(outcomeValido.id_solicitud).toBe(solPropia.id_solicitud);

    // Caso B: Mensaje menciona un número que no existe o pertenece a otro -> referencia dudosa -> SOLICITUD_PENDIENTE_APERTURA
    const intDudoso = await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_canal: 1,
        id_fuente: 1,
        tipo: 'Mensaje Dudoso',
        mensaje: 'Quiero cambiar fecha de mi solicitud #9999999',
        es_respuesta_util: false,
        resultado: 'Registrado',
      },
    });
    const outcomeDudoso = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: intDudoso.id_interaccion,
      mensaje: intDudoso.mensaje!,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });
    expect(outcomeDudoso.accion).toBe('SOLICITUD_PENDIENTE_APERTURA');
    expect(outcomeDudoso.id_solicitud).toBeNull();

    // Caso C: Mensaje vago ("mi cotización previa") sin número explícito -> no toma la última a ciegas -> SOLICITUD_PENDIENTE_APERTURA
    const intVago = await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_canal: 1,
        id_fuente: 1,
        tipo: 'Mensaje Vago',
        mensaje: 'Quisiera continuar con mi cotización previa que me enviaron ayer',
        es_respuesta_util: false,
        resultado: 'Registrado',
      },
    });
    const outcomeVago = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: persona.id_persona,
      id_captacion: captacion.id_captacion,
      id_interaccion: intVago.id_interaccion,
      mensaje: intVago.mensaje!,
      dbClient: prisma,
      classifierOverride: mockClassifier,
    });
    expect(outcomeVago.accion).toBe('SOLICITUD_PENDIENTE_APERTURA');
    expect(outcomeVago.id_solicitud).toBeNull();
  });

  // 19. Idempotency-Key como identidad persistente y hash de contenido (Punto 4)
  it('19. Idempotency-Key: misma clave con contenido distinto se rechaza (409); claves distintas permiten mensajes iguales', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/buyer', buyerRouter);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}/api/buyer`;

    try {
      const timestamp = Date.now() + Math.floor(Math.random() * 1000);
      const idempotencyKey = `idem-${timestamp}-uuid-abc`;
      const phone = `9${String(timestamp).slice(-8)}`;

      // 1. Primer envío con Idempotency-Key
      const res1 = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          nombres: 'JuanIdem',
          apellidos: 'Perez',
          numero: phone,
          consentimiento_atencion: true,
          necesidad_declarada: 'Consulta sobre limpieza dental',
        }),
      });
      expect([200, 201]).toContain(res1.status);
      const body1 = await res1.json();
      expect(body1.success).toBe(true);
      const initialInteractionId = body1.data.id_interaccion;
      createdPersonaIds.push(body1.data.id_persona);

      // 2. Misma Idempotency-Key con CONTENIDO DISTINTO debe rechazarse con 409 Conflict
      const resConflict = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          nombres: 'JuanIdem',
          apellidos: 'Perez',
          numero: phone,
          consentimiento_atencion: true,
          necesidad_declarada: 'CONTENIDO COMPLETAMENTE DIFERENTE',
        }),
      });
      expect(resConflict.status).toBe(409);
      const conflictBody = await resConflict.json();
      expect(conflictBody.code).toBe('IDEMPOTENCY_CONFLICT');

      // 3. Misma Idempotency-Key con MISMO CONTENIDO devuelve el resultado persistido (replayed: true)
      const resReplay = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          nombres: 'JuanIdem',
          apellidos: 'Perez',
          numero: phone,
          consentimiento_atencion: true,
          necesidad_declarada: 'Consulta sobre limpieza dental',
        }),
      });
      expect(resReplay.status).toBe(200);
      const replayBody = await resReplay.json();
      expect(replayBody.replayed).toBe(true);
      expect(replayBody.data.id_interaccion).toBe(initialInteractionId);

      // 4. Clave distinta permite mensajes nuevos idénticos en conversaciones diferentes
      const differentKey = `idem-${timestamp}-uuid-xyz`;
      const resDifferent = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': differentKey,
        },
        body: JSON.stringify({
          nombres: 'JuanIdem',
          apellidos: 'Perez',
          numero: phone,
          consentimiento_atencion: true,
          necesidad_declarada: 'Consulta sobre limpieza dental',
        }),
      });
      expect([200, 201]).toContain(resDifferent.status);
      const differentBody = await resDifferent.json();
      expect(differentBody.success).toBe(true);
      expect(differentBody.replayed).toBeFalsy();
      expect(differentBody.data.id_interaccion).not.toBe(initialInteractionId);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // 14. Pruebas reales con Gemini SDK (@google/genai & gemini-3.5-flash-lite)
  it.skipIf(!runLiveGemini)(
    '14. Llamada real a Gemini con catálogo activo de NexoSalud_LeadEnsayoFinal (RUN_LIVE_GEMINI_TESTS=true)',
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
