import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LeadAlternatives from '../components/LeadAlternatives';
import LeadActivity from '../components/LeadActivity';
import LeadPayerReadiness from '../components/LeadPayerReadiness';
import LeadStaffAccess from '../components/LeadStaffAccess';
import LeadProposals from '../components/LeadProposals';
import LeadOutcome from '../components/LeadOutcome';
import { commercialStatus, formatFollowUp, leadCommercialService, validLeadId } from '../services/leadCommercial.service';

export default function LeadOpportunityPage() {
  const { idSolicitud = '' } = useParams<{ idSolicitud: string }>();
  const valid = validLeadId(idSolicitud);
  const [access, setAccess] = useState<{ requestId: string; token: string } | null>(null);
  const query = useQuery({
    queryKey: ['lead', 'opportunity', idSolicitud],
    queryFn: ({ signal }) => leadCommercialService.detail(idSolicitud, signal),
    enabled: valid,
    retry: false,
  });
  const data = query.data;
  const open = data && !data.oportunidad.archivada_lead_en &&
    !['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(data.oportunidad.resultado_comercial_lead ?? '');
  const editAccess = open && access?.requestId === idSolicitud ? access : undefined;

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <Link to="/lead" className="underline">Volver a oportunidades</Link>
      <h1 className="text-2xl font-semibold">{valid ? `Solicitud #${idSolicitud}` : 'Oportunidad LEAD'}</h1>
      {!valid && <p role="alert">Identificador de solicitud inválido.</p>}
      {valid && query.isPending && <p role="status">Cargando oportunidad…</p>}
      {query.isError && (
        <div role="alert">
          <p>{query.error.message}</p>
          <button className="underline" onClick={() => void query.refetch()}>Reintentar</button>
        </div>
      )}
      {data && (
        <>
          <section className="space-y-2 rounded-lg border bg-white p-4" aria-labelledby="resumen-lead">
            <h2 id="resumen-lead" className="text-lg font-semibold">Resumen comercial</h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt>Paciente</dt><dd>{data.cabecera.paciente}</dd></div>
              <div><dt>Servicio</dt><dd>{data.cabecera.servicio ?? 'Sin registrar'}</dd></div>
              <div><dt>Negociador</dt><dd>{data.cabecera.negociador ?? 'Sin asignar'}</dd></div>
              <div><dt>Ingreso documentado</dt><dd>{data.oportunidad.ingreso_lead_documentado.slice(0, 10)}</dd></div>
              <div><dt>Resultado</dt><dd>{commercialStatus(data.oportunidad.resultado_comercial_lead)}</dd></div>
              <div><dt>Archivo</dt><dd>{data.oportunidad.archivada_lead_en ? 'Archivada' : 'Sin archivar'}</dd></div>
              <div><dt>Motivo de consulta</dt><dd>{data.oportunidad.motivo ?? 'Sin registrar'}</dd></div>
              <div><dt>Próximo seguimiento (Lima)</dt><dd>{formatFollowUp(data.oportunidad.fecha_proximo_seguimiento)}</dd></div>
              <div><dt>Valor acordado</dt><dd>{data.oportunidad.valor_acordado_lead == null ? 'Sin registrar' : `S/ ${data.oportunidad.valor_acordado_lead}`}</dd></div>
            </dl>
          </section>
          <LeadAlternatives key={`alternatives-${idSolicitud}`} data={data} requestId={idSolicitud}
            token={access?.requestId === idSolicitud ? access.token : null} />
          <LeadProposals key={`proposals-${idSolicitud}`} data={data} access={editAccess} />
          <LeadOutcome key={`outcome-${idSolicitud}`} data={data} access={editAccess} />
          <LeadActivity key={`activity-${idSolicitud}`} data={data} requestId={idSolicitud} token={editAccess?.token} />
          <LeadPayerReadiness key={`payer-${idSolicitud}`} requestId={idSolicitud}
            token={access?.requestId === idSolicitud ? access.token : undefined} />
          {(import.meta.env.VITE_LEAD_STAFF_AUTH_QA === 'true' ||
            import.meta.env.VITE_LEAD_STAFF_AUTH_ENABLED === 'true') &&
            <LeadStaffAccess key={`staff-${idSolicitud}`} requestId={idSolicitud}
              qa={import.meta.env.VITE_LEAD_STAFF_AUTH_QA === 'true'}
              onToken={token => setAccess(token ? { requestId: idSolicitud, token } : null)}
              currentFollowUp={data.oportunidad.fecha_proximo_seguimiento}
              editable={!data.oportunidad.archivada_lead_en &&
                data.oportunidad.resultado_comercial_lead !== 'ACEPTADA' &&
                data.oportunidad.resultado_comercial_lead !== 'CERRADA_SIN_ACUERDO'} />}
        </>
      )}
    </main>
  );
}
