// Doble de persistencia: NO es una prueba de SQL Server ni de locks reales.
import { vi } from 'vitest';
export function buyerChatMemory() {
  let id = 1000;
  let queue = Promise.resolve();
  const state = { decisions: [] as any[], interactions: [] as any[], requests: [] as any[], events: [] as any[],
    intakes: [] as any[], depth: 0, sqlNow: Date.parse('2026-11-13T02:00:00Z'), failConversion: false, people: new Map<number, any>([
      [1, { id_persona: 1, nombres: 'Paciente Privado', apellidos: 'Apellido Reservado', dni: '12345678', numero: '999888777',
        email: 'privado@example.invalid', autoriza_contacto: true, estado_calidad: 'Valido', Etapa: { nombre: 'BUYER' } }],
      [2, { id_persona: 2, nombres: 'Otro', apellidos: 'QA', autoriza_contacto: true, estado_calidad: 'Valido', Etapa: { nombre: 'BUYER' } }],
    ]), capture: [{ id_persona: 1, id_captacion: 11, id_servicio: 1 }, { id_persona: 2, id_captacion: 22, id_servicio: 1 }],
    pref: { id_preferencia: 1, id_horario: null, id_servicio_interes: 1, sede_preferida: 'Sede QA', Horario: null },
  };
  const services = [{ id_servicio: 1, nombre: 'Evaluación odontológica', descripcion: 'Evaluación', activo: true }];
  const matches = (r: any, w: any): boolean => Object.entries(w || {}).every(([k,v]: [string,any]) => {
    if (k === 'OR') return v.some((c: any) => matches(r,c));
    if (k === 'NOT') return !matches(r,v);
    if (v && typeof v === 'object') {
      if ('contains' in v) return String(r[k] || '').includes(v.contains);
      if ('gt' in v) return r[k] > v.gt;
      if ('not' in v) return r[k] !== v.not;
    }
    return r[k] === v;
  });
  const rows = (data: any[], args: any = {}, key = 'id_decision') => {
    const filtered = data.filter(r => matches(r,args.where));
    const direction = args.orderBy?.[key] === 'desc' ? -1 : 1;
    filtered.sort((a,b) => (a[key]-b[key])*direction);
    return structuredClone(filtered.slice(0,args.take ?? filtered.length));
  };
  const db: any = {
    $transaction: vi.fn(async (cb: any) => {
      const before = queue; let release!: () => void;
      queue = new Promise<void>(r => { release = r; }); await before;
      state.depth++;
      const snapshot = structuredClone({ decisions: state.decisions, interactions: state.interactions });
      try { return await cb(db); }
      catch (e) { state.decisions = snapshot.decisions; state.interactions = snapshot.interactions; throw e; }
      finally { state.depth--; release(); }
    }),
    personas: { findUnique: vi.fn(async ({where,include}: any) => {
      const p=structuredClone(state.people.get(where.id_persona)||null);if(!p)return null;
      if(include?.Interacciones)Object.assign(p,{
        fecha_registro:new Date('2026-11-01T00:00:00Z'),CanalOrigen:null,CampanaOrigen:null,
        Interacciones:rows(state.interactions,{where:{id_persona:p.id_persona,...include.Interacciones.where}},'id_interaccion'),
        DecisionesIA:rows(state.decisions,{where:{id_persona:p.id_persona,...include.DecisionesIA?.where}}),
        Preferencias:[],Solicitudes:[],EventosEtapa:[],DatosAcademicos:[],DatosLaborales:[],SaludOdontologica:[],
      });return p;
    }) },
    servicios: { findMany: vi.fn(async () => structuredClone(services)), findFirst: vi.fn(async ({where}: any) => services.find(s => matches(s,where)) || null) },
    horarios: { findMany: vi.fn(async () => []) },
    personaPreferencias: { findFirst: vi.fn(async () => structuredClone(state.pref)) },
    decisionesIA: {
      findMany: vi.fn(async (args: any) => rows(state.decisions,args)),
      findFirst: vi.fn(async (args: any) => rows(state.decisions,args)[0] || null),
      create: vi.fn(async ({data}: any) => { const row={id_decision: ++id, id_interaccion:null, fecha_hora: new Date(), ...data};state.decisions.push(row);return structuredClone(row); }),
      update: vi.fn(async ({where,data}: any) => { const row=state.decisions.find(d=>d.id_decision===where.id_decision);if(!row)throw Error('DECISION_NOT_FOUND');Object.assign(row,data);return structuredClone(row); }),
    },
    interacciones: {
      create: vi.fn(async ({data}: any) => {const row={id_interaccion: ++id,...data};state.interactions.push(row);return structuredClone(row);}),
      findUnique: vi.fn(async ({where}: any) => structuredClone(state.interactions.find(r=>r.id_interaccion===where.id_interaccion)||null)),
      findFirst: vi.fn(async (args: any) => rows(state.interactions,args,'id_interaccion')[0]||null),
    },
    solicitudes: { findFirst: vi.fn(async ({where}: any) => state.requests.find(r=>matches(r,where))||null) },
    $queryRaw: vi.fn(async (parts: TemplateStringsArray,...values: any[]) => {
      const sql=parts.join('?');
      if(sql.includes('CHAT_INTAKE_SESSION_FENCE')) {
        if(state.depth!==0)throw Error('INTAKE_REQUIRES_AUTOCOMMIT');
        const [requestId,personId,turnId,executionId,resource]=values;
        const row=state.decisions.find(d=>d.id_decision===turnId&&d.id_persona===personId&&d.agente==='BUYER_CHAT');
        const turn=row?JSON.parse(row.entrada):null;
        const interaction=state.interactions.find(i=>i.id_interaccion===row?.id_interaccion&&i.id_persona===personId);
        if(resource!==`BuyerChat:${personId}`||turn?.status!=='PROCESANDO'||turn?.execution?.id!==executionId||
          Date.parse(turn.execution.expiresAt)<=state.sqlNow||interaction?.id_solicitud!==requestId)throw Error('CHAT_EXECUTION_LOST');
        const event=state.events.find(e=>e.id_solicitud===requestId);if(!event)throw Error('NO_CONVERSION');
        if(!state.intakes.some(e=>e.id_solicitud===requestId))state.intakes.push({...event});return[{...event}];
      }
      if(sql.includes('sp_getapplock')) return [{result:0}];
      if(sql.includes('SYSUTCDATETIME() AS now_utc')) return [{now_utc:new Date(state.sqlNow)}];
      if(sql.includes('CHAT_RECONCILE')) return structuredClone(state.events.filter(e=>e.id_persona===values[0]&&e.id_captacion===values[1])
        .map(e=>({...e,id_servicio:state.requests.find(r=>r.id_solicitud===e.id_solicitud)?.id_servicio})));
      if(sql.includes("OBJECT_ID(N'dbo.usp_RegistrarEntradaAgenteLead'")) return [{existe:1}];
      if(sql.includes('FROM dbo.CaptacionesBuyer')) return structuredClone(state.capture.filter(c=>c.id_persona===values[0]));
      if(sql.includes('FROM dbo.EventosEtapa')) return structuredClone(state.events.filter(e=>e.id_captacion===values[0]).slice(-1));
      if(sql.includes('FROM dbo.Solicitudes')) return structuredClone(state.requests.filter(r=>r.id_solicitud===values[0]));
      if(sql.includes('EXEC dbo.usp_ConvertirBuyerALead')) {
        // v2 protege cada efecto con una transacción breve de fencing. El SDK
        // sigue comprobando depth=0: nunca espera a Gemini dentro de ella.
        if(state.failConversion) throw Error('SIMULATED_SQL_FAILURE');
        const capture=state.capture.find(c=>c.id_captacion===values[0])!;
        const old=state.events.find(e=>e.id_captacion===capture.id_captacion);if(old)return[{...old,ya_convertido:1}];
        const request={id_solicitud:++id,id_persona:capture.id_persona,id_servicio:values[1],estado:'Abierta'};state.requests.push(request);
        const event={id_evento_etapa:++id,id_captacion:capture.id_captacion,id_persona:capture.id_persona,id_solicitud:request.id_solicitud,clave_operacion_buyer:`BUYER_LEAD:${capture.id_captacion}`};
        state.events.push(event);state.people.get(capture.id_persona).Etapa.nombre='LEAD';return[{...event,ya_convertido:0}];
      }
      if(sql.includes('EXEC dbo.usp_RegistrarEntradaAgenteLead')) {
        const event=state.events.find(e=>e.id_solicitud===values[0]);if(!event)throw Error('NO_CONVERSION');
        if(!state.intakes.some(e=>e.id_solicitud===values[0]))state.intakes.push({...event});return[{...event}];
      }
      throw Error('UNMODELED_SQL: '+sql);
    }),
    $executeRaw: vi.fn(async (parts: TemplateStringsArray,...values: any[]) => {
      const sql=parts.join('?');if(!sql.includes('UPDATE dbo.Interacciones'))throw Error('UNMODELED_DML');
      const row=state.interactions.find(r=>r.id_interaccion===values[values.length-1]);
      if(row && sql.includes('id_solicitud='))row.id_solicitud=values[0];return row?1:0;
    }),
  };
  return { db,state,services };
}
