import { useEffect, useId, useState, type ReactNode } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { LEAD_INDICATORS } from '@/modules/lead/lib/leadIndicators';
import { SegmentedControl } from './SegmentedControl';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const root = API + '/lead/commercial';
type Report = 'R1' | 'R2' | 'R3';
type Row = Record<string, string | number | boolean | null | undefined>;
type Catalogs = Record<string, Row[] | string | null>;
type Filters = Record<string, string>;
type ReportData = { queryKey: string; rows: Row[]; summary?: Row; cutoff: string | null };
const reports = {
  R1: {
    title: 'Reporte de Resultados de Negociaciones Comerciales',
    objective: 'Evaluar las oportunidades ingresadas a LEAD, su resultado comercial y el valor de los acuerdos alcanzados.',
  },
  R2: {
    title: 'Reporte de Precios, Promociones y Motivos de Rechazo',
    objective: 'Analizar los precios y las promociones ofrecidos, junto con los resultados y motivos de rechazo de las propuestas económicas.',
  },
  R3: {
    title: 'Reporte de Preferencias y Alternativas de Atención',
    objective: 'Comparar los horarios preferidos y ofrecidos, y revisar los resultados, cambios y motivos de rechazo de las alternativas de atención.',
  },
};
const reportTabs = (Object.keys(reports) as Report[]).map(value => ({ value, label: reports[value].title }));
const indicatorByReport = { R1: LEAD_INDICATORS[0], R2: LEAD_INDICATORS[1], R3: LEAD_INDICATORS[2] };
const pageSize = 10;
const wholeNumber = new Intl.NumberFormat('es-PE');
const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const decimal = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cutoffLima = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'medium',
});

export function leadPercent(value: Row[string]) {
  return value == null ? 'No calculable' : decimal.format(Number(value)) + ' %';
}

function dateLabel(value: Row[string]) {
  const [year, month, day] = String(value ?? '').slice(0, 10).split('-');
  return day ? [day, month, year].join('/') : '—';
}

function todayLima() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
}

export function leadReportQuery(report: Report, filters: Filters, now = new Date()) {
  const [year, month] = filters.periodo.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const query = new URLSearchParams({ inicio: filters.periodo + '-01', fin_exclusivo: end });
  for (const [key, value] of Object.entries(filters)) {
    if (!value || key === 'periodo' || key === 'corte') continue;
    if (key === 'pref_horario' || key === 'ofr_horario') {
      const [day, shift] = JSON.parse(value) as [number, string];
      const prefix = key.slice(0, 3);
      query.set(prefix + '_dia', String(day));
      query.set(prefix + '_turno', shift);
      continue;
    }
    if (key === 'id_promocion' && value === 'sin-promocion') query.set('con_promocion', 'false');
    else query.set(key, value);
  }
  if (report === 'R1') {
    const endOfCutoff = new Date(filters.corte + 'T23:59:59.999-05:00');
    query.set('corte_utc', new Date(Math.min(endOfCutoff.getTime(), now.getTime())).toISOString());
  }
  return query;
}

function money(value: Row[string]) {
  return value == null ? '—' : decimal.format(Number(value));
}

function timeLabel(value: Row[string]) {
  return String(value ?? '').match(/(?:T|^)(\d{2}:\d{2})/)?.[1] ?? '';
}

function schedule(day: Row[string], shift: Row[string], start: Row[string], end: Row[string], date?: Row[string]) {
  const dayLabel = day ? days[Number(day) - 1] : '';
  const interval = timeLabel(start) && timeLabel(end) ? timeLabel(start) + '–' + timeLabel(end) : '';
  return <>{[dayLabel, shift].filter(Boolean).join(' · ') || (date ? dateLabel(date) : 'Sin especificar')}
    {interval && <span className="block text-xs text-slate-500">{interval}</span>}
    {date && dayLabel && <span className="block text-xs text-slate-500">{dateLabel(date)}</span>}</>;
}

