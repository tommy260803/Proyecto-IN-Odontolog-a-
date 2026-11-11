import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

const api = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

type Message = {
  id_mensaje: number;
  remitente: 'PACIENTE' | 'PERSONAL';
  texto: string;
  recibido_utc: string | null;
};

export function LeadChat({ requestId, token, staff = false }: {
  requestId: string;
  token: string;
  staff?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [invite, setInvite] = useState('');
  const [refresh, setRefresh] = useState(0);
  const pending = useRef<{ clave: string; texto: string } | null>(null);
  const endpoint = api + '/lead/commercial/chat/' + (staff ? 'staff/' : 'patient/') + requestId;
  const own = staff ? 'PERSONAL' : 'PACIENTE';

  async function call(method: string, path = '', body?: object, signal?: AbortSignal) {
    const response = await fetch(endpoint + path, {
      method, signal, cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'El acceso a este chat venció o no es válido.' : 'No se pudo completar la operación.');
    }
    return response.json();
  }

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    async function load() {
      try {
        const received: Message[] = [];
        let cursor = 0;
        while (!controller.signal.aborted) {
          const data = await call('GET', cursor ? '?desde=' + cursor : '', undefined, controller.signal);
          const page: Message[] = data.mensajes;
          received.push(...page);
          if (page.length < 50) break;
          cursor = page[page.length - 1].id_mensaje;
        }
        if (controller.signal.aborted) return;
        setMessages(received);
        for (const message of received) {
          if (message.remitente !== own && !message.recibido_utc) {
            await call('PATCH', '', { id_mensaje: message.id_mensaje }, controller.signal);
          }
        }
      } catch (failure) {
        if (!controller.signal.aborted && failure instanceof Error) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(() => void load(), 5000);
      }
    }
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [endpoint, token, own, refresh]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    pending.current ??= { clave: crypto.randomUUID(), texto: draft.trim() };
    try {
      await call('POST', '', pending.current);
      pending.current = null;
      setDraft('');
      setRefresh(value => value + 1);
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setSending(false);
    }
  }

  async function issueAccess() {
    setError('');
    setInvite('');
    try {
      const access = await call('POST', '/access');
      setInvite(window.location.origin + '/lead-chat/' + requestId + '#' + access.token);
      setRefresh(value => value + 1);
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    }
  }

  return <section className="space-y-3 rounded-lg border bg-white p-4">
    <h2 className="text-lg font-semibold">Conversación LEAD</h2>
    {staff && <button type="button" className="underline" onClick={() => void issueAccess()}>Generar enlace temporal de QA</button>}
    {invite && <label className="block">Enlace para el paciente
      <input className="block w-full rounded border p-2" readOnly value={invite} onFocus={event => event.target.select()} />
    </label>}
    {error && <p role="alert">{error}</p>}
    <ol className="max-h-96 space-y-2 overflow-y-auto" aria-label="Mensajes">
      {messages.map(message => <li className="rounded bg-slate-100 p-2" key={message.id_mensaje}>
        <strong>{message.remitente === 'PACIENTE' ? 'Paciente' : 'Equipo LEAD'}</strong>
        <p className="whitespace-pre-wrap break-words">{message.texto}</p>
        {message.remitente === own && <small>{message.recibido_utc ? 'Recibido' : 'Publicado'}</small>}
      </li>)}
    </ol>
    <form className="space-y-2" onSubmit={send}>
      <label className="block">Mensaje
        <textarea className="block w-full rounded border p-2" value={draft} maxLength={2000}
          disabled={sending || pending.current !== null} onChange={event => setDraft(event.target.value)} />
      </label>
      <button className="rounded border px-3 py-1" disabled={sending || !draft.trim()}>
        {sending ? 'Enviando…' : pending.current ? 'Reintentar envío' : 'Enviar'}
      </button>
    </form>
  </section>;
}

export function LeadPatientChatPage() {
  const { id = '' } = useParams();
  return <PatientConversation key={id} requestId={id} />;
}

function PatientConversation({ requestId }: { requestId: string }) {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const key = 'lead-chat-qa-' + requestId;
    const fragment = window.location.hash.slice(1);
    if (/^[a-f0-9]{64}$/.test(fragment)) {
      window.sessionStorage.setItem(key, fragment);
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
    setToken(window.sessionStorage.getItem(key) ?? '');
    setReady(true);
  }, [requestId]);
  return <main className="mx-auto max-w-2xl p-4">
    <h1 className="mb-4 text-2xl font-semibold">Chat de atención</h1>
    {token ? <LeadChat requestId={requestId} token={token} />
      : ready && <p>Abre el enlace que te entregó el equipo LEAD para acceder al chat.</p>}
  </main>;
}
