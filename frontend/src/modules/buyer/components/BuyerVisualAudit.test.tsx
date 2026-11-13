import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({buyer:{id:'1',personId:'1',activeInteractionId:1,person:{firstName:'QA',lastName:'Sintético'},state:'NEW',currentStage:'BUYER',createdAt:'2026-11-12T10:00:00Z',latestEvaluation:null as any}}));
vi.mock('../hooks/useBuyerQueries',()=>({useBuyer:()=>({data:state.buyer,isLoading:false,isError:false}),
  useUpdateBuyer:()=>({isPending:false,mutate:vi.fn()}),useConvertBuyerToLead:()=>({isPending:false,mutate:vi.fn()}),useEvaluateBuyer:()=>({isPending:false,mutate:vi.fn()})}));
import { BuyerDetailView } from './BuyerDetailView';
import { staffAuthService } from '@/shared/services/staffAuthService';
import { buyerService } from '../services/buyer.service';
const cid='10000000-0000-4000-8000-000000000001';
const session={email:'qa@example.invalid',token:'Q'.repeat(43),expira_en:'2030-01-01T00:00:00Z',usuario:{id_usuario:7,nombres:'QA',apellidos:'Administrador',rol:'Administrador'}};
const json=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status});
let client:QueryClient,sent:number,status:'PENDIENTE'|'PROCESANDO';
beforeEach(()=>{
  staffAuthService.saveSession(session);sent=0;status='PENDIENTE';state.buyer.latestEvaluation=null;state.buyer.activeInteractionId=1;
  HTMLElement.prototype.scrollTo=vi.fn();
  vi.spyOn(buyerService,'getCatalogs').mockResolvedValue({canales:[],fuentes:[],servicios:[],sedes:[],horarios:[],modalidades:[]});
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit={})=>{
    if(init.method==='DELETE')return json(null,204);
    if(url.endsWith('/messages')){
      sent++;return json({conversationId:cid,turnId:sent===1?10:11,interactionId:sent===1?20:21,status:sent===1?'COMPLETADA':status,
        retryable:false,execution:null,declaredServiceId:null,analysis:null,attempts:[],
        messages:sent===1?[{role:'asistente',origin:'BACKEND_RESULTADO',at:'2026-11-12T10:00:00Z',text:'Respuesta comercial anterior'}]:[],
        // El turno en curso puede conservar evidencia de un intento; no finaliza por eso.
        evaluation:{estado:'COMPLETADA',accion:'CONVERSION_LEAD',id_solicitud:30,id_evento_etapa:40,etapa_final:'LEAD'}},sent===1?200:202);
    }
    if(url.includes('/conversations/'+cid))return json({personId:1,conversationId:cid,turns:[{conversationId:cid,turnId:2,interactionId:2,status:'COMPLETADA',retryable:false,messages:[],attempts:[],evaluation:{estado:'COMPLETADA',accion:'CONVERSION_LEAD',id_solicitud:99,etapa_final:'LEAD'}}],nextAfter:null});
    return json({personId:1,items:[{conversationId:cid,status:'COMPLETADA',lastTurnId:2,lastAction:'CONVERSION_LEAD',retryable:false}],nextAfter:null});
  }));
  client=new QueryClient({defaultOptions:{queries:{retry:false}}});
});
afterEach(()=>{cleanup();client.clear();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});
function show(){return render(<QueryClientProvider client={client}><MemoryRouter><BuyerDetailView buyerId="1"/></MemoryRouter></QueryClientProvider>);}
async function write(text:string){fireEvent.change(await screen.findByLabelText('Mensaje de la persona'),{target:{value:text}});fireEvent.click(screen.getByRole('button',{name:'Enviar y evaluar'}));}
describe('Ficha y panel reales conectados con HTTP simulado',()=>{
  it.each(['PENDIENTE','PROCESANDO'] as const)('la tarjeta pasa de COMPLETADA a %s sin heredar conversión',async next=>{
    status=next;show();await write('Primer mensaje');await within(screen.getByLabelText('Conversación administrativa Buyer')).findByText('Respuesta comercial anterior');
    const card=within(screen.getByLabelText('Estado actual del agente Buyer'));expect(card.getByText('Acción: CONVERSION_LEAD')).toBeInTheDocument();
    const invalidations=vi.spyOn(client,'invalidateQueries');invalidations.mockClear();
    await write('Nuevo mensaje');await card.findByText(`Turno #11 · ${next}`);
    expect(card.getByText(`Acción: ${next}`)).toBeInTheDocument();expect(card.queryByText('Acción: CONVERSION_LEAD')).not.toBeInTheDocument();
    expect(card.queryByText(/preparado para iniciar la transferencia/)).not.toBeInTheDocument();expect(invalidations).not.toHaveBeenCalled();
  });
  it('abrir una conversación histórica no reemplaza la evaluación vigente ni anuncia conversión',async()=>{
    state.buyer.latestEvaluation={estado:'COMPLETADA',accion:'SOLO_CONSULTA',explicacion:'VIGENTE_DE_LA_PERSONA',fecha_hora:'2026-11-12T10:00:00Z',es_mensaje_vigente:true};
    show();const card=within(screen.getByLabelText('Estado actual del agente Buyer')),invalidate=vi.spyOn(client,'invalidateQueries');
    fireEvent.click(await screen.findByRole('button',{name:`Conversación ${cid} · COMPLETADA`}));
    await screen.findByText('Turno #2 · COMPLETADA');expect(card.getByText('Acción: SOLO_CONSULTA')).toBeInTheDocument();
    expect(card.queryByText('Acción: CONVERSION_LEAD')).not.toBeInTheDocument();expect(invalidate).not.toHaveBeenCalled();
  });
  it('logout limpia la evaluación local y un cambio de operador no la restaura',async()=>{
    show();await write('Primer mensaje');await within(screen.getByLabelText('Conversación administrativa Buyer')).findByText('Respuesta comercial anterior');
    act(()=>staffAuthService.logout());expect(screen.queryByText('Respuesta comercial anterior')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Estado actual del agente Buyer')).queryByText('Acción: CONVERSION_LEAD')).not.toBeInTheDocument();
    act(()=>staffAuthService.saveSession({...session,token:'N'.repeat(43),usuario:{id_usuario:8,nombres:'Otro',apellidos:'Operador',rol:'Administrador'}}));
    expect(screen.queryByText('Respuesta comercial anterior')).not.toBeInTheDocument();
  });
  it('una evaluación más reciente recuperada de ficha prevalece sobre un turno local anterior',async()=>{
    const mounted=show();await write('Primer mensaje');await within(screen.getByLabelText('Conversación administrativa Buyer')).findByText('Respuesta comercial anterior');
    state.buyer.activeInteractionId=22;
    state.buyer.latestEvaluation={estado:'COMPLETADA',accion:'SOLO_CONSULTA',fecha_hora:'2026-11-12T10:02:00Z',es_mensaje_vigente:true};
    mounted.rerender(<QueryClientProvider client={client}><MemoryRouter><BuyerDetailView buyerId="1"/></MemoryRouter></QueryClientProvider>);
    const card=within(screen.getByLabelText('Estado actual del agente Buyer'));
    expect(card.getByText('Acción: SOLO_CONSULTA')).toBeInTheDocument();expect(card.queryByText('Acción: CONVERSION_LEAD')).not.toBeInTheDocument();
  });
});
