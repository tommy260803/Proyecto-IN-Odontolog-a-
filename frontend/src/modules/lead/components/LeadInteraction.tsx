import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';

export type LeadInteractionAnalysis = {
  dia?: string;
  turno?: string;
  intencion: string;
  sugerencia: string;
  promociones: string[];
};

type Recognition = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type PatientMessage = { id_interaccion: number; mensaje: string; fecha_hora: string; id_canal: number };

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

export function LeadInteraction({ requestId, onAnalysis }: {
  requestId: number;
  onAnalysis: (value: LeadInteractionAnalysis | null) => void;
}) {
  const [channels, setChannels] = useState<{ id_canal: number; nombre: string }[]>([]);
  const [channel, setChannel] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<PatientMessage[]>([]);
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
  const scope = '/opportunities/' + requestId + '/interactions';
  useEffect(() => {
    let mounted = true;
    request('/report-catalogs').then(({ canales }) => {
      if (mounted) setChannels(canales.filter((c: { nombre: string }) =>
        /llamada|telef[oó]n|presencial/i.test(c.nombre)));
    }).catch((e: Error) => { if (mounted) setError(e.message); });
    request('/opportunities/' + requestId + '/conversation').then(({ mensajes, hay_anteriores }) => {
      if (mounted) { setHistory(mensajes); setHasOlder(hay_anteriores); setLoaded(true); }
    }).catch((e: Error) => { if (mounted) setError(e.message); });
    return () => {
      mounted = false;
      recognition.current?.abort();
    };
  }, []);

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
  }, [history, suggestions]);

  async function loadOlder() {
    if (!hasOlder || olderInFlight.current || !history.length) return;
    olderInFlight.current = true;
    setLoadingOlder(true);
    try {
      const page = await request('/opportunities/' + requestId + '/conversation?antes=' + history[0].id_interaccion);
      const element = viewport.current;
      if (element) scrollSnapshot.current = { height: element.scrollHeight, top: element.scrollTop };
      setHistory((current) => {
        const ids = new Set(current.map(m => m.id_interaccion));
        return [...page.mensajes.filter((m: PatientMessage) => !ids.has(m.id_interaccion)), ...current];
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
    setStatus('Interacción guardada y analizada.');
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
    <section className="space-y-3 p-6">
      <h2 className="text-sm font-semibold">Conversación de negociación</h2>
      <div ref={viewport} className="h-96 space-y-3 overflow-y-auto overscroll-contain rounded-xl bg-slate-100 p-3 dark:bg-slate-950"
        aria-label="Historial de negociación" onScroll={(event) => {
          const element = event.currentTarget;
          stayAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
          if (stayAtBottom.current) setNewMessages(false);
          if (element.scrollTop < 32) void loadOlder();
        }}>
        {hasOlder && <button type="button" disabled={loadingOlder} onClick={() => void loadOlder()}
          className="mx-auto block rounded border bg-background px-3 py-1 text-xs">
          {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
        </button>}
        {history.map((message) => (
          <div key={message.id_interaccion} className="flex flex-col items-start gap-2">
            <div className="max-w-[88%] break-words rounded-2xl rounded-tl-sm border bg-white p-3 text-sm dark:bg-slate-900">
              <p className="text-xs font-medium">Paciente · registrado por el asesor</p>
              <p className="text-xs text-slate-500">
                {new Date(message.fecha_hora).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
                {' · '}{channels.find(c => c.id_canal === message.id_canal)?.nombre ?? 'Contacto'}
              </p>
              <p className="whitespace-pre-wrap">{message.mensaje}</p>
            </div>
            {suggestions[message.id_interaccion] && (
              <div className="max-w-[88%] self-end break-words rounded-2xl rounded-tr-sm border border-teal-200 bg-teal-50 p-3 text-sm dark:bg-teal-950">
                <p className="text-xs font-medium">IA · sugerencia</p>
                <p className="whitespace-pre-wrap">{suggestions[message.id_interaccion].sugerencia}</p>
              </div>
            )}
          </div>
        ))}
        {loaded && !history.length && <p className="text-sm text-slate-500">Las respuestas registradas aparecerán aquí.</p>}
      </div>
      {newMessages && <button type="button" className="mx-auto block rounded-full border px-3 py-1 text-xs"
        onClick={() => {
          stayAtBottom.current = true;
          if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
          setNewMessages(false);
        }}>Ir al último mensaje ↓</button>}
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        if (busy || listening || !loaded || !channel || !note.trim()) return;
        void run(async () => {
          setStatus('');
          setSaved(null);
          const text = note.trim();
          if (!pending.current || pending.current.text !== text || pending.current.channel !== Number(channel)) {
            pending.current = { text, channel: Number(channel), expected: history.at(-1)?.id_interaccion ?? null };
          }
          const interaction = await request(scope, {
            id_canal: Number(channel), tipo: 'Respuesta del paciente', mensaje: text,
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
        <label className="block text-sm">Canal
          <select className="ml-2 rounded border bg-background p-1" required disabled={busy} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Selecciona un canal</option>
            {channels.map((c) => <option key={c.id_canal} value={c.id_canal}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="block text-sm">¿Qué dijo el paciente?
          <textarea className="mt-1 w-full rounded border bg-background p-2" rows={3} required maxLength={4000} value={note}
            disabled={busy} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" disabled={busy || listening} onClick={dictate} className="rounded border px-3 py-2">
            {listening ? 'Escuchando…' : 'Dictar nota'}
          </button>
          <button type="submit" disabled={busy || listening || !loaded || !channel || !note.trim()} className="rounded bg-teal-700 px-3 py-2 text-white disabled:opacity-50">
            {busy ? 'Procesando…' : 'Guardar y analizar'}
          </button>
          {saved && error && <button type="button" disabled={busy} onClick={() => void run(() => analyze(saved))}
            className="rounded border px-3 py-2">Reintentar análisis</button>}
        </div>
      </form>
      {status && <p role="status" className="text-sm">{status}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!channels.length && !error && <p className="text-sm">Selecciona un canal de llamada o presencial cuando esté disponible.</p>}
    </section>
  );
}
