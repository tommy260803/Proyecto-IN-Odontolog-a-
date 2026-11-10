import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { OpportunityDetail } from '../services/leadCommercial.service';

const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';
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

function ProposalForm({ data, previous, requestId, token, finish }: {
  data: ProposalsData; previous: Proposal | null; requestId: string; token: string; finish: (saved: boolean) => void;
}) {
  const client = useQueryClient();
  const [expected] = useState(() => data.propuestas.map(proposal => proposal.id_propuesta));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form className="my-3 space-y-3 rounded-md border p-3" onSubmit={async event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setBusy(true); setError('');
      try {
        const response = await fetch(root + `/opportunities/${requestId}/staff/proposals`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presentada: fields.has('presentada'), precio_cotizado: fields.get('precio'),
            id_promocion_lead: fields.get('promocion') || null, id_version_anterior: previous?.id_propuesta ?? null,
            versiones_esperadas: expected,
          }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 409) await client.invalidateQueries({ queryKey: ['lead', 'opportunity', requestId] });
          throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo registrar la cotización.');
        }
        await client.invalidateQueries({ queryKey: ['lead', 'opportunity', requestId] });
        finish(true);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'No se pudo registrar la cotización.');
      } finally { setBusy(false); }
    }}>
      <h3 className="font-semibold">{previous ? `Nueva versión de propuesta #${previous.id_propuesta_logica}` : 'Registrar propuesta presentada'}</h3>
      <label className="grid max-w-xs gap-1">Precio cotizado (S/)
        <input className="rounded border p-2" name="precio" type="number" min="0" max="99999999.99" step="0.01"
          defaultValue={previous?.precio_cotizado} required />
      </label>
      <label className="grid max-w-xs gap-1">Promoción aplicada
        <select className="rounded border p-2" name="promocion"
          defaultValue={data.promociones_disponibles.some(p => p.id_promocion === previous?.id_promocion_lead)
            ? previous?.id_promocion_lead ?? '' : ''}>
          <option value="">Sin promoción</option>
          {data.promociones_disponibles.map(p => <option key={p.id_promocion} value={p.id_promocion}>{p.nombre}</option>)}
        </select>
      </label>
      <label className="flex gap-2"><input name="presentada" type="checkbox" required /> Confirmo que presenté estas condiciones al paciente.</label>
      <div className="flex flex-wrap gap-3">
        <button className="rounded border px-3 py-2" type="submit" disabled={busy}>Guardar cotización</button>
        <button className="underline" type="button" disabled={busy} onClick={() => finish(false)}>Cerrar formulario</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export default function LeadProposals({ data, access }: {
  data: ProposalsData; access?: { requestId: string; token: string };
}) {
  const [draft, setDraft] = useState<{ previous: Proposal | null } | null>(null);
  const [saved, setSaved] = useState(false);
  const start = (previous: Proposal | null) => { setSaved(false); setDraft({ previous }); };
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
        {access && <button type="button" className="underline" onClick={() => start(null)}>Nueva propuesta</button>}
        {access && draft && (
          <ProposalForm key={draft.previous?.id_propuesta ?? 'new'} data={data} previous={draft.previous} {...access}
            finish={confirmed => { setDraft(null); setSaved(confirmed); }} />
        )}
        {saved && <p role="status">Cotización registrada.</p>}
        {roots.size === 0 && <p>No hay propuestas registradas.</p>}
        <ul className="divide-y">
          {[...roots].map(([root, versions]) => {
            const [current, ...history] = versions;
            return (
              <li key={root} className="space-y-2 py-3">
                <h3 className="font-semibold">Propuesta #{root}</h3>
                <ProposalVersion proposal={current} agreed={current.id_propuesta === agreedId} />
                {access && current.estado !== 'Aceptada' && (
                  <button type="button" className="underline" onClick={() => start(current)}>Crear nueva versión</button>
                )}
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
