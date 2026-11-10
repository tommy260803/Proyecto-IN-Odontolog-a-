import type { OpportunityDetail } from '../services/leadCommercial.service';

type Proposal = OpportunityDetail['propuestas'][number];

function ProposalVersion({ proposal, agreed }: { proposal: Proposal; agreed: boolean }) {
  const promotion = proposal.promocion_registrada ?? proposal.promocion_catalogo ??
    (proposal.id_promocion_lead == null ? 'Sin promoción' : `Promoción #${proposal.id_promocion_lead}`);
  return (
    <div className="space-y-1">
      <p className="font-medium">Versión {proposal.numero_version}{proposal.orden_version === 1 && ' · Vigente'}{agreed && ' · Vinculada al acuerdo'}</p>
      <p>Precio cotizado: S/ {proposal.precio_cotizado} · {proposal.estado}</p>
      <p>Promoción: {promotion}</p>
      <p>Presentación: {proposal.fecha_presentacion.slice(0, 10)}{proposal.fecha_decision && ` · Decisión: ${proposal.fecha_decision.slice(0, 10)}`}</p>
      {proposal.sede && <p>Sede: {proposal.sede}</p>}
      {proposal.estado === 'Rechazada' && (
        <p>Motivo: {proposal.motivo_rechazo ?? 'Sin motivo documentado'}{proposal.categoria_rechazo === 'ECONOMICO' && ' · Económico'}</p>
      )}
    </div>
  );
}

type ProposalsData = Pick<OpportunityDetail, 'propuestas' | 'tarifa_referencia' | 'promociones_disponibles'> & {
  oportunidad: Pick<OpportunityDetail['oportunidad'], 'id_propuesta_aceptada_lead'>;
};

export default function LeadProposals({ data }: { data: ProposalsData }) {
  const roots = new Map<number, Proposal[]>();
  for (const proposal of data.propuestas) {
    const versions = roots.get(proposal.id_propuesta_logica);
    if (versions) versions.push(proposal);
    else roots.set(proposal.id_propuesta_logica, [proposal]);
  }

  const agreedId = data.oportunidad.id_propuesta_aceptada_lead;
  return (
    <details className="rounded-lg border bg-white p-4">
      <summary className="cursor-pointer font-semibold">Propuestas económicas ({roots.size})</summary>
      <section className="mt-3 space-y-2" aria-label="Referencias comerciales">
        <p>Tarifa de referencia vigente: {data.tarifa_referencia ? `S/ ${data.tarifa_referencia.precio}` : 'Sin tarifa vigente para el servicio'}</p>
        <h3 className="font-semibold">Promociones activas para el servicio</h3>
        {data.promociones_disponibles.length ? (
          <ul className="ml-4 list-disc">
            {data.promociones_disponibles.map(promo => <li key={promo.id_promocion}>{promo.nombre} · {promo.tipo_promocion}</li>)}
          </ul>
        ) : <p>Sin promociones activas para el servicio.</p>}
      </section>
      <section className="mt-4 border-t pt-3" aria-label="Cotizaciones registradas">
        {roots.size === 0 && <p>No hay propuestas registradas.</p>}
        <ul className="divide-y">
          {[...roots].map(([root, versions]) => {
            const [current, ...history] = versions;
            return (
              <li key={root} className="space-y-2 py-3">
                <h3 className="font-semibold">Propuesta #{root}</h3>
                <ProposalVersion proposal={current} agreed={current.id_propuesta === agreedId} />
                {history.length > 0 && (
                  <details>
                    <summary className="cursor-pointer underline">Versiones anteriores ({history.length})</summary>
                    <ul className="ml-4 divide-y">
                      {history.map(version => (
                        <li className="py-2" key={version.id_propuesta}>
                          <ProposalVersion proposal={version} agreed={version.id_propuesta === agreedId} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </details>
  );
}
