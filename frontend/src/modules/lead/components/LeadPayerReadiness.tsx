import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadCommercialService } from '../services/leadCommercial.service';

const labels = { cumple: 'Cumple', bloqueado: 'Bloqueado', pendiente: 'Pendiente de verificación' };
const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';

export default function LeadPayerReadiness({ requestId, token }: { requestId: string; token?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['lead', 'payer-readiness', requestId],
    queryFn: ({ signal }) => leadCommercialService.payerReadiness(requestId, signal),
    enabled: expanded,
    retry: false,
  });
  const reference = query.data?.condiciones_autorizables;
  const canRegister = Boolean(token && reference && !query.data?.autorizacion);
  const filters = useQuery({ queryKey: ['lead', 'opportunity-filters'],
    queryFn: ({ signal }) => leadCommercialService.filters(signal), enabled: expanded && canRegister });

  return (
    <details className="rounded-lg border bg-white p-4" onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">Preparación para PAYER</summary>
      {expanded && query.isPending && <p className="mt-3" role="status">Verificando requisitos…</p>}
      {query.isError && <p className="mt-3" role="alert">{query.error.message} <button className="underline" onClick={() => void query.refetch()}>Reintentar</button></p>}
      {query.data && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold" role="status">
              {query.isFetching ? 'Actualizando diagnóstico…' : query.data.estado === 'preparado' ? 'Requisitos verificados' : 'Traspaso bloqueado'}
            </p>
            <button type="button" className="underline disabled:opacity-50" disabled={query.isFetching} onClick={() => void query.refetch()}>Volver a verificar</button>
          </div>
          <ul className="mt-2 divide-y">
            {query.data.requisitos.map(check => (
              <li className="py-2" key={check.codigo}>
                <p className="font-medium">{check.etiqueta} · {labels[check.estado]}</p>
                <p>{check.detalle}</p>
              </li>
            ))}
          </ul>
          {query.data.autorizacion && <p>Autorización registrada #{query.data.autorizacion.id_autorizacion}.</p>}
          {canRegister && reference && (
            <form key={reference.revision} className="mt-3 space-y-2 rounded border p-3" onSubmit={async event => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              setBusy(true); setError('');
              try {
                const response = await fetch(root + `/opportunities/${requestId}/staff/reservation-authorization`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ revision: reference.revision, id_opcion: reference.id_opcion,
                    id_propuesta: reference.id_propuesta, id_canal: fields.get('canal'),
                    referencia_evidencia: fields.get('referencia'), confirmada: fields.has('confirmada') }),
                });
                const body = await response.json().catch(() => null);
                if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo registrar la autorización.');
                await query.refetch();
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : 'No se pudo registrar la autorización.');
              } finally { setBusy(false); }
            }}>
              <p>Opción #{reference.id_opcion} · Propuesta #{reference.id_propuesta} · S/ {reference.precio}</p>
              <p>{reference.dia} · {reference.inicio}–{reference.fin} · {reference.sede} · {reference.profesional}</p>
              <label className="grid max-w-xs gap-1">Canal de la autorización
                <select name="canal" className="rounded border p-2" required defaultValue="">
                  <option value="">Selecciona un canal</option>
                  {filters.data?.canales?.map(c => <option key={c.id_canal} value={c.id_canal}>{c.nombre}</option>)}
                </select>
              </label>
              {filters.isError && <button type="button" className="underline" onClick={() => void filters.refetch()}>Reintentar carga de canales</button>}
              <label className="grid gap-1">Referencia de la evidencia
                <input name="referencia" maxLength={300} className="rounded border p-2" required />
              </label>
              <label className="flex gap-2"><input name="confirmada" type="checkbox" required />
                El paciente autorizó expresamente la reserva bajo estas condiciones.
              </label>
              <button type="submit" className="rounded border px-3 py-2" disabled={busy || query.isFetching}>Guardar autorización</button>
              {error && <p role="alert">{error}</p>}
            </form>
          )}
        </>
      )}
    </details>
  );
}
