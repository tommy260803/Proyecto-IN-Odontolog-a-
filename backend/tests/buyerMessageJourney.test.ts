// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { detectScheduleDiscrepancy } from '../src/services/buyerEvaluationService';

const { state, mockPrisma } = vi.hoisted(() => {
  const state = {
    personas: new Map<number, any>(),
    interacciones: [] as any[],
    solicitudes: [] as any[],
    decisionesIA: [] as any[],
    captaciones: [] as any[],
    personaPreferencias: [] as any[],
    captacionesUpdated: false,
    etapas: [
      { id_etapa: 1, nombre: 'BUYER', descripcion: 'Contacto inicial' },
      { id_etapa: 2, nombre: 'LEAD', descripcion: 'Intención concreta' },
      { id_etapa: 3, nombre: 'PAYER', descripcion: 'Paciente en tratamiento' },
    ],
    personaIdCounter: 100,
    interaccionIdCounter: 1000,
    solicitudIdCounter: 500,
    decisionIdCounter: 800,
    preferenciaIdCounter: 300,
  };

  const catalogServicios = [
    { id_servicio: 1, nombre: 'Ortodoncia General', activo: true },
    { id_servicio: 2, nombre: 'Blanqueamiento Dental', activo: true },
    { id_servicio: 3, nombre: 'Endodoncia Avanzada', activo: true },
    { id_servicio: 99, nombre: 'Servicio Inactivo', activo: false },
  ];

  function buildPersonaResponse(p: any, include?: any) {
    const res = { ...p };
    if (include?.Etapa) {
      res.Etapa = state.etapas.find(e => e.id_etapa === (p.id_etapa_actual || 1));
    }
    if (include?.Interacciones) {
      res.Interacciones = state.interacciones
        .filter(i => i.id_persona === p.id_persona)
        .sort((a, b) => b.id_interaccion - a.id_interaccion);
    } else {
      res.Interacciones = [];
    }
    if (include?.Solicitudes) {
      const sols = state.solicitudes.filter(s => s.id_persona === p.id_persona);
      res.Solicitudes = sols.map(sol => {
        const item = { ...sol };
        if (include.Solicitudes.include?.Servicio && sol.id_servicio) {
          item.Servicio = catalogServicios.find(s => s.id_servicio === sol.id_servicio) || null;
        }
        return item;
      });
    } else {
      res.Solicitudes = [];
    }
    if (include?.DecisionesIA) {
      res.DecisionesIA = state.decisionesIA
        .filter(d => d.id_persona === p.id_persona)
        .sort((a, b) => b.id_decision - a.id_decision);
    } else {
      res.DecisionesIA = [];
    }
    if (include?.Preferencias) {
      let prefs = state.personaPreferencias.filter(pr => pr.id_persona === p.id_persona);
      if (include.Preferencias.orderBy?.id_preferencia === 'desc') {
        prefs = [...prefs].sort((a, b) => b.id_preferencia - a.id_preferencia);
      }
      res.Preferencias = prefs.map(pref => {
        const item = { ...pref };
        if (include.Preferencias.include?.ServicioInteres && pref.id_servicio_interes) {
          item.ServicioInteres = catalogServicios.find(s => s.id_servicio === pref.id_servicio_interes) || null;
        }
        return item;
      });
    } else {
      res.Preferencias = [];
    }
    if (include?.DatosAcademicos) res.DatosAcademicos = [];
    if (include?.DatosLaborales) res.DatosLaborales = [];
    if (include?.SaludOdontologica) res.SaludOdontologica = [];
    if (include?.EventosEtapa) res.EventosEtapa = [];
    return res;
  }

  const mockPrisma: any = {
    $transaction: vi.fn().mockImplementation(async (cb: any) => {
      return cb(mockPrisma);
    }),
    personas: {
      findUnique: vi.fn().mockImplementation(async ({ where, include }: any) => {
        const p = state.personas.get(where.id_persona);
        if (!p) return null;
        return buildPersonaResponse(p, include);
      }),
      findFirst: vi.fn().mockImplementation(async ({ where, include }: any) => {
        for (const p of state.personas.values()) {
          if (where?.id_persona && p.id_persona !== where.id_persona) continue;
          return buildPersonaResponse(p, include);
        }
        return null;
      }),
      findMany: vi.fn().mockImplementation(async ({ include }: any) => {
        return Array.from(state.personas.values()).map(p => buildPersonaResponse(p, include));
      }),
      count: vi.fn().mockImplementation(async () => state.personas.size),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const id = ++state.personaIdCounter;
        const persona = { id_persona: id, fecha_registro: new Date(), ...data };
        state.personas.set(id, persona);
        return persona;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const p = state.personas.get(where.id_persona);
        if (!p) throw new Error(`Persona ${where.id_persona} no encontrada`);
        const updated = { ...p, ...data };
        state.personas.set(where.id_persona, updated);
        return updated;
      }),
    },
    interacciones: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const id = ++state.interaccionIdCounter;
        const int = { id_interaccion: id, fecha_hora: new Date(), ...data };
        state.interacciones.push(int);
        return int;
      }),
      findFirst: vi.fn().mockImplementation(async ({ where, orderBy }: any) => {
        let matches = state.interacciones.filter(i => {
          if (where?.id_persona && i.id_persona !== where.id_persona) return false;
          return true;
        });
        if (orderBy?.fecha_hora === 'desc') {
          matches = [...matches].reverse();
        }
        return matches[0] || null;
      }),
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        return state.interacciones.filter(i => i.id_persona === where?.id_persona);
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const idx = state.interacciones.findIndex(i => i.id_interaccion === where.id_interaccion);
        if (idx >= 0) {
          state.interacciones[idx] = { ...state.interacciones[idx], ...data };
          return state.interacciones[idx];
        }
        return null;
      }),
    },
    solicitudes: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const id = ++state.solicitudIdCounter;
        const sol = { id_solicitud: id, fecha_solicitud: new Date(), ...data };
        state.solicitudes.push(sol);
        return sol;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const idx = state.solicitudes.findIndex(s => s.id_solicitud === where.id_solicitud);
        if (idx >= 0) {
          state.solicitudes[idx] = { ...state.solicitudes[idx], ...data };
          return state.solicitudes[idx];
        }
        return null;
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        return state.solicitudes.find(s => s.id_persona === where?.id_persona) || null;
      }),
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        return state.solicitudes.filter(s => s.id_persona === where?.id_persona);
      }),
    },
    decisionesIA: {
      findFirst: vi.fn().mockImplementation(async ({ where, orderBy }: any) => {
        const matches = state.decisionesIA.filter(d => {
          if (where?.id_persona && d.id_persona !== where.id_persona) return false;
          if (where?.id_interaccion && d.id_interaccion !== where.id_interaccion) return false;
          return true;
        });
        return matches[matches.length - 1] || null;
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const id = ++state.decisionIdCounter;
        const dec = { id_decision: id, fecha_hora: new Date(), ...data };
        state.decisionesIA.push(dec);
        return dec;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const idx = state.decisionesIA.findIndex(d => d.id_decision === where.id_decision);
        if (idx >= 0) {
          state.decisionesIA[idx] = { ...state.decisionesIA[idx], ...data };
          return state.decisionesIA[idx];
        }
        return null;
      }),
    },
    etapas: {
      findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: any) => {
        return state.etapas.find(e => e.nombre === where?.nombre) || state.etapas[0];
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        return state.etapas.find(e => e.nombre === where?.nombre) || state.etapas[0];
      }),
    },
    canales: {
      findFirst: vi.fn().mockResolvedValue({ id_canal: 1, nombre: 'Página Web / Portal Online', activo: true }),
      findUnique: vi.fn().mockResolvedValue({ id_canal: 1, nombre: 'Página Web / Portal Online', activo: true }),
    },
    fuentes: {
      findFirst: vi.fn().mockResolvedValue({ id_fuente: 1, nombre: 'Formulario Web - Portal NexoSalud', activo: true }),
      findUnique: vi.fn().mockResolvedValue({ id_fuente: 1, nombre: 'Formulario Web - Portal NexoSalud', activo: true }),
    },
    servicios: {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        return catalogServicios.find(s => s.id_servicio === Number(where?.id_servicio)) || null;
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        return catalogServicios.find(s => {
          if (where?.id_servicio && s.id_servicio !== Number(where.id_servicio)) return false;
          if (where?.activo !== undefined && s.activo !== where.activo) return false;
          return true;
        }) || null;
      }),
      findMany: vi.fn().mockResolvedValue(catalogServicios),
    },
    horarios: {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        const id = Number(where?.id_horario);
        return id ? { id_horario: id } : null;
      }),
      findMany: vi.fn().mockResolvedValue([
        { id_horario: 1, hora_inicio: '1970-01-01T08:00:00Z', hora_fin: '1970-01-01T13:00:00Z', nombre: 'Mañana (08:00 - 13:00)' },
        { id_horario: 2, hora_inicio: '1970-01-01T13:00:00Z', hora_fin: '1970-01-01T18:00:00Z', nombre: 'Tarde (13:00 - 18:00)' },
        { id_horario: 3, hora_inicio: '1970-01-01T18:00:00Z', hora_fin: '1970-01-01T21:00:00Z', nombre: 'Noche (18:00 - 21:00)' },
      ]),
    },
    modalidades: {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        const id = Number(where?.id_modalidad);
        return id ? { id_modalidad: id, nombre: 'Presencial' } : null;
      }),
      findMany: vi.fn().mockResolvedValue([{ id_modalidad: 1, nombre: 'Presencial' }]),
    },
    horariosAtencion: {
      findUnique: vi.fn().mockResolvedValue({ id_horario: 1 }),
    },
    modalidadesAtencion: {
      findUnique: vi.fn().mockResolvedValue({ id_modalidad: 1 }),
    },
    campanas: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    personaPreferencias: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const id = ++state.preferenciaIdCounter;
        const item = { id_preferencia: id, ...data };
        state.personaPreferencias.push(item);
        return item;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const idx = state.personaPreferencias.findIndex(p => p.id_preferencia === where.id_preferencia);
        if (idx >= 0) {
          state.personaPreferencias[idx] = { ...state.personaPreferencias[idx], ...data };
          return state.personaPreferencias[idx];
        }
        return null;
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const now = new Date();
        const matches = state.personaPreferencias.filter(p => {
          if (where?.id_persona && p.id_persona !== where.id_persona) return false;
          if (where?.OR && p.fecha_fin) {
            const fin = new Date(p.fecha_fin);
            if (!isNaN(fin.getTime()) && fin <= now) return false;
          }
          return true;
        });
        return matches[matches.length - 1] || null;
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
        if (where?.id_persona) {
          state.personaPreferencias = state.personaPreferencias.filter(p => p.id_persona !== where.id_persona);
        }
        return { count: 1 };
      }),
    },
    datosAcademicos: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    datosLaborales: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    personaSaludOdontologica: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    eventosEtapa: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockImplementation(async (query: any, ...args: any[]) => {
      function getAllValues(qObj: any, aList: any[]): any[] {
        const collected: any[] = [];
        function pushVal(v: any) {
          if (v == null) return;
          if (Array.isArray(v)) {
            v.forEach(pushVal);
          } else if (typeof v === 'object' && Array.isArray(v.values)) {
            v.values.forEach(pushVal);
          } else {
            collected.push(v);
          }
        }
        if (Array.isArray(aList)) aList.forEach(pushVal);
        if (qObj && typeof qObj === 'object' && Array.isArray(qObj.values)) qObj.values.forEach(pushVal);
        return collected;
      }

      const q = typeof query === 'string' ? query : (Array.isArray(query) ? query.join(' ') : (query?.strings?.join(' ') || ''));
      const vals = getAllValues(query, args);

      if (q.includes('dbo.Personas') || q.includes('Personas')) {
        for (const p of state.personas.values()) {
          const ph = (p.numero || '').replace(/\D/g, '');
          for (const val of vals) {
            if (!val) continue;
            const s = String(val).toLowerCase().trim();
            if (p.email && p.email.toLowerCase().trim() === s) return [{ id_persona: p.id_persona }];
            if (p.dni && p.dni.trim() === s) return [{ id_persona: p.id_persona }];
            if (ph && ph.endsWith(s)) return [{ id_persona: p.id_persona }];
          }
        }
        return [];
      }

      if (q.includes('usp_ConvertirBuyerALead')) {
        const idSol = ++state.solicitudIdCounter;
        return [{
          id_evento_etapa: 999,
          id_solicitud: idSol,
          ya_convertido: 0,
        }];
      }

      if (q.includes('CaptacionesBuyer')) {
        // Soporte de consulta en lote (GET /buyer listado)
        if (q.includes('WHERE cb.id_persona IN') || q.includes('id_persona IN')) {
          const rows: any[] = [];
          for (const cap of state.captaciones) {
            if (vals.includes(cap.id_persona)) {
              const svc = catalogServicios.find(s => s.id_servicio === cap.id_servicio);
              const row: any = { id_persona: cap.id_persona };
              // El mock respeta estrictamente las columnas solicitadas por la sentencia SQL
              if (q.includes('id_captacion')) row.id_captacion = cap.id_captacion;
              if (q.includes('id_servicio')) row.id_servicio = cap.id_servicio;
              if (q.includes('nombre_servicio') || q.includes('s.nombre')) row.nombre_servicio = svc?.nombre || null;
              if (q.includes('s.activo') || q.includes('activo')) row.activo = svc?.activo !== false;
              if (q.includes('motivo_consulta')) row.motivo_consulta = cap.motivo_consulta;
              rows.push(row);
            }
          }
          return rows;
        }

        // Soporte de consulta individual (GET /buyer/:id o POST /buyer/:id/evaluate)
        const targetId = vals.find((v: any) => typeof v === 'number');
        const cap = targetId ? state.captaciones.find(c => c.id_persona === targetId) : state.captaciones[0];
        if (cap) {
          const svc = catalogServicios.find(s => s.id_servicio === cap.id_servicio);
          const row: any = {};
          if (q.includes('id_persona')) row.id_persona = cap.id_persona;
          if (q.includes('id_captacion')) row.id_captacion = cap.id_captacion;
          if (q.includes('id_servicio')) row.id_servicio = cap.id_servicio;
          if (q.includes('nombre_servicio') || q.includes('s.nombre')) row.nombre_servicio = svc?.nombre || null;
          if (q.includes('s.activo') || q.includes('activo')) row.activo = svc?.activo !== false;
          if (q.includes('motivo_consulta')) row.motivo_consulta = cap.motivo_consulta;
          return [row];
        }
        return [];
      }
      return [];
    }),
    $executeRaw: vi.fn().mockImplementation(async (query: any, ...args: any[]) => {
      function getAllValues(qObj: any, aList: any[]): any[] {
        const collected: any[] = [];
        function pushVal(v: any) {
          if (v == null) return;
          if (Array.isArray(v)) {
            v.forEach(pushVal);
          } else if (typeof v === 'object' && Array.isArray(v.values)) {
            v.values.forEach(pushVal);
          } else {
            collected.push(v);
          }
        }
        if (Array.isArray(aList)) aList.forEach(pushVal);
        if (qObj && typeof qObj === 'object' && Array.isArray(qObj.values)) qObj.values.forEach(pushVal);
        return collected;
      }

      const q = typeof query === 'string' ? query : (Array.isArray(query) ? query.join(' ') : (query?.strings?.join(' ') || ''));
      const vals = getAllValues(query, args);

      if (q.includes('INSERT dbo.CaptacionesBuyer') || q.includes('INSERT INTO dbo.CaptacionesBuyer')) {
        const personId = vals[4] ?? vals[0] ?? 1;
        const serviceId = vals[2] ?? null;
        const reason = vals[3] ?? null;
        state.captaciones.push({
          id_captacion: state.captaciones.length + 1,
          id_persona: Number(personId) || 1,
          id_servicio: serviceId ? Number(serviceId) : null,
          motivo_consulta: reason ? String(reason) : null,
        });
      }
      if (q.includes('UPDATE dbo.CaptacionesBuyer SET id_servicio')) {
        state.captacionesUpdated = true;
      }
      return 1;
    }),
  };

  return { state, mockPrisma };
});

