import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { commercialStatus, formatFollowUp, leadCommercialService, type OpportunityDetail } from '../services/leadCommercial.service';

function commercialEvents(data: OpportunityDetail) {
  const events: { id: string; day: string; description: string }[] = [];
  function add(id: string, date: string | null, description: string) {
    if (date) events.push({ id, day: date.slice(0, 10), description });
  }
  for (const proposal of data.propuestas) {
    const label = `Propuesta #${proposal.id_propuesta_logica}, versión ${proposal.numero_version}`;
    add(`proposal-${proposal.id_propuesta}`, proposal.fecha_presentacion, `${label} · Presentación registrada`);
    if (proposal.estado === 'Aceptada' || proposal.estado === 'Rechazada') {
      add(`proposal-decision-${proposal.id_propuesta}`, proposal.fecha_decision, `${label} · ${proposal.estado}`);
    }
  }
  for (const option of data.alternativas) {
    add(`option-${option.id_opcion}`, option.fecha_ofrecida, `Opción #${option.id_opcion} · Oferta registrada`);
    if (option.estado_respuesta === 'Aceptada' || option.estado_respuesta === 'Rechazada') {
      add(`option-decision-${option.id_opcion}`, option.fecha_respuesta, `Opción #${option.id_opcion} · ${option.estado_respuesta}`);
    }
  }
  for (const change of data.modificaciones) {
    add(`change-${change.id_cambio}`, change.fecha_cambio, `Opción #${change.id_opcion} · Modificación registrada`);
  }
  const opportunity = data.oportunidad;
  if (opportunity.resultado_comercial_lead === 'ACEPTADA' || opportunity.resultado_comercial_lead === 'CERRADA_SIN_ACUERDO') {
    add('outcome', opportunity.fecha_decision_comercial_lead, commercialStatus(opportunity.resultado_comercial_lead));
  }
  return events.sort((left, right) => right.day.localeCompare(left.day));
}

const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';

function InteractionForm({ requestId, token, latest, onSaved }: {
  requestId: string; token: string; latest: number | null; onSaved: () => void;
}) {
  const client = useQueryClient();
  const [expected, setExpected] = useState(latest);
  const [type, setType] = useState('Nota de contacto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const filters = useQuery({ queryKey: ['lead', 'opportunity-filters'],
    queryFn: ({ signal }) => leadCommercialService.filters(signal) });
  return (
    <form className="my-3 space-y-2 rounded border p-3" onSubmit={async event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setBusy(true); setError('');
      try {
        const response = await fetch(root + `/opportunities/${requestId}/staff/interactions`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: type, id_canal: fields.get('canal'), mensaje: fields.get('mensaje'),
            es_respuesta_util: fields.has('util'), ultima_interaccion_esperada: expected }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 409) {
            setConflict(true);
            await client.invalidateQueries({ queryKey: ['lead', 'activity', requestId] });
          }
          throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo registrar la interacción.');
        }
        onSaved();
        await Promise.all([
          client.invalidateQueries({ queryKey: ['lead', 'activity', requestId] }),
          client.invalidateQueries({ queryKey: ['lead', 'opportunity', requestId] }),
          client.invalidateQueries({ queryKey: ['lead', 'opportunities'] }),
        ]);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'No se pudo registrar la interacción.');
      } finally { setBusy(false); }
    }}>
      <label className="grid max-w-xs gap-1">Tipo de interacción
        <select className="rounded border p-2" value={type} onChange={event => setType(event.target.value)}>
          <option>Nota de contacto</option><option>Respuesta del paciente</option>
        </select>
      </label>
      <label className="grid max-w-xs gap-1">Canal
        <select className="rounded border p-2" name="canal" required defaultValue="">
          <option value="">{filters.isFetching ? 'Cargando canales…' : 'Selecciona un canal'}</option>
          {filters.data?.canales?.map(channel => <option key={channel.id_canal} value={channel.id_canal}>{channel.nombre}</option>)}
        </select>
      </label>
      {filters.isError && <button type="button" className="underline" onClick={() => void filters.refetch()}>Reintentar carga de canales</button>}
      <label className="grid gap-1">Nota de la interacción
        <textarea name="mensaje" required maxLength={4000} className="rounded border p-2" />
      </label>
      {type === 'Respuesta del paciente' && <label className="flex gap-2"><input name="util" type="checkbox" /> La respuesta aporta información útil para continuar.</label>}
      <button type="submit" className="rounded border px-3 py-2" disabled={busy || conflict}>Guardar interacción</button>
      {error && <p role="alert">{error}</p>}
      {conflict && <button type="button" className="underline" disabled={busy} onClick={() => {
        setExpected(latest); setConflict(false); setError('');
      }}>Usar la bitácora actual como referencia</button>}
    </form>
  );
}

