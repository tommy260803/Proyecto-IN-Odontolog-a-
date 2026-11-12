import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, Bot, CalendarDays, CheckCircle2, CircleAlert, ClipboardList,
  Loader2, MessageSquare, Mic, Sparkles, UserRound,
} from 'lucide-react';
import { LeadWhatsAppStatus, type LeadWhatsAppTracking } from './LeadWhatsAppStatus';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';

export type LeadInteractionAnalysis = {
  dia?: string;
  turno?: string;
  intencion: string;
  sugerencia: string;
  promociones: string[];
  recomendacion?: string;
  turnos_excluidos?: string[];
  alternativas?: LeadSuggestedSlot[];
};

export type LeadSuggestedSlot = {
  id_disponibilidad: number; id_sede: number; id_profesional: number;
  fecha: string; inicio: string; fin: string; sede: string; profesional: string;
};

export type WhatsAppProposalUpdate = { id_opcion: number; id_propuesta: number; huella?: string; horario?: LeadSuggestedSlot };

type Recognition = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type NegotiationMessage = {
  id_interaccion: number; mensaje: string | null; fecha_hora: string; id_canal: number;
  tipo?: string; resultado?: string | null;
  accion_chatbot?: string;
  actividad_agente?: AgentActivity;
  nombre_canal?: string;
  analisis_agente?: LeadInteractionAnalysis;
  actualizacion?: WhatsAppProposalUpdate;
  confirmaciones_whatsapp?: LeadWhatsAppTracking;
};

type AgentActivity = { codigo: string; detalle: string };

const activityLabels: Record<string, string> = {
  'CAP-01': 'Priorización',
  'CAP-02': 'Búsqueda de alternativas',
  'CAP-03': 'Negociación',
  'CAP-04': 'Seguimiento',
  'CAP-05': 'Verificación y traspaso',
};

const messageTime = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima',
});
const slotDate = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' });
const fieldClass = 'w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-sm font-normal text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/20 disabled:opacity-60 [color-scheme:light] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-500 dark:focus:bg-slate-950 dark:focus:ring-teal-500/25 dark:[color-scheme:dark]';
const secondaryButton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

