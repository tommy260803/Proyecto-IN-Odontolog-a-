import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leadCommercialService } from '../services/leadCommercial.service';

export default function LeadAlternativeDecision({ requestId, option, revision, token, pending, canArchive }: {
  requestId: string; option: number; revision: string; token: string; pending: boolean; canArchive: boolean;
}) {
  const client = useQueryClient();
  const [action, setAction] = useState<'aceptar' | 'rechazar' | 'archivar' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reasons = useQuery({
    queryKey: ['lead', 'alternative-reasons'],
    queryFn: ({ signal }) => leadCommercialService.reasons(signal),
    enabled: action === 'rechazar',
  });
  const options = reasons.data?.motivos.filter(reason => reason.ambito === 'ALTERNATIVA') ?? [];
  return (
    <div className="space-y-2">
      {!action ? <div className="flex flex-wrap gap-3">
        {pending && <><button className="underline" type="button" onClick={() => setAction('aceptar')}>Registrar aceptación</button>
          <button className="underline" type="button" onClick={() => setAction('rechazar')}>Registrar rechazo</button></>}
        {canArchive && <button className="underline" type="button" onClick={() => setAction('archivar')}>Archivar</button>}
      </div> : <form className="space-y-2 rounded border p-3" onSubmit={async event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        setBusy(true); setError('');
        try {
          await leadCommercialService.changeAlternative(requestId, option, token, action === 'archivar'
            ? { accion: 'archivar', revision }
            : { accion: 'decidir', revision, estado: action === 'aceptar' ? 'Aceptada' : 'Rechazada',
                id_motivo_rechazo_lead: fields.get('motivo') || null });
          setAction(null);
          await client.invalidateQueries({ queryKey: ['lead', 'opportunity', requestId] });
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : 'No se pudo completar la acción.');
        } finally { setBusy(false); }
      }}>
        <p>{action === 'archivar' ? 'Archivar conserva la oferta y su historial.' :
          'Confirma que el paciente comunicó esta decisión.'}</p>
        {action === 'rechazar' && (
          <label className="grid gap-1">Motivo de rechazo
            <select name="motivo" className="rounded border p-2" required>
              <option value="">{reasons.isFetching ? 'Cargando motivos…' : options.length ? 'Selecciona un motivo' : 'Sin motivos activos'}</option>
              {options.map(reason => <option key={reason.id_motivo_rechazo} value={reason.id_motivo_rechazo}>{reason.motivo}</option>)}
            </select>
          </label>
        )}
        {action === 'rechazar' && reasons.isError && <button type="button" className="underline" onClick={() => void reasons.refetch()}>Reintentar carga de motivos</button>}
        <div className="flex gap-3">
          <button className="rounded border px-3 py-1" type="submit" disabled={busy || (action === 'rechazar' && !options.length)}>
            {action === 'archivar' ? 'Confirmar archivo' : 'Guardar decisión'}
          </button>
          <button type="button" className="underline" disabled={busy} onClick={() => { setAction(null); setError(''); }}>Volver</button>
        </div>
        {error && <p role="alert">{error}</p>}
      </form>}
    </div>
  );
}