export default function LeadActivity({ data, requestId, token }: { data: OpportunityDetail; requestId: string; token?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState(false);
  const [writing, setWriting] = useState(false);
  const query = useQuery({
    queryKey: ['lead', 'activity', requestId, page],
    queryFn: ({ signal }) => leadCommercialService.activity(requestId, page, signal),
    enabled: expanded,
    retry: false,
  });
  const opportunity = data.oportunidad;
  const inactive = opportunity.archivada_lead_en || opportunity.resultado_comercial_lead === 'ACEPTADA' ||
    opportunity.resultado_comercial_lead === 'CERRADA_SIN_ACUERDO';
  const events = commercialEvents(data);

  return (
    <details className="rounded-lg border bg-white p-4" onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">Actividad y seguimiento</summary>
      <section className="mt-3 space-y-1" aria-label="Seguimiento comercial">
        <h3 className="font-semibold">{inactive ? 'Seguimiento registrado' : 'Próximo seguimiento comercial'}</h3>
        <p>{formatFollowUp(opportunity.fecha_proximo_seguimiento)}{opportunity.fecha_proximo_seguimiento && ' · Hora de Lima'}</p>
        {!inactive && opportunity.fecha_proximo_seguimiento && (
          <p>Próxima acción: retomar el seguimiento de esta solicitud.</p>
        )}
      </section>
      <section className="mt-4 border-t pt-3" aria-label="Bitácora de interacciones">
        <h3 className="font-semibold">Bitácora de interacciones</h3>
        <p className="text-sm">Una entrada registra una interacción. La entrega de mensajes requiere confirmación del canal.</p>
        {saved && <p role="status">Interacción registrada.</p>}
        {!inactive && token && page === 1 && query.data && (
          <>
            <button type="button" className="underline" onClick={() => { setWriting(value => !value); setSaved(false); }}>
              {writing ? 'Cerrar formulario' : 'Registrar interacción'}
            </button>
            {writing && <InteractionForm requestId={requestId} token={token}
              latest={query.data.interacciones[0]?.ultima_interaccion_id ?? null}
              onSaved={() => { setWriting(false); setSaved(true); }} />}
          </>
        )}
        {expanded && query.isPending && <p role="status">Cargando interacciones…</p>}
        {query.isError && <p role="alert">{query.error.message} <button className="underline" onClick={() => void query.refetch()}>Reintentar</button></p>}
        {query.data && (
          <>
            {query.data.interacciones.length === 0 && <p>No hay interacciones registradas en esta página.</p>}
            <ol className="divide-y">
              {query.data.interacciones.map(interaction => (
                <li className="space-y-1 py-2" key={interaction.id_interaccion}>
                  <p className="font-medium">{interaction.tipo} · {interaction.dia_registrado} {interaction.hora_registrada}</p>
                  <p>Canal: {interaction.canal ?? 'Sin registrar'} · Autor: {interaction.actor ?? 'Sin registrar'}</p>
                  {interaction.es_respuesta_util && <p>Clasificada como respuesta útil en la bitácora</p>}
                  {interaction.mensaje && <p className="whitespace-pre-wrap break-words">{interaction.mensaje}</p>}
                </li>
              ))}
            </ol>
            {(page > 1 || query.data.hay_siguiente) && (
              <nav className="flex gap-3" aria-label="Páginas de actividad">
                <button className="underline disabled:opacity-50" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
                <span>Página {page}</span>
                <button className="underline disabled:opacity-50" disabled={writing || !query.data.hay_siguiente} onClick={() => setPage(page + 1)}>Siguiente</button>
              </nav>
            )}
          </>
        )}
      </section>
      <section className="mt-4 border-t pt-3" aria-label="Hitos comerciales">
        <h3 className="font-semibold">Hitos comerciales por fecha registrada</h3>
        {events.length === 0 && <p>No hay hitos comerciales documentados.</p>}
        <ol className="divide-y">
          {events.map(event => <li className="py-2" key={event.id}><time dateTime={event.day}>{event.day}</time> · {event.description}</li>)}
        </ol>
      </section>
    </details>
  );
}