function AgentActivityCard({ activity, slots, promotions, onChooseSlot }: {
  activity: { codigo?: string; detalle: string };
  slots?: LeadSuggestedSlot[];
  promotions?: string[];
  onChooseSlot?: (slot: LeadSuggestedSlot) => void;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-teal-200/80 bg-white px-3.5 py-3 dark:border-teal-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#0f766e] dark:text-teal-300" />
        <span className="text-xs font-semibold text-teal-800 dark:text-teal-200">Agente Negociador</span>
        {activity.codigo && <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-200">
          {[activity.codigo, activityLabels[activity.codigo]].filter(Boolean).join(' · ')}
        </span>}
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Actividad interna</span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">{activity.detalle}</p>
      {!!promotions?.length && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-semibold">Promociones activas para revisar</span> · {promotions.join(', ')}
      </p>}
      {onChooseSlot && !!slots?.length && (
        <div className="mt-3 grid gap-2">
          {slots.map(slot => (
            <button key={slot.id_disponibilidad} type="button" onClick={() => onChooseSlot(slot)}
              className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-left transition-colors hover:border-teal-500 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-teal-600 dark:hover:bg-teal-950">
              <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">{slotDate.format(new Date(slot.fecha + 'T00:00:00Z'))} · {slot.inicio}–{slot.fin}</span>
                <span className="block text-xs text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">{slot.sede} · {slot.profesional}</span>
                <span className="mt-1 block text-xs font-medium text-teal-800 dark:text-teal-300">Usar en la propuesta</span>
              </span>
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function MessageCard({ message, channel, onUpdateProposal }: {
  message: NegotiationMessage;
  channel?: string;
  onUpdateProposal?: LeadInteractionProps['onUpdateProposal'];
}) {
  const fromBot = message.tipo === 'Respuesta del chatbot';
  const whatsapp = fromBot || message.resultado?.startsWith('WhatsApp');
  const needsAdvisor = message.resultado?.toLowerCase().includes('requiere asesor');
  const Icon = fromBot ? Bot : UserRound;
  const text = message.mensaje ?? '';
  const update = message.actualizacion;
  const [updating, setUpdating] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [updateError, setUpdateError] = useState('');

  async function updateProposal() {
    if (!update || !onUpdateProposal || updating || updated) return;
    setUpdating(true);
    setUpdateError('');
    try {
      await onUpdateProposal(update);
      setUpdated(true);
    }
    catch (error) { setUpdateError(error instanceof Error ? error.message : 'No se pudo cargar la propuesta.'); }
    finally { setUpdating(false); }
  }

  return (
    <article className={`min-w-0 max-w-full rounded-xl border px-3.5 py-3 sm:max-w-[90%] ${
      fromBot
        ? 'self-end border-teal-200 bg-teal-50/70 dark:border-teal-800 dark:bg-teal-950/60'
        : 'self-start border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
    }`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${fromBot ? 'text-teal-800 dark:text-teal-200' : 'text-slate-900 dark:text-slate-100'}`}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {fromBot ? 'ChatBot LEAD' : 'Paciente'}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{whatsapp ? 'WhatsApp' : channel ?? 'Registrado por el asesor'}</span>
        <time dateTime={message.fecha_hora} className="text-[11px] text-slate-500 dark:text-slate-400">{messageTime.format(new Date(message.fecha_hora))}</time>
      </div>
      {fromBot && message.accion_chatbot && <p className="mt-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200">{message.accion_chatbot}</p>}
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">
        {fromBot ? text.split(/(\*[^*\n]+\*)/).map((part, index) =>
          index % 2 ? <strong key={index} className="font-semibold">{part.slice(1, -1)}</strong> : part) : text}
      </p>
      {needsAdvisor && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" /> Requiere atención del asesor
        </p>
      )}
      {message.confirmaciones_whatsapp && <div className="mt-2"><LeadWhatsAppStatus tracking={message.confirmaciones_whatsapp} /></div>}
      {fromBot && update && onUpdateProposal && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-teal-200/70 pt-3 dark:border-teal-800/80">
        <button type="button" className={secondaryButton} onClick={() => void updateProposal()} disabled={updating || updated}>
          {updated ? 'Actualizado' : updating ? 'Cargando propuesta…' : 'Actualizar'}
        </button>
        {updateError && <p role="alert" className="basis-full text-xs text-rose-700 dark:text-rose-300">{updateError}</p>}
      </div>}
    </article>
  );
}

async function request(path: string, body?: object) {
  const response = await fetch(api + path, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error ?? 'No se pudo completar la operación.');
  return result;
}

type LeadInteractionProps = {
  requestId: number;
  onAnalysis: (value: LeadInteractionAnalysis | null) => void;
  onChooseSlot: (value: LeadSuggestedSlot) => void;
  onUpdateProposal?: (update: WhatsAppProposalUpdate) => Promise<void>;
};
type Communication = 'whatsapp' | 'presencial';

export function LeadInteraction(props: LeadInteractionProps) {
  const [communication, setCommunication] = useState<Communication>('whatsapp');
  const id = useId();
  const tabs = [
    { value: 'whatsapp' as const, label: 'WhatsApp', Icon: MessageSquare },
    { value: 'presencial' as const, label: 'Presencial/Llamada', Icon: UserRound },
  ];
  return (
    <section className="space-y-4 px-4 pb-6 sm:px-6" aria-label="Conversación de negociación">
      <div role="tablist" aria-label="Tipo de comunicación" className="flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
        {tabs.map(({ value, label, Icon }, index) => (
          <button key={value} type="button" role="tab" id={`${id}-tab-${value}`}
            aria-controls={`${id}-panel-${value}`} aria-selected={communication === value}
            tabIndex={communication === value ? 0 : -1}
            onClick={() => setCommunication(value)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + 1) % tabs.length;
              const selected = tabs[next].value;
              setCommunication(selected);
              document.getElementById(`${id}-tab-${selected}`)?.focus();
            }}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${communication === value
              ? 'bg-white text-teal-800 shadow-sm dark:bg-slate-800 dark:text-teal-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
      {tabs.map(({ value }) => (
        <div key={value} role="tabpanel" id={`${id}-panel-${value}`} aria-labelledby={`${id}-tab-${value}`}
          hidden={communication !== value}>
          <ConversationPanel {...props} communication={value} active={communication === value} />
        </div>
      ))}
    </section>
  );
}

function ConversationPanel({ requestId, onAnalysis, onChooseSlot, onUpdateProposal, communication, active }: LeadInteractionProps & {
  communication: Communication;
  active: boolean;
}) {
  const [channels, setChannels] = useState<{ id_canal: number; nombre: string }[]>([]);
  const [channel, setChannel] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<NegotiationMessage[]>([]);
  const [latestOffer, setLatestOffer] = useState<LeadWhatsAppTracking | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, LeadInteractionAnalysis>>({});
  const [loaded, setLoaded] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const viewport = useRef<HTMLDivElement | null>(null);
  const stayAtBottom = useRef(true);
  const olderInFlight = useRef(false);
  const scrollSnapshot = useRef<{ height: number; top: number } | null>(null);
  const inFlight = useRef(false);
  const pending = useRef<{ text: string; channel: number; expected: number | null } | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const manual = communication === 'presencial';
  const scope = '/opportunities/' + requestId + '/interactions';
  const conversation = '/opportunities/' + requestId + '/conversation?comunicacion=' + communication;
  useEffect(() => {
    let mounted = true;
    let loadedFirstPage = false;
    if (manual) request('/report-catalogs').then(({ canales }) => {
      if (!mounted) return;
      const available = canales.filter((c: { nombre: string }) => /llamada|telef[oó]n|presencial/i.test(c.nombre));
      setChannels(available);
      const presencial = available.find((c: { nombre: string }) => /presencial/i.test(c.nombre));
      setChannel(String(presencial?.id_canal ?? available[0]?.id_canal ?? ''));
    }).catch((e: Error) => { if (mounted) setError(e.message); });
    request(conversation).then(({ mensajes, hay_anteriores, ultima_oferta_whatsapp }) => {
      if (mounted) {
        loadedFirstPage = true;
        setHistory(mensajes);
        setLatestOffer(ultima_oferta_whatsapp ?? null);
        setHasOlder(hay_anteriores);
        setLoaded(true);
      }
    }).catch((e: Error) => { if (mounted) setError(e.message); });
    let refreshing = false;
    const refresh = window.setInterval(async () => {
      const panel = viewport.current?.closest('details');
      if (!activeRef.current || refreshing || document.hidden || (panel && !panel.open)) return;
      refreshing = true;
      try {
        const { mensajes, hay_anteriores, ultima_oferta_whatsapp } = await request(conversation);
        if (!mounted) return;
        setLatestOffer(ultima_oferta_whatsapp ?? null);
        if (!loadedFirstPage) {
          loadedFirstPage = true;
          setHasOlder(hay_anteriores);
          setLoaded(true);
        }
        setHistory(current => {
          const existing = new Map(current.map(message => [message.id_interaccion, message]));
          let changed = false;
          for (const message of mensajes as NegotiationMessage[]) {
            const before = existing.get(message.id_interaccion);
            if (!before || before.mensaje !== message.mensaje || before.resultado !== message.resultado ||
                before.accion_chatbot !== message.accion_chatbot ||
                before.actividad_agente?.codigo !== message.actividad_agente?.codigo ||
                before.actividad_agente?.detalle !== message.actividad_agente?.detalle ||
                JSON.stringify(before.analisis_agente) !== JSON.stringify(message.analisis_agente) ||
                JSON.stringify(before.confirmaciones_whatsapp) !== JSON.stringify(message.confirmaciones_whatsapp) ||
                JSON.stringify(before.actualizacion) !== JSON.stringify(message.actualizacion)) {
              existing.set(message.id_interaccion, message);
              changed = true;
            }
          }
          return changed ? [...existing.values()].sort((a, b) => a.id_interaccion - b.id_interaccion) : current;
        });
      } catch {
        // The initial load shows connection errors. A refresh can recover on the next interval.
      } finally {
        refreshing = false;
      }
    }, 5000);
    return () => {
      mounted = false;
      window.clearInterval(refresh);
      recognition.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!active) {
      recognition.current?.abort();
      setListening(false);
    }
  }, [active]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (scrollSnapshot.current) {
      element.scrollTop = scrollSnapshot.current.top + element.scrollHeight - scrollSnapshot.current.height;
      scrollSnapshot.current = null;
    } else if (stayAtBottom.current) {
      element.scrollTop = element.scrollHeight;
      setNewMessages(false);
    } else {
      setNewMessages(true);
    }
  }, [history, suggestions, active]);

  async function loadOlder() {
    if (!hasOlder || olderInFlight.current || !history.length) return;
    olderInFlight.current = true;
    setLoadingOlder(true);
    try {
      const page = await request(conversation + '&antes=' + history[0].id_interaccion);
      const element = viewport.current;
      if (element) scrollSnapshot.current = { height: element.scrollHeight, top: element.scrollTop };
      setHistory((current) => {
        const ids = new Set(current.map(m => m.id_interaccion));
        return [...page.mensajes.filter((m: NegotiationMessage) => !ids.has(m.id_interaccion)), ...current];
      });
      setHasOlder(page.hay_anteriores);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los mensajes anteriores.');
    } finally {
      olderInFlight.current = false;
      setLoadingOlder(false);
    }
  }

  async function analyze(interaction: number) {
    const result = await request(scope + '/' + interaction + '/analyze', {});
    setSuggestions((current) => ({ ...current, [interaction]: result }));
    onAnalysis(result);
    setStatus('Interacción guardada. Recomendación del Agente disponible.');
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    onAnalysis(null);
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); inFlight.current = false; }
  }

  function dictate() {
    const browser = window as Window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Este navegador no admite dictado. Puedes escribir la nota.');
      return;
    }
    try {
      const input = new SpeechRecognition();
      recognition.current = input;
      input.lang = 'es-PE';
      input.onresult = (event) => setNote((current) =>
        [current, event.results[0]?.[0]?.transcript].filter(Boolean).join(' ').slice(0, 4000));
      input.onerror = () => setError('No se pudo dictar. Comprueba el micrófono o escribe la nota.');
      input.onend = () => setListening(false);
      setError('');
      setListening(true);
      input.start();
    } catch {
      setListening(false);
      setError('No se pudo iniciar el dictado.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <MessageSquare aria-hidden="true" className="h-4 w-4 text-[#0f766e] dark:text-teal-300" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{manual ? 'Atención presencial y telefónica' : 'Conversación de WhatsApp'}</h3>
        </div>
        {!manual && latestOffer && <div className="space-y-1.5 border-b border-slate-200 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="text-xs font-medium text-slate-700 dark:text-slate-200">Última propuesta enviada desde la mesa</h4>
          <LeadWhatsAppStatus tracking={latestOffer} />
        </div>}
        <div ref={viewport} tabIndex={0}
          className={`space-y-3 overflow-y-auto overscroll-contain bg-slate-50/70 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 dark:bg-slate-950/60 ${history.length ? 'max-h-[28rem]' : ''}`}
          aria-label="Historial de negociación" onScroll={(event) => {
            const element = event.currentTarget;
            stayAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
            if (stayAtBottom.current) setNewMessages(false);
            if (element.scrollTop < 32) void loadOlder();
          }}>
          {hasOlder && <div className="text-center">
            <button type="button" disabled={loadingOlder} onClick={() => void loadOlder()} className={secondaryButton}>
              {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
            </button>
          </div>}
          {history.map(message => {
            const suggestion = suggestions[message.id_interaccion] ?? message.analisis_agente;
            const activityCode = suggestion?.intencion === 'HORARIO' || suggestion?.intencion === 'SEDE' ? 'CAP-02'
              : suggestion?.intencion === 'PRECIO' ? 'CAP-03' : undefined;
            return (
              <div key={message.id_interaccion} className="flex min-w-0 flex-col gap-2">
                {message.actividad_agente && <AgentActivityCard activity={message.actividad_agente} />}
                <MessageCard message={message} channel={message.nombre_canal ?? channels.find(c => c.id_canal === message.id_canal)?.nombre}
                  onUpdateProposal={communication === 'whatsapp' ? onUpdateProposal : undefined} />
                {suggestion && <AgentActivityCard activity={{ codigo: activityCode, detalle: suggestion.sugerencia }}
                  slots={suggestion.alternativas} promotions={suggestion.promociones} onChooseSlot={onChooseSlot} />}
              </div>
            );
          })}
          {!history.length && <p className="px-2 py-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {loaded ? manual ? 'Registra lo que comenta el paciente para consultar al Agente.' : 'Los mensajes de WhatsApp aparecerán aquí.'
              : error ? 'El historial se actualizará al recuperar la conexión.' : 'Cargando conversación…'}
          </p>}
        </div>
        {newMessages && <div className="border-t border-slate-200 bg-white px-3 py-2 text-center dark:border-slate-800 dark:bg-slate-900">
          <button type="button" className={secondaryButton} onClick={() => {
            stayAtBottom.current = true;
            if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
            setNewMessages(false);
          }}><ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /> Ir al último mensaje</button>
        </div>}
      </div>
      {manual && <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" onSubmit={(event) => {
        event.preventDefault();
        if (busy || listening || !loaded || !channel || !note.trim()) return;
        void run(async () => {
          setStatus('');
          setSaved(null);
          const text = note.trim();
          if (!pending.current || pending.current.text !== text || pending.current.channel !== Number(channel)) {
            const lastPatient = history.findLast(message => message.tipo !== 'Respuesta del chatbot');
            pending.current = { text, channel: Number(channel), expected: lastPatient?.id_interaccion ?? null };
          }
          const interaction = await request(scope, {
            id_canal: Number(channel), tipo: 'Respuesta del paciente', mensaje: text,
            comunicacion: 'presencial',
            ultima_interaccion_esperada: pending.current.expected,
          });
          pending.current = null;
          setHistory((current) => current.some(m => m.id_interaccion === interaction.id_interaccion)
            ? current : [...current, interaction]);
          setSaved(interaction.id_interaccion);
          setNote('');
          setStatus('Interacción guardada.');
          await analyze(interaction.id_interaccion);
        });
      }}>
        <div className="flex items-center gap-2">
          <ClipboardList aria-hidden="true" className="h-4 w-4 text-[#0f766e] dark:text-teal-300" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Registrar una interacción</h3>
        </div>
        <div className="flex items-start gap-2">
          <label className="min-w-0 flex-1 space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <span className="block">¿Qué dijo el paciente?</span>
            <textarea className={`${fieldClass} min-h-[5rem] resize-y py-2`} rows={3} required maxLength={4000} value={note}
              placeholder="Por ejemplo, el paciente necesita otro horario o quiere revisar el precio."
              disabled={busy} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" disabled={busy} onClick={() => {
            if (listening) {
              recognition.current?.abort();
              setListening(false);
            } else dictate();
          }}
            aria-label={listening ? 'Detener dictado' : 'Dictar nota'}
            aria-pressed={listening}
            title={listening ? 'Detener dictado' : 'Dictar nota'}
            className={`${secondaryButton} mt-6 h-9 w-9 shrink-0 px-0 ${listening ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-300' : ''}`}>
            <Mic aria-hidden="true" className={`h-4 w-4 ${listening ? 'motion-safe:animate-pulse' : ''}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {listening && <span role="status" className="text-xs text-teal-800 dark:text-teal-300">Escuchando…</span>}
          <button type="submit" disabled={busy || listening || !loaded || !channel || !note.trim()}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50">
            {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />}
            {busy ? 'Consultando…' : 'Consultar al Agente'}
          </button>
          {saved && error && <button type="button" disabled={busy} onClick={() => void run(() => analyze(saved))}
            className={secondaryButton}>Reintentar análisis</button>}
        </div>
        {status && !error && <p role="status" className="flex items-center gap-1.5 text-xs text-teal-800 dark:text-teal-300">
          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> {status}
        </p>}
        {error && <p role="alert" className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
          <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>}
      </form>}
    </div>
  );
}
