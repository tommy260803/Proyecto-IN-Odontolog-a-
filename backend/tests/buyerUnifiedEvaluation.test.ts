import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BuyerEvaluationService,
  computeEvaluationContextFingerprint,
  detectScheduleDiscrepancy,
  generateAutomaticClarification,
  resolveShiftFromPreference,
} from '../src/services/buyerEvaluationService';
import {
  validateClassificationResult,
  BuyerValidationError,
} from '../src/services/buyerMessageClassifier';
import type {
  ServiceCatalogItem,
  BuyerClassificationResult,
  BuyerEvaluationOutcome,
} from '../src/types/buyer';

describe('Evaluación Unificada Buyer - Clasificador Gemini como Fuente Única', () => {
  const activeCatalog: ServiceCatalogItem[] = [
    { id_servicio: 1, nombre: 'Ortodoncia General', descripcion: 'Tratamiento de alineación y brackets' },
    { id_servicio: 2, nombre: 'Ortodoncia Invisible', descripcion: 'Alineadores transparentes invisalign' },
    { id_servicio: 3, nombre: 'Blanqueamiento Dental', descripcion: 'Estética dental y aclaramiento' },
    { id_servicio: 4, nombre: 'Limpieza y Profilaxis', descripcion: 'Higiene dental y remoción de sarro' },
    { id_servicio: 5, nombre: 'Implante Dental', descripcion: 'Rehabilitación oral con implante' },
  ];

  interface MockDbState {
    personas: Map<number, any>;
    decisiones: Map<number, any>;
    interacciones: Map<number, any>;
    eventosEtapa: any[];
    preferencias: Map<number, any>;
    solicitudes: any[];
    decisionIdCounter: number;
    solicitudIdCounter: number;
    eventoEtapaIdCounter: number;
  }

  function createMockDb(initialState?: Partial<MockDbState>) {
    const state: MockDbState = {
      personas: new Map(),
      decisiones: new Map(),
      interacciones: new Map(),
      eventosEtapa: [],
      preferencias: new Map(),
      solicitudes: [],
      decisionIdCounter: 100,
      solicitudIdCounter: 500,
      eventoEtapaIdCounter: 800,
      ...initialState,
    };

    const mockDb: any = {
      horarios: {
        findMany: vi.fn().mockImplementation(async () => [
          { id_horario: 1, hora_inicio: '1970-01-01T08:00:00Z', hora_fin: '1970-01-01T13:00:00Z', nombre: 'Mañana (08:00 - 13:00)' },
          { id_horario: 2, hora_inicio: '1970-01-01T13:00:00Z', hora_fin: '1970-01-01T18:00:00Z', nombre: 'Tarde (13:00 - 18:00)' },
          { id_horario: 3, hora_inicio: '1970-01-01T18:00:00Z', hora_fin: '1970-01-01T21:00:00Z', nombre: 'Noche (18:00 - 21:00)' },
        ]),
      },
      servicios: {
        findMany: vi.fn().mockImplementation(async () => activeCatalog),
      },
      personas: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id_persona: number } }) => {
          return state.personas.get(where.id_persona) || null;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const current = state.personas.get(where.id_persona) || {};
          const updated = { ...current, ...data };
          state.personas.set(where.id_persona, updated);
          return updated;
        }),
      },
      decisionesIA: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          for (const dec of Array.from(state.decisiones.values()).reverse()) {
            if (where.id_interaccion && dec.id_interaccion !== where.id_interaccion) continue;
            if (where.id_persona && dec.id_persona !== where.id_persona) continue;
            if (where.agente && dec.agente !== where.agente) continue;
            return dec;
          }
          return null;
        }),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const id = ++state.decisionIdCounter;
          const record = { id_decision: id, ...data };
          state.decisiones.set(id, record);
          return record;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const current = state.decisiones.get(where.id_decision) || {};
          const updated = { ...current, ...data };
          state.decisiones.set(where.id_decision, updated);
          return updated;
        }),
      },
      interacciones: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          return state.interacciones.get(where.id_interaccion) || null;
        }),
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          for (const item of state.interacciones.values()) {
            if (where.id_persona && item.id_persona !== where.id_persona) continue;
            if (where.id_solicitud && item.id_solicitud !== where.id_solicitud) continue;
            if (where.NOT?.id_interaccion && item.id_interaccion === where.NOT.id_interaccion) continue;
            return item;
          }
          return null;
        }),
      },
      personaPreferencias: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return state.preferencias.get(where.id_persona) || null;
        }),
      },
      etapas: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where.nombre === 'LEAD') return { id_etapa: 2, nombre: 'LEAD' };
          if (where.nombre === 'BUYER') return { id_etapa: 1, nombre: 'BUYER' };
          if (where.nombre === 'PAYER') return { id_etapa: 3, nombre: 'PAYER' };
          return { id_etapa: 1, nombre: where.nombre || 'BUYER' };
        }),
      },
      solicitudes: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const id = ++state.solicitudIdCounter;
          const record = { id_solicitud: id, ...data };
          state.solicitudes.push(record);
          return record;
        }),
      },
      eventosEtapa: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const id = ++state.eventoEtapaIdCounter;
          const record = { id_evento_etapa: id, ...data };
          state.eventosEtapa.push(record);
          return record;
        }),
      },
      $queryRaw: vi.fn().mockImplementation(async (query: any, ...args: any[]) => {
        const queryText = typeof query === 'string'
          ? query
          : (Array.isArray(query) ? query.join(' ') : (query?.strings?.join(' ') || String(query || '')));
        const allQueryParts = [queryText, ...(args || []).map(a => String(a ?? ''))].join(' ');

        // Verificación de conversiones previas en dbo.EventosEtapa
        if (allQueryParts.includes('EventosEtapa') && allQueryParts.includes('BUYER_LEAD')) {
          const matched = state.eventosEtapa.filter(e => e.clave_operacion_buyer?.startsWith('BUYER_LEAD'));
          return matched.length > 0 ? [matched[matched.length - 1]] : [];
        }

        // Ejecución de procedimiento almacenado de conversión
        if (allQueryParts.includes('usp_ConvertirBuyerALead')) {
          const idSol = ++state.solicitudIdCounter;
          const idEv = ++state.eventoEtapaIdCounter;
          state.eventosEtapa.push({
            id_evento_etapa: idEv,
            id_solicitud: idSol,
            clave_operacion_buyer: 'BUYER_LEAD',
          });
          return [{
            id_evento_etapa: idEv,
            id_solicitud: idSol,
            ya_convertido: 0,
          }];
        }

        // Comprobación si otra interacción ya tiene la misma solicitud
        if (allQueryParts.includes('Interacciones') && allQueryParts.includes('id_solicitud')) {
          return [];
        }

        // Comprobación de existencia de solicitud explícita
        if (allQueryParts.includes('dbo.Solicitudes') && allQueryParts.includes('id_solicitud')) {
          return [];
        }

        return [];
      }),
      $executeRaw: vi.fn().mockImplementation(async (query: any, ...args: any[]) => {
        const queryText = typeof query === 'string'
          ? query
          : (Array.isArray(query) ? query.join(' ') : (query?.strings?.join(' ') || String(query || '')));
        if (queryText.includes('UPDATE dbo.Interacciones') && queryText.includes('id_solicitud')) {
          const idSol = args[0];
          const idInter = args[1];
          if (idInter && state.interacciones.has(idInter)) {
            const current = state.interacciones.get(idInter);
            state.interacciones.set(idInter, { ...current, id_solicitud: idSol });
          }
        }
        return 1;
      }),
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback(mockDb);
      }),
      _state: state,
    };

    return mockDb;
  }

  // =========================================================================
  // CASO 1: Saludo -> AMBIGUA
  // =========================================================================
  it('Caso 1: Saludo puro sin servicio ni intención de reserva evalúa como AMBIGUA con acción ACLARACION', async () => {
    const mockDb = createMockDb();
    mockDb._state.personas.set(101, {
      id_persona: 101,
      nombres: 'Carlos',
      apellidos: 'Mendoza',
      numero: '+51987654321',
      email: 'carlos@example.com',
      autoriza_contacto: true,
      estado_calidad: 'Valido',
      Etapa: { id_etapa: 1, nombre: 'BUYER' },
    });

    const classifierMock = vi.fn().mockResolvedValue({
      intencion: 'AMBIGUA',
      id_servicio: null,
      intentosRealizados: 1,
      duracionTotalMs: 42,
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 101,
      id_captacion: 1,
      id_interaccion: 1001,
      mensaje: '¡Hola! Buenas tardes, ¿cómo están?',
      dbClient: mockDb,
      classifierOverride: classifierMock,
    });

    expect(classifierMock).toHaveBeenCalledTimes(1);
    expect(outcome.intencion).toBe('AMBIGUA');
    expect(outcome.id_servicio).toBeNull();
    expect(outcome.accion).toBe('ACLARACION');
    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.etapa_final).toBe('BUYER');
    expect(outcome.aclaracion).toBeDefined();
    expect(typeof outcome.aclaracion).toBe('string');
    expect(outcome.aclaracion).toContain('NexoSalud');
  });

  // =========================================================================
  // CASO 2: Consulta de precio y negación de reserva -> SOLO_CONSULTA
  // =========================================================================
  it('Caso 2: Consulta de precio con negación explícita de reserva evalúa como SOLO_CONSULTA y conserva etapa BUYER', async () => {
    const mockDb = createMockDb();
    mockDb._state.personas.set(102, {
      id_persona: 102,
      nombres: 'Lucia',
      apellidos: 'Vargas',
      numero: '+51912345678',
      email: 'lucia@example.com',
      autoriza_contacto: true,
      estado_calidad: 'Valido',
      Etapa: { id_etapa: 1, nombre: 'BUYER' },
    });

    const classifierMock = vi.fn().mockResolvedValue({
      intencion: 'SOLO_CONSULTA',
      id_servicio: 2, // Ortodoncia Invisible
      intentosRealizados: 1,
      duracionTotalMs: 55,
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 102,
      id_captacion: 2,
      id_interaccion: 1002,
      mensaje: '¿Cuánto cuesta la ortodoncia invisible? Por ahora NO quiero cita ni agendar nada, solo información de costos.',
      dbClient: mockDb,
      classifierOverride: classifierMock,
    });

    expect(classifierMock).toHaveBeenCalledTimes(1);
    expect(outcome.intencion).toBe('SOLO_CONSULTA');
    expect(outcome.id_servicio).toBe(2);
    expect(outcome.accion).toBe('SOLO_CONSULTA');
    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.etapa_final).toBe('BUYER');
    expect(outcome.id_solicitud).toBeUndefined();
    // La persona NO debe avanzar a LEAD
    expect(mockDb.personas.update).not.toHaveBeenCalled();
  });

  // =========================================================================
  // CASO 3: Reserva explícita -> servicio válido (CONVERSION_LEAD)
  // =========================================================================
  it('Caso 3: Reserva explícita con servicio válido y datos completos ejecuta CONVERSION_LEAD', async () => {
    const mockDb = createMockDb();
    mockDb._state.personas.set(103, {
      id_persona: 103,
      nombres: 'Ana',
      apellidos: 'Torres',
      numero: '+51944556677',
      email: 'ana.torres@example.com',
      autoriza_contacto: true,
      estado_calidad: 'Valido',
      Etapa: { id_etapa: 1, nombre: 'BUYER' },
    });

    const classifierMock = vi.fn().mockResolvedValue({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: 1, // Ortodoncia General
      intentosRealizados: 1,
      duracionTotalMs: 60,
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 103,
      id_captacion: 3,
      id_interaccion: 1003,
      mensaje: 'Buenas tardes, quiero agendar una cita para ortodoncia inicial esta semana por favor.',
      dbClient: mockDb,
      classifierOverride: classifierMock,
    });

    expect(classifierMock).toHaveBeenCalledTimes(1);
    expect(outcome.intencion).toBe('SOLICITA_RESERVA');
    expect(outcome.id_servicio).toBe(1);
    expect(outcome.accion).toBe('CONVERSION_LEAD');
    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.etapa_final).toBe('LEAD');
    expect(outcome.id_solicitud).toBeDefined();
    expect(outcome.id_evento_etapa).toBeDefined();
  });

  // =========================================================================
  // CASO 4: Discrepancia tarde/mañana -> Aclaración, sin inventar preferencias
  // =========================================================================
  it('Caso 4: Discrepancia entre mensaje (por la tarde) y preferencia (Mañana) genera ACLARACION conservando ambos datos', async () => {
    const mockDb = createMockDb();
    mockDb._state.personas.set(104, {
      id_persona: 104,
      nombres: 'Diego',
      apellidos: 'Rios',
      numero: '+51933221100',
      email: 'diego@example.com',
      autoriza_contacto: true,
      estado_calidad: 'Valido',
      Etapa: { id_etapa: 1, nombre: 'BUYER' },
    });
    // Preferencia registrada: 1 = Mañana (08:00 - 13:00)
    mockDb._state.preferencias.set(104, { id_horario: 1 });

    const classifierMock = vi.fn().mockResolvedValue({
      intencion: 'SOLICITA_RESERVA',
      id_servicio: 3, // Blanqueamiento Dental
      intentosRealizados: 1,
      duracionTotalMs: 48,
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 104,
      id_captacion: 4,
      id_interaccion: 1004,
      mensaje: 'Quiero reservar cita para un blanqueamiento dental por la tarde',
      pref_id_horario: 1, // Mañana
      dbClient: mockDb,
      classifierOverride: classifierMock,
    });

    expect(outcome.intencion).toBe('SOLICITA_RESERVA');
    expect(outcome.accion).toBe('ACLARACION');
    expect(outcome.discrepancia_horario).toBeDefined();
    expect(outcome.discrepancia_horario?.detectada).toBe(true);
    expect(outcome.discrepancia_horario?.mensajeIndica).toBe('Tarde');
    expect(outcome.discrepancia_horario?.preferenciaRegistrada).toBe('Mañana (08:00 - 13:00)');
    expect(outcome.aclaracion).toContain('Tarde');
    expect(outcome.aclaracion).toContain('Mañana (08:00 - 13:00)');
    // No debe mutar la preferencia ni convertir a LEAD sin aclaración previa
    expect(outcome.etapa_final).toBe('BUYER');
    expect(mockDb._state.preferencias.get(104).id_horario).toBe(1);
  });

  // =========================================================================
  // CASO 5: Fallo de Gemini -> mensaje conservado y evaluación pendiente
  // =========================================================================
  it('Caso 5: Fallo en el clasificador conserva el mensaje y persiste estado PENDIENTE con acción REINTENTO_PENDIENTE', async () => {
    const mockDb = createMockDb();
    mockDb._state.personas.set(105, {
      id_persona: 105,
      nombres: 'Elena',
      apellidos: 'Paz',
      numero: '+51955667788',
      email: 'elena@example.com',
      autoriza_contacto: true,
      estado_calidad: 'Valido',
      Etapa: { id_etapa: 1, nombre: 'BUYER' },
    });

    const failingClassifier = vi.fn().mockRejectedValue(
      new Error('503 Service Unavailable: Rate limit exceeded or network error')
    );

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 105,
      id_captacion: 5,
      id_interaccion: 1005,
      mensaje: 'Hola, quisiera información sobre el implante dental.',
      dbClient: mockDb,
      classifierOverride: failingClassifier,
    });

    expect(outcome.estado).toBe('PENDIENTE');
    expect(outcome.accion).toBe('REINTENTO_PENDIENTE');
    expect(outcome.intencion).toBeNull();
    expect(outcome.id_servicio).toBeNull();
    expect(outcome.error).toBeDefined();
    expect(outcome.error).toContain('503 Service Unavailable');

    // Comprobar que en la base de datos se registró la decisión como PENDIENTE
    const decisionRecord = mockDb._state.decisiones.get(outcome.id_decision);
    expect(decisionRecord).toBeDefined();
    expect(decisionRecord.accion).toBe('REINTENTO_PENDIENTE');
    expect(decisionRecord.requiere_revision).toBe(true);

    // Reintento posterior sobre el mismo id_interaccion:
    const successClassifier = vi.fn().mockResolvedValue({
      intencion: 'SOLO_CONSULTA',
      id_servicio: 5,
      intentosRealizados: 1,
      duracionTotalMs: 35,
    });

    const retryOutcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 105,
      id_captacion: 5,
      id_interaccion: 1005, // Mismo ID de interacción
      mensaje: 'Hola, quisiera información sobre el implante dental.',
      dbClient: mockDb,
      classifierOverride: successClassifier,
    });

    expect(retryOutcome.id_interaccion).toBe(1005);
    expect(retryOutcome.estado).toBe('COMPLETADA');
    expect(retryOutcome.intencion).toBe('SOLO_CONSULTA');
    expect(retryOutcome.id_servicio).toBe(5);
  });

  // =========================================================================
  // CASO 6: Recargar ficha -> lectura persistida, sin llamada nueva a Gemini
  // =========================================================================
  it('Caso 6: Recargar la ficha lee la decisión ya persistida sin invocar de nuevo al clasificador Gemini', async () => {
    const mockDb = createMockDb();
    mockDb._state.personas.set(106, {
      id_persona: 106,
      nombres: 'Felipe',
      apellidos: 'Gomez',
      numero: '+51977889900',
      email: 'felipe@example.com',
      autoriza_contacto: true,
      estado_calidad: 'Valido',
      Etapa: { id_etapa: 1, nombre: 'BUYER' },
    });

    // Simular decisión ya COMPLETADA y persistida en dbo.DecisionesIA
    mockDb._state.decisiones.set(101, {
      id_decision: 101,
      agente: 'BUYER',
      id_persona: 106,
      id_captacion: 6,
      id_interaccion: 1006,
      fecha_hora: new Date(),
      regla_aplicada: 'gemini-3.5-flash-lite',
      decision: JSON.stringify({
        estado: 'COMPLETADA',
        intencion: 'SOLO_CONSULTA',
        id_servicio: 4,
        intentosRealizados: 1,
        duracionTotalMs: 50,
      }),
      accion: 'SOLO_CONSULTA',
      requiere_revision: false,
      resultado_revision: 'Consulta informativa sobre profilaxis',
    });

    const classifierSpy = vi.fn();

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 106,
      id_captacion: 6,
      id_interaccion: 1006,
      mensaje: '¿Qué incluye la limpieza dental?',
      dbClient: mockDb,
      classifierOverride: classifierSpy,
    });

    // Idempotencia: el clasificador NO debe ser invocado
    expect(classifierSpy).not.toHaveBeenCalled();
    expect(outcome.estado).toBe('COMPLETADA');
    expect(outcome.intencion).toBe('SOLO_CONSULTA');
    expect(outcome.id_servicio).toBe(4);
    expect(outcome.accion).toBe('SOLO_CONSULTA');
    expect(outcome.id_decision).toBe(101);
  });

  // =========================================================================
  // CASO 7: Nueva consulta de PAYER -> etapa conservada y sin recuperar conversión histórica (P1)
  // =========================================================================
  it('Caso 7: Nueva consulta de una persona en PAYER conserva etapa PAYER y no recupera conversión histórica como CONVERSION_LEAD', async () => {
    const mockDb = createMockDb();
    mockDb._state.personas.set(107, {
      id_persona: 107,
      nombres: 'Patricia',
      apellidos: 'Salas',
      numero: '+51966554433',
      email: 'patricia@example.com',
      autoriza_contacto: true,
      estado_calidad: 'Valido',
      Etapa: { id_etapa: 3, nombre: 'PAYER' }, // Etapa avanzada PAYER
    });

    // Existe un evento histórico de conversión en EventosEtapa para la captación
    mockDb._state.eventosEtapa.push({
      id_evento_etapa: 777,
      id_solicitud: 300,
      id_persona: 107,
      id_captacion: 7,
      clave_operacion_buyer: 'BUYER_LEAD:7',
    });

    const classifierMock = vi.fn().mockResolvedValue({
      intencion: 'SOLO_CONSULTA',
      id_servicio: 1,
      intentosRealizados: 1,
      duracionTotalMs: 40,
    });

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: 107,
      id_captacion: 7,
      id_interaccion: 1007,
      mensaje: 'Buenas tardes, ¿tienen atención los sábados para control de brackets?',
      dbClient: mockDb,
      classifierOverride: classifierMock,
    });

    expect(classifierMock).toHaveBeenCalledTimes(1);
    expect(outcome.intencion).toBe('SOLO_CONSULTA');
    expect(outcome.accion).toBe('SOLO_CONSULTA');
    // Etapa PAYER debe conservarse, NO debe devolver CONVERSION_LEAD ni sobreescribir la etapa
    expect(outcome.etapa_final).toBe('PAYER');
    expect(outcome.accion).not.toBe('CONVERSION_LEAD');
    expect(outcome.ya_convertido).toBeUndefined();
    expect(mockDb.personas.update).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Matriz de Detección de Discrepancias de Horario
  // =========================================================================
  describe('Matriz de Detección de Discrepancias de Horario (detectScheduleDiscrepancy)', () => {
    const catalogHorarios = [
      { id_horario: 1, hora_inicio: '1970-01-01T08:00:00Z', hora_fin: '1970-01-01T13:00:00Z', nombre: 'Mañana (08:00 - 13:00)' },
      { id_horario: 2, hora_inicio: '1970-01-01T13:00:00Z', hora_fin: '1970-01-01T18:00:00Z', nombre: 'Tarde (13:00 - 18:00)' },
      { id_horario: 3, hora_inicio: '1970-01-01T18:00:00Z', hora_fin: '1970-01-01T21:00:00Z', nombre: 'Noche (18:00 - 21:00)' },
    ];

    it('detecta discrepancia cuando el mensaje indica tarde y el formulario indica Mañana', () => {
      const disc = detectScheduleDiscrepancy('Quiero atenderme por la tarde', 1, catalogHorarios);
      expect(disc.detectada).toBe(true);
      expect(disc.mensajeIndica).toBe('Tarde');
      expect(disc.preferenciaRegistrada).toBe('Mañana (08:00 - 13:00)');
    });

    it('detecta discrepancia cuando el mensaje indica mañana y el formulario indica Tarde', () => {
      const disc = detectScheduleDiscrepancy('Por favor necesito que sea en la mañana', 2, catalogHorarios);
      expect(disc.detectada).toBe(true);
      expect(disc.mensajeIndica).toBe('Mañana');
      expect(disc.preferenciaRegistrada).toBe('Tarde (13:00 - 18:00)');
    });

    it('detecta discrepancia cuando el mensaje indica noche y el formulario indica Mañana o Tarde', () => {
      const disc = detectScheduleDiscrepancy('Solo puedo por la noche después de trabajar', 1, catalogHorarios);
      expect(disc.detectada).toBe(true);
      expect(disc.mensajeIndica).toBe('Noche');
    });

    it('no detecta discrepancia cuando coinciden el turno solicitado y la preferencia', () => {
      const disc1 = detectScheduleDiscrepancy('Me gustaría por la tarde', 2, catalogHorarios);
      expect(disc1.detectada).toBe(false);

      const disc2 = detectScheduleDiscrepancy('Quiero turno en la mañana temprano', 1, catalogHorarios);
      expect(disc2.detectada).toBe(false);
    });

    it('no detecta discrepancia si no hay preferencia registrada o mensaje sin mención de horario', () => {
      expect(detectScheduleDiscrepancy('Hola, buenas tardes', null, catalogHorarios).detectada).toBe(false);
      expect(detectScheduleDiscrepancy('Quiero una cita de ortodoncia', 1, catalogHorarios).detectada).toBe(false);
      expect(detectScheduleDiscrepancy('', 2, catalogHorarios).detectada).toBe(false);
    });

    it('distingue "hasta mañana" o "más tarde" de preferencias de turno', () => {
      // Expresiones cotidianas que no son turnos de atención
      const disc1 = detectScheduleDiscrepancy('Hasta mañana, gracias por la información', 2, catalogHorarios);
      expect(disc1.detectada).toBe(false);

      const disc2 = detectScheduleDiscrepancy('Les respondo más tarde, estoy en reunión', 1, catalogHorarios);
      expect(disc2.detectada).toBe(false);
    });
  });

  // =========================================================================
  // Robustez: Negaciones, Solicitudes Condicionales e Instrucciones Maliciosas
  // =========================================================================
  describe('Robustez Frente a Negaciones, Condiciones e Instrucciones Maliciosas', () => {
    it('validador estricto rechaza inyecciones de esquemas no tipados o manipulación de id_servicio', () => {
      // Inyección de id_servicio como string maliciosa
      expect(() =>
        validateClassificationResult(
          { intencion: 'SOLICITA_RESERVA', id_servicio: '1; DROP TABLE Personas;' as any },
          activeCatalog
        )
      ).toThrow(BuyerValidationError);

      // Inyección de id_servicio como objeto o array
      expect(() =>
        validateClassificationResult(
          { intencion: 'SOLICITA_RESERVA', id_servicio: [1, 2] as any },
          activeCatalog
        )
      ).toThrow(BuyerValidationError);

      // Inyección de intencion no permitida
      expect(() =>
        validateClassificationResult(
          { intencion: 'ADMIN_OVERRIDE' as any, id_servicio: 1 },
          activeCatalog
        )
      ).toThrow(BuyerValidationError);
    });

    it('evaluación automática genera aclaración sin compromisos comerciales cuando la consulta es condicional', () => {
      const clarification = generateAutomaticClarification(
        '¿Cuánto cuesta el implante si pago en efectivo?',
        activeCatalog
      );
      expect(clarification).toContain('precios');
      expect(clarification).toContain('tratamiento');
      // No debe prometer descuentos o cifras no acreditadas
      expect(clarification).not.toContain('descuento');
      expect(clarification).not.toContain('S/');
    });
  });

  // =========================================================================
  // PRUEBAS FOCALIZADAS DE CIERRE V6
  // =========================================================================
  describe('Pruebas Focalizadas de Cierre V6', () => {
    // 1. Dos fallos consecutivos, mismo mensaje/contexto: misma decisión pendiente
    it('dos fallos consecutivos con el mismo mensaje y contexto reutilizan la misma decisión pendiente y acumulan intentos', async () => {
      const mockDb = createMockDb();
      mockDb._state.personas.set(201, {
        id_persona: 201,
        nombres: 'Prueba',
        apellidos: 'Fallo',
        autoriza_contacto: true,
        estado_calidad: 'Valido',
        numero: '987654321',
        Etapa: { id_etapa: 1, nombre: 'BUYER' },
      });
      mockDb._state.interacciones.set(3001, {
        id_interaccion: 3001,
        id_persona: 201,
        mensaje: 'Quiero información sobre brackets',
      });

      const failingClassifier = vi.fn().mockRejectedValue(new Error('Error de conexión temporal a Gemini'));

      // Primer fallo
      const out1 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 201,
        id_captacion: 1,
        id_interaccion: 3001,
        mensaje: 'Quiero información sobre brackets',
        id_servicio_declarado: 1,
        dbClient: mockDb,
        classifierOverride: failingClassifier,
      });

      expect(out1.estado).toBe('PENDIENTE');
      expect(out1.accion).toBe('REINTENTO_PENDIENTE');
      expect(out1.intentosRealizados).toBe(1);
      const firstDecisionId = out1.id_decision;
      expect(mockDb._state.decisiones.size).toBe(1);

      // Segundo fallo consecutivo (mismo mensaje e id_interaccion)
      const out2 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 201,
        id_captacion: 1,
        id_interaccion: 3001,
        mensaje: 'Quiero información sobre brackets',
        id_servicio_declarado: 1,
        dbClient: mockDb,
        classifierOverride: failingClassifier,
      });

      expect(out2.estado).toBe('PENDIENTE');
      expect(out2.id_decision).toBe(firstDecisionId); // Reutiliza la misma decisión pendiente
      expect(out2.intentosRealizados).toBe(2); // Acumula intentos de forma auditable
      expect(mockDb._state.decisiones.size).toBe(1); // No crea registros huérfanos adicionales
    });

    // 2. Fallo seguido de éxito: misma interacción, sin pendientes abandonadas
    it('un fallo seguido de éxito reutiliza la misma interacción y no deja pendientes abandonadas', async () => {
      const mockDb = createMockDb();
      mockDb._state.personas.set(202, {
        id_persona: 202,
        nombres: 'Laura',
        apellidos: 'Recuperada',
        autoriza_contacto: true,
        estado_calidad: 'Valido',
        numero: '987654322',
        Etapa: { id_etapa: 1, nombre: 'BUYER' },
      });
      mockDb._state.interacciones.set(3002, {
        id_interaccion: 3002,
        id_persona: 202,
        mensaje: '¿Cuánto cuesta el blanqueamiento dental?',
      });

      const failingClassifier = vi.fn().mockRejectedValueOnce(new Error('Fallo de red transitorio'));
      const successClassifier = vi.fn().mockResolvedValue({
        intencion: 'SOLO_CONSULTA',
        id_servicio: 3,
        confianza: 0.95,
        intentosRealizados: 1,
        duracionTotalMs: 45,
      });

      // 1. Fallo inicial
      const out1 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 202,
        id_captacion: 2,
        id_interaccion: 3002,
        mensaje: '¿Cuánto cuesta el blanqueamiento dental?',
        id_servicio_declarado: 3,
        dbClient: mockDb,
        classifierOverride: failingClassifier,
      });
      expect(out1.estado).toBe('PENDIENTE');
      const pendingDecisionId = out1.id_decision;

      // 2. Éxito subsiguiente
      const out2 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 202,
        id_captacion: 2,
        id_interaccion: 3002,
        mensaje: '¿Cuánto cuesta el blanqueamiento dental?',
        id_servicio_declarado: 3,
        dbClient: mockDb,
        classifierOverride: successClassifier,
      });

      expect(out2.estado).toBe('COMPLETADA');
      expect(out2.id_decision).toBe(pendingDecisionId); // Misma decisión actualizada a COMPLETADA
      expect(mockDb._state.decisiones.size).toBe(1);

      // Comprobar que en la base de datos no quedó ninguna decisión PENDIENTE para esta interacción
      const decInDb = mockDb._state.decisiones.get(pendingDecisionId);
      expect(decInDb.decision).toContain('"estado":"COMPLETADA"');
      expect(decInDb.decision).not.toContain('"estado":"PENDIENTE"');
      expect(decInDb.accion).toBe('SOLO_CONSULTA');
    });

    // 3. Conversión confirmada seguida de repetición: misma solicitud/evento, huella conservada y cero llamadas adicionales
    it('conversión confirmada seguida de repetición conserva solicitud, evento y huella sin llamadas adicionales a Gemini', async () => {
      const mockDb = createMockDb();
      mockDb._state.personas.set(203, {
        id_persona: 203,
        nombres: 'Elena',
        apellidos: 'Ríos',
        autoriza_contacto: true,
        estado_calidad: 'Valido',
        numero: '987654323',
        email: 'elena@example.com',
        Etapa: { id_etapa: 1, nombre: 'BUYER' },
      });
      mockDb._state.interacciones.set(3003, {
        id_interaccion: 3003,
        id_persona: 203,
        mensaje: 'Quiero reservar una limpieza dental para mañana por la tarde',
      });

      const classifierMock = vi.fn().mockResolvedValue({
        intencion: 'SOLICITA_RESERVA',
        id_servicio: 4,
        confianza: 0.98,
        intentosRealizados: 1,
        duracionTotalMs: 50,
      });

      // 1. Primera evaluación que ejecuta conversión
      const out1 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 203,
        id_captacion: 3,
        id_interaccion: 3003,
        mensaje: 'Quiero reservar una limpieza dental para mañana por la tarde',
        id_servicio_declarado: 4,
        pref_id_horario: 2,
        dbClient: mockDb,
        classifierOverride: classifierMock,
      });

      expect(out1.estado).toBe('COMPLETADA');
      expect(out1.accion).toBe('CONVERSION_LEAD');
      expect(out1.id_solicitud).toBeDefined();
      expect(out1.id_evento_etapa).toBeDefined();
      expect(out1.contextFingerprint).toBeDefined();
      expect(classifierMock).toHaveBeenCalledTimes(1);

      // El mock SQL registra el evento de conversión real en mockDb._state.eventosEtapa
      expect(mockDb._state.eventosEtapa.length).toBeGreaterThan(0);

      // 2. Repetición de la misma evaluación confirmada (mismo contexto)
      const out2 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 203,
        id_captacion: 3,
        id_interaccion: 3003,
        mensaje: 'Quiero reservar una limpieza dental para mañana por la tarde',
        id_servicio_declarado: 4,
        pref_id_horario: 2,
        dbClient: mockDb,
        classifierOverride: classifierMock,
      });

      expect(out2.estado).toBe('COMPLETADA');
      expect(out2.accion).toBe('CONVERSION_LEAD');
      expect(out2.id_solicitud).toBe(out1.id_solicitud);
      expect(out2.id_evento_etapa).toBe(out1.id_evento_etapa);
      expect(out2.contextFingerprint).toBe(out1.contextFingerprint);
      // CERO llamadas adicionales al clasificador (se conserva en 1)
      expect(classifierMock).toHaveBeenCalledTimes(1);
    });

    // 4. ID de horario inexistente
    it('un ID de horario inexistente o ausente del catálogo se resuelve como desconocido sin declarar discrepancia errónea', () => {
      const catalogHorarios = [
        { id_horario: 1, hora_inicio: '1970-01-01T08:00:00Z', nombre: 'Mañana (08:00 - 13:00)' },
        { id_horario: 2, hora_inicio: '1970-01-01T13:00:00Z', nombre: 'Tarde (13:00 - 18:00)' },
      ];

      // ID 999 no existe en el catálogo
      const resolved = resolveShiftFromPreference(999, catalogHorarios);
      expect(resolved).toBeNull();

      // No debe inventar discrepancia para ID ausente
      const disc = detectScheduleDiscrepancy('Quiero atenderme por la tarde', 999, catalogHorarios);
      expect(disc.detectada).toBe(false);

      // ID como string numérico ausente sin catálogo tampoco asume fallback 1/2/3
      const resolvedUnknown = resolveShiftFromPreference('999');
      expect(resolvedUnknown).toBeNull();
    });

    // 5. Alternativas mañana o tarde con preferencia compatible
    it('si el mensaje acepta mañana o tarde y el formulario indica tarde o mañana, no declara conflicto', () => {
      const catalogHorarios = [
        { id_horario: 1, hora_inicio: '1970-01-01T08:00:00Z', nombre: 'Mañana (08:00 - 13:00)' },
        { id_horario: 2, hora_inicio: '1970-01-01T13:00:00Z', nombre: 'Tarde (13:00 - 18:00)' },
        { id_horario: 3, hora_inicio: '1970-01-01T18:00:00Z', nombre: 'Noche (18:00 - 21:00)' },
      ];

      // Caso A: Mensaje "mañana o tarde" + preferencia Tarde (2) -> sin conflicto
      const disc1 = detectScheduleDiscrepancy('Puedo atenderme mañana o tarde sin problema', 2, catalogHorarios);
      expect(disc1.detectada).toBe(false);

      // Caso B: Mensaje "por la mañana o por la tarde" + preferencia Mañana (1) -> sin conflicto
      const disc2 = detectScheduleDiscrepancy('Me conviene por la mañana o por la tarde', 1, catalogHorarios);
      expect(disc2.detectada).toBe(false);

      // Caso C: Mensaje "mañana o tarde" + preferencia Noche (3) -> conflicto legítimo
      const disc3 = detectScheduleDiscrepancy('Disponible en la mañana o tarde', 3, catalogHorarios);
      expect(disc3.detectada).toBe(true);
      expect(disc3.mensajeIndica).toBe('Mañana o Tarde');
    });

    // =========================================================================
    // PRUEBAS DE CIERRE V7: RECUPERACIÓN POST-COMMIT Y TRAZABILIDAD DE HISTORIAL
    // =========================================================================

    // 6. Conversión histórica sin interacción vinculada + mensaje nuevo con negación de reserva
    it('conversión histórica sin interacción vinculada + mensaje nuevo "No quiero reservar, solo consultar horarios" clasifica la consulta, conserva etapa BUYER y no reutiliza la solicitud histórica', async () => {
      const mockDb = createMockDb();
      mockDb._state.personas.set(204, {
        id_persona: 204,
        nombres: 'Carlos',
        apellidos: 'Vargas',
        autoriza_contacto: true,
        estado_calidad: 'Valido',
        numero: '987654324',
        email: 'carlos@example.com',
        Etapa: { id_etapa: 1, nombre: 'BUYER' },
      });
      mockDb._state.interacciones.set(3004, {
        id_interaccion: 3004,
        id_persona: 204,
        id_captacion: 10,
        mensaje: 'No quiero reservar, solo consultar horarios',
        id_solicitud: null,
      });

      // Conversión histórica existente en EventosEtapa para la captación, sin vinculación a la interacción 3004
      mockDb._state.eventosEtapa.push({
        id_evento_etapa: 901,
        id_solicitud: 450,
        id_persona: 204,
        id_captacion: 10,
        clave_operacion_buyer: 'BUYER_LEAD:10',
      });

      const classifierMock = vi.fn().mockResolvedValue({
        intencion: 'SOLO_CONSULTA',
        id_servicio: 1,
        confianza: 0.95,
        intentosRealizados: 1,
        duracionTotalMs: 30,
      });

      const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 204,
        id_captacion: 10,
        id_interaccion: 3004,
        mensaje: 'No quiero reservar, solo consultar horarios',
        id_servicio_declarado: 1,
        dbClient: mockDb,
        classifierOverride: classifierMock,
      });

      // Debe invocar al clasificador y NO adjudicar la conversión histórica por falsos positivos como "reservar" o "horarios"
      expect(classifierMock).toHaveBeenCalledTimes(1);
      expect(outcome.estado).toBe('COMPLETADA');
      expect(outcome.intencion).toBe('SOLO_CONSULTA');
      expect(outcome.accion).toBe('SOLO_CONSULTA');
      expect(outcome.etapa_final).toBe('BUYER');
      expect(outcome.id_solicitud ?? null).toBeNull();
      expect(outcome.ya_convertido).toBeUndefined();

      // No debe vincular la solicitud 450 histórica a esta interacción
      const interactionInDb = mockDb._state.interacciones.get(3004);
      expect(interactionInDb.id_solicitud).toBeNull();
      // No debe haber duplicado eventos de etapa
      expect(mockDb._state.eventosEtapa.length).toBe(1);
    });

    // 7. Caída real simulada de la misma operación tras commit
    it('caída real simulada de la misma operación tras el commit recupera la misma solicitud y evento sin duplicarlos', async () => {
      const mockDb = createMockDb();
      mockDb._state.personas.set(205, {
        id_persona: 205,
        nombres: 'Mariana',
        apellidos: 'Soto',
        autoriza_contacto: true,
        estado_calidad: 'Valido',
        numero: '987654325',
        email: 'mariana@example.com',
        Etapa: { id_etapa: 1, nombre: 'BUYER' },
      });
      mockDb._state.interacciones.set(3005, {
        id_interaccion: 3005,
        id_persona: 205,
        id_captacion: 11,
        mensaje: 'Quiero agendar para ortodoncia invisible',
        id_solicitud: null, // Simula que la caída impidió actualizar la interacción
      });

      const contextFingerprint = computeEvaluationContextFingerprint({
        mensaje: 'Quiero agendar para ortodoncia invisible',
        id_servicio_declarado: 2,
      });

      // El procedimiento almacenado ejecutó commit creando el evento y la solicitud con la clave de operación de esta interacción
      mockDb._state.eventosEtapa.push({
        id_evento_etapa: 902,
        id_solicitud: 451,
        id_persona: 205,
        id_captacion: 11,
        clave_operacion_buyer: 'BUYER_LEAD:11:3005',
      });

      // La decisión quedó registrada como CONVERSION_EN_CURSO con la clave de operación persistida
      mockDb._state.decisiones.set(150, {
        id_decision: 150,
        agente: 'BUYER',
        id_persona: 205,
        id_captacion: 11,
        id_interaccion: 3005,
        fecha_hora: new Date(),
        regla_aplicada: 'gemini-3.5-flash-lite',
        decision: JSON.stringify({
          estado: 'CONVERSION_EN_CURSO',
          intencion: 'SOLICITA_RESERVA',
          id_servicio: 2,
          operacion_id: 'BUYER_LEAD:11:3005',
          contextFingerprint,
        }),
        accion: 'CONVERSION_LEAD',
        requiere_revision: true,
        resultado_revision: 'Conversión a LEAD en curso para interacción #3005...',
      });

      const classifierSpy = vi.fn();

      // Reintento tras la caída
      const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 205,
        id_captacion: 11,
        id_interaccion: 3005,
        mensaje: 'Quiero agendar para ortodoncia invisible',
        id_servicio_declarado: 2,
        dbClient: mockDb,
        classifierOverride: classifierSpy,
      });

      // Idempotencia y recuperación post-commit:
      expect(classifierSpy).not.toHaveBeenCalled();
      expect(outcome.estado).toBe('COMPLETADA');
      expect(outcome.accion).toBe('CONVERSION_LEAD');
      expect(outcome.id_solicitud).toBe(451);
      expect(outcome.id_evento_etapa).toBe(902);
      expect(outcome.etapa_final).toBe('LEAD');

      // No duplica eventos en dbo.EventosEtapa
      expect(mockDb._state.eventosEtapa.length).toBe(1);

      // La interacción queda vinculada a la solicitud recuperada
      const interactionInDb = mockDb._state.interacciones.get(3005);
      expect(interactionInDb.id_solicitud).toBe(451);

      // La decisión queda actualizada a COMPLETADA
      const decisionInDb = mockDb._state.decisiones.get(150);
      expect(decisionInDb.decision).toContain('"estado":"COMPLETADA"');
      expect(decisionInDb.decision).toContain('"id_solicitud":451');
    });

    // 8. Secuencia fallo-fallo-éxito sobre la misma interacción: conservación de historial de errores e intentos
    it('secuencia fallo-fallo-éxito sobre la misma interacción conserva historial_errores e información acumulada de intentos', async () => {
      const mockDb = createMockDb();
      mockDb._state.personas.set(206, {
        id_persona: 206,
        nombres: 'Diego',
        apellidos: 'Herrera',
        autoriza_contacto: true,
        estado_calidad: 'Valido',
        numero: '987654326',
        email: 'diego@example.com',
        Etapa: { id_etapa: 1, nombre: 'BUYER' },
      });
      mockDb._state.interacciones.set(3006, {
        id_interaccion: 3006,
        id_persona: 206,
        id_captacion: 12,
        mensaje: '¿Tienen citas de ortodoncia los días sábados?',
      });

      const failingClassifier1 = vi.fn().mockRejectedValue(new Error('Fallo de conexión primario a Gemini (503)'));
      const failingClassifier2 = vi.fn().mockRejectedValue(new Error('Timeout de red en reintento (ETIMEDOUT)'));
      const successClassifier = vi.fn().mockResolvedValue({
        intencion: 'SOLO_CONSULTA',
        id_servicio: 1,
        confianza: 0.98,
        intentosRealizados: 1,
        duracionTotalMs: 45,
      });

      // 1. Primer fallo
      const out1 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 206,
        id_captacion: 12,
        id_interaccion: 3006,
        mensaje: '¿Tienen citas de ortodoncia los días sábados?',
        id_servicio_declarado: 1,
        dbClient: mockDb,
        classifierOverride: failingClassifier1,
      });

      expect(out1.estado).toBe('PENDIENTE');
      expect(out1.intentosRealizados).toBe(1);
      expect(out1.error).toContain('Fallo de conexión primario');
      const firstDecisionId = out1.id_decision;
      expect(mockDb._state.decisiones.size).toBe(1);

      // 2. Segundo fallo sobre la misma interacción
      const out2 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 206,
        id_captacion: 12,
        id_interaccion: 3006,
        mensaje: '¿Tienen citas de ortodoncia los días sábados?',
        id_servicio_declarado: 1,
        dbClient: mockDb,
        classifierOverride: failingClassifier2,
      });

      expect(out2.estado).toBe('PENDIENTE');
      expect(out2.id_decision).toBe(firstDecisionId); // Reutiliza decisión existente
      expect(out2.intentosRealizados).toBe(2);
      expect(out2.error).toContain('Timeout de red en reintento');
      expect(mockDb._state.decisiones.size).toBe(1);

      // 3. Tercer intento exitoso sobre la misma interacción
      const out3 = await BuyerEvaluationService.evaluateBuyerInteraction({
        id_persona: 206,
        id_captacion: 12,
        id_interaccion: 3006,
        mensaje: '¿Tienen citas de ortodoncia los días sábados?',
        id_servicio_declarado: 1,
        dbClient: mockDb,
        classifierOverride: successClassifier,
      });

      expect(out3.estado).toBe('COMPLETADA');
      expect(out3.id_decision).toBe(firstDecisionId); // Misma decisión completada
      expect(out3.intencion).toBe('SOLO_CONSULTA');
      expect(out3.accion).toBe('SOLO_CONSULTA');
      // Debe registrar 3 intentos acumulados (2 fallos previos + 1 éxito)
      expect(out3.intentosRealizados).toBe(3);
      // Debe conservar el historial de errores previos de forma auditable
      expect(out3.historial_errores).toBeDefined();
      expect(out3.historial_errores).toHaveLength(2);
      expect(out3.historial_errores![0]).toContain('Fallo de conexión primario a Gemini (503)');
      expect(out3.historial_errores![1]).toContain('Timeout de red en reintento (ETIMEDOUT)');

      // En base de datos debe haber un único registro de decisión completada
      expect(mockDb._state.decisiones.size).toBe(1);
      const decInDb = mockDb._state.decisiones.get(firstDecisionId);
      const parsedDec = JSON.parse(decInDb.decision);
      expect(parsedDec.estado).toBe('COMPLETADA');
      expect(parsedDec.intentosRealizados).toBe(3);
      expect(parsedDec.historial_errores).toHaveLength(2);
      expect(parsedDec.historial_errores[0]).toContain('Fallo de conexión primario');
      expect(parsedDec.historial_errores[1]).toContain('Timeout de red en reintento');
    });
  });
});
