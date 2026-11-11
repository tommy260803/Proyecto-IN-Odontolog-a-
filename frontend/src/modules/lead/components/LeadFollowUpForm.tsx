import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatFollowUp } from '../services/leadCommercial.service';

const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';

export default function LeadFollowUpForm({ requestId, token, current }: { requestId: string; token: string; current: string | null }) {
  const client = useQueryClient();
  const [expected, setExpected] = useState(current);
  const [draft, setDraft] = useState(() => current
    ? new Date(new Date(current).getTime() - 5 * 3600_000).toISOString().slice(0, 16)
    : '');
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['lead', 'opportunity', requestId] }),
    client.invalidateQueries({ queryKey: ['lead', 'opportunities'] }),
  ]);

  async function save(fecha_lima: string | null) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await fetch(root + `/opportunities/${requestId}/follow-up`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_lima, fecha_esperada_utc: expected }),
      });
      const body = await result.json().catch(() => null);
      if (!result.ok) {
        if (result.status === 409) {
          setConflict(true);
          await refresh();
        }
        throw new Error(result.status === 401 ? 'La sesión venció o fue revocada. Vuelve a verificar el acceso.' :
          typeof body?.error === 'string' ? body.error : 'No se pudo guardar el seguimiento.');
      }
      setExpected(body.fecha_proximo_seguimiento);
      setConfirmCancel(false);
      if (fecha_lima === null) setDraft('');
      setSuccess(fecha_lima === null ? 'Seguimiento cancelado.' : 'Seguimiento guardado.');
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el seguimiento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-2 border-t pt-3" onSubmit={event => { event.preventDefault(); void save(draft); }}>
      <h3 className="font-semibold">Programar seguimiento comercial</h3>
      <p>Fecha registrada: {formatFollowUp(current)}</p>
      <label className="grid max-w-xs gap-1">Fecha y hora de Lima
        <input type="datetime-local" className="rounded border px-3 py-2" value={draft} required
          onChange={event => setDraft(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded border px-3 py-2" disabled={busy || conflict}>Guardar seguimiento</button>
        {current && <button type="button" className="underline" disabled={busy || conflict}
          onClick={() => setConfirmCancel(true)}>Cancelar seguimiento</button>}
      </div>
      {confirmCancel && !conflict && (
        <div className="flex flex-wrap items-center gap-2">
          <p>¿Quitar la fecha programada?</p>
          <button type="button" className="underline" disabled={busy} onClick={() => void save(null)}>Confirmar cancelación</button>
          <button type="button" className="underline" disabled={busy} onClick={() => setConfirmCancel(false)}>Conservar fecha</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {conflict && <button type="button" className="underline" disabled={busy} onClick={() => {
        setExpected(current);
        setConflict(false);
        setConfirmCancel(false);
        setError('');
      }}>Usar la fecha registrada como referencia</button>}
      {success && <p role="status">{success}</p>}
    </form>
  );
}
