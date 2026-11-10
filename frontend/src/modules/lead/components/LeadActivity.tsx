import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export default function LeadActivity({ data, requestId }: { data: OpportunityDetail; requestId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
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
                <button className="underline disabled:opacity-50" disabled={!query.data.hay_siguiente} onClick={() => setPage(page + 1)}>Siguiente</button>
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