// Mock database module
vi.mock('../src/db', () => ({
  prisma: mockPrisma,
}));

// Mock evaluation service
vi.mock('../src/services/buyerEvaluationService', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    BuyerEvaluationService: {
      ...actual.BuyerEvaluationService,
      evaluateBuyerInteraction: vi.fn().mockImplementation(async (input: any) => {
        const fingerprint = actual.computeEvaluationContextFingerprint({
          mensaje: input.mensaje,
          id_servicio_declarado: input.id_servicio_declarado,
          pref_id_horario: input.pref_id_horario,
          sede_preferida: input.sede_preferida,
        });

        // Verificación de idempotencia por huella de contexto (misma interacción y mismo contexto)
        const existingDecision = state.decisionesIA
          .slice()
          .reverse()
          .find((d: any) => d.id_persona === input.id_persona && d.id_interaccion === input.id_interaccion);

        if (existingDecision) {
          try {
            const parsed = JSON.parse(existingDecision.decision || '{}');
            let prevFingerprint = parsed.contextFingerprint;
            if (!prevFingerprint && existingDecision.entrada) {
              const prevEntrada = JSON.parse(existingDecision.entrada);
              prevFingerprint = prevEntrada.contextFingerprint;
            }
            if (prevFingerprint === fingerprint) {
              return {
                id_persona: input.id_persona,
                id_captacion: input.id_captacion,
                id_interaccion: input.id_interaccion,
                id_decision: existingDecision.id_decision,
                estado: 'COMPLETADA',
                intencion: parsed.intencion ?? null,
                id_servicio: parsed.id_servicio ?? null,
                accion: existingDecision.accion,
                etapa_final: existingDecision.accion === 'CONVERSION_LEAD' ? 'LEAD' : 'BUYER',
                aclaracion: existingDecision.resultado_revision,
                discrepancia_horario: parsed.discrepancia_horario || null,
                intentosRealizados: 1,
                duracionTotalMs: 40,
                mensaje_evaluado: input.mensaje,
                contextFingerprint: fingerprint,
              };
            }
          } catch {}
        }

        const journeyCatalogHorarios = [
          { id_horario: 1, hora_inicio: '1970-01-01T08:00:00Z', hora_fin: '1970-01-01T13:00:00Z', nombre: 'Mañana (08:00 - 13:00)' },
          { id_horario: 2, hora_inicio: '1970-01-01T13:00:00Z', hora_fin: '1970-01-01T18:00:00Z', nombre: 'Tarde (13:00 - 18:00)' },
          { id_horario: 3, hora_inicio: '1970-01-01T18:00:00Z', hora_fin: '1970-01-01T21:00:00Z', nombre: 'Noche (18:00 - 21:00)' },
        ];
        const discrepancy = actual.detectScheduleDiscrepancy(
          input.mensaje,
          input.pref_id_horario,
          journeyCatalogHorarios
        );

        let intencion = /(?:reserva|cita|agendar)/i.test(input.mensaje) ? 'SOLICITA_RESERVA' : 'SOLO_CONSULTA';
        let accion = intencion === 'SOLICITA_RESERVA' ? 'CONVERSION_LEAD' : 'SOLO_CONSULTA';
        let aclaracion = 'Evaluación simulada para pruebas de ruta';

        if (discrepancy.detectada) {
          accion = 'ACLARACION';
          aclaracion = discrepancy.detalle;
        }

        const decisionPayload = {
          estado: 'COMPLETADA',
          intencion,
          id_servicio: input.id_servicio_declarado ?? null,
          discrepancia_horario: discrepancy.detectada ? discrepancy : null,
          intentosRealizados: 1,
          duracionTotalMs: 40,
          mensaje_evaluado: input.mensaje,
          contextFingerprint: fingerprint,
        };

        const dec = {
          id_decision: ++state.decisionIdCounter,
          id_persona: input.id_persona,
          id_interaccion: input.id_interaccion,
          agente: 'BUYER',
          fecha_hora: new Date(),
          accion,
          decision: JSON.stringify(decisionPayload),
          entrada: JSON.stringify({
            mensaje: input.mensaje,
            id_persona: input.id_persona,
            id_servicio_declarado: input.id_servicio_declarado,
            pref_id_horario: input.pref_id_horario,
            sede_preferida: input.sede_preferida,
            contextFingerprint: fingerprint,
          }),
          resultado_revision: aclaracion,
        };
        state.decisionesIA.push(dec);

        return {
          id_persona: input.id_persona,
          id_captacion: input.id_captacion,
          id_interaccion: input.id_interaccion,
          id_decision: dec.id_decision,
          estado: 'COMPLETADA',
          intencion: decisionPayload.intencion,
          id_servicio: decisionPayload.id_servicio,
          accion: dec.accion,
          etapa_final: accion === 'CONVERSION_LEAD' ? 'LEAD' : 'BUYER',
          aclaracion: dec.resultado_revision,
          discrepancia_horario: decisionPayload.discrepancia_horario,
          intentosRealizados: 1,
          duracionTotalMs: 40,
          mensaje_evaluado: input.mensaje,
          contextFingerprint: fingerprint,
        };
      }),
    },
  };
});

