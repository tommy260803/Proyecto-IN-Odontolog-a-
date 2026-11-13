import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerConversationPanel } from './BuyerConversationPanel';
import { staffAuthService } from '@/shared/services/staffAuthService';
import type { ChatTurn, ConversationPage, HistoryPage } from '../types/buyerConversation.types';
import { loadPendingSend, storePendingSend } from '../services/buyerConversation.service';

// API simulada, servicios/rutas HTTP frontend reales. No SQL, Gemini ni login real.
const cid='10000000-0000-4000-8000-000000000001',cid2='10000000-0000-4000-8000-000000000002';
const token='T'.repeat(43);
const session={token,expira_en:'2030-01-01T00:00:00.000Z',email:'operador@example.invalid',usuario:{id_usuario:7,nombres:'Operador',apellidos:'Sintético',rol:'Administrador'}};
const response=(body:unknown,status=200)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function turn(overrides:Partial<ChatTurn>={}): ChatTurn {
  return {conversationId:cid,turnId:10,interactionId:20,status:'COMPLETADA',retryable:false,execution:null,declaredServiceId:null,analysis:null,
    attempts:[{at:'2026-11-12T10:00:00Z',result:'COMPLETADA'}],
    messages:[{role:'operador_transcriptor',text:'Consulta sintética',origin:'OPERADOR_TRANSCRIPTOR',at:'2026-11-12T10:00:00Z'},
      {role:'asistente',text:'Respuesta persistida',origin:'GEMINI',at:'2026-11-12T10:00:01Z'}],
    evaluation:{estado:'COMPLETADA',accion:'SOLO_CONSULTA',etapa_final:'BUYER'},...overrides};
}
function page(items: ConversationPage['items']=[],nextAfter:number|null=null,personId=1):ConversationPage {return{personId,items,nextAfter};}
function history(turns:ChatTurn[]=[],nextAfter:number|null=null,personId=1,conversationId=cid):HistoryPage {return{personId,conversationId,turns,nextAfter};}
const summary=(id=cid)=>({conversationId:id,status:'COMPLETADA' as const,lastTurnId:10,lastAction:'SOLO_CONSULTA',retryable:false});
let list: (url:URL)=>Response|Promise<Response>;
let read: (url:URL)=>Response|Promise<Response>;
let send: (init:RequestInit)=>Response|Promise<Response>;
let retry: (url:URL)=>Response|Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
let expectedToken=token;

beforeEach(()=>{
  expectedToken=token;
  sessionStorage.clear();
  localStorage.clear();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.scrollTo = vi.fn();
  staffAuthService.saveSession(session as any);
  list=url=>response(page([],null,Number(url.pathname.split('/')[3])));
  read=()=>response(history());send=()=>response(turn());retry=()=>response(turn());
  fetchMock=vi.fn(async(input:string,init:RequestInit={})=>{
    const url=new URL(input);
    if(url.pathname.endsWith('/staff/session'))return response(init.method==='DELETE'?undefined:session,init.method==='DELETE'?204:200);
    expect((init.headers as Record<string,string>).Authorization).toBe(`Bearer ${expectedToken}`);
    if(url.pathname.endsWith('/messages'))return send(init);
    if(url.pathname.endsWith('/retry'))return retry(url);
    if(url.pathname.endsWith('/conversations'))return list(url);
    return read(url);
  });
  vi.stubGlobal('fetch',fetchMock);
});

