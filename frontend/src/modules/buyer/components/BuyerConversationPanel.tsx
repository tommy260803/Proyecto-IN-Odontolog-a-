import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessageSquare, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { useStaffAuth } from '@/shared/context/StaffAuthContext';
import { validStaffBearerSession } from '@/shared/services/staffAuthService';
import { buyerConversationService as api, ChatApiError, isConfirmedTurnPending, loadPendingSend, storePendingSend,
  loadRejectedDraft, storeRejectedDraft } from '../services/buyerConversation.service';
import type { ChatTurn, ConversationPage, ConversationSummary, HistoryPage, PendingChatSend, StaffBearerSession } from '../types/buyerConversation.types';

const POLL_MS = 5000;
const mergeTurns = (old: ChatTurn[], incoming: ChatTurn[]) =>
  [...new Map([...old, ...incoming].map(t => [t.turnId, t])).values()].sort((a,b) => a.turnId-b.turnId);
const roleLabel = {
  paciente: 'Operador · mensaje de la persona', operador_transcriptor: 'Operador transcriptor',
  asistente: 'Asistente Buyer', sistema: 'Sistema',
};
export interface ChatTurnNotification { personId: string; actorId: number; source: 'active' | 'history' }
interface Props {
  personId: string;
  session?: StaffBearerSession | null;
  onCompleted?: (turn: ChatTurn) => void;
  onTurnChanged?: (turn: ChatTurn, context: ChatTurnNotification) => void;
  onSessionRequired?: () => void;
  onAccessLost?: (message: string) => void;
}

// La clave desmonta el estado inmediatamente al cambiar de persona, también en el
// primer render. Los aborts/épocas evitan aplicar respuestas de la ficha anterior.
export function BuyerConversationPanel(props: Props) {
  const auth=useStaffAuth();
  const [accessNotice,setAccessNotice]=useState('');
  const candidate=props.session===undefined?auth.session:
    props.session?.token===auth.session?.token && props.session?.usuario.id_usuario===auth.session?.id_usuario?auth.session:null;
  const session=validStaffBearerSession(candidate)?candidate:null;
  // Desmontaje síncrono: ninguna vista ni promesa de la sesión anterior se reutiliza.
  return <>{!session && accessNotice && <p role="alert">{accessNotice}</p>}
    <ConversationWorkspace key={`${props.personId}:${session?.usuario.id_usuario}:${session?.token}`} {...props} session={session} onAccessLost={setAccessNotice} /></>;
}