vi.mock('../src/services/martSyncService', () => ({
  MartSyncService: {
    syncBuyer: vi.fn().mockResolvedValue(undefined),
  },
}));

import { buyerRouter, resolveDeclaredService } from '../src/routes/buyer.routes';
import { BuyerEvaluationService } from '../src/services/buyerEvaluationService';

describe('Recorrido del Mensaje Buyer, Servicio Declarado y Prevención de Solicitudes Prematuras', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    state.personas.clear();
    state.interacciones.length = 0;
    state.solicitudes.length = 0;
    state.decisionesIA.length = 0;
    state.captaciones.length = 0;
    state.personaPreferencias.length = 0;
    state.captacionesUpdated = false;
    vi.clearAllMocks();

    const app = express();
    app.use(express.json());
    app.use('/api/buyer', buyerRouter);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}/api/buyer`;
  });

  afterEach(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  });

  // =========================================================================
  // PRUEBAS FOCALIZADAS DE RESOLUCIÓN DEL SERVICIO DECLARADO
  // =========================================================================

  describe('Pruebas Focalizadas de Resolución del Servicio Declarado (Listado, Ficha y Evaluador)', () => {
    it('Focal 1: Solo captación, sin preferencias ni solicitudes (comprueba igualdad listado, ficha y evaluador)', async () => {
      const personaId = 201;
      state.personas.set(personaId, {
        id_persona: personaId,
        nombres: 'Gabriel',
        apellidos: 'Ponce',
        numero: '988001122',
        email: 'gabriel.ponce@example.com',
        id_etapa_actual: 1,
        estado_calidad: 'Valido',
        autoriza_contacto: true,
        fecha_registro: new Date(),
      });

      // Solo captación inicial registrada con Ortodoncia General (id_servicio: 1)
      state.captaciones.push({
        id_captacion: 50,
        id_persona: personaId,
        id_servicio: 1,
        motivo_consulta: 'Captación inicial directa',
      });

      state.interacciones.push({
        id_interaccion: 2001,
        id_persona: personaId,
        tipo: 'Consulta Inicial',
        mensaje: 'Consulta general de ortodoncia',
        fecha_hora: new Date(),
      });

      // 1. GET /buyer (Listado)
      const listRes = await fetch(`${baseUrl}/`);
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      const listBuyer = listData.find((b: any) => Number(b.id) === personaId);
      expect(listBuyer).toBeDefined();

      // 2. GET /buyer/:id (Ficha)
      const fichaRes = await fetch(`${baseUrl}/${personaId}`);
      expect(fichaRes.status).toBe(200);
      const fichaBuyer = await fichaRes.json();

      // 3. POST /buyer/:id/evaluate (Evaluador)
      const evalRes = await fetch(`${baseUrl}/${personaId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fichaBuyer.concreteRequest }),
      });
      expect(evalRes.status).toBe(200);
      const lastEvalCall = vi.mocked(BuyerEvaluationService.evaluateBuyerInteraction).mock.calls.at(-1)?.[0];

      // Comprobación de igualdad estricta entre listado, ficha y argumento del evaluador
      expect(listBuyer.serviceOfInterestId).toBe('1');
      expect(listBuyer.serviceOfInterest).toBe('Ortodoncia General');

      expect(fichaBuyer.serviceOfInterestId).toBe('1');
      expect(fichaBuyer.serviceOfInterest).toBe('Ortodoncia General');

      expect(lastEvalCall?.id_servicio_declarado).toBe(1);

      expect(listBuyer.serviceOfInterestId).toBe(fichaBuyer.serviceOfInterestId);
      expect(listBuyer.serviceOfInterest).toBe(fichaBuyer.serviceOfInterest);
      expect(String(lastEvalCall?.id_servicio_declarado)).toBe(fichaBuyer.serviceOfInterestId);
    });

    it('Focal 2: Captación y solicitud histórica con servicios diferentes (prevalece captación sobre solicitud)', async () => {
      const personaId = 202;
      state.personas.set(personaId, {
        id_persona: personaId,
        nombres: 'Patricia',
        apellidos: 'Reyes',
        numero: '988002233',
        email: 'patricia.reyes@example.com',
        id_etapa_actual: 1,
        estado_calidad: 'Valido',
        autoriza_contacto: true,
        fecha_registro: new Date(),
      });

      // Captación inicial: Ortodoncia General (id_servicio: 1)
      state.captaciones.push({
        id_captacion: 51,
        id_persona: personaId,
        id_servicio: 1,
        motivo_consulta: 'Captación inicial',
      });

      // Solicitud histórica anterior con servicio distinto: Endodoncia Avanzada (id_servicio: 3)
      state.solicitudes.push({
        id_solicitud: 601,
        id_persona: personaId,
        id_servicio: 3,
        motivo: 'Solicitud antigua en otra especialidad',
        fecha_solicitud: new Date('2025-05-01'),
      });

      state.interacciones.push({
        id_interaccion: 2002,
        id_persona: personaId,
        tipo: 'Consulta Inicial',
        mensaje: 'Quiero información de mi captación',
        fecha_hora: new Date(),
      });

      // 1. GET /buyer (Listado)
      const listRes = await fetch(`${baseUrl}/`);
      const listData = await listRes.json();
      const listBuyer = listData.find((b: any) => Number(b.id) === personaId);

      // 2. GET /buyer/:id (Ficha)
      const fichaRes = await fetch(`${baseUrl}/${personaId}`);
      const fichaBuyer = await fichaRes.json();

      // 3. POST /buyer/:id/evaluate (Evaluador)
      await fetch(`${baseUrl}/${personaId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fichaBuyer.concreteRequest }),
      });
      const lastEvalCall = vi.mocked(BuyerEvaluationService.evaluateBuyerInteraction).mock.calls.at(-1)?.[0];

      // Ambos deben resolver la captación inicial (1) y no la solicitud histórica (3)
      expect(listBuyer.serviceOfInterestId).toBe('1');
      expect(listBuyer.serviceOfInterest).toBe('Ortodoncia General');

      expect(fichaBuyer.serviceOfInterestId).toBe('1');
      expect(fichaBuyer.serviceOfInterest).toBe('Ortodoncia General');

      expect(lastEvalCall?.id_servicio_declarado).toBe(1);

      expect(listBuyer.serviceOfInterestId).toBe(fichaBuyer.serviceOfInterestId);
      expect(String(lastEvalCall?.id_servicio_declarado)).toBe(fichaBuyer.serviceOfInterestId);
    });

    it('Focal 3: Varias preferencias, incluida una anterior cerrada (selecciona preferencia vigente determinista)', async () => {
      const personaId = 203;
      state.personas.set(personaId, {
        id_persona: personaId,
        nombres: 'Federico',
        apellidos: 'Luna',
        numero: '988003344',
        email: 'federico.luna@example.com',
        id_etapa_actual: 1,
        estado_calidad: 'Valido',
        autoriza_contacto: true,
        fecha_registro: new Date(),
      });

      // Preferencia 1 antigua y CERRADA por fecha_fin: Ortodoncia General (id: 1)
      state.personaPreferencias.push({
        id_preferencia: 310,
        id_persona: personaId,
        id_servicio_interes: 1,
        fecha_inicio: new Date('2025-01-01'),
        fecha_fin: new Date('2025-06-01'), // Fecha pasada -> cerrada
      });

      // Preferencia 2 más reciente y VIGENTE: Blanqueamiento Dental (id: 2)
      state.personaPreferencias.push({
        id_preferencia: 320,
        id_persona: personaId,
        id_servicio_interes: 2,
        fecha_inicio: new Date('2026-01-01'),
        fecha_fin: null, // Sin cierre -> vigente
      });

      // Captación inicial (1) y Solicitud (3) de fondo
      state.captaciones.push({
        id_captacion: 52,
        id_persona: personaId,
        id_servicio: 1,
        motivo_consulta: 'Captación histórica',
      });
      state.solicitudes.push({
        id_solicitud: 602,
        id_persona: personaId,
        id_servicio: 3,
        motivo: 'Solicitud histórica',
      });

      state.interacciones.push({
        id_interaccion: 2003,
        id_persona: personaId,
        tipo: 'Consulta Inicial',
        mensaje: 'Consulta para blanqueamiento',
        fecha_hora: new Date(),
      });

      // 1. GET /buyer (Listado)
      const listRes = await fetch(`${baseUrl}/`);
      const listData = await listRes.json();
      const listBuyer = listData.find((b: any) => Number(b.id) === personaId);

      // 2. GET /buyer/:id (Ficha)
      const fichaRes = await fetch(`${baseUrl}/${personaId}`);
      const fichaBuyer = await fichaRes.json();

      // 3. POST /buyer/:id/evaluate (Evaluador)
      await fetch(`${baseUrl}/${personaId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fichaBuyer.concreteRequest }),
      });
      const lastEvalCall = vi.mocked(BuyerEvaluationService.evaluateBuyerInteraction).mock.calls.at(-1)?.[0];

      // Debe resolver determinísticamente la preferencia vigente 2 (Blanqueamiento)
      expect(listBuyer.serviceOfInterestId).toBe('2');
      expect(listBuyer.serviceOfInterest).toBe('Blanqueamiento Dental');

      expect(fichaBuyer.serviceOfInterestId).toBe('2');
      expect(fichaBuyer.serviceOfInterest).toBe('Blanqueamiento Dental');

      expect(lastEvalCall?.id_servicio_declarado).toBe(2);

      expect(listBuyer.serviceOfInterestId).toBe(fichaBuyer.serviceOfInterestId);
      expect(String(lastEvalCall?.id_servicio_declarado)).toBe(fichaBuyer.serviceOfInterestId);
    });

    it('Focal 4: Servicio declarado inactivo (señalado como no disponible sin reemplazo silencioso)', async () => {
      const personaId = 204;
      state.personas.set(personaId, {
        id_persona: personaId,
        nombres: 'Susana',
        apellidos: 'Bustamante',
        numero: '988004455',
        email: 'susana.b@example.com',
        id_etapa_actual: 1,
        estado_calidad: 'Valido',
        autoriza_contacto: true,
        fecha_registro: new Date(),
      });

      // Preferencia vigente pero con servicio INACTIVO (id_servicio: 99)
      state.personaPreferencias.push({
        id_preferencia: 330,
        id_persona: personaId,
        id_servicio_interes: 99,
        fecha_inicio: new Date(),
        fecha_fin: null,
      });

      // Existen captación inicial (1) y solicitud histórica (3) activas
      state.captaciones.push({
        id_captacion: 53,
        id_persona: personaId,
        id_servicio: 1,
        motivo_consulta: 'Captación histórica',
      });
      state.solicitudes.push({
        id_solicitud: 603,
        id_persona: personaId,
        id_servicio: 3,
        motivo: 'Solicitud histórica',
      });

      state.interacciones.push({
        id_interaccion: 2004,
        id_persona: personaId,
        tipo: 'Consulta Inicial',
        mensaje: 'Pregunta sobre servicio dado de baja',
        fecha_hora: new Date(),
      });

      // 1. GET /buyer (Listado)
      const listRes = await fetch(`${baseUrl}/`);
      const listData = await listRes.json();
      const listBuyer = listData.find((b: any) => Number(b.id) === personaId);

      // 2. GET /buyer/:id (Ficha)
      const fichaRes = await fetch(`${baseUrl}/${personaId}`);
      const fichaBuyer = await fichaRes.json();

      // 3. POST /buyer/:id/evaluate (Evaluador)
      await fetch(`${baseUrl}/${personaId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fichaBuyer.concreteRequest }),
      });
      const lastEvalCall = vi.mocked(BuyerEvaluationService.evaluateBuyerInteraction).mock.calls.at(-1)?.[0];

      // Verificación de no disponibilidad explícita:
      // NO debe reemplazar silenciosamente por el servicio 1 (captación) ni por el 3 (solicitud)
      expect(listBuyer.serviceOfInterest).toContain('No disponible');
      expect(listBuyer.serviceOfInterestId).toBeUndefined();

      expect(fichaBuyer.serviceOfInterest).toContain('No disponible');
      expect(fichaBuyer.serviceOfInterestId).toBeUndefined();

      expect(lastEvalCall?.id_servicio_declarado).toBeNull();

      expect(listBuyer.serviceOfInterest).toBe(fichaBuyer.serviceOfInterest);
      expect(listBuyer.serviceOfInterestId).toBe(fichaBuyer.serviceOfInterestId);
    });
  });

  // =========================================================================
  // CASO 1: Buyer sin Solicitudes: servicio seleccionado coincide entre ficha y evaluador
  // =========================================================================
  it('Caso 1: Buyer sin Solicitudes: servicio seleccionado coincide entre ficha y argumento enviado al evaluador', async () => {
    const personaId = 101;
    state.personas.set(personaId, {
      id_persona: personaId,
      nombres: 'Andrea',
      apellidos: 'Salazar',
      numero: '987112233',
      email: 'andrea.salazar@example.com',
      id_etapa_actual: 1, // BUYER
      estado_calidad: 'Valido',
      autoriza_contacto: true,
      fecha_registro: new Date(),
    });

    // Sin solicitudes comerciales
    expect(state.solicitudes.length).toBe(0);

    // Preferencia declarada vigente para Blanqueamiento Dental (id_servicio: 2)
    state.personaPreferencias.push({
      id_preferencia: 301,
      id_persona: personaId,
      id_servicio_interes: 2,
    });

    state.interacciones.push({
      id_interaccion: 1001,
      id_persona: personaId,
      tipo: 'Consulta Inicial',
      mensaje: '¿Cuánto dura la sesión de blanqueamiento?',
      fecha_hora: new Date(),
    });

    // 1. Obtener la ficha del buyer
    const getRes = await fetch(`${baseUrl}/${personaId}`);
    expect(getRes.status).toBe(200);
    const buyerData = await getRes.json();

    // La ficha debe resolver el servicio declarado desde PersonaPreferencias.id_servicio_interes
    expect(buyerData.serviceOfInterestId).toBe('2');
    expect(buyerData.serviceOfInterest).toBe('Blanqueamiento Dental');
    expect(buyerData.solicitudesHistory.length).toBe(0);

    // 2. Evaluar el mensaje del buyer
    const evalRes = await fetch(`${baseUrl}/${personaId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: buyerData.concreteRequest }),
    });

    expect(evalRes.status).toBe(200);
    expect(BuyerEvaluationService.evaluateBuyerInteraction).toHaveBeenCalled();

    const lastCallArg = vi.mocked(BuyerEvaluationService.evaluateBuyerInteraction).mock.calls.at(-1)?.[0];
    expect(lastCallArg).toBeDefined();
    // El argumento enviado al evaluador debe coincidir exactamente con el servicio de la ficha (2)
    expect(lastCallArg?.id_servicio_declarado).toBe(2);
    expect(buyerData.serviceOfInterestId).toBe(String(lastCallArg?.id_servicio_declarado));
  });

  // =========================================================================
  // CASO 2: Edición de servicio: cambia preferencia actual y conserva captación
  // =========================================================================
  it('Caso 2: Edición de servicio: cambia preferencia actual y conserva captación inicial', async () => {
    const personaId = 102;
    state.personas.set(personaId, {
      id_persona: personaId,
      nombres: 'Camila',
      apellidos: 'Vega',
      numero: '955112233',
      email: 'camila.vega@example.com',
      id_etapa_actual: 1,
      estado_calidad: 'Valido',
      autoriza_contacto: true,
      fecha_registro: new Date(),
    });

    // Captación inicial documentada con Ortodoncia General (id_servicio: 1)
    state.captaciones.push({
      id_captacion: 1,
      id_persona: personaId,
      id_servicio: 1,
      motivo_consulta: 'Interés inicial en brackets',
    });

    // Preferencia inicial
    state.personaPreferencias.push({
      id_preferencia: 302,
      id_persona: personaId,
      id_servicio_interes: 1,
      sede_preferida: 'Sede Sur',
    });

    // Edición del servicio de interés a Blanqueamiento Dental (id_servicio: 2)
    const res = await fetch(`${baseUrl}/${personaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceOfInterestId: 2,
        person: {
          firstName: 'Camila',
          lastName: 'Vega',
        },
      }),
    });

    expect(res.status).toBe(200);

    // 1. Verificar que PersonaPreferencias se actualizó con el nuevo servicio
    const pref = state.personaPreferencias.find(p => p.id_persona === personaId);
    expect(pref).toBeDefined();
    expect(pref?.id_servicio_interes).toBe(2);
    // Conserva otras preferencias no enviadas (sede_preferida)
    expect(pref?.sede_preferida).toBe('Sede Sur');

    // 2. Verificar que la captación inicial CONSERVA su servicio original (id_servicio: 1)
    const cap = state.captaciones.find(c => c.id_persona === personaId);
    expect(cap).toBeDefined();
    expect(cap?.id_servicio).toBe(1);

    // 3. Verificar que NO se ejecutó UPDATE en CaptacionesBuyer
    expect(state.captacionesUpdated).toBe(false);
  });

  // =========================================================================
  // CASO 3: Nueva consulta de contacto existente en PAYER: guarda mensaje, conserva etapa
  // =========================================================================
  it('Caso 3: Nueva consulta de contacto existente en PAYER: guarda mensaje, conserva etapa y no crea persona ni solicitud', async () => {
    const personaId = 103;
    state.personas.set(personaId, {
      id_persona: personaId,
      nombres: 'Diego',
      apellidos: 'Torres',
      numero: '944887766',
      email: 'diego.payer@example.com',
      id_etapa_actual: 3, // PAYER
      estado_calidad: 'Valido',
      autoriza_contacto: true,
      fecha_registro: new Date('2026-10-01'),
    });

    state.captaciones.push({
      id_captacion: 2,
      id_persona: personaId,
      id_servicio: 1,
      motivo_consulta: 'Tratamiento inicial pagado',
    });

    const personasBefore = state.personas.size;
    const solicitudesBefore = state.solicitudes.length;

    // Contacto existente envía una nueva consulta
    const nuevaConsulta = 'Hola, soy paciente activo. ¿Tienen disponibilidad este sábado para control de brackets?';
    const res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Diego',
        lastName: 'Torres',
        phone: '944887766',
        email: 'diego.payer@example.com',
        concreteRequest: nuevaConsulta,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isDuplicate).toBe(true);

    // 1. No se creó una persona adicional
    expect(state.personas.size).toBe(personasBefore);

    // 2. Se conserva estrictamente su etapa PAYER (3)
    const personInDb = state.personas.get(personaId);
    expect(personInDb.id_etapa_actual).toBe(3);

    // 3. NO se creó ninguna solicitud comercial
    expect(state.solicitudes.length).toBe(solicitudesBefore);

    // 4. Se guardó la nueva consulta en Interacciones vinculada al contacto existente
    const newInt = state.interacciones.find(i => i.id_persona === personaId && i.tipo === 'Nueva Consulta');
    expect(newInt).toBeDefined();
    expect(newInt?.mensaje).toBe(nuevaConsulta);
  });

  // =========================================================================
  // CASO 4: Mensaje mayor de 500 caracteres: conserva el contenido completo en Interacciones
  // =========================================================================
  it('Caso 4: Mensaje mayor de 500 caracteres: conserva el contenido completo en Interacciones sin recortar', async () => {
    const textoExtenso = 'Consulta sumamente detallada para ortodoncia invisible: ' +
      'quisiera saber los costos exactos del tratamiento integral, las formas de financiamiento con tarjeta de crédito, ' +
      'si se requiere estudio cefalométrico previo incluido en el presupuesto inicial, qué días atienden en horario extendido ' +
      'pasadas las 18:00 horas, y cuánto tiempo estimado toma la entrega de los alineadores en la primera cita de colocación. ' +
      'Adicionalmente requiero saber si atienden pacientes con historial previo de endodoncia en piezas molares superiores. ' +
      'Muchas gracias por su pronta y detallada respuesta a cada punto.';

    expect(textoExtenso.length).toBeGreaterThan(500);

    const res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Gonzalo',
        lastName: 'Mendez',
        phone: '933445566',
        email: 'gonzalo.mendez@example.com',
        concreteRequest: textoExtenso,
        serviceOfInterestId: 1,
        contactAuthorization: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();

    // 1. Verificar que Interacciones.mensaje contiene el texto íntegro sin recortar a 500 caracteres
    const createdInt = state.interacciones.find(i => i.id_persona === body.id_persona);
    expect(createdInt).toBeDefined();
    expect(createdInt?.mensaje).toBe(textoExtenso);
    expect(createdInt?.mensaje.length).toBe(textoExtenso.length);
    expect(createdInt?.mensaje.length).toBeGreaterThan(500);

    // 2. Verificar que CaptacionesBuyer.motivo_consulta sí respeta el límite de almacenamiento
    const cap = state.captaciones.find(c => c.id_persona === body.id_persona);
    if (cap?.motivo_consulta) {
      expect(cap.motivo_consulta.length).toBeLessThanOrEqual(500);
    }
  });

  // =========================================================================
  // CASO 5: Edición que omite servicio: conserva la preferencia existente
  // =========================================================================
  it('Caso 5: Edición que omite servicio: conserva la preferencia existente sin borrarla ni resetearla', async () => {
    const personaId = 104;
    state.personas.set(personaId, {
      id_persona: personaId,
      nombres: 'Elena',
      apellidos: 'Morales',
      numero: '922334455',
      email: 'elena.morales@example.com',
      id_etapa_actual: 1,
      estado_calidad: 'Valido',
      autoriza_contacto: true,
      fecha_registro: new Date(),
    });

    // Preferencia declarada previa con servicio 2 y sede específica
    state.personaPreferencias.push({
      id_preferencia: 304,
      id_persona: personaId,
      id_servicio_interes: 2, // Blanqueamiento Dental
      sede_preferida: 'Sede Central Magdalena',
      id_canal: 1,
    });

    // Edición administrativa que actualiza teléfono y mensaje pero OMITE serviceOfInterestId
    const res = await fetch(`${baseUrl}/${personaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concreteRequest: 'Mensaje actualizado sobre formas de pago',
        person: {
          firstName: 'Elena',
          lastName: 'Morales',
          phone: '922998877',
        },
      }),
    });

    expect(res.status).toBe(200);

    // Verificar que la preferencia existente para persona 104 conserva id_servicio_interes y sede
    const pref = state.personaPreferencias.find(p => p.id_persona === personaId);
    expect(pref).toBeDefined();
    expect(pref?.id_servicio_interes).toBe(2);
    expect(pref?.sede_preferida).toBe('Sede Central Magdalena');
    expect(pref?.id_canal).toBe(1);
  });

  // =========================================================================
  // CASO 6: PUT /buyer/:id al editar consulta conserva historial y NO modifica Solicitudes históricas
  // =========================================================================
  it('Caso 6: PUT /buyer/:id al editar consulta conserva el historial de interacciones y NO modifica solicitudes comerciales históricas', async () => {
    const personaId = 105;
    state.personas.set(personaId, {
      id_persona: personaId,
      nombres: 'Marcos',
      apellidos: 'Guerra',
      numero: '955443322',
      email: 'marcos@example.com',
      id_etapa_actual: 1,
      estado_calidad: 'Valido',
      autoriza_contacto: true,
      fecha_registro: new Date('2026-11-01'),
    });

    state.interacciones.push({
      id_interaccion: 1010,
      id_persona: personaId,
      tipo: 'Consulta Inicial',
      mensaje: '¿Cuánto cuesta la profilaxis?',
      fecha_hora: new Date('2026-11-01T10:00:00Z'),
    });

    state.solicitudes.push({
      id_solicitud: 550,
      id_persona: personaId,
      id_servicio: 1,
      motivo: 'Solicitud histórica inmutable aprobada',
      fecha_solicitud: new Date('2026-11-01T10:05:00Z'),
    });

    const nuevoMensaje = 'Nueva consulta: ¿tienen horario después de las 6 pm para profilaxis?';
    const res = await fetch(`${baseUrl}/${personaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concreteRequest: nuevoMensaje,
        person: {
          firstName: 'Marcos',
          lastName: 'Guerra',
          phone: '955443322',
        },
      }),
    });

    expect(res.status).toBe(200);

    expect(mockPrisma.solicitudes.update).not.toHaveBeenCalled();
    expect(mockPrisma.solicitudes.create).not.toHaveBeenCalled();
    const solHistorica = state.solicitudes.find(s => s.id_solicitud === 550);
    expect(solHistorica?.motivo).toBe('Solicitud histórica inmutable aprobada');

    const interaccionesPersona = state.interacciones.filter(i => i.id_persona === personaId);
    expect(interaccionesPersona.length).toBe(2);
    expect(interaccionesPersona[0].mensaje).toBe('¿Cuánto cuesta la profilaxis?');
    expect(interaccionesPersona[1].mensaje).toBe(nuevoMensaje);
    expect(interaccionesPersona[1].tipo).toBe('Mensaje Modificado / Edición');
  });

  // =========================================================================
  // CASO 7: GET /buyer/:id y POST /buyer/:id/evaluate utilizan el mismo mensaje vigente
  // =========================================================================
  it('Caso 7: GET /buyer/:id y POST /buyer/:id/evaluate utilizan el mismo mensaje vigente e identificador de interacción', async () => {
    const personaId = 106;
    state.personas.set(personaId, {
      id_persona: personaId,
      nombres: 'Luciana',
      apellidos: 'Paredes',
      numero: '944332211',
      email: 'luciana@example.com',
      id_etapa_actual: 1,
      estado_calidad: 'Valido',
      autoriza_contacto: true,
      fecha_registro: new Date(),
    });

    const activeMessage = 'Hola, quiero consultar el arancel de ortodoncia';
    state.interacciones.push({
      id_interaccion: 1020,
      id_persona: personaId,
      tipo: 'Consulta Inicial',
      mensaje: activeMessage,
      fecha_hora: new Date(),
    });

    const getRes = await fetch(`${baseUrl}/${personaId}`);
    expect(getRes.status).toBe(200);
    const buyerData = await getRes.json();

    expect(buyerData.concreteRequest).toBe(activeMessage);
    expect(buyerData.activeInteractionId).toBe(1020);

    const evalRes = await fetch(`${baseUrl}/${personaId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: buyerData.concreteRequest }),
    });

    expect(evalRes.status).toBe(200);
    const evalData = await evalRes.json();

    expect(evalData.latestEvaluation.id_interaccion).toBe(1020);
    expect(evalData.latestEvaluation.mensaje_evaluado).toBe(activeMessage);
    expect(evalData.latestEvaluation.es_mensaje_vigente).toBe(true);
  });

  // =========================================================================
  // CASO 8: Mensaje nuevo sin evaluar -> evaluación anterior identificada como previa
  // =========================================================================
  it('Caso 8: Mensaje nuevo sin evaluar identifica la evaluación previa como perteneciente al mensaje anterior', async () => {
    const personaId = 107;
    state.personas.set(personaId, {
      id_persona: personaId,
      nombres: 'Renato',
      apellidos: 'Castro',
      numero: '911223344',
      email: 'renato@example.com',
      id_etapa_actual: 1,
      estado_calidad: 'Valido',
      autoriza_contacto: true,
      fecha_registro: new Date(),
    });

    const primerMensaje = 'Pregunta 1: ¿Tienen ortodoncia invisible?';
    state.interacciones.push({
      id_interaccion: 1030,
      id_persona: personaId,
      tipo: 'Consulta Inicial',
      mensaje: primerMensaje,
      fecha_hora: new Date('2026-11-01T09:00:00Z'),
    });

    state.decisionesIA.push({
      id_decision: 850,
      id_persona: personaId,
      id_interaccion: 1030,
      agente: 'BUYER',
      fecha_hora: new Date('2026-11-01T09:01:00Z'),
      accion: 'SOLO_CONSULTA',
      decision: JSON.stringify({
        estado: 'COMPLETADA',
        intencion: 'SOLO_CONSULTA',
        id_servicio: 1,
        mensaje_evaluado: primerMensaje,
      }),
      resultado_revision: 'Consulta informativa sobre alineadores',
    });

    const segundoMensaje = 'Pregunta 2 actualizada: También quiero saber si atienden los feriados.';
    state.interacciones.push({
      id_interaccion: 1031,
      id_persona: personaId,
      tipo: 'Mensaje Modificado / Edición',
      mensaje: segundoMensaje,
      fecha_hora: new Date('2026-11-01T12:00:00Z'),
    });

    const res = await fetch(`${baseUrl}/${personaId}`);
    expect(res.status).toBe(200);
    const buyer = await res.json();

    expect(buyer.concreteRequest).toBe(segundoMensaje);
    expect(buyer.activeInteractionId).toBe(1031);
    expect(buyer.latestEvaluation).toBeDefined();
    expect(buyer.latestEvaluation.es_mensaje_vigente).toBe(false);
    expect(buyer.latestEvaluation.id_interaccion).toBe(1030);
    expect(buyer.latestEvaluation.id_interaccion_vigente).toBe(1031);
    expect(buyer.latestEvaluation.mensaje_evaluado).toBe(primerMensaje);
    expect(buyer.latestEvaluation.mensaje_vigente).toBe(segundoMensaje);
  });

  // =========================================================================
  // CASO 9: Journey Completo: Horarios, Reevaluación con preferencias modificadas e Idempotencia
  // =========================================================================
  describe('Caso 9 Journey: Reevaluación con preferencias modificadas e idempotencia persistente', () => {
    it('ejecuta el ciclo completo: aclaración por discrepancia -> edición de horario -> evaluación desactualizada en ficha -> actualización con resolución -> repetición idempotente sin duplicar', async () => {
      const personaId = 108;
      state.personas.set(personaId, {
        id_persona: personaId,
        nombres: 'Laura',
        apellidos: 'Torres',
        numero: '988776655',
        email: 'laura.torres@example.com',
        id_etapa_actual: 1, // BUYER
        estado_calidad: 'Valido',
        autoriza_contacto: true,
        fecha_registro: new Date(),
      });

      // Captación inicial
      state.captaciones.push({
        id_captacion: 80,
        id_persona: personaId,
        id_servicio: 1, // Ortodoncia General
        motivo_consulta: 'Quiero una cita mañana por la tarde',
      });

      // Preferencia inicial: Mañana (id_horario: 1)
      state.personaPreferencias.push({
        id_preferencia: 310,
        id_persona: personaId,
        id_servicio_interes: 1,
        id_horario: 1, // Mañana
        sede_preferida: 'Sede Central',
      });

      // Mensaje del paciente solicitando turno tarde
      const mensajePaciente = 'Quiero una cita mañana por la tarde';
      state.interacciones.push({
        id_interaccion: 1040,
        id_persona: personaId,
        tipo: 'Formulario Web',
        mensaje: mensajePaciente,
        fecha_hora: new Date('2026-11-02T10:00:00Z'),
      });

      // 1. Primer evaluate: Mensaje pide tarde + formulario indica mañana -> Aclaración requerida
      const evalRes1 = await fetch(`${baseUrl}/${personaId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensajePaciente }),
      });
      expect(evalRes1.status).toBe(200);
      const evalData1 = await evalRes1.json();

      expect(evalData1.success).toBe(true);
      expect(evalData1.data.accion).toBe('ACLARACION');
      expect(evalData1.data.discrepancia_horario).toBeDefined();
      expect(evalData1.data.discrepancia_horario.detectada).toBe(true);
      expect(evalData1.data.discrepancia_horario.mensajeIndica).toBe('Tarde');
      expect(evalData1.latestEvaluation.estado).toBe('COMPLETADA');
      expect(evalData1.latestEvaluation.accion).toBe('ACLARACION');

      // 2. Editar solamente horario a tarde (id_horario: 2) mediante PUT /buyer/:id
      const putRes = await fetch(`${baseUrl}/${personaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Laura',
          lastName: 'Torres',
          pref_id_horario: '2', // Cambio a turno Tarde
          concreteRequest: mensajePaciente, // Mismo mensaje
        }),
      });
      expect(putRes.status).toBe(200);

      // 3. Recargar la ficha (GET /buyer/:id): solo lee datos, evaluación anterior desactualizada
      const getRes = await fetch(`${baseUrl}/${personaId}`);
      expect(getRes.status).toBe(200);
      const buyerFicha = await getRes.json();

      expect(buyerFicha.latestEvaluation).toBeDefined();
      expect(buyerFicha.latestEvaluation.es_mensaje_vigente).toBe(true);
      // El contexto cambió (horario 1 -> 2), por lo que la evaluación queda desactualizada
      expect(buyerFicha.latestEvaluation.es_contexto_vigente).toBe(false);
      expect(buyerFicha.latestEvaluation.estado).toBe('DESACTUALIZADA');

      // 4. Pulsar Actualizar (POST /buyer/:id/evaluate): reevalúa bajo el nuevo contexto y resuelve conflicto
      const decisionsCountBefore = state.decisionesIA.length;
      const evalRes2 = await fetch(`${baseUrl}/${personaId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensajePaciente }),
      });
      expect(evalRes2.status).toBe(200);
      const evalData2 = await evalRes2.json();

      expect(evalData2.success).toBe(true);
      expect(evalData2.data.accion).toBe('CONVERSION_LEAD');
      expect(evalData2.data.discrepancia_horario).toBeNull();
      expect(evalData2.latestEvaluation.es_contexto_vigente).toBe(true);
      expect(evalData2.latestEvaluation.estado).toBe('COMPLETADA');
      expect(evalData2.latestEvaluation.id_interaccion).toBe(1040); // Mismo id_interaccion conservado
      expect(state.decisionesIA.length).toBe(decisionsCountBefore + 1); // Nueva decisión creada conservando la anterior

      // 5. Repetir sin cambios (POST /buyer/:id/evaluate): idempotencia sin nueva llamada ni duplicación
      const decisionsCountAfterEval2 = state.decisionesIA.length;
      const evalRes3 = await fetch(`${baseUrl}/${personaId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensajePaciente }),
      });
      expect(evalRes3.status).toBe(200);
      const evalData3 = await evalRes3.json();

      expect(evalData3.success).toBe(true);
      expect(evalData3.data.accion).toBe('CONVERSION_LEAD');
      // No se creó ningún registro adicional en decisionesIA (reutilización idempotente por coincidencia de huella)
      expect(state.decisionesIA.length).toBe(decisionsCountAfterEval2);
    });
  });

  // =========================================================================
  // Matriz de Casos de Horarios (detectScheduleDiscrepancy)
  // =========================================================================
  describe('Matriz de Casos de Horarios (detectScheduleDiscrepancy)', () => {
    const catalog = [
      { id_horario: 10, hora_inicio: '1970-01-01T08:00:00Z', hora_fin: '1970-01-01T12:00:00Z', nombre: 'Turno Mañana (08:00 - 12:00)' },
      { id_horario: 20, hora_inicio: '1970-01-01T14:00:00Z', hora_fin: '1970-01-01T18:00:00Z', nombre: 'Turno Tarde (14:00 - 18:00)' },
      { id_horario: 30, hora_inicio: '1970-01-01T18:30:00Z', hora_fin: '1970-01-01T21:00:00Z', nombre: 'Turno Noche (18:30 - 21:00)' },
    ];

    it('“Quiero una cita mañana por la tarde” + turno tarde: sin conflicto', () => {
      const res = detectScheduleDiscrepancy('Quiero una cita mañana por la tarde', 20, catalog);
      expect(res.detectada).toBe(false);
    });

    it('“No puedo por la tarde; prefiero por la mañana” + mañana: sin conflicto', () => {
      const res = detectScheduleDiscrepancy('No puedo por la tarde; prefiero por la mañana', 10, catalog);
      expect(res.detectada).toBe(false);
    });

    it('“Por la tarde” + noche: conflicto', () => {
      const res = detectScheduleDiscrepancy('Por la tarde', 30, catalog);
      expect(res.detectada).toBe(true);
      expect(res.mensajeIndica).toBe('Tarde');
      expect(res.preferenciaRegistrada).toContain('Noche');
    });

    it('“Por la mañana” + noche: conflicto', () => {
      const res = detectScheduleDiscrepancy('Por la mañana', 30, catalog);
      expect(res.detectada).toBe(true);
      expect(res.mensajeIndica).toBe('Mañana');
      expect(res.preferenciaRegistrada).toContain('Noche');
    });

    it('“Hasta mañana” y “más tarde”: no inferir un turno por esas expresiones', () => {
      expect(detectScheduleDiscrepancy('Muchas gracias, hasta mañana', 10, catalog).detectada).toBe(false);
      expect(detectScheduleDiscrepancy('Te confirmo más tarde si puedo', 20, catalog).detectada).toBe(false);
      expect(detectScheduleDiscrepancy('Hasta mañana y te aviso más tarde', 30, catalog).detectada).toBe(false);
    });

    it('“Quiero una cita mañana” (fecha) + turno tarde: sin conflicto por ser fecha', () => {
      const res = detectScheduleDiscrepancy('Quiero una cita mañana', 20, catalog);
      expect(res.detectada).toBe(false);
    });

    it('detecta conflictos en ambos sentidos entre los 6 pares (mañana, tarde, noche)', () => {
      // 1. Manana vs Tarde
      expect(detectScheduleDiscrepancy('Por la tarde', 10, catalog).detectada).toBe(true);
      // 2. Manana vs Noche
      expect(detectScheduleDiscrepancy('Por la noche', 10, catalog).detectada).toBe(true);
      // 3. Tarde vs Manana
      expect(detectScheduleDiscrepancy('Por la mañana', 20, catalog).detectada).toBe(true);
      // 4. Tarde vs Noche
      expect(detectScheduleDiscrepancy('Por la noche', 20, catalog).detectada).toBe(true);
      // 5. Noche vs Manana
      expect(detectScheduleDiscrepancy('Por la mañana', 30, catalog).detectada).toBe(true);
      // 6. Noche vs Tarde
      expect(detectScheduleDiscrepancy('Por la tarde', 30, catalog).detectada).toBe(true);
    });

    it('no utiliza preferencias cerradas cuando no existe una vigente (null -> sin discrepancia)', () => {
      expect(detectScheduleDiscrepancy('Por la tarde', null, catalog).detectada).toBe(false);
      expect(detectScheduleDiscrepancy('Por la mañana', undefined, catalog).detectada).toBe(false);
    });
  });
});
