import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadCommercialService, type OpportunityDetail, type Candidate } from '../services/leadCommercial.service';
import LeadOfferForm from './LeadOfferForm';
import LeadAlternativeDecision from './LeadAlternativeDecision';

const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function schedule(day: string | null, start: string | null, end: string | null, shift?: string | null) {
  const time = start && end ? `${start}–${end}` : start ?? end;
  return [day, time, shift].filter(Boolean).join(' · ') || 'Sin horario documentado';
}

type OfferEdit = { option: number; revision: string };

function CandidateSearch({ requestId, data, token, edit, finishEdit }: {
  requestId: string; data: OpportunityDetail; token: string | null; edit: OfferEdit | null; finishEdit: (saved?: boolean) => void;
}) {
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState({ day: '', page: 1 });
  const { day, page } = search;
  const query = useQuery({
    queryKey: ['lead', 'availability', requestId, day, page],
    queryFn: ({ signal }) => leadCommercialService.availability(requestId, day, page, signal),
    enabled: Boolean(day),
    retry: false,
  });

  return (
    <section className="mt-4 border-t pt-4" id="agenda-lead">
      <h3 className="font-semibold">Horarios candidatos</h3>
      {edit && <p>Selecciona un horario para modificar la opción #{edit.option}. <button className="underline" type="button" onClick={() => finishEdit()}>Salir de modificación</button></p>}
      <p>Consulta de agenda en hora de Lima. La disponibilidad puede cambiar.</p>
      <form className="my-3 flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        const date = new FormData(event.currentTarget).get('fecha');
        if (typeof date === 'string' && date) {
          setSelected(null);
          setSaved(false);
          if (date === day && page === 1) void query.refetch();
          else setSearch({ day: date, page: 1 });
        }
      }}>
        <label className="grid gap-1">Fecha de atención
          <input name="fecha" type="date" required className="rounded border px-3 py-2" />
        </label>
        <button className="rounded border px-3 py-2" type="submit">Consultar agenda</button>
      </form>
      {day && query.isPending && <p role="status">Consultando horarios…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {query.data && (
        <>
          <p className="font-medium">Resultados para {day}</p>
          {query.data.candidatas.length === 0 && <p>No hay horarios elegibles en esta página.</p>}
          <ul className="divide-y">
            {query.data.candidatas.map(slot => (
              <li key={slot.id_disponibilidad} className="py-2">
                {slot.inicio}–{slot.fin} · {slot.sede} · {slot.profesional}
                {token && <button type="button" className="ml-3 underline" onClick={() => { setSaved(false); setSelected(slot); }}>
                  {edit ? 'Usar para la modificación' : 'Preparar oferta'}
                </button>}
              </li>
            ))}
          </ul>
          {selected && token && <LeadOfferForm key={selected.id_disponibilidad} candidate={selected} data={data}
            requestId={requestId} token={token} edit={edit} done={confirmed => {
              setSelected(null);
              if (edit && confirmed) finishEdit(true);
              else setSaved(confirmed);
            }} />}
          {saved && <p role="status">Oferta registrada.</p>}
          {(page > 1 || query.data.hay_siguiente) && (
            <nav aria-label="Páginas de agenda" className="flex gap-3">
              <button className="underline disabled:opacity-50" disabled={page === 1} onClick={() => setSearch({ day, page: page - 1 })}>Anterior</button>
              <span>Página {page}</span>
              <button className="underline disabled:opacity-50" disabled={!query.data.hay_siguiente} onClick={() => setSearch({ day, page: page + 1 })}>Siguiente</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default function LeadAlternatives({ data, requestId, token }: { data: OpportunityDetail; requestId: string; token: string | null }) {
  const [edit, setEdit] = useState<OfferEdit | null>(null);
  const [modified, setModified] = useState(false);
  const conditions = new Map(data.condiciones_ofrecidas.map(item => [item.id_opcion, item]));
  const { archivada_lead_en: archived, resultado_comercial_lead: result } = data.oportunidad;
  const open = !archived && result !== 'ACEPTADA' && result !== 'CERRADA_SIN_ACUERDO';
  const currentEdit = token ? edit : null;
  return (
    <details className="rounded-lg border bg-white p-4">
      <summary className="cursor-pointer font-semibold">Alternativas ({data.alternativas.length})</summary>
      <section className="mt-3">
        <h3 className="font-semibold">Preferencias del paciente</h3>
        {data.preferencias.length === 0 && <p>No hay preferencias registradas.</p>}
        <ul className="divide-y">
          {data.preferencias.map(preference => (
            <li key={preference.id_preferencia} className="py-2">
              <p>Desde {preference.fecha_inicio.slice(0, 10)}{preference.fecha_fin ? ` hasta ${preference.fecha_fin.slice(0, 10)}` : ''}{preference.ServicioInteres && ` · ${preference.ServicioInteres.nombre}`}</p>
              <p>{schedule(weekdays[preference.Horario?.dia_semana ?? -1] ?? null, preference.Horario?.hora_inicio?.slice(11, 16) ?? null, preference.Horario?.hora_fin?.slice(11, 16) ?? null)}</p>
              <p>Sede: {preference.sede_preferida ?? 'Sin registrar'} · Profesional: {preference.profesional_preferido ?? 'Sin registrar'}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4 border-t pt-4">
        <h3 className="font-semibold">Ofertas registradas</h3>
        {modified && <p role="status">Modificación registrada.</p>}
        {data.alternativas.length === 0 && <p>No hay alternativas registradas.</p>}
        <ul className="divide-y">
          {data.alternativas.map(option => {
            const offer = conditions.get(option.id_opcion);
            const changes = data.modificaciones.filter(change => change.id_opcion === option.id_opcion);
            const canManage = token && open && offer && !option.archivada_lead_en && option._count.Reservas === 0 &&
              !option.seleccionada && option.estado_respuesta !== 'Aceptada';
            return (
              <li className="space-y-1 py-3" key={option.id_opcion}>
                <p className="font-medium">Opción #{option.id_opcion} · {option.estado_respuesta ?? 'Sin respuesta documentada'}{option.archivada_lead_en && ' · Archivada'}</p>
                {offer ? (
                  <>
                    <p>Horario preferido en el último registro: {schedule(offer.dia_preferido ?? weekdays[offer.dia_semana_preferido ?? -1] ?? null, offer.inicio_preferido, offer.fin_preferido, offer.turno_preferido)}</p>
                    <p>Último horario registrado: {schedule(offer.dia, offer.inicio, offer.fin, offer.turno_ofrecido)} · {offer.sede} · {offer.profesional} · S/ {offer.precio}</p>
                    <p>{offer.origen === 'INSERT' ? 'Registro inicial de oferta' : 'Primer estado observado en auditoría'}: {schedule(offer.dia_inicial, offer.inicio_inicial, offer.fin_inicial)} · {offer.sede_inicial} · {offer.profesional_inicial} · S/ {offer.precio_inicial}</p>
                    {option.estado_respuesta === 'Rechazada' && (
                      <p>Motivo: {offer.motivo_rechazo ?? 'Sin motivo documentado'}{offer.categoria_rechazo === 'INCOMPATIBILIDAD' && ' · Incompatibilidad registrada'}</p>
                    )}
                  </>
                ) : <p>Sin condiciones documentadas en el historial.</p>}
                <p>Modificaciones registradas: {changes.length}</p>
                {changes.length > 0 && (
                  <details>
                    <summary className="cursor-pointer underline">Ver modificaciones</summary>
                    <ul className="ml-4 list-disc">
                      {changes.map(change => <li key={change.id_cambio}>{change.motivo_cambio}{change.valor_anterior && change.valor_nuevo && ` (${change.valor_anterior} → ${change.valor_nuevo})`}</li>)}
                    </ul>
                  </details>
                )}
                {canManage && (
                  <>
                    {option.estado_respuesta === 'Pendiente' && <a href="#agenda-lead" className="underline"
                      onClick={() => { setModified(false); setEdit({ option: option.id_opcion, revision: offer.revision }); }}>Modificar horario o turno</a>}
                    <LeadAlternativeDecision key={offer.revision} requestId={requestId} option={option.id_opcion} revision={offer.revision}
                      token={token} pending={option.estado_respuesta === 'Pendiente'} canArchive />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {open && <CandidateSearch key={currentEdit ? `edit-${currentEdit.option}-${currentEdit.revision}` : 'new'}
        requestId={requestId} data={data} token={token} edit={currentEdit} finishEdit={saved => { setEdit(null); setModified(Boolean(saved)); }} />}
    </details>
  );
}