afterEach(()=>{
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

async function login() {
  await screen.findByText(/Operador Sintético/);
}
async function write(text='Consulta sintética') {
  fireEvent.change(screen.getByLabelText('Mensaje de la persona'),{target:{value:text}});
  fireEvent.click(screen.getByRole('button',{name:'Enviar y evaluar'}));
}
function sends() {return fetchMock.mock.calls.filter(([url])=>url.endsWith('/messages'));}
function reads() {return fetchMock.mock.calls.filter(([url])=>/\/conversations\/[^/?]+\?/.test(url));}

describe('Panel administrativo Buyer con API simulada',()=>{
  it.each(['PENDIENTE','PROCESANDO'] as const)('notifica COMPLETADA → %s y no repite efectos de finalización',async status=>{
    const changed=vi.fn(),completed=vi.fn();render(<BuyerConversationPanel personId="1" onTurnChanged={changed} onCompleted={completed}/>);await login();
    await write();await screen.findByText('Respuesta persistida');
    send=()=>response(turn({turnId:11,interactionId:21,status,retryable:status==='PENDIENTE',evaluation:null,messages:[]}),202);
    await write('Otro mensaje');await screen.findByText(`Turno #11 · ${status}`);
    expect(changed.mock.calls.map(([t])=>t.status)).toEqual(['COMPLETADA',status]);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('reabrir un turno histórico notifica su procedencia sin efectos de finalización',async()=>{
    list=()=>response(page([summary()]));read=()=>response(history([turn()]));
    const changed=vi.fn(),completed=vi.fn();render(<BuyerConversationPanel personId="1" onTurnChanged={changed} onCompleted={completed}/>);await login();
    fireEvent.click(await screen.findByRole('button',{name:`Conversación ${cid} · COMPLETADA`}));await screen.findByText('Respuesta persistida');
    expect(changed).toHaveBeenCalledWith(expect.anything(),{personId:'1',actorId:7,source:'history'});expect(completed).not.toHaveBeenCalled();
  });

  it('subir mientras send espera conserva la posición al recibir la respuesta',async()=>{
    render(<BuyerConversationPanel personId="1"/>);await login();await write();await screen.findByText('Respuesta persistida');
    let release!:(r:Response)=>void;send=()=>new Promise(r=>{release=r;});await write('Mensaje lento');
    const area=screen.getByLabelText('Historial persistido');Object.defineProperties(area,{scrollHeight:{configurable:true,value:1600},clientHeight:{configurable:true,value:400}});
    area.scrollTop=180;fireEvent.scroll(area);const scroll=vi.spyOn(area,'scrollTo');scroll.mockClear();
    await act(async()=>release(response(turn({turnId:11,interactionId:21,messages:[{role:'asistente',text:'Respuesta nueva demorada',origin:'GEMINI',at:'2026-11-12T10:00:00Z'}]}))));
    await screen.findByText('Respuesta nueva demorada');expect(scroll).not.toHaveBeenCalled();expect(area.scrollTop).toBe(180);
    expect(screen.getByRole('button',{name:'Ver mensajes nuevos'})).toBeInTheDocument();
  });

  it('polling conserva la posición de lectura y notifica el cambio del mismo turno',async()=>{
    send=()=>response(turn({status:'PROCESANDO',messages:[],evaluation:null}),202);
    const changed=vi.fn();render(<BuyerConversationPanel personId="1" onTurnChanged={changed}/>);await login();
    vi.useFakeTimers();await act(async()=>{await write();});expect(screen.getByText('Turno #10 · PROCESANDO')).toBeInTheDocument();
    const area=screen.getByLabelText('Historial persistido');Object.defineProperties(area,{scrollHeight:{configurable:true,value:1600},clientHeight:{configurable:true,value:400}});
    area.scrollTop=180;fireEvent.scroll(area);const scroll=vi.spyOn(area,'scrollTo');scroll.mockClear();read=()=>response(history([turn()]));
    await act(async()=>{await vi.advanceTimersByTimeAsync(5100);});
    expect(screen.getByText('Respuesta persistida')).toBeInTheDocument();expect(scroll).not.toHaveBeenCalled();expect(area.scrollTop).toBe(180);
    expect(changed.mock.calls.map(([t])=>t.status)).toEqual(['PROCESANDO','COMPLETADA']);
  });

  it('retry conserva la posición cuando el operador sube mientras espera',async()=>{
    send=()=>response(turn({status:'PENDIENTE',retryable:true,evaluation:null,messages:[]}),202);
    render(<BuyerConversationPanel personId="1"/>);await login();await write();await screen.findByText('Turno #10 · PENDIENTE');
    let release!:(r:Response)=>void;retry=()=>new Promise(r=>{release=r;});
    fireEvent.click(screen.getByRole('button',{name:'Reintentar turno #10'}));
    const area=screen.getByLabelText('Historial persistido');Object.defineProperties(area,{scrollHeight:{configurable:true,value:1600},clientHeight:{configurable:true,value:400}});
    area.scrollTop=180;fireEvent.scroll(area);const scroll=vi.spyOn(area,'scrollTo');scroll.mockClear();
    await act(async()=>release(response(turn())));await screen.findByText('Respuesta persistida');
    expect(scroll).not.toHaveBeenCalled();expect(area.scrollTop).toBe(180);expect(screen.getByRole('button',{name:'Ver mensajes nuevos'})).toBeInTheDocument();
    expect(sends()).toHaveLength(1);
  });

  it('Consultar estado conserva el historial durante la espera y no fuerza scroll',async()=>{
    render(<BuyerConversationPanel personId="1"/>);await login();await write();await screen.findByText('Respuesta persistida');
    const area=screen.getByLabelText('Historial persistido');Object.defineProperties(area,{scrollHeight:{configurable:true,value:1600},clientHeight:{configurable:true,value:400}});
    area.scrollTop=180;fireEvent.scroll(area);const scroll=vi.spyOn(area,'scrollTo');scroll.mockClear();
    let release!:(r:Response)=>void;read=()=>new Promise(r=>{release=r;});fireEvent.click(screen.getByRole('button',{name:'Consultar estado'}));
    expect(screen.getByText('Respuesta persistida')).toBeInTheDocument();await act(async()=>release(response(history([turn()]))));
    expect(scroll).not.toHaveBeenCalled();expect(area.scrollTop).toBe(180);
  });

  it('dos operadores conservan sus sobres originales aunque exista un sobre legado por persona',()=>{
    const body=JSON.stringify({message:'Mensaje incierto',origin:'OPERADOR_TRANSCRIPTOR'}),old={personId:'1',actorId:7,key:'original-007',body};
    sessionStorage.setItem('nexosalud_buyer_chat_pending_v1:1',JSON.stringify(old));
    const next={...old,actorId:8,key:'original-008',body:JSON.stringify({message:'Otro incierto',origin:'OPERADOR_TRANSCRIPTOR'})};
    storePendingSend('1',next);
    expect(loadPendingSend('1',7)).toEqual(old);expect(loadPendingSend('1',8)).toEqual(next);
    storePendingSend('1',null,8);expect(loadPendingSend('1',7)).toEqual(old);
  });

  it.each(['logout','operator'] as const)('%s durante send invalida la respuesta tardía y conserva el sobre del propietario',async change=>{
    const completed=vi.fn();render(<BuyerConversationPanel personId="1" onCompleted={completed}/>);await login();await write();await screen.findByText('Respuesta persistida');
    let release!:(r:Response)=>void;send=()=>new Promise(r=>{release=r;});await write('Texto incierto exacto');
    const sent=sends()[1][1],stored=sessionStorage.getItem('nexosalud_buyer_chat_pending_v1:1:7');expect(stored).not.toBeNull();
    act(()=>{
      if(change==='logout')staffAuthService.logout();
      else {expectedToken='N'.repeat(43);staffAuthService.saveSession({...session,token:expectedToken,usuario:{id_usuario:8,nombres:'Nuevo',apellidos:'Operador',rol:'Administrador'}});}
    });
    expect((sent.signal as AbortSignal).aborted).toBe(true);expect(screen.queryByText('Respuesta persistida')).not.toBeInTheDocument();
    await act(async()=>release(response(turn({turnId:11,interactionId:21,messages:[{role:'asistente',text:'RESPUESTA_TARDIA_PRIVADA',origin:'GEMINI',at:'2026-11-12T10:00:00Z'}]}))));
    expect(screen.queryByText('RESPUESTA_TARDIA_PRIVADA')).not.toBeInTheDocument();expect(completed).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('nexosalud_buyer_chat_pending_v1:1:7')).toBe(stored);expect(sends()).toHaveLength(2);
    if(change==='operator')expect(screen.queryByRole('button',{name:'Comprobar envío original'})).not.toBeInTheDocument();
  });
  it('usa el login real, envía Bearer y muestra únicamente la respuesta persistida; continúa con otro turno',async()=>{
    const completed=vi.fn();render(<BuyerConversationPanel personId="1" onCompleted={completed}/>);await login();
    await write();await screen.findByText('Respuesta persistida');
    const first=sends()[0][1] as RequestInit;
    expect(JSON.parse(first.body as string)).toEqual({message:'Consulta sintética',origin:'OPERADOR_TRANSCRIPTOR'});
    expect((first.headers as Record<string,string>)['Idempotency-Key']).toMatch(/^[a-f0-9-]{36}$/);
    expect(screen.getByText('Turno #10 · COMPLETADA')).toBeInTheDocument();
    expect(screen.getByText(/Operador transcriptor/)).toBeInTheDocument();
    expect(completed).toHaveBeenCalledTimes(1);
    send=()=>response(turn({turnId:11,interactionId:21,messages:[{role:'asistente',text:'Segunda respuesta guardada',origin:'GEMINI',at:'2026-11-12T10:01:00Z'}]}));
    await write('Segunda consulta');await screen.findByText('Segunda respuesta guardada');
    expect(JSON.parse(sends()[1][1].body)).toEqual({conversationId:cid,message:'Segunda consulta',origin:'OPERADOR_TRANSCRIPTOR'});
    expect(sends()[1][1].headers['Idempotency-Key']).not.toBe((first.headers as Record<string,string>)['Idempotency-Key']);
    expect(sessionStorage.getItem('nexosalud_buyer_chat_pending_v1:1')).toBeNull();
  });

  it('lista, reabre y pagina conversaciones e historial reconstruidos tras volver a montar',async()=>{
    list=url=>response(url.searchParams.get('after')==='0'?page([summary()],7):page([summary(cid2)]));
    read=url=>response(url.pathname.endsWith(cid2)?history([],null,1,cid2):
      url.searchParams.get('after')==='0'?history([turn()],10):history([turn({turnId:11,messages:[{role:'sistema',text:'Segundo turno persistido',origin:'BACKEND_ERROR',at:'2026-11-12T10:00:00Z'}]})]));
    const mounted=render(<BuyerConversationPanel personId="1"/>);await login();
    fireEvent.click(screen.getByRole('button',{name:`Conversación ${cid} · COMPLETADA`}));await screen.findByText('Respuesta persistida');
    fireEvent.click(screen.getByRole('button',{name:'Más turnos'}));await screen.findByText('Segundo turno persistido');
    expect(reads().some(([url])=>url.endsWith('?after=10'))).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Más conversaciones'}));await screen.findByRole('button',{name:`Conversación ${cid2} · COMPLETADA`});
    mounted.unmount();render(<BuyerConversationPanel personId="1"/>);await login();
    fireEvent.click(screen.getByRole('button',{name:`Conversación ${cid} · COMPLETADA`}));await screen.findByText('Respuesta persistida');
  });

  it('ante error de red conserva clave y cadena exacta, sin añadir conversationId ni mensaje optimista',async()=>{
    send=()=>Promise.reject(new TypeError('red interrumpida'));
    render(<BuyerConversationPanel personId="1"/>);await login();await write('  Texto exacto\ncon salto  ');
    await screen.findByRole('button',{name:'Comprobar envío original'});
    expect(screen.queryByText(/Texto exacto/)).not.toBeInTheDocument();
    const stored=JSON.parse(sessionStorage.getItem('nexosalud_buyer_chat_pending_v1:1')!);
    expect(JSON.parse(stored.body)).toEqual({message:'  Texto exacto\ncon salto  ',origin:'OPERADOR_TRANSCRIPTOR'});
    expect(stored.actorId).toBe(7);expect(stored.key).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('un envío incierto sobrevive a recarga y solo se repite explícitamente con su cuerpo original',async()=>{
    send=()=>Promise.reject(new TypeError('red interrumpida'));
    const mounted=render(<BuyerConversationPanel personId="1"/>);await login();await write();await screen.findByRole('alert');
    const original=sends()[0][1];mounted.unmount();render(<BuyerConversationPanel personId="1"/>);await login();
    expect(sends()).toHaveLength(1);
    send=()=>response(turn());
    fireEvent.click(screen.getByRole('button',{name:'Comprobar envío original'}));await screen.findByText('Respuesta persistida');
    expect(sends()[1][1].body).toBe(original.body);expect(sends()[1][1].headers['Idempotency-Key']).toBe(original.headers['Idempotency-Key']);
    expect(sessionStorage.getItem('nexosalud_buyer_chat_pending_v1:1')).toBeNull();
  });

  it('reintenta el turno pendiente con su endpoint e identidad, sin volver a registrar el mensaje',async()=>{
    send=()=>response(turn({status:'PENDIENTE',retryable:true,evaluation:null,messages:[{role:'sistema',text:'Mensaje guardado, evaluación pendiente',origin:'BACKEND_ERROR',at:'2026-11-12T10:00:00Z'}]}),202);
    render(<BuyerConversationPanel personId="1"/>);await login();await write();
    fireEvent.click(await screen.findByRole('button',{name:'Reintentar turno #10'}));await screen.findByText('Respuesta persistida');
    expect(sends()).toHaveLength(1);
    const retryCall=fetchMock.mock.calls.find(([url])=>url.endsWith('/turns/10/retry'));
    expect(retryCall).toBeDefined();expect(retryCall![1].body).toBe('{}');
  });

  it('consulta PROCESANDO cada 5 s, se detiene al completar y notifica el resultado confirmado',async()=>{
    let count=0;
    send=()=>response(turn({status:'PROCESANDO',retryable:false,messages:[{role:'operador_transcriptor',text:'Consulta',origin:'OPERADOR_TRANSCRIPTOR',at:'2026-11-12T10:00:00Z'}],evaluation:null}),202);
    read=()=>response(history([turn({evaluation:{estado:'COMPLETADA',accion:'CONVERSION_LEAD',etapa_final:'LEAD',id_solicitud:30,id_evento_etapa:40,entregaLeadEstado:'CONFIRMADA'}})]));
    const completed=vi.fn();
    render(<BuyerConversationPanel personId="1" onCompleted={completed}/>);await login();
    vi.useFakeTimers();await act(async()=>{await write();});expect(screen.getByText('Turno #10 · PROCESANDO')).toBeInTheDocument();
    await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
    expect(screen.getByText('Turno #10 · COMPLETADA')).toBeInTheDocument();
    expect(screen.getByText(/Solicitud #30/)).toBeInTheDocument();
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({evaluation:expect.objectContaining({id_solicitud:30})}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});expect(reads()).toHaveLength(1);
  });

  it('solo ofrece recuperar cuando retryable llega del servidor, aunque el vencimiento parezca pasado',async()=>{
    send=()=>response(turn({status:'PROCESANDO',retryable:false,execution:{id:'e1',expiresAt:'2000-01-01T00:00:00.000Z'},messages:[],evaluation:null}),202);
    render(<BuyerConversationPanel personId="1"/>);await login();
    vi.useFakeTimers();await act(async()=>{await write();});
    expect(screen.queryByRole('button',{name:/Reintentar turno/})).not.toBeInTheDocument();
    expect(screen.getByText(/Procesando. Consultamos el estado cada 5 segundos/)).toBeInTheDocument();
  });

  it('detiene el polling al desmontar',async()=>{
    send=()=>response(turn({status:'PROCESANDO',retryable:false,evaluation:null,messages:[]}),202);
    const mounted=render(<BuyerConversationPanel personId="1"/>);await login();
    vi.useFakeTimers();await act(async()=>{await write();});expect(screen.getByText('Turno #10 · PROCESANDO')).toBeInTheDocument();
    mounted.unmount();await act(async()=>{await vi.advanceTimersByTimeAsync(20000);});expect(reads()).toHaveLength(0);
  });

  it('una sesión vencida conserva el envío; reautenticar no lo reenvía automáticamente',async()=>{
    send=()=>response({error:'Sesión vencida'},401);
    render(<BuyerConversationPanel personId="1"/>);await login();await write();
    await screen.findByRole('button',{name:'Iniciar sesión en el sistema'});
    expect(screen.getByRole('alert')).toHaveTextContent(/Sesión no válida o vencida/);
    const original=sends()[0][1];
    expect(screen.queryByLabelText('Historial persistido')).not.toBeInTheDocument();
    act(() => { staffAuthService.saveSession(session as any); });
    await login();
    expect(sends()).toHaveLength(1);send=()=>response(turn());
    fireEvent.click(screen.getByRole('button',{name:'Comprobar envío original'}));await screen.findByText('Respuesta persistida');
    expect(sends()[1][1].body).toBe(original.body);expect(sends()[1][1].headers['Idempotency-Key']).toBe(original.headers['Idempotency-Key']);
  });

  it.each([403,404])('explica %i y no abre acceso anónimo ni realiza escrituras',async status=>{
    list=()=>response({},status);render(<BuyerConversationPanel personId="1"/>);
    await screen.findByRole('alert');expect(screen.queryByLabelText('Historial persistido')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(status===403?/No tienes acceso/:/no disponible/);expect(sends()).toHaveLength(0);
  });

  it('cambiar de persona aborta e ignora un envío anterior y no muestra sus respuestas',async()=>{
    let release!:(r:Response)=>void;send=()=>new Promise<Response>(r=>{release=r;});
    const mounted=render(<BuyerConversationPanel personId="1"/>);await login();await write('Mensaje persona uno');
    await waitFor(()=>expect(sends()).toHaveLength(1));const signal=sends()[0][1].signal as AbortSignal;
    mounted.rerender(<BuyerConversationPanel personId="2"/>);expect(signal.aborted).toBe(true);
    await act(async()=>{release(response(turn({messages:[{role:'asistente',text:'Respuesta privada persona uno',origin:'GEMINI',at:'2026-11-12T10:00:00Z'}]})));});
    expect(screen.queryByText('Respuesta privada persona uno')).not.toBeInTheDocument();await login();
    expect(screen.queryByText('Mensaje persona uno')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Comprobar envío original'})).not.toBeInTheDocument();
    expect(sessionStorage.getItem('nexosalud_buyer_chat_pending_v1:1')).not.toBeNull();
  });

  it('cambiar de persona descarta también un historial en vuelo',async()=>{
    list=url=>response(page([summary()],null,Number(url.pathname.split('/')[3])));
    let release!:(r:Response)=>void;read=()=>new Promise<Response>(r=>{release=r;});
    const mounted=render(<BuyerConversationPanel personId="1"/>);await login();
    fireEvent.click(screen.getByRole('button',{name:`Conversación ${cid} · COMPLETADA`}));await waitFor(()=>expect(reads()).toHaveLength(1));
    mounted.rerender(<BuyerConversationPanel personId="2"/>);
    await act(async()=>{release(response(history([turn()])));});expect(screen.queryByText('Respuesta persistida')).not.toBeInTheDocument();
  });

  it('mantiene PAYER según el resultado y renderiza texto del backend sin HTML',async()=>{
    const text='<img src=x onerror=alert(1)> Texto guardado';
    send=()=>response(turn({evaluation:{estado:'COMPLETADA',accion:'CONSERVA_ETAPA_POSTERIOR',etapa_final:'PAYER'},messages:[{role:'asistente',text,origin:'BACKEND_RESULTADO',at:'2026-11-12T10:00:00Z'}]}));
    const mounted=render(<BuyerConversationPanel personId="1"/>);await login();await write();await screen.findByText(text);
    expect(mounted.container.querySelector('img')).toBeNull();expect(screen.getByText(/Etapa: PAYER/)).toBeInTheDocument();
    expect(screen.queryByText(/Solicitud #/)).not.toBeInTheDocument();
  });

  it('al comprobar un envío incierto no mezcla los turnos de otra conversación abierta',async()=>{
    list=()=>response(page([summary(cid2)]));send=()=>Promise.reject(new TypeError('sin respuesta'));
    read=()=>response(history([turn({conversationId:cid2,turnId:99,messages:[{role:'asistente',text:'Historial de la otra conversación',origin:'GEMINI',at:'2026-11-12T10:00:00Z'}]})],null,1,cid2));
    render(<BuyerConversationPanel personId="1"/>);await login();await write();await screen.findByRole('button',{name:'Comprobar envío original'});
    fireEvent.click(screen.getByRole('button',{name:`Conversación ${cid2} · COMPLETADA`}));await screen.findByText('Historial de la otra conversación');
    const original=sends()[0][1];send=()=>response(turn());
    fireEvent.click(screen.getByRole('button',{name:'Comprobar envío original'}));await screen.findByText('Respuesta persistida');
    expect(screen.queryByText('Historial de la otra conversación')).not.toBeInTheDocument();
    expect(sends()[1][1].body).toBe(original.body);expect(JSON.parse(sends()[1][1].body)).not.toHaveProperty('conversationId');
  });

  it('pausa el polling tras un error de red y no hace reintentos de escritura automáticos',async()=>{
    send=()=>response(turn({status:'PROCESANDO',retryable:false,messages:[],evaluation:null}),202);
    read=()=>Promise.reject(new TypeError('red interrumpida'));
    render(<BuyerConversationPanel personId="1"/>);await login();vi.useFakeTimers();await act(async()=>{await write();});
    await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(screen.getByRole('alert')).toBeInTheDocument();
    await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(reads()).toHaveLength(1);expect(sends()).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url])=>url.endsWith('/retry'))).toBe(false);
  });

  it('pendiente anterior → recarga → TURN_PENDING → recuperar turno, sin bloquear retry ni reenviar el borrador',async()=>{
    let oldPending=true;
    const pendingTurn=()=>turn({status:oldPending?'PENDIENTE':'COMPLETADA',retryable:oldPending,
      messages:[{role:'sistema',text:oldPending?'Turno anterior guardado':'Turno anterior finalizado',origin:'BACKEND_RESULTADO',at:'2026-11-12T10:00:00Z'}]});
    // El pendiente está en una página posterior: el refresh no debe perder su cursor.
    list=url=>response(url.searchParams.get('after')==='7'?page([{...summary(),status:oldPending?'PENDIENTE':'COMPLETADA',retryable:oldPending}]):page([summary(cid2)],7));
    read=url=>response(url.pathname.endsWith(cid)?history([pendingTurn()]):history([],null,1,cid2));
    send=()=>response(pendingTurn(),202);
    let mounted=render(<BuyerConversationPanel personId="1"/>);await login();await write('Mensaje anterior');
    await screen.findByText('Turno #10 · PENDIENTE');mounted.unmount();
    mounted=render(<BuyerConversationPanel personId="1"/>);await login();
    fireEvent.click(screen.getByRole('button',{name:'Nueva conversación'}));
    send=()=>response({code:'TURN_PENDING',error:'Existe otro turno pendiente.'},409);
    const text='  Borrador nuevo\nno registrado  ';await write(text);
    await screen.findByLabelText('Borrador rechazado');
    expect(screen.getByLabelText('Borrador rechazado')).toHaveValue(text);
    expect(sessionStorage.getItem('nexosalud_buyer_chat_pending_v1:1')).toBeNull();
    expect(screen.queryByRole('button',{name:'Comprobar envío original'})).not.toBeInTheDocument();
    expect(sends()).toHaveLength(2);expect(JSON.parse(sends()[1][1].body)).not.toHaveProperty('conversationId');
    // El rechazo y el texto también sobreviven a otra recarga sin reservar un envío.
    mounted.unmount();mounted=render(<BuyerConversationPanel personId="1"/>);await login();
    expect(screen.getByLabelText('Borrador rechazado')).toHaveValue(text);expect(sends()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button',{name:'Más conversaciones'}));
    fireEvent.click(await screen.findByRole('button',{name:`Conversación ${cid} · PENDIENTE`}));
    const button=await screen.findByRole('button',{name:'Reintentar turno #10'});expect(button).toBeEnabled();
    retry=()=>{oldPending=false;return response(pendingTurn());};fireEvent.click(button);
    await screen.findByText('Turno anterior finalizado');
    expect(sends()).toHaveLength(2);expect(fetchMock.mock.calls.filter(([url])=>url.endsWith('/turns/10/retry'))).toHaveLength(1);
    expect(screen.getByLabelText('Borrador rechazado')).toHaveValue(text);
    fireEvent.click(screen.getByRole('button',{name:'Recuperar borrador en su destino original'}));
    await waitFor(()=>expect(screen.getByLabelText('Mensaje de la persona')).toHaveValue(text));
    expect(screen.queryByText('Turno anterior finalizado')).not.toBeInTheDocument(); // destino original = nueva
    expect(sends()).toHaveLength(2);
    // Cambiar a la conversación anterior no traslada silenciosamente el borrador.
    fireEvent.click(screen.getByRole('button',{name:`Conversación ${cid} · COMPLETADA`}));await screen.findByText('Turno anterior finalizado');
    expect(screen.getByLabelText('Mensaje de la persona')).toHaveValue('');expect(screen.getByLabelText('Borrador rechazado')).toHaveValue(text);
  });

  it.each([
    {name:'conflicto de clave',result:()=>response({error:'Clave de idempotencia en uso',code:'IDEMPOTENCY_CONFLICT'},409)},
    {name:'503 TURN_PENDING',result:()=>response({error:'Servicio no disponible temporalmente TURN_PENDING'},503)},
    {name:'409 ilegible',result:()=>new Response('<html>Error</html>',{status:409,headers:{'Content-Type':'text/html'}})},
    {name:'éxito con JSON ilegible',result:()=>new Response('ok sin json',{status:200,headers:{'Content-Type':'text/plain'}})},
    {name:'2xx sin contrato de turno',result:()=>response({incompleto:true})},
    {name:'otro rechazo 400',result:()=>response({error:'Persona no encontrada'},400)},
  ])('conserva clave/cuerpo tras recarga ante $name; no interpreta todos los errores como rechazo confirmado',async({result})=>{
    send=result;const mounted=render(<BuyerConversationPanel personId="1"/>);await login();await write('Original exacto');
    await screen.findByRole('alert');const original=sends()[0][1];
    expect(screen.queryByLabelText('Borrador rechazado')).not.toBeInTheDocument();
    mounted.unmount();render(<BuyerConversationPanel personId="1"/>);await login();
    send=()=>response(turn());fireEvent.click(screen.getByRole('button',{name:'Comprobar envío original'}));await screen.findByText('Respuesta persistida');
    expect(sends()[1][1].body).toBe(original.body);expect(sends()[1][1].headers['Idempotency-Key']).toBe(original.headers['Idempotency-Key']);
  });

  it('restaurar no cambia la conversación original y el retry incierto tras recarga consume ese borrador una sola vez',async()=>{
    // Borrador de una conversación existente, aislado por persona y operador.
    const body=JSON.stringify({conversationId:cid,message:'Texto recuperable',origin:'OPERADOR_TRANSCRIPTOR'});
    sessionStorage.setItem('nexosalud_buyer_chat_rejected_v1:1:7',JSON.stringify({personId:'1',actorId:7,key:'rejected-001',body}));
    list=()=>response(page([summary(cid2)]));read=url=>response(history([],null,1,url.pathname.endsWith(cid2)?cid2:cid));
    let mounted=render(<BuyerConversationPanel personId="1"/>);await login();
    fireEvent.click(screen.getByRole('button',{name:`Conversación ${cid2} · COMPLETADA`}));await waitFor(()=>expect(reads()).toHaveLength(1));
    send=()=>Promise.reject(new TypeError('red'));
    fireEvent.click(screen.getByRole('button',{name:'Recuperar borrador en su destino original'}));
    await waitFor(()=>expect(screen.getByLabelText('Mensaje de la persona')).toHaveValue('Texto recuperable'));
    fireEvent.click(screen.getByRole('button',{name:'Enviar y evaluar'}));await screen.findByRole('alert');
    expect(JSON.parse(sends()[0][1].body).conversationId).toBe(cid);const original=sends()[0][1];
    mounted.unmount();mounted=render(<BuyerConversationPanel personId="1"/>);await login();send=()=>response(turn());
    fireEvent.click(screen.getByRole('button',{name:'Comprobar envío original'}));await screen.findByText('Respuesta persistida');
    expect(sessionStorage.getItem('nexosalud_buyer_chat_rejected_v1:1:7')).toBeNull();
    expect(screen.queryByLabelText('Borrador rechazado')).not.toBeInTheDocument();
    expect(sends()[1][1].body).toBe(original.body);
  });

  it('no muestra borradores de otra persona u operador aunque estén en el almacenamiento de la pestaña',async()=>{
    const draft=(p:string,a:number)=>JSON.stringify({personId:p,actorId:a,key:crypto.randomUUID(),body:JSON.stringify({message:'Borrador ajeno',origin:'OPERADOR_TRANSCRIPTOR'})});
    sessionStorage.setItem('nexosalud_buyer_chat_rejected_v1:1:8',draft('1',8));
    sessionStorage.setItem('nexosalud_buyer_chat_rejected_v1:2:7',draft('2',7));
    render(<BuyerConversationPanel personId="1"/>);await login();
    expect(screen.queryByLabelText('Borrador rechazado')).not.toBeInTheDocument();expect(sends()).toHaveLength(0);
  });

  it('reutiliza la misma sesión institucional al cambiar de ficha sin solicitar login', async () => {
    const mounted = render(<BuyerConversationPanel personId="1" />);
    await login();
    mounted.rerender(<BuyerConversationPanel personId="2" />);
    await screen.findByText(/Operador Sintético/);
    expect(screen.queryByRole('button', { name: 'Iniciar sesión en el sistema' })).not.toBeInTheDocument();
  });

  it('muestra aviso para iniciar sesión cuando no hay sesión activa en el sistema', async () => {
    localStorage.clear();
    staffAuthService.logout();
    const sessionReq = vi.fn();
    render(<BuyerConversationPanel personId="1" session={null} onSessionRequired={sessionReq} />);
    const btn = screen.getByRole('button', { name: 'Iniciar sesión en el sistema' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(sessionReq).toHaveBeenCalledTimes(1);
  });

  it('origen está fijado a OPERADOR_TRANSCRIPTOR y no expone selector', async () => {
    render(<BuyerConversationPanel personId="1" />);
    await login();
    expect(screen.queryByLabelText('Origen del mensaje')).not.toBeInTheDocument();
    expect(screen.getByText('El operador transcribe la respuesta de la persona.')).toBeInTheDocument();
  });

  it('desplaza automáticamente al recibir turnos y permite pulsar Ver mensajes nuevos cuando hay scroll hacia arriba', async () => {
    const scrollMock = vi.fn();
    // scrollToBottom usa container.scrollTo (preferido) o scrollIntoView (fallback)
    window.HTMLElement.prototype.scrollTo = scrollMock;
    render(<BuyerConversationPanel personId="1" />);
    await login();
    await write();
    await screen.findByText('Respuesta persistida');
    // scrollToBottom se llama con un setTimeout de 50ms; esperar a que se ejecute
    await waitFor(() => expect(scrollMock).toHaveBeenCalled());

    // Simular que el contenedor tiene scroll previo hacia arriba
    const container = screen.getByLabelText('Historial persistido');
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 200, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    fireEvent.scroll(container);

    const btn = await screen.findByRole('button', { name: /Ver mensajes nuevos/i });
    expect(btn).toBeInTheDocument();
    scrollMock.mockClear();
    fireEvent.click(btn);
    await waitFor(() => expect(scrollMock).toHaveBeenCalled());
  });

  describe('staffAuthService — sesión institucional estricta sin fallbacks simulados', () => {
    it('falla y no concede sesión si el endpoint responde 404 o error de red', async () => {
      localStorage.clear();
      fetchMock.mockImplementationOnce(async () => new Response(null, { status: 404 }));
      await expect(staffAuthService.authenticate('doc@nexosalud.pe', 'Clave1234!')).rejects.toThrow(
        /no está disponible/i
      );
      expect(staffAuthService.getSession()).toBeNull();
    });

    it('falla si la respuesta carece de token de autenticación válido', async () => {
      localStorage.clear();
      fetchMock.mockImplementationOnce(async () =>
        response({ token: '', expira_en: '2030-01-01', usuario: { id_usuario: 1, nombres: 'A', apellidos: 'B', rol: 'Administrador' } })
      );
      await expect(staffAuthService.authenticate('doc@nexosalud.pe', 'Clave1234!')).rejects.toThrow(
        /token de autenticación válido/i
      );
      expect(staffAuthService.getSession()).toBeNull();
    });

    it('falla si la respuesta carece de datos del usuario', async () => {
      localStorage.clear();
      fetchMock.mockImplementationOnce(async () =>
        response({ token: 'T'.repeat(43), expira_en: '2030-01-01', usuario: {} })
      );
      await expect(staffAuthService.authenticate('doc@nexosalud.pe', 'Clave1234!')).rejects.toThrow(
        /datos de usuario requeridos/i
      );
      expect(staffAuthService.getSession()).toBeNull();
    });

    it('getSession rechaza perfiles locales antiguos que solo tienen email pero no token', () => {
      localStorage.setItem('nexosalud_staff_session_v1', JSON.stringify({ email: 'fake@nexosalud.pe', nombres: 'Fake' }));
      expect(staffAuthService.getSession()).toBeNull();
    });

    it('logout limpia almacenamiento local y envía invalidación al backend', async () => {
      staffAuthService.saveSession(session as any);
      expect(staffAuthService.getSession()).not.toBeNull();
      staffAuthService.logout();
      expect(staffAuthService.getSession()).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/staff\/session$/),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
