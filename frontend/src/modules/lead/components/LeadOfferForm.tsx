import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { leadCommercialService, type Candidate, type OpportunityDetail } from '../services/leadCommercial.service';

const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';

export default function LeadOfferForm({ candidate, data, requestId, token, done, edit }: {
  candidate: Candidate; data: OpportunityDetail; requestId: string; token: string; done: (saved: boolean) => void;
  edit?: { option: number; revision: string } | null;
}) {
  const client = useQueryClient();
  const [expected] = useState(() => data.alternativas.map(option => option.id_opcion));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState('');
  const proposals = data.propuestas.filter(item => item.orden_version === 1 && item.estado !== 'Rechazada');
  const selected = proposals.find(item => String(item.id_propuesta) === proposal);
  const now = Date.now();
  const preferences = data.preferencias.filter(item => Date.parse(item.fecha_inicio) <= now &&
    (item.fecha_fin == null || Date.parse(item.fecha_fin) > now));
  return (
    <form className="my-3 space-y-3 rounded border p-3" onSubmit={async event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setBusy(true); setError('');
      try {
        if (edit) {
          await leadCommercialService.changeAlternative(requestId, edit.option, token, {
            ...candidate, accion: 'modificar', revision: edit.revision,
            turno_ofrecido: fields.get('turno'), motivo_cambio: fields.get('motivo_cambio'),
          });
        } else {
          const result = await fetch(root + `/opportunities/${requestId}/alternatives`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...candidate, opciones_esperadas: expected, precio_ofrecido: selected?.precio_cotizado ?? fields.get('precio'),
              id_propuesta: proposal || null, id_preferencia: fields.get('preferencia') || null,
              turno_ofrecido: fields.get('turno'), turno_preferido: fields.get('turno_preferido') || null,
            }),
          });
          const body = await result.json().catch(() => null);
          if (!result.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo registrar la oferta.');
        }
        await client.invalidateQueries({ queryKey: ['lead', 'opportunity', requestId] });
        done(true);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'No se pudo registrar la oferta.');
      } finally { setBusy(false); }
    }}>
      <h4 className="font-semibold">{edit ? `Modificar opción #${edit.option}` : 'Confirmar oferta'} · {candidate.dia} {candidate.inicio}–{candidate.fin}</h4>
      <p>{candidate.sede} · {candidate.profesional}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {!edit && <><label className="grid gap-1">Propuesta vinculada
          <select className="rounded border p-2" value={proposal} onChange={event => setProposal(event.target.value)}>
            <option value="">Cotización manual</option>
            {proposals.map(item => <option key={item.id_propuesta} value={item.id_propuesta}>
              Propuesta #{item.id_propuesta_logica} · versión {item.numero_version} · S/ {item.precio_cotizado}
            </option>)}
          </select>
        </label>
        {selected ? <p>Precio ofrecido: S/ {selected.precio_cotizado}</p> : <label className="grid gap-1">Precio ofrecido (S/)
          <input className="rounded border p-2" type="number" name="precio" min="0" max="99999999.99" step="0.01" required />
        </label>}</>}
        <label className="grid gap-1">Turno ofrecido
          <input className="rounded border p-2" name="turno" maxLength={30} required />
        </label>
        {!edit && <><label className="grid gap-1">Preferencia registrada
          <select className="rounded border p-2" name="preferencia">
            <option value="">Sin preferencia documentada</option>
            {preferences.map(item =>
              <option key={item.id_preferencia} value={item.id_preferencia}>
                Preferencia #{item.id_preferencia} · {item.sede_preferida ?? 'Sede sin especificar'}
              </option>)}
          </select>
        </label>
        <label className="grid gap-1">Turno preferido declarado (opcional)
          <input className="rounded border p-2" name="turno_preferido" maxLength={30} />
        </label></>}
        {edit && <label className="grid gap-1">Motivo del cambio
          <input className="rounded border p-2" name="motivo_cambio" maxLength={300} required />
        </label>}
      </div>
      <p>{edit ? 'Se conservarán el precio y la preferencia de la oferta.' : 'Al confirmar se registrará una alternativa ofrecida a esta solicitud.'}</p>
      <div className="flex gap-3">
        <button className="rounded border px-3 py-2" type="submit" disabled={busy}>{edit ? 'Guardar modificación' : 'Confirmar oferta'}</button>
        <button className="underline" type="button" onClick={() => done(false)} disabled={busy}>Volver a la agenda</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