function ReportTable({ label, columns, children, footer }: {
  label: string; columns: string[]; children: ReactNode; footer?: ReactNode;
}) {
  return <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500"
    tabIndex={0} role="region" aria-label={label}>
    <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"><tr>
        {columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-4 py-3">{column}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50 dark:[&>tr:hover]:bg-slate-800/50">{children}</tbody>
      {footer && <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">{footer}</tfoot>}
    </table>
  </div>;
}

const cell = 'px-4 py-3 text-sm tabular-nums';
const control = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 [color-scheme:light] dark:[color-scheme:dark]';
const filterLabel = 'grid min-w-0 gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300';
const action = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

function ReportIndicator({ report, totals }: { report: Report; totals?: Row }) {
  const indicator = indicatorByReport[report];
  const accepted = Number(totals?.Aceptadas ?? 0);
  const rejected = Number((report === 'R1' ? totals?.CerradasSinAcuerdo : totals?.Rechazadas) ?? 0);
  const resolved = accepted + rejected;
  const numerator = report === 'R1' ? accepted : Number((report === 'R2' ? totals?.RechazosEconomicos : totals?.RechazadasIncompatibilidad) ?? 0);
  const rate = report === 'R1' ? totals?.AceptacionPorcentaje : report === 'R2' ? totals?.L2Porcentaje : totals?.L3Porcentaje;
  const measures = {
    R1: [
      { code: 'M1', label: 'Oportunidades aceptadas', value: accepted },
      { code: 'M2', label: 'Oportunidades cerradas sin acuerdo', value: rejected },
    ],
    R2: [
      { code: 'M3', label: 'Propuestas aceptadas', value: accepted },
      { code: 'M4', label: 'Propuestas rechazadas por cualquier motivo', value: rejected },
      { code: 'M5', label: 'Propuestas rechazadas por motivos económicos', value: numerator },
    ],
    R3: [
      { code: 'M6', label: 'Alternativas aceptadas', value: accepted },
      { code: 'M7', label: 'Alternativas rechazadas por cualquier motivo', value: rejected },
      { code: 'M8', label: 'Alternativas rechazadas por incompatibilidad de atención', value: numerator },
    ],
  }[report];
  return (
    <section aria-label={`Indicador ${indicator.code}`} className="grid overflow-hidden rounded-xl border border-teal-200/80 dark:border-teal-900/80 lg:grid-cols-[1.15fr_1fr]">
      <div className="bg-teal-50/70 p-5 dark:bg-teal-950/30">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{indicator.code} · {indicator.label}</h3>
        <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-teal-800 dark:text-teal-300">{leadPercent(rate)}</p>
        <p className="mt-2 text-xs tabular-nums text-slate-600 dark:text-slate-400">{numerator} de {resolved} {indicator.unit}</p>
      </div>
      <div className="flex flex-col justify-center border-t border-teal-200/80 p-5 dark:border-teal-900/80 lg:border-l lg:border-t-0">
        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">Cómo se calcula</h4>
        <p className="mt-2 font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{indicator.formula}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {resolved > 0 ? `(${numerator} ÷ ${resolved}) × 100` : `Sin ${indicator.unit} para los filtros seleccionados.`}
        </p>
      </div>
      <dl aria-label="Medidas del indicador" className={'grid gap-3 border-t border-teal-200/80 bg-slate-50/70 p-4 dark:border-teal-900/80 dark:bg-slate-950/40 lg:col-span-2 ' + (report === 'R1' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        {measures.map(measure => (
          <div key={measure.code} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <dt className="flex gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-teal-700 dark:text-teal-300">{measure.code}</span>
              {measure.label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{wholeNumber.format(measure.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function readReportResponse<T>(path: string, signal: AbortSignal): Promise<{ body: T; headers: Headers }> {
  const response = await fetch(root + path, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No fue posible cargar el reporte.');
  return { body, headers: response.headers };
}

export function LeadReportsPanel({ initialPeriod }: { initialPeriod?: string | null }) {
  const panelId = useId();
  const today = todayLima();
  const defaults = { periodo: initialPeriod && /^\d{4}-(0[1-9]|1[0-2])$/.test(initialPeriod) ? initialPeriod : today.slice(0, 7), corte: today };
  const [report, setReport] = useState<Report>('R1');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [catalogs, setCatalogs] = useState<Catalogs>({});
  const [catalogError, setCatalogError] = useState('');
  const [loadedResult, setResult] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const queryKey = JSON.stringify([report, filters]);
  const result = loadedResult?.queryKey === queryKey ? loadedResult : null;

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    readReportResponse<Catalogs>('/report-catalogs', controller.signal).then(({ body }) => {
      if (!controller.signal.aborted) setCatalogs(body);
    }).catch(err => {
      if (!controller.signal.aborted) setCatalogError(err.message);
    });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setResult(null);
    setError('');
    if (!filters.periodo || (report === 'R1' && !filters.corte)) {
      setLoading(false);
      return () => controller.abort();
    }
    const query = leadReportQuery(report, filters);
    readReportResponse<Row[] | { detalle: Row[]; resumen: Row[] }>(
      '/reports/' + report + '?' + query, controller.signal,
    ).then(({ body, headers }) => {
      if (controller.signal.aborted) return;
      setResult({
        queryKey,
        ...(Array.isArray(body) ? { rows: body } : { rows: body.detalle, summary: body.resumen[0] }),
        cutoff: headers.get('X-Lead-Cutoff-Utc') ?? query.get('corte_utc'),
      });
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, report, queryKey, retry]);

  function field(key: string, value: string) {
    setPage(1);
    setFilters(current => ({ ...current, [key]: value }));
  }

  function catalog(key: string) {
    const items = catalogs[key];
    return Array.isArray(items) ? items : [];
  }

  function select(label: string, key: string, options: { id: string; name: string }[], all = 'Todos') {
    return <label className={filterLabel}>{label}
      <select className={control} value={filters[key] ?? ''} onChange={e => field(key, e.target.value)}>
        <option value="">{all}</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>;
  }

  function catalogSelect(label: string, key: string, source: string, name = 'nombre', sourceKey = key) {
    return select(label, key, catalog(source).map(item => ({ id: String(item[sourceKey]), name: String(item[name]) })));
  }

  function hours(prefix: 'pref' | 'ofr', label: string) {
    const shifts = [...new Set(catalog('horarios').map(item => item[prefix + '_turno_lead']).filter(Boolean).map(String))].sort();
    const options = days.flatMap((day, index) => shifts.map(shift => ({
      id: JSON.stringify([index + 1, shift]),
      name: day + ' · ' + shift,
    })));
    return select(label, prefix + '_horario', options);
  }

  const rows = result?.rows ?? [];
  const summary = result?.summary;
  const r1Total = rows.find(row => row.EsTotal);
  const professionals = Array.from(new Map(catalog('horarios').map(item => [
    String(item.id_profesional), { id: String(item.id_profesional), name: String(item.profesional) },
  ])).values());
  const cutoff = result?.cutoff ? new Date(result.cutoff) : null;
  const validCutoff = cutoff != null && Number.isFinite(cutoff.getTime());
  const detailRows = report === 'R1' ? rows.filter(row => !row.EsTotal) : rows;
  const totalPages = Math.max(1, Math.ceil(detailRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstRow = (currentPage - 1) * pageSize;
  const pageRows = detailRows.slice(firstRow, firstRow + pageSize);
  const totalChanges = report === 'R3' ? rows.reduce((sum, row) => sum + Number(row.NumeroCambios ?? 0), 0) : 0;

  return <section aria-label="Reportes LEAD" className="min-w-0 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><BarChart3 aria-hidden="true" className="h-5 w-5" /></span>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Gestión Comercial LEAD</h1>
      </div>
      <button type="button" className={action} disabled={loading} onClick={() => setRetry(value => value + 1)}>
        <RefreshCw aria-hidden="true" className={'h-3.5 w-3.5 ' + (loading ? 'motion-safe:animate-spin' : '')} />Actualizar consulta
      </button>
    </header>
    <div className="px-5 pt-5 sm:px-6">
      <SegmentedControl options={reportTabs} value={report} controls={panelId} ariaLabel="Reportes de la etapa LEAD"
        className="grid w-full gap-1 sm:grid-cols-3 [&>button]:h-auto [&>button]:min-h-10 [&>button]:whitespace-normal [&>button]:px-3 [&>button]:py-2 [&>button]:text-left [&>button]:text-xs"
        onChange={key => { if (report !== key) { setReport(key); setFilters(defaults); setPage(1); } }} />
    </div>
    <div id={panelId} role="tabpanel" aria-label={reports[report].title} className="space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{reports[report].title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{reports[report].objective}</p>
      </div>
      <section aria-label="Filtros del reporte" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">        <div className="flex items-center justify-between gap-2">          <h3 className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-slate-500" />Filtros del reporte</h3>          <button type="button" className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300" onClick={() => { setFilters(defaults); setPage(1); }}>Limpiar filtros</button>
        </div>        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">          <label className={filterLabel}>{report === 'R1' ? 'Período de ingreso a LEAD' : 'Período'}            <input className={control} type="month" value={filters.periodo} onChange={e => field('periodo', e.target.value)} />          </label>          {report === 'R1' && <label className={filterLabel}>Fecha de corte            <input className={control} type="date" max={today} value={filters.corte} onChange={e => field('corte', e.target.value)} />          </label>}          {catalogSelect('Tratamiento', 'id_servicio', 'servicios')}          {report === 'R1' && catalogSelect('Canal de origen', 'id_canal', 'canales')}          {report !== 'R2' && catalogSelect(report === 'R1' ? 'Sede de interés' : 'Sede ofrecida', 'id_sede', 'sedes')}          {report === 'R1' && catalogSelect('Negociador', 'id_negociador', 'negociadores', 'nombre', 'id_usuario')}          {report === 'R2' && select('Promoción', 'id_promocion', [
            { id: 'sin-promocion', name: 'Sin promoción' },
            ...catalog('promociones').map(item => ({ id: String(item.id_promocion), name: String(item.nombre) })),
          ], 'Todas')}
          {report === 'R3' && <>            {select('Profesional ofrecido', 'id_profesional', professionals)}            {hours('pref', 'Horario preferido')}            {hours('ofr', 'Horario ofrecido')}          </>}        </div>
        {report === 'R3' && <p className="text-xs text-slate-500 dark:text-slate-400">Los horarios se filtran por día y franja. El período corresponde a la fecha en que se presentó la alternativa.</p>}
      </section>      {loading && <p role="status" className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Cargando reporte…</p>}      {(error || catalogError) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error || catalogError} <button type="button" className={action}        onClick={() => setRetry(retry + 1)}>Reintentar</button></p>}      {result && <>        <ReportIndicator report={report} totals={report === 'R1' ? r1Total : summary} />        {report === 'R1' && validCutoff && <p className="text-xs text-slate-500 dark:text-slate-400">
          Corte aplicado al <time dateTime={result.cutoff!}>{cutoffLima.format(cutoff)} (Lima)</time>.
        </p>}
        {detailRows.length === 0 && <p>Sin registros para los filtros seleccionados.</p>}
        {report === 'R1' && <>          <h3 className="font-semibold">Resultados de oportunidades comerciales por tratamiento</h3>
          <ReportTable label="Resultados de oportunidades comerciales por tratamiento"
            columns={['Tratamiento', 'Ingresadas', 'Aceptadas', 'Cerradas sin acuerdo', 'Pendientes', 'Aceptación %', 'Valor acordado (S/)']}
            footer={r1Total && <R1Row row={r1Total} />}>
            {pageRows.map(row => <R1Row key={[row.Mes, row.Tratamiento].join('|')} row={row} />)}
          </ReportTable>
          {Number(r1Total?.SinResultadoDocumentado ?? 0) > 0 &&            <p className="text-sm text-slate-500">Sin resultado documentado: {r1Total?.SinResultadoDocumentado}.</p>}        </>}        {report === 'R2' && <>          <div>
            <h3 className="font-semibold">Resultados de las propuestas económicas</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{rows.length} propuestas encontradas · Importes en soles (S/)</p>
          </div>
          <ReportTable label="Resultados de las propuestas económicas" columns={['Fecha / Propuesta', 'Tratamiento', 'Precio cotizado (S/)', 'Promoción aplicada', 'Resultado', 'Motivo de rechazo']}>
            {pageRows.map(row => <tr key={String(row.id_propuesta_logica)}>
              <td className={cell}><strong>PROP-{row.id_propuesta_logica}</strong><br />{dateLabel(row.fecha_presentacion)}</td>              <td className={cell}>{row.Tratamiento ?? 'Sin tratamiento'}</td><td className={cell}>{money(row.PrecioCotizado)}</td>              <td className={cell}>{row.ConPromocion === false ? 'Sin promoción' : row.PromocionAplicada}</td><td className={cell}>{row.Resultado ?? 'Sin evidencia'}</td>              <td className={cell}>{row.MotivoRechazo ?? '—'}</td>            </tr>)}          </ReportTable>        </>}        {report === 'R3' && <>          <div>
            <h3 className="font-semibold">Registro y resultados de alternativas de atención</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{rows.length} alternativas encontradas</p>
          </div>
          <ReportTable label="Registro y resultados de alternativas de atención"
            columns={['Solicitud / Alternativa', 'Horario preferido', 'Horario ofrecido', 'Resultado', 'Motivo de rechazo', 'N.º cambios']}
            footer={summary && <tr>
              <th scope="row" colSpan={3} className={cell}>Total · {summary.Presentadas} alternativas</th>
              <td className={cell}>{summary.Aceptadas} aceptadas · {summary.Rechazadas} rechazadas · {summary.Pendientes} pendientes</td>
              <td className={cell}>—</td>
              <td className={cell}>{totalChanges}</td>
            </tr>}>
            {pageRows.map(row => <tr key={String(row.id_opcion)}>
              <td className={cell}><strong>SOL-{row.id_solicitud}</strong><br />ALT-{row.id_opcion}<br />Presentada {dateLabel(row.fecha_ofrecida)}</td>              <td className={cell}>{schedule(row.pref_dia_semana_lead, row.pref_turno_lead, row.pref_hora_inicio_lead, row.pref_hora_fin_lead, row.pref_fecha_lead)}</td>              <td className={cell}>{schedule(row.DiaOfrecido, row.ofr_turno_lead, row.HoraInicioOfrecida, row.HoraFinOfrecida, row.FechaAtencionOfrecida)}</td>              <td className={cell}>{row.Resultado ?? 'Sin evidencia'}</td><td className={cell}>{row.MotivoRechazo ?? '—'}</td>              <td className={cell}>{row.NumeroCambios ?? 0}</td>            </tr>)}          </ReportTable>        </>}        {totalPages > 1 && (
          <nav aria-label="Paginación del reporte" className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              Filas {firstRow + 1}–{firstRow + pageRows.length} de {detailRows.length}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={action} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />Anterior
              </button>
              <span className="px-1 text-xs tabular-nums">Página {currentPage} de {totalPages}</span>
              <button type="button" className={action} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                Siguiente<ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </nav>
        )}
      </>}
    </div>
  </section>;
}

function R1Row({ row }: { row: Row }) {
  const values = [row.Tratamiento, row.Ingresadas, row.Aceptadas, row.CerradasSinAcuerdo,
    row.Pendientes ?? 0, leadPercent(row.AceptacionPorcentaje), money(row.ValorAcordadoSoles)];
  return <tr>{values.map((value, index) => <td className={cell} key={index}>{value}</td>)}</tr>;
}
