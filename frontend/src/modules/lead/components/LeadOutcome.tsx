import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { commercialStatus, type OpportunityDetail } from '../services/leadCommercial.service';

const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';

export default function LeadOutcome({ data, access }: {
  data: OpportunityDetail; access?: { requestId: string; token: string };
}) {
  const client = useQueryClient();
  const [mode, setMode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const accepted = data.propuestas.filter(p => p.orden_version === 1 && p.estado === 'Aceptada' && p.fecha_decision);
  const row = data.oportunidad;
  return (
    <section className="space-y-2 rounded-lg border bg-white p-4" aria-label="Resultado comercial">
      <h2 className="font-semibold">Resultado comercial de la solicitud</h2>
      <p>{commercialStatus(row.resultado_comercial_lead)}
        {row.fecha_decision_comercial_lead && ` · ${row.fecha_decision_comercial_lead.slice(0, 10)}`}</p>
      {row.motivo_cierre_lead && <p>Motivo: {row.motivo_cierre_lead}</p>}
      {saved && <p role="status">Resultado comercial guardado.</p>}
      {access && (
        <form className="space-y-3" onSubmit={async event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          setBusy(true); setError('');
          try {
            const response = await fetch(root + `/opportunities/${access.requestId}/staff/outcome`, {
              method: 'POST', headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ resultado: mode, confirmado: fields.has('confirmado'),
                id_propuesta: fields.get('propuesta'), motivo: fields.get('motivo') }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'No se pudo guardar el resultado.');
            setMode('');
            setSaved(true);
            await Promise.all([
              client.invalidateQueries({ queryKey: ['lead', 'opportunity', access.requestId] }),
              client.invalidateQueries({ queryKey: ['lead', 'opportunities'] }),
              client.invalidateQueries({ queryKey: ['lead', 'payer-readiness', access.requestId] }),
            ]);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'No se pudo guardar el resultado.');
          } finally { setBusy(false); }
        }}>
          <label className="grid max-w-xs gap-1">Registrar resultado
            <select className="rounded border p-2" value={mode} onChange={event => { setMode(event.target.value); setError(''); }}>
              <option value="">Selecciona un resultado</option>
              <option value="ACEPTADA" disabled={!accepted.length}>Acuerdo comercial</option>
              <option value="CERRADA_SIN_ACUERDO">Cierre sin acuerdo</option>
            </select>
          </label>
          {!accepted.length && <p>Para registrar un acuerdo hace falta una cotización vigente aceptada.</p>}
          {mode === 'ACEPTADA' && (
            <label className="grid max-w-xs gap-1">Cotización aceptada
              <select className="rounded border p-2" name="propuesta" required defaultValue="">
                <option value="">Selecciona una versión</option>
                {accepted.map(p => <option key={p.id_propuesta} value={p.id_propuesta}>
                  Propuesta #{p.id_propuesta_logica} · versión {p.numero_version} · S/ {p.precio_cotizado}
                </option>)}
              </select>
            </label>
          )}
          {mode === 'CERRADA_SIN_ACUERDO' && (
            <label className="grid max-w-md gap-1">Motivo del cierre
              <textarea className="rounded border p-2" name="motivo" maxLength={400} required />
            </label>
          )}
          {mode && (
            <>
              <label className="flex gap-2" key={mode}><input type="checkbox" name="confirmado" required />
                {mode === 'ACEPTADA' ? 'Confirmo que el paciente aceptó expresamente este acuerdo.' :
                  'Confirmo el cierre de la solicitud sin acuerdo.'}
              </label>
              <button className="rounded border px-3 py-2" type="submit" disabled={busy || saved}>Guardar resultado</button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}
