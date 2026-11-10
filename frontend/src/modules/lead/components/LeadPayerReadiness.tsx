import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadCommercialService } from '../services/leadCommercial.service';

const labels = { cumple: 'Cumple', bloqueado: 'Bloqueado', pendiente: 'Pendiente de verificación' };

export default function LeadPayerReadiness({ requestId }: { requestId: string }) {
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({
    queryKey: ['lead', 'payer-readiness', requestId],
    queryFn: ({ signal }) => leadCommercialService.payerReadiness(requestId, signal),
    enabled: expanded,
    retry: false,
  });

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
        </>
      )}
    </details>
  );
}