function ConversationWorkspace({ personId, session, onCompleted, onTurnChanged, onSessionRequired, onAccessLost }: Props) {
  const auth = useStaffAuth();
  const [access, setAccess] = useState<'LOGIN'|'READY'|'FORBIDDEN'|'DISABLED'>(() => session?.token ? 'READY' : 'LOGIN');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [listCursor, setListCursor] = useState<number|null>(null);
  const [conversationId, setConversationId] = useState<string|null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number|null>(null);
  const [draft, setDraft] = useState('');
  // Origen fijo para este panel administrativo: el operador transcribe la respuesta de la persona
  const origin = 'OPERADOR_TRANSCRIPTOR';
  const [pending, setPending] = useState<PendingChatSend|null>(() => session ? loadPendingSend(personId,session.usuario.id_usuario) : null);
  const [rejectedDraft, setRejectedDraft] = useState<PendingChatSend|null>(null);
  const [restoredDraftKey, setRestoredDraftKey] = useState<string|null>(null);
  const [pollPaused, setPollPaused] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const alive = useRef(false), busyRef = useRef(false), epoch = useRef(0);
  const controller = useRef<AbortController|null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const notified = useRef(new Set<string>());
  const activeTurn = useRef<number|null>(null);
  const onCompletedRef = useRef(onCompleted); onCompletedRef.current = onCompleted;
  const onTurnChangedRef=useRef(onTurnChanged); onTurnChangedRef.current=onTurnChanged;

  useLayoutEffect(() => {
    const c = new AbortController(); controller.current=c; alive.current=true;
    return () => { alive.current=false; epoch.current++; c.abort(); };
  }, []);

  const current = (ticket: number) => alive.current && ticket === epoch.current;

  const scrollToBottom = (smooth = true) => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      userScrolledUpRef.current = false;
      setShowScrollBottom(false);
    }
  };

  // Se decide DESPUÉS de actualizar el DOM, respetando dónde está leyendo ahora.
  useLayoutEffect(()=>{
    if(!turns.length)return;
    if(userScrolledUpRef.current)setShowScrollBottom(true);
    else scrollToBottom(false);
  },[turns]);

  const handleContainerScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    userScrolledUpRef.current = !isAtBottom;
    setShowScrollBottom(!isAtBottom);
  };

  function begin() {
    if (busyRef.current) return false;
    busyRef.current=true; setBusy(true); setError(''); return true;
  }
  function finish() { busyRef.current=false; if (alive.current) setBusy(false); }

  function failure(cause: unknown, scope: 'access'|'resource' = 'resource') {
    if (!alive.current || (cause instanceof DOMException && cause.name === 'AbortError')) return;
    setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.');
    setPollPaused(true);
    if (cause instanceof ChatApiError && [401,403].includes(cause.status)) {
      epoch.current++; setAccess(cause.status === 401 ? 'LOGIN':'FORBIDDEN');
      setTurns([]); setItems([]); setListCursor(null);
      if (cause.status === 401) {
        onAccessLost?.('Sesión no válida o vencida. Vuelve a identificarte.');
        auth.clearSession();
      }
    } else if (cause instanceof ChatApiError && cause.status === 404 && (scope === 'access' || !cause.code)) {
      setAccess('DISABLED'); setTurns([]); setItems([]);
      setError('Conversación administrativa no disponible. La autenticación puede estar deshabilitada o su guarda QA no permite este destino.');
    }
  }

  function acceptPage(page: ConversationPage, append = false) {
    if (String(page.personId) !== personId) throw new Error('La respuesta no pertenece a esta persona.');
    setItems(old => append ? [...new Map([...old,...page.items].map(i=>[i.conversationId,i])).values()] : page.items);
    setListCursor(page.nextAfter);
  }

  function notify(turn: ChatTurn, source: ChatTurnNotification['source']) {
    if(!session)return;
    const identity = `${source}:${turn.turnId}:${turn.status}:${JSON.stringify(turn.evaluation)}`;
    if (!notified.current.has(identity)) {
      notified.current.add(identity);
      onTurnChangedRef.current?.(turn,{personId,actorId:session.usuario.id_usuario,source});
      if(source==='active' && turn.status==='COMPLETADA')onCompletedRef.current?.(turn);
    }
  }

  function summarize(turn: ChatTurn) {
    setItems(old=>{
      const index=old.findIndex(i=>i.conversationId===turn.conversationId);
      if(index>=0 && (old[index].lastTurnId||0)>turn.turnId) return old;
      const item:ConversationSummary={conversationId:turn.conversationId,status:turn.status,lastTurnId:turn.turnId,
        lastAction:turn.evaluation?.accion||null,retryable:turn.retryable};
      return index<0?[...old,item]:old.map((v,i)=>i===index?item:v);
    });
  }

  function acceptHistory(page: HistoryPage, cid: string, append: boolean) {
    if (String(page.personId) !== personId || page.conversationId !== cid) throw new Error('Historial de otra persona o conversación rechazado.');
    setTurns(old => append ? mergeTurns(old,page.turns) : page.turns);
    setHistoryCursor(page.nextAfter);
    page.turns.forEach(t=>{summarize(t);notify(t,t.turnId===activeTurn.current?'active':'history');});
  }

  function acceptTurn(turn: ChatTurn) {
    setConversationId(turn.conversationId);
    setTurns(old=>turn.conversationId===conversationId?mergeTurns(old,[turn]):[turn]);
    if(turn.conversationId!==conversationId) setHistoryCursor(null);
    summarize(turn);
    activeTurn.current=turn.turnId;
    setPollPaused(false); notify(turn,'active');
  }

  // Carga automática al montar o cambiar de sesión/persona
  useEffect(() => {
    if (!session?.token) {
      setAccess('LOGIN');
      return;
    }
    setAccess('READY');
    setRejectedDraft(loadRejectedDraft(personId, session.usuario.id_usuario));
    setRestoredDraftKey(null);

    const ticket = epoch.current;
    let isCancelled = false;
    api.list(personId, session.token, 0, controller.current?.signal)
      .then(page => {
        if (!isCancelled && current(ticket)) {
          acceptPage(page);
        }
      })
      .catch(err => {
        if (!isCancelled && current(ticket)) {
          failure(err, 'access');
        }
      });
    return () => { isCancelled = true; };
  }, [personId, session?.token]);

  async function listMore(after = listCursor, append = true) {
    if (!session || after===null || !begin()) return;
    const ticket=epoch.current;
    try { const page=await api.list(personId,session.token,after,controller.current?.signal); if(current(ticket)) acceptPage(page,append); }
    catch(cause) {if(current(ticket)) failure(cause,'access');} finally {finish();}
  }

  async function openHistory(cid: string, after = 0) {
    if (!session || !begin()) return;
    const ticket=++epoch.current;
    if (!after) {
      if(cid!==conversationId) {setDraft('');setRestoredDraftKey(null);activeTurn.current=null;userScrolledUpRef.current=false;setTurns([]);}
      setConversationId(cid);setHistoryCursor(null);
    }
    try {
      const page=await api.history(personId,cid,session.token,after,controller.current?.signal);
      if(current(ticket)) {acceptHistory(page,cid,Boolean(after));setPollPaused(false);}
    } catch(cause) {if(current(ticket)) failure(cause);} finally {finish();}
  }

  async function send(envelope: PendingChatSend) {
    if (!session || envelope.actorId!==session.usuario.id_usuario || !begin()) return;
    const ticket=epoch.current;
    try {
      const turn=await api.send(envelope,session.token,controller.current?.signal);
      if(!current(ticket)) return;
      acceptTurn(turn); setPending(null); setDraft('');
      // La respuesta HTTP es confirmación de identidad del turno, no una reserva inferida.
      storePendingSend(personId,null,envelope.actorId);
      if(rejectedDraft && (restoredDraftKey===rejectedDraft.key || envelope.recoveredDraftKey===rejectedDraft.key)) {
        storeRejectedDraft(personId,session.usuario.id_usuario,null);setRejectedDraft(null);setRestoredDraftKey(null);
      }
    } catch(cause) {
      if(current(ticket)) {
        if(isConfirmedTurnPending(cause)) {
          try {
            storeRejectedDraft(personId,envelope.actorId,envelope);storePendingSend(personId,null,envelope.actorId);
            setRejectedDraft(envelope);setRestoredDraftKey(null);setPending(null);setDraft('');
          } catch {failure(new Error('El mensaje fue rechazado, pero no se pudo conservar el borrador. Conservamos el sobre; revisa el almacenamiento de esta pestaña.'));return;}
          setError('El nuevo mensaje no se registró porque existe otro turno pendiente. El texto quedó como borrador. Abre la conversación PENDIENTE o PROCESANDO; usa Más conversaciones si hace falta.');
          try {
            const page=await api.list(personId,session.token,0,controller.current?.signal);
            if(current(ticket)) acceptPage(page);
          } catch(refreshError) {if(current(ticket)) failure(refreshError,'access');}
        } else failure(cause);
      }
    } finally {finish();}
  }

  async function restoreRejectedDraft() {
    if(!session || !rejectedDraft || rejectedDraft.actorId!==session.usuario.id_usuario || pending ||
      turns.some(t=>t.status!=='COMPLETADA') || historyCursor!==null || !begin()) return;
    const ticket=++epoch.current;
    try {
      const body=JSON.parse(rejectedDraft.body) as {message:string;origin:string;conversationId?:string};
      if(body.conversationId) {
        const page=await api.history(personId,body.conversationId,session.token,0,controller.current?.signal);
        if(!current(ticket))return;
        acceptHistory(page,body.conversationId,false);setConversationId(body.conversationId);
      } else {setConversationId(null);setTurns([]);setHistoryCursor(null);}
      setDraft(body.message);setRestoredDraftKey(rejectedDraft.key);setPollPaused(false);
    } catch(cause) {if(current(ticket))failure(cause);} finally {finish();}
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !draft.trim() || pending || (rejectedDraft && restoredDraftKey!==rejectedDraft.key) ||
      historyCursor!==null || busyRef.current || turns.some(t=>t.status!=='COMPLETADA')) return;
    const envelope: PendingChatSend = {personId,actorId:session.usuario.id_usuario,key:crypto.randomUUID(),
      ...(restoredDraftKey?{recoveredDraftKey:restoredDraftKey}:{}),
      body:JSON.stringify({...(conversationId?{conversationId}:{}),message:draft,origin})};
    try {storePendingSend(personId,envelope);} catch {
      setError('No se pudo conservar el envío en esta pestaña. Habilita el almacenamiento de sesión antes de enviar.');return;
    }
    setPending(envelope);
    setDraft('');
    // NO scrollear incondicionalmente aquí: si el operador está leyendo mensajes anteriores,
    // conservar su posición. El scroll ocurre en acceptTurn cuando !userScrolledUpRef.current.
    void send(envelope);
  }

  async function retry(turn: ChatTurn) {
    if (!session || !turn.retryable || pending || !begin()) return;
    const ticket=epoch.current;
    try {
      const result=await api.retry(personId,turn.conversationId,turn.turnId,session.token,controller.current?.signal);
      if(current(ticket)) acceptTurn(result);
    } catch(cause) {if(current(ticket)) failure(cause);} finally {finish();}
  }

  const processing = turns.find(t=>t.status==='PROCESANDO' && !t.retryable);
  useEffect(() => {
    if (!session || access!=='READY' || !conversationId || !processing || pollPaused || busy) return;
    const token=session.token,cid=conversationId,turnId=processing.turnId,ticket=epoch.current;
    const c=new AbortController();
    const timer=setTimeout(async()=>{
      try {
        const page=await api.history(personId,cid,token,turnId-1,c.signal);
        if(!c.signal.aborted && current(ticket)) {
          if(String(page.personId)!==personId || page.conversationId!==cid) throw new Error('Historial ajeno rechazado.');
          setTurns(old=>mergeTurns(old,page.turns));page.turns.forEach(t=>{summarize(t);notify(t,t.turnId===activeTurn.current?'active':'history');});
        }
      } catch(cause) {if(!c.signal.aborted && current(ticket)) failure(cause);}
    },POLL_MS);
    return ()=>{clearTimeout(timer);c.abort();};
  },[session,access,conversationId,processing,turns,pollPaused,busy,personId]);

  const ready=access==='READY' && Boolean(session);
  const unfinished=turns.some(t=>t.status!=='COMPLETADA');
  const awaitingDraftRestore=Boolean(rejectedDraft && restoredDraftKey!==rejectedDraft.key);

  return <section aria-label="Conversación administrativa Buyer" className="rounded-xl border border-teal-200 bg-white p-5 shadow-2xs space-y-4 dark:border-teal-900 dark:bg-slate-900">
    <div className="flex items-start gap-2">
      <MessageSquare className="h-5 w-5 text-teal-600 shrink-0" />
      <div><h2 className="font-semibold text-sm">Conversación administrativa Buyer</h2>
        <p className="text-xs text-slate-500">El operador escribe o transcribe los mensajes de la persona. Cada respuesta se evalúa al enviarla.</p></div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</p>}

    {!ready && access!=='DISABLED' && (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60 text-xs space-y-2">
        <p className="font-medium text-slate-700 dark:text-slate-300">
          Inicia sesión en el sistema para utilizar la conversación administrativa.
        </p>
        <p className="text-slate-500">
          El operador accede con su sesión general institucional, sin ingresar nuevamente credenciales al abrir cada ficha.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (onSessionRequired) onSessionRequired();
            else auth.openLoginModal();
          }}
          className="bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
        >
          Iniciar sesión en el sistema
        </Button>
      </div>
    )}

    {ready && session && <>
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <p className="font-medium text-slate-700 dark:text-slate-300">
          {session.usuario.nombres} {session.usuario.apellidos} · <span className="text-slate-500">{session.usuario.rol}</span>
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold">Conversaciones guardadas</h3>
        <ul className="max-h-40 overflow-y-auto space-y-1">
          {items.map(item=><li key={item.conversationId}><button type="button" disabled={busy}
            aria-pressed={conversationId===item.conversationId} onClick={()=>void openHistory(item.conversationId)}
            className="w-full rounded-lg border border-slate-200 p-2 text-left text-xs break-all hover:bg-teal-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Conversación {item.conversationId} · {item.status}
          </button></li>)}
        </ul>
        {!items.length && <p className="text-xs text-slate-500">No hay conversaciones en esta página.</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={()=>void listMore(0,false)}>Actualizar conversaciones</Button>
          {listCursor!==null && <Button size="sm" variant="outline" disabled={busy} onClick={()=>void listMore()}>Más conversaciones</Button>}
          <Button size="sm" variant="outline" disabled={busy||Boolean(pending)||unfinished} onClick={()=>{
            epoch.current++;activeTurn.current=null;setConversationId(null);setTurns([]);setHistoryCursor(null);setDraft('');setRestoredDraftKey(null);setError('');setPollPaused(false);
          }}>Nueva conversación</Button>
        </div>
      </div>
      <div className="relative">
        <div
          ref={messagesContainerRef}
          onScroll={handleContainerScroll}
          className="space-y-3 max-h-[32rem] overflow-y-auto pr-1"
          aria-label="Historial persistido"
          aria-live="polite"
        >
          {turns.map(turn=><article key={turn.turnId} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs font-semibold">Turno #{turn.turnId} · {turn.status}</p>
            {turn.messages.map((message,index)=><div key={index} className={`rounded-lg p-2 text-xs ${message.role==='asistente'?'bg-teal-50 dark:bg-teal-950':message.role==='sistema'?'bg-amber-50 dark:bg-amber-950':'bg-slate-50 dark:bg-slate-800'}`}>
              <p className="font-semibold">{roleLabel[message.role as keyof typeof roleLabel] || message.role} <span className="font-normal text-slate-500">· {message.origin}</span></p>
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            </div>)}
            {turn.status==='COMPLETADA' && turn.evaluation?.estado==='COMPLETADA' && <p className="text-xs text-slate-500">Resultado persistido: {turn.evaluation.accion} · Etapa: {turn.evaluation.etapa_final}
              {turn.evaluation.id_solicitud!=null && <> · Solicitud #{turn.evaluation.id_solicitud}</>}
              {turn.evaluation.entregaLeadEstado && <> · Recepción LEAD: {turn.evaluation.entregaLeadEstado}</>}</p>}
            {!!turn.attempts.length && <p className="text-xs text-slate-500">Intentos: {turn.attempts.map(a=>a.result).join(' → ')}</p>}
            {turn.retryable && <Button size="sm" variant="outline" disabled={busy||Boolean(pending)} onClick={()=>void retry(turn)}>Reintentar turno #{turn.turnId}</Button>}
            {turn.status==='PROCESANDO' && !turn.retryable && <p className="text-xs text-slate-500">{pollPaused?'Consulta automática pausada. Usa Consultar estado.':'Procesando. Consultamos el estado cada 5 segundos; la recuperación depende del servidor.'}</p>}
          </article>)}
          {!turns.length && <p className="text-xs text-slate-500">{conversationId?'Abre o consulta el historial guardado.':'El primer mensaje iniciará una conversación.'}</p>}
          <div ref={messagesEndRef} />
        </div>
        {showScrollBottom && (
          <div className="sticky bottom-2 flex justify-center z-10 pointer-events-none mt-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => scrollToBottom(true)}
              className="pointer-events-auto shadow-md text-xs gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50"
            >
              <ChevronDown className="h-3.5 w-3.5 text-teal-600" />
              <span>Ver mensajes nuevos</span>
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {historyCursor!==null && conversationId && <Button size="sm" variant="outline" disabled={busy} onClick={()=>void openHistory(conversationId,historyCursor)}>Más turnos</Button>}
        {conversationId && <Button size="sm" variant="ghost" disabled={busy} onClick={()=>void openHistory(conversationId)}>Consultar estado</Button>}
      </div>
      {pending && <div className="rounded-lg border border-amber-300 p-3 text-xs space-y-2">
        <p>Hay un envío sin confirmación. No se mostrará como mensaje guardado hasta que el backend lo confirme.</p>
        {pending.actorId===session.usuario.id_usuario ? <Button size="sm" variant="outline" disabled={busy} onClick={()=>void send(pending)}>Comprobar envío original</Button>:
          <p>Debe comprobarlo el mismo operador que lo envió. No se reenviará desde otra cuenta.</p>}
      </div>}
      {rejectedDraft && rejectedDraft.actorId===session.usuario.id_usuario && <div className="rounded-lg border border-amber-300 p-3 text-xs space-y-2">
        <p>Borrador rechazado por otro turno pendiente. No forma parte del historial y no se enviará automáticamente.</p>
        <p>Destino original: {JSON.parse(rejectedDraft.body).conversationId?`conversación ${JSON.parse(rejectedDraft.body).conversationId}`:'una conversación nueva'}.</p>
        <Textarea aria-label="Borrador rechazado" readOnly value={JSON.parse(rejectedDraft.body).message} rows={2}/>
        <Button size="sm" variant="outline" disabled={busy||Boolean(pending)||unfinished||historyCursor!==null}
          onClick={()=>void restoreRejectedDraft()}>Recuperar borrador en su destino original</Button>
      </div>}
      <form onSubmit={submit} className="space-y-2">
        {historyCursor!==null && <p className="text-xs text-slate-500">Carga los siguientes turnos con Más turnos antes de continuar esta conversación.</p>}
        <p className="text-[11px] text-slate-500 italic">El operador transcribe la respuesta de la persona.</p>
        <label className="block text-xs" htmlFor={`buyer-chat-message-${personId}`}>Mensaje de la persona</label>
        <Textarea id={`buyer-chat-message-${personId}`} value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)} disabled={busy||Boolean(pending)||unfinished||awaitingDraftRestore} rows={3} />
        <Button type="submit" size="sm" disabled={busy||Boolean(pending)||unfinished||awaitingDraftRestore||historyCursor!==null||!draft.trim()} className="bg-teal-600 text-white hover:bg-teal-700">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy?'Esperando al servidor…':'Enviar y evaluar'}
        </Button>
      </form>
    </>}
  </section>;
}
