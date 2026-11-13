// @vitest-environment node
// Regresión del contrato observado en QA real. Este archivo usa SDK simulado.
import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/db', () => ({ prisma: new Proxy({}, {get(){throw Error('REAL_SQL_FORBIDDEN');}}) }));
import { BuyerMessageClassifier } from '../src/services/buyerMessageClassifier';
import { BuyerConversationService } from '../src/services/buyerConversationService';
import { buyerChatMemory } from './helpers/buyerChatMemory';
const catalog=[{id_servicio:1,nombre:'Evaluación odontológica'}];
const context={history:[],preferences:{declaredServiceId:1,branch:null,schedule:null,source:'CaptacionesBuyer'},facts:[],confirmationServiceId:null};
describe('Contrato confirmar_servicio tras QA real',()=>{
  it.each(['INFORMAR','SOLICITAR_CONVERSION'])('explica null para %s y conserva la salida válida',async action=>{
    const sdk=vi.fn(async()=>({text:JSON.stringify({intencion:action==='INFORMAR'?'SOLO_CONSULTA':'SOLICITA_RESERVA',id_servicio:1,
      respuesta:'Puedo ayudarte con esa solicitud.',datos_pendientes:[],contradicciones:[],accion_propuesta:action,confirmar_servicio:null})}));
    const classifier=new BuyerMessageClassifier({client:{models:{generateContent:sdk}} as any});
    const result=await classifier.classify('Solicito información o atención.',catalog,{conversationContext:context as any});
    expect(result.conversation?.confirmar_servicio).toBeNull();
    const sent=(sdk.mock.calls[0] as any)[0];
    expect(sent.config.systemInstruction).toContain('confirmar_servicio DEBE ser null');
    expect(sent.config.systemInstruction).toContain('con intencion AMBIGUA, accion_propuesta DEBE ser ACLARAR');
    expect(sent.config.responseSchema.properties.confirmar_servicio.description).toContain('null con INFORMAR o SOLICITAR_CONVERSION');
    expect(sdk).toHaveBeenCalledTimes(1);
  });
  it('sigue rechazando confirmar_servicio con solicitud directa, sin normalizar ni convertir',async()=>{
    const sdk=vi.fn(async()=>({text:JSON.stringify({intencion:'SOLICITA_RESERVA',id_servicio:1,respuesta:'Puedo ayudarte con esa solicitud.',
      datos_pendientes:[],contradicciones:[],accion_propuesta:'SOLICITAR_CONVERSION',confirmar_servicio:1})}));
    const classifier=new BuyerMessageClassifier({client:{models:{generateContent:sdk}} as any});
    await expect(classifier.classify('Quiero solicitar una cita.',catalog,{conversationContext:context as any})).rejects.toThrow('La confirmación debe ser una pregunta de aclaración');
    expect(sdk).toHaveBeenCalledTimes(1);
  });
  it('mantiene el rechazo de acción incompatible y solo identifica enums en el diagnóstico',async()=>{
    const sdk=vi.fn(async()=>({text:JSON.stringify({intencion:'AMBIGUA',id_servicio:null,respuesta:'Hola.',datos_pendientes:[],contradicciones:[],accion_propuesta:'INFORMAR',confirmar_servicio:null})}));
    const classifier=new BuyerMessageClassifier({client:{models:{generateContent:sdk}} as any});
    await expect(classifier.classify('Hola',catalog,{conversationContext:context as any})).rejects.toThrow('AMBIGUA/INFORMAR');
    expect(sdk).toHaveBeenCalledTimes(1);
  });
});

describe('Recepción LEAD sin transacción envolvente (SQL simulado)',()=>{
  const classified={intencion:'SOLICITA_RESERVA',id_servicio:1,conversation:{respuesta:'Puedo enviar la solicitud.',
    datos_pendientes:[],contradicciones:[],accion_propuesta:'SOLICITAR_CONVERSION',confirmar_servicio:null}};
  it('ejecuta el receptor sin transacción y conserva el fencing por sesión en el mismo batch',async()=>{
    const f=buyerChatMemory(),classify=vi.fn(async()=>classified as any);
    const service=new BuyerConversationService(f.db,classify);
    const r=await service.send(1,7,'real-intake-contract',{message:'Solicito evaluación odontológica.',origin:'OPERADOR_TRANSCRIPTOR'});
    expect(r.evaluation?.entregaLeadEstado).toBe('CONFIRMADA');expect(f.state.intakes).toHaveLength(1);
    const call=f.db.$queryRaw.mock.calls.find((c:any)=>c[0].join('').includes('CHAT_INTAKE_SESSION_FENCE'))!;
    expect(call[0].join('')).toContain("@LockOwner=N'Session'");expect(call[0].join('')).toContain('SYSUTCDATETIME()');
    expect(call[0].join('')).toContain("$.execution.id");expect(call[0].join('')).toContain('sp_releaseapplock');
    expect(classify).toHaveBeenCalledTimes(1);
  });
  it('un retry explícito de entrega pendiente reconcilia sin repetir Gemini, mensaje ni conversión',async()=>{
    const f=buyerChatMemory(),raw=f.db.$queryRaw.getMockImplementation()!;let unavailable=true;
    f.db.$queryRaw.mockImplementation(async(...args:any[])=>{
      if(unavailable&&args[0].join('').includes('CHAT_INTAKE_SESSION_FENCE'))throw Error('SIMULATED_INTAKE_UNAVAILABLE');
      return raw(...args);
    });
    const classify=vi.fn(async()=>classified as any),service=new BuyerConversationService(f.db,classify);
    const first=await service.send(1,7,'pending-handoff-contract',{message:'Solicito evaluación odontológica.',origin:'OPERADOR_TRANSCRIPTOR'});
    expect(first.evaluation?.entregaLeadEstado).toBe('PENDIENTE');expect(first.retryable).toBe(true);
    unavailable=false;const second=await service.retry(1,first.conversationId,first.turnId);
    expect(second.turnId).toBe(first.turnId);expect(second.interactionId).toBe(first.interactionId);
    expect(second.evaluation?.id_solicitud).toBe(first.evaluation?.id_solicitud);expect(second.evaluation?.entregaLeadEstado).toBe('CONFIRMADA');
    expect(second.retryable).toBe(false);expect(second.messages.filter(m=>m.role==='asistente')).toHaveLength(1);
    expect(f.state.requests).toHaveLength(1);expect(f.state.events).toHaveLength(1);expect(f.state.intakes).toHaveLength(1);
    expect(f.state.interactions).toHaveLength(1);expect(classify).toHaveBeenCalledTimes(1);
    expect(f.db.$queryRaw.mock.calls.filter((c:any)=>c[0].join('').includes('EXEC dbo.usp_ConvertirBuyerALead'))).toHaveLength(1);
  });
});
