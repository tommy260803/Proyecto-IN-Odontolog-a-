import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/shared/utils/index';
import { Calendar, Filter, RotateCcw, TrendingUp } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const root = API + '/lead/commercial';
type Report = 'R1' | 'R2' | 'R3';
type Row = Record<string, string | number | boolean | null | undefined>;
type Catalogs = Record<string, Row[] | string | null>;
type Filters = Record<string, string>;
type ReportData = { rows: Row[]; summary?: Row };
const titles = {
  R1: 'Resultados de Negociaciones Comerciales',
  R2: 'Precios, Promociones y Motivos de Rechazo',
  R3: 'Preferencias y Alternativas de Atención',
};
const tabFriendlyNames: Record<Report, string> = {
  R1: 'Resultados de Negociación',
  R2: 'Precios y Rechazos',
  R3: 'Horarios y Disponibilidad',
};
const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const decimal = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function ReportTable({ columns, children, footer }: { columns: string[]; children: ReactNode; footer?: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200/80 bg-slate-50/90 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"><tr>
        {columns.map(column => <th key={column} scope="col" className="px-3.5 py-2.5">{column}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      {footer && <tfoot className="border-t-2 border-slate-200 font-semibold bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40">{footer}</tfoot>}
    </table>
  </div>;
}

const cell = 'px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300';
const control = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-2xs';

function reportGroups(report: 'R2' | 'R3', rows: Row[], sedeName: (id: Row[string]) => string) {
  const grouped = new Map<string, { labels: string[]; total: number }>();
  for (const row of rows) {
    const labels = report === 'R2'
      ? [String(row.Tratamiento ?? 'Sin tratamiento'), row.ConPromocion ? 'Con promoción' : 'Sin promoción', String(row.Resultado ?? 'Sin evidencia')]
      : [sedeName(row.id_sede),
         [days[Number(row.DiaOfrecido) - 1], row.ofr_turno_lead, timeLabel(row.HoraInicioOfrecida) + '–' + timeLabel(row.HoraFinOfrecida)].filter(Boolean).join(' · '),
         String(row.Resultado ?? 'Sin evidencia')];
    const key = JSON.stringify(labels);
    const group = grouped.get(key) ?? { labels, total: 0 };
    group.total++;
    grouped.set(key, group);
  }
  return Array.from(grouped.values()).sort((a, b) => a.labels.join(' ').localeCompare(b.labels.join(' '), 'es'));
}

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(root + path, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No fue posible cargar el reporte.');
  return body;
}

export function LeadReportsPanel() {
  const today = todayLima();
  const defaults = { periodo: today.slice(0, 7), corte: today };
  const [report, setReport] = useState<Report>('R1');
  const [filters, setFilters] = useState<Filters>(defaults);
  const [catalogs, setCatalogs] = useState<Catalogs>({});
  const [catalogError, setCatalogError] = useState('');
  const [result, setResult] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    readJson<Catalogs>('/report-catalogs', controller.signal).then(setCatalogs).catch(err => {
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
    readJson<Row[] | { detalle: Row[]; resumen: Row[] }>(
      '/reports/' + report + '?' + leadReportQuery(report, filters), controller.signal,
    ).then(data => {
      if (controller.signal.aborted) return;
      setResult(Array.isArray(data) ? { rows: data } : { rows: data.detalle, summary: data.resumen[0] });
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, report, retry]);

  function field(key: string, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  function catalog(key: string) {
    const items = catalogs[key];
    return Array.isArray(items) ? items : [];
  }

  function select(label: string, key: string, options: { id: string; name: string }[], all = 'Todos') {
    return <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}
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
    return <fieldset className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</legend>
      <div className="grid grid-cols-2 gap-2 mt-1">
        {select('Día ' + label.toLowerCase(), prefix + '_dia', days.map((name, index) => ({ id: String(index + 1), name })))}
        {select('Franja ' + label.toLowerCase(), prefix + '_turno', shifts.map(name => ({ id: name, name })))}
      </div>
    </fieldset>;
  }

  const rows = result?.rows ?? [];
  const summary = result?.summary;
  const r1Total = rows.find(row => row.EsTotal);
  const reasonOptions = catalog('motivos').filter(row => row.ambito === (report === 'R2' ? 'PROPUESTA' : 'ALTERNATIVA'));
  const professionals = Array.from(new Map(catalog('horarios').map(item => [
    String(item.id_profesional), { id: String(item.id_profesional), name: String(item.profesional) },
  ])).values());
  const summaryLabel = filters.id_motivo ? 'Totales del indicador con los demás filtros, para conservar el denominador' : 'Totales';
  const names = new Map(catalog('sedes').map(item => [String(item.id_sede), String(item.nombre)]));
  const groups = report === 'R1' ? [] : reportGroups(report, rows, id => names.get(String(id)) ?? 'Sin sede');

  return (
    <section aria-label="Reportes LEAD" className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-900">
      {/* Selector de sub-reporte */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div aria-label="Reportes de la etapa LEAD" className="flex flex-wrap gap-2">
          {(Object.keys(titles) as Report[]).map(key => (
            <button
              type="button"
              key={key}
              aria-label={key}
              aria-pressed={report === key}
              onClick={() => { setReport(key); setFilters(defaults); }}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none',
                report === key
                  ? 'bg-teal-700 text-white shadow-sm dark:bg-teal-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
            >
              <span className="font-mono">{key}</span>
              <span className="hidden sm:inline">· {tabFriendlyNames[key]}</span>
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400">
          Mesa de Cotizaciones & Agenda
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-lg bg-teal-50 px-2 py-0.5 font-mono text-xs font-bold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
          {report}
        </span>
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
          {report}. {titles[report]}
        </h2>
      </div>

      {/* Grid de Filtros */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" />
          <span>Filtros de Análisis</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Filtros del reporte">
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            {report === 'R1' ? 'Período de ingreso a LEAD' : 'Período de presentación'}
            <input className={control} type="month" value={filters.periodo} onChange={e => field('periodo', e.target.value)} />
          </label>
          {report === 'R1' && <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">Fecha de corte
            <input className={control} type="date" max={today} value={filters.corte} onChange={e => field('corte', e.target.value)} />
          </label>}
          {catalogSelect('Tratamiento', 'id_servicio', 'servicios')}
          {report === 'R1' && catalogSelect('Canal de origen', 'id_canal', 'canales')}
          {report === 'R1' && catalogSelect('Fuente de captación', 'id_fuente', 'fuentes')}
          {catalogSelect(report === 'R1' ? 'Sede de interés' : report === 'R3' ? 'Sede ofrecida' : 'Sede', 'id_sede', 'sedes')}
          {report === 'R1' && catalogSelect('Negociador', 'id_negociador', 'negociadores', 'nombre', 'id_usuario')}
          {report === 'R2' && <>
            {select('Promoción aplicada', 'id_promocion', [
              { id: 'sin-promocion', name: 'Sin promoción' },
              ...catalog('promociones').map(item => ({ id: String(item.id_promocion), name: String(item.nombre) })),
            ], 'Todas')}
            <fieldset className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">Rango de precios (S/)</legend>
              <div className="grid grid-cols-2 gap-2 mt-1">{['min', 'max'].map((key, index) =>
                <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300" key={key}>{index === 0 ? 'Mínimo' : 'Máximo'}
                  <input type="number" min="0" step="0.01" className={control} value={filters['precio_' + key] ?? ''}
                    onChange={e => field('precio_' + key, e.target.value)} />
                </label>)}</div>
            </fieldset>
          </>}
          {report === 'R3' && <>
            {select('Profesional ofrecido', 'id_profesional', professionals)}
            {hours('pref', 'Horario preferido')}
            {hours('ofr', 'Horario ofrecido')}
          </>}
          {report !== 'R1' && select('Motivo de rechazo', 'id_motivo', reasonOptions.map(row => ({
            id: String(row.id_motivo_rechazo), name: String(row.motivo),
          })))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
            onClick={() => setFilters(defaults)}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpiar filtros</span>
          </button>

          {report === 'R1' && (
            <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                checked={filters.desglosar_canal === 'true'}
                onChange={e => field('desglosar_canal', e.target.checked ? 'true' : '')}
              />
              <span>Desglosar por canal de origen</span>
            </label>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500 justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p role="status">Cargando reporte…</p>
        </div>
      )}

      {(error || catalogError) && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <span>{error || catalogError}</span>
          <button type="button" className={control} onClick={() => setRetry(retry + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {rows.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">
              Sin registros para los filtros seleccionados.
            </p>
          )}

          {report === 'R1' && (
            <>
              <div className="flex items-center justify-between rounded-xl border border-teal-200/70 bg-teal-50/60 p-3.5 dark:border-teal-800/60 dark:bg-teal-950/40">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    L1 · Tasa de aceptación de oportunidades comerciales: {leadPercent(r1Total?.AceptacionPorcentaje)}
                  </p>
                </div>
              </div>

              <ReportTable
                columns={[
                  'Tratamiento',
                  ...(filters.desglosar_canal ? ['Canal de origen'] : []),
                  'Ingresadas',
                  'Aceptadas',
                  'Cerradas sin acuerdo',
                  'Pendientes',
                  'Aceptación %',
                  'Valor acordado (S/)',
                ]}
                footer={r1Total && <R1Row row={r1Total} channel={filters.desglosar_canal === 'true' ? '—' : undefined} />}
              >
                {rows.filter(row => !row.EsTotal).map(row => (
                  <R1Row
                    key={[row.Mes, row.Tratamiento, row.IdCanal].join('|')}
                    row={row}
                    channel={filters.desglosar_canal === 'true'
                      ? String(catalog('canales').find(c => c.id_canal === row.IdCanal)?.nombre ?? 'Sin canal')
                      : undefined}
                  />
                ))}
              </ReportTable>

              {Number(r1Total?.SinResultadoDocumentado ?? 0) > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sin resultado documentado: {r1Total?.SinResultadoDocumentado}.
                </p>
              )}
            </>
          )}

          {report === 'R2' && (
            <>
              <div className="flex items-center justify-between rounded-xl border border-teal-200/70 bg-teal-50/60 p-3.5 dark:border-teal-800/60 dark:bg-teal-950/40">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    L2 · Tasa de rechazo por motivos económicos: {leadPercent(summary?.L2Porcentaje)}
                  </p>
                </div>
              </div>

              <ReportTable columns={['Fecha / Propuesta', 'Tratamiento', 'Precio cotizado (S/)', 'Promoción aplicada', 'Resultado', 'Motivo de rechazo']}>
                {rows.map(row => (
                  <tr key={String(row.id_propuesta_logica)}>
                    <td className={cell}>PROP-{row.id_propuesta_logica}<br /><span className="text-slate-400">{dateLabel(row.fecha_presentacion)}</span></td>
                    <td className={cn(cell, 'font-medium')}>{row.Tratamiento}</td>
                    <td className={cn(cell, 'font-mono')}>{money(row.PrecioCotizado)}</td>
                    <td className={cell}>{row.PromocionAplicada}</td>
                    <td className={cell}>
                      <span className={cn(
                        'rounded-md px-1.5 py-0.5 font-medium text-[11px]',
                        String(row.Resultado).includes('Acept') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        String(row.Resultado).includes('Rech') ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      )}>
                        {row.Resultado ?? 'Sin evidencia'}
                      </span>
                    </td>
                    <td className={cn(cell, 'text-slate-500')}>{row.MotivoRechazo ?? '—'}</td>
                  </tr>
                ))}
              </ReportTable>

              {summary && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {summaryLabel} · Presentadas {summary.Presentadas} · Aceptadas {summary.Aceptadas} · Rechazadas {summary.Rechazadas} · Pendientes {summary.Pendientes} · Aceptación {leadPercent(summary.AceptacionPorcentaje)}
                </p>
              )}
            </>
          )}

          {report === 'R3' && (
            <>
              <div className="flex items-center justify-between rounded-xl border border-teal-200/70 bg-teal-50/60 p-3.5 dark:border-teal-800/60 dark:bg-teal-950/40">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    L3 · Tasa de rechazo por incompatibilidad: {leadPercent(summary?.L3Porcentaje)}
                  </p>
                </div>
              </div>

              <ReportTable columns={['Solicitud / Alternativa', 'Horario preferido', 'Horario ofrecido', 'Resultado', 'Motivo de rechazo', 'N.º cambios']}>
                {rows.map(row => (
                  <tr key={String(row.id_opcion)}>
                    <td className={cell}>SOL-{row.id_solicitud} / ALT-{row.id_opcion}<br /><span className="text-slate-400">{dateLabel(row.fecha_ofrecida)}</span></td>
                    <td className={cell}>{schedule(row.pref_dia_semana_lead, row.pref_turno_lead, row.pref_hora_inicio_lead, row.pref_hora_fin_lead, row.pref_fecha_lead)}</td>
                    <td className={cell}>{schedule(row.DiaOfrecido, row.ofr_turno_lead, row.HoraInicioOfrecida, row.HoraFinOfrecida, row.FechaAtencionOfrecida)}</td>
                    <td className={cell}>
                      <span className={cn(
                        'rounded-md px-1.5 py-0.5 font-medium text-[11px]',
                        String(row.Resultado).includes('Acept') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        String(row.Resultado).includes('Rech') ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      )}>
                        {row.Resultado ?? 'Sin evidencia'}
                      </span>
                    </td>
                    <td className={cn(cell, 'text-slate-500')}>{row.MotivoRechazo ?? '—'}</td>
                    <td className={cn(cell, 'font-mono text-center')}>{row.NumeroCambios ?? 0}</td>
                  </tr>
                ))}
              </ReportTable>

              {summary && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {summaryLabel} · Presentadas {summary.Presentadas} · Aceptadas {summary.Aceptadas} · Rechazadas {summary.Rechazadas} · Pendientes {summary.Pendientes} · Modificadas {summary.Modificadas}
                </p>
              )}
            </>
          )}

          {groups.length > 0 && (
            <details className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <summary className="cursor-pointer font-semibold text-xs text-slate-800 dark:text-slate-200">
                {report === 'R2' ? 'Desglose por tratamiento, promoción y resultado' : 'Desglose por sede, horario ofrecido y resultado'}
              </summary>
              <div className="mt-3">
                <ReportTable columns={report === 'R2' ? ['Tratamiento', 'Condición comercial', 'Resultado', 'Propuestas'] : ['Sede', 'Horario ofrecido', 'Resultado', 'Alternativas']}>
                  {groups.map(group => (
                    <tr key={JSON.stringify(group.labels)}>
                      {group.labels.map((value, i) => (
                        <td key={i} className={cell}>{value}</td>
                      ))}
                      <td className={cn(cell, 'font-mono font-semibold')}>{group.total}</td>
                    </tr>
                  ))}
                </ReportTable>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function R1Row({ row, channel }: { row: Row; channel?: string }) {
  const values = [
    row.Tratamiento,
    ...(channel === undefined ? [] : [channel]),
    row.Ingresadas,
    row.Aceptadas,
    row.CerradasSinAcuerdo,
    row.Pendientes ?? 0,
    leadPercent(row.AceptacionPorcentaje),
    money(row.ValorAcordadoSoles)
  ];
  return (
    <tr className={cn(row.EsTotal && 'font-semibold bg-slate-50/90 dark:bg-slate-800/60')}>
      {values.map((value, index) => (
        <td className={cn(cell, index >= 2 && 'font-mono')} key={index}>{value}</td>
      ))}
    </tr>
  );
}
