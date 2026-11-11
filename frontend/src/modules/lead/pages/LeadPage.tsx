import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { commercialStatus, formatFollowUp, leadCommercialService, validLeadId } from '../services/leadCommercial.service';

const states = [
  ['todas', 'Todas'],
  ['pendientes', 'Pendientes'],
  ['aceptadas', 'Aceptadas'],
  ['cerradas', 'Cerradas sin acuerdo'],
  ['sin_evidencia', 'Sin resultado documentado'],
  ['archivadas', 'Archivadas'],
];
const followUps = [
  ['todos', 'Todos'], ['vencido', 'Vencido'], ['hoy', 'Hoy'], ['futuro', 'Futuro'], ['sin_programar', 'Sin programar'],
];
const additionalFilters = ['id_servicio', 'id_negociador', 'ingreso_desde', 'ingreso_hasta', 'seguimiento'];

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const [url, setUrl] = useSearchParams();
  const pageParam = url.get('pagina') ?? '';
  const page = validLeadId(pageParam) ? Number(pageParam) : 1;
  const search = id === undefined ? (url.get('buscar') ?? '').trim().slice(0, 100) : '';
  const state = id === undefined ? url.get('estado') ?? 'todas' : 'todas';
  const params = new URLSearchParams({ pagina: String(page), estado: state });
  if (search) params.set('buscar', search);
  if (id !== undefined) params.set('id_persona', id);
  if (id === undefined) {
    for (const filter of additionalFilters) {
      const value = url.get(filter);
      if (value) params.set(filter, value);
    }
  }
  const validPerson = id === undefined || validLeadId(id);
  const query = useQuery({
    queryKey: ['lead', 'opportunities', params.toString()],
    queryFn: ({ signal }) => leadCommercialService.list(params, signal),
    enabled: validPerson,
    retry: false,
  });
  const catalogs = useQuery({
    queryKey: ['lead', 'opportunity-filters'],
    queryFn: ({ signal }) => leadCommercialService.filters(signal),
    enabled: id === undefined,
    retry: false,
  });

  const goToPage = (next: number) => setUrl(current => {
    const updated = new URLSearchParams(current);
    updated.set('pagina', String(next));
    return updated;
  });

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{id === undefined ? 'Oportunidades LEAD' : 'Selecciona una solicitud'}</h1>
        <Link className="underline" to={id === undefined ? '/reportes?tab=lead' : '/lead'}>
          {id === undefined ? 'Reportes LEAD' : 'Todas las oportunidades'}
        </Link>
      </header>
      {id === undefined && (
        <form key={params.toString()} className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const filters = new URLSearchParams();
          const term = String(fields.get('buscar') ?? '').trim();
          if (term) filters.set('buscar', term);
          filters.set('estado', String(fields.get('estado')));
          for (const filter of additionalFilters) {
            const value = fields.get(filter);
            if (typeof value === 'string' && value) filters.set(filter, value);
            if (value === null && params.has(filter)) filters.set(filter, params.get(filter)!);
          }
          setUrl(filters);
        }}>
          <label className="grid gap-1">Paciente o número de solicitud
            <input className="rounded border px-3 py-2" name="buscar" defaultValue={search} maxLength={100} />
          </label>
          <label className="grid gap-1">Estado
            <select className="rounded border px-3 py-2" name="estado" defaultValue={state}>
              {states.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {catalogs.data && (
            <>
              <label className="grid gap-1">Servicio
                <select className="rounded border px-3 py-2" name="id_servicio" defaultValue={params.get('id_servicio') ?? ''}>
                  <option value="">Todos</option>
                  {catalogs.data.servicios.map(service => <option key={service.id_servicio} value={service.id_servicio}>{service.nombre}</option>)}
                </select>
              </label>
              <label className="grid gap-1">Negociador
                <select className="rounded border px-3 py-2" name="id_negociador" defaultValue={params.get('id_negociador') ?? ''}>
                  <option value="">Todos</option>
                  {catalogs.data.negociadores.map(user => <option key={user.id_usuario} value={user.id_usuario}>{user.nombre}</option>)}
                </select>
              </label>
            </>
          )}
          {catalogs.isError && <button type="button" className="underline" onClick={() => void catalogs.refetch()}>Volver a cargar servicios y negociadores</button>}
          <label className="grid gap-1">Ingreso desde
            <input className="rounded border px-3 py-2" type="date" name="ingreso_desde" defaultValue={params.get('ingreso_desde') ?? ''} />
          </label>
          <label className="grid gap-1">Ingreso hasta
            <input className="rounded border px-3 py-2" type="date" name="ingreso_hasta" defaultValue={params.get('ingreso_hasta') ?? ''} />
          </label>
          <label className="grid gap-1">Seguimiento
            <select className="rounded border px-3 py-2" name="seguimiento" defaultValue={params.get('seguimiento') ?? 'todos'}>
              {followUps.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="rounded border px-3 py-2" type="submit">Buscar</button>
          <Link to="/lead" className="underline">Limpiar filtros</Link>
        </form>
      )}
      {!validPerson && <p role="alert">Identificador de paciente inválido.</p>}
      {validPerson && query.isPending && <p role="status">Cargando solicitudes…</p>}
      {query.isError && (
        <div role="alert">
          <p>{query.error.message}</p>
          <button className="underline" onClick={() => void query.refetch()}>Reintentar</button>
        </div>
      )}
      {query.data && (
        <>
          {query.data.oportunidades.length === 0 && <p>No hay oportunidades documentadas en esta página.</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {query.data.oportunidades.map(row => (
              <li className="rounded-lg border bg-white p-4" key={row.id_solicitud}>
                <Link className="font-semibold underline" to={`/lead/oportunidades/${row.id_solicitud}`}>
                  Solicitud #{row.id_solicitud} · {row.nombres} {row.apellidos}
                </Link>
                <p>{row.servicio ?? 'Servicio sin registrar'}</p>
                <p>{commercialStatus(row.resultado_comercial_lead)}{row.archivada_lead_en && ' · Archivada'}</p>
                <p>Ingreso {row.dia_ingreso} · {row.negociador ?? 'Sin negociador asignado'}</p>
                <p>Primera respuesta: {row.fecha_primera_respuesta?.slice(0, 10) ?? 'Sin registrar'}</p>
                <p>Última interacción: {row.ultima_interaccion?.slice(0, 10) ?? 'Sin registrar'}</p>
                {row.estado_seguimiento && <p>Seguimiento: {formatFollowUp(row.fecha_proximo_seguimiento)}
                  {row.prioridad_operativa === 1 && ' · Vencido'}
                  {row.prioridad_operativa === 2 && ' · Hoy'}
                </p>}
                {row.prioridad_operativa === 3 && <p className="font-medium">Pendiente sin primera respuesta registrada</p>}
              </li>
            ))}
          </ul>
          <nav aria-label="Páginas de oportunidades" className="flex flex-wrap items-center gap-3">
            <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={page === 1} onClick={() => goToPage(page - 1)}>Anterior</button>
            <span>Página {page}</span>
            <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={!query.data.hay_siguiente} onClick={() => goToPage(page + 1)}>Siguiente</button>
          </nav>
        </>
      )}
    </main>
  );
}
