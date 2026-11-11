import { useRef, useState } from 'react';
import { LeadChat } from '../components/LeadChat';

export default function LeadChatDemoPage() {
  const [staff, setStaff] = useState(true);
  const messages = useRef([
    { id_mensaje: 1, remitente: 'PACIENTE', texto: 'Hola, ¿podría asistir por la tarde?', recibido_utc: 'demo' },
  ]);

  async function demo(method: string, path: string, body?: object) {
    if (path === '/suggestion') {
      return { intencion: 'HORARIO', sugerencia: '¿Qué días y en qué rango horario podrías asistir?' };
    }
    if (path === '/proposals') return { propuestas: [] };
    if (method === 'POST' && body && 'texto' in body && typeof body.texto === 'string') {
      messages.current.push({
        id_mensaje: messages.current.length + 1,
        remitente: staff ? 'PERSONAL' : 'PACIENTE',
        texto: body.texto,
        recibido_utc: 'demo',
      });
    }
    return { mensajes: messages.current.slice() };
  }

  return <main className="mx-auto max-w-2xl space-y-4 p-4">
    <h1 className="text-2xl font-semibold">Demo del chat LEAD</h1>
    <p>Conversación ficticia con sugerencia simulada. Los mensajes duran hasta que recargues la página.</p>
    <button type="button" className="rounded border px-3 py-1" onClick={() => setStaff(value => !value)}>
      {staff ? 'Cambiar a vista del paciente' : 'Cambiar a vista del personal'}
    </button>
    <LeadChat key={String(staff)} requestId="demo" token="" staff={staff} demo={demo} />
  </main>;
}
