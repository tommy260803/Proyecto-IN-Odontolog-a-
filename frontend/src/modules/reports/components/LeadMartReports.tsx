import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, BarChart3, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { LEAD_INDICATORS, formatLeadRate } from '@/modules/lead/lib/leadIndicators';

type Code = 'L1' | 'L2' | 'L3';
type Counts = { aceptadas: number; rechazadas: number; especiales: number };
type MartReport = { rows: (Counts & { servicio: string; grupo: string })[]; totals: Counts; source: string; consultedAt: string };
type Catalogs = Record<string, { id: number; nombre: string }[]>;
const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/reports/lead-management';
const filterLabels: Record<string, string> = {
  KeyServicio: 'Tratamiento', KeyCanal: 'Canal de origen', KeySede: 'Sede', KeyNegociador: 'Negociador',
  KeyPromocion: 'Promoción', KeyProfesional: 'Profesional', KeyHorarioPreferido: 'Horario preferido', KeyHorarioOfrecido: 'Horario ofrecido',
};
const reportFilters = {
  L1: ['KeyServicio', 'KeyCanal', 'KeySede', 'KeyNegociador'],
  L2: ['KeyServicio', 'KeyPromocion'],
  L3: ['KeyServicio', 'KeySede', 'KeyProfesional', 'KeyHorarioPreferido', 'KeyHorarioOfrecido'],
};
const inputClass = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 [color-scheme:light] dark:[color-scheme:dark]';
async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo consultar el reporte.');
  return body;
}
export function martRate(code: Code, counts: Counts) {
  const denominator = counts.aceptadas + counts.rechazadas;
  return denominator > 0 ? 100 * (code === 'L1' ? counts.aceptadas : counts.especiales) / denominator : null;
}

export function LeadMartReports({ period }: { period: string }) {
  const [code, setCode] = useState<Code>('L1');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [periodChoice, setPeriodChoice] = useState({ parent: period, value: period });
  const selectedPeriod = periodChoice.parent === period ? periodChoice.value : period;
  const query = new URLSearchParams({ report: code, period: selectedPeriod, ...filters }).toString();
  const catalogs = useQuery({ queryKey: ['reports', 'lead-dimensions'], queryFn: ({ signal }) => getJson<Catalogs>(API + '/catalogs', signal), staleTime: 300000 });
  const data = useQuery({ queryKey: ['reports', 'lead-management', query], queryFn: ({ signal }) => getJson<MartReport>(API + '?' + query, signal), staleTime: 30000 });
  const indicator = LEAD_INDICATORS.find(item => item.code === code)!;
  const totals = data.data?.totals;
  const numerator = totals ? code === 'L1' ? totals.aceptadas : totals.especiales : 0;
  const denominator = totals ? totals.aceptadas + totals.rechazadas : 0;
  const rate = totals ? martRate(code, totals) : null;
  const refresh = () => { void data.refetch(); void catalogs.refetch(); };
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Reportes dimensionales LEAD">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><BarChart3 className="h-5 w-5" /></div>
        <div><h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Gestión comercial LEAD</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Oportunidades, propuestas y alternativas de atención</p></div>
      </div>
      <button type="button" onClick={refresh} disabled={data.isFetching} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        <RefreshCw className={'h-3.5 w-3.5 ' + (data.isFetching ? 'animate-spin' : '')} />Actualizar consulta
      </button>
    </header>
    <div className="space-y-5 p-5 sm:p-6">
      <div className="grid gap-2 md:grid-cols-3" aria-label="Seleccionar indicador LEAD">
        {LEAD_INDICATORS.map(item => <button key={item.code} type="button" aria-label={item.code + ' · ' + item.label} aria-pressed={code === item.code}
          onClick={() => { setCode(item.code); setFilters({}); }}
          className={'flex items-start gap-3 rounded-lg border p-3 text-left transition ' + (code === item.code
            ? 'border-teal-500 bg-teal-50/60 text-teal-900 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-200'
            : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800')}>
          <span className="text-xs font-bold">{item.code}</span><span className="text-xs font-medium leading-5">{item.label}</span>
        </button>)}
      </div>
      <section aria-label="Filtros dimensionales" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><SlidersHorizontal className="h-3.5 w-3.5" />Filtros del reporte</h3>
          <button type="button" onClick={() => setFilters({})} className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300">Limpiar filtros</button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="grid min-w-0 gap-1.5">
            <label className="grid gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Período (mes)
              <input type="month" className={inputClass} value={selectedPeriod === 'all' ? '' : selectedPeriod}
                onChange={event => setPeriodChoice({ parent: period, value: event.target.value || 'all' })} />
            </label>
            <button type="button" aria-pressed={selectedPeriod === 'all'} onClick={() => setPeriodChoice({ parent: period, value: 'all' })}
              className="w-fit text-[11px] font-medium text-teal-700 hover:underline dark:text-teal-300">{selectedPeriod === 'all' ? 'Mostrando todo el historial' : 'Ver todo el historial'}</button>
          </div>
          {reportFilters[code].map(key => <label key={key} className="grid min-w-0 gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{filterLabels[key]}
            <select className={inputClass} value={filters[key] || ''} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}>
              <option value="">Todos</option>{(catalogs.data?.[key.startsWith('KeyHorario') ? 'KeyHorario' : key] || []).map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>)}
        </div>
      </section>
      {(data.isError || catalogs.isError) && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        {(data.error || catalogs.error)?.message} <button onClick={refresh} type="button" className="font-semibold underline">Reintentar</button>
      </div>}
      {data.isPending && <p role="status" className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Consultando los hechos de LEAD…</p>}
      {data.isSuccess && <>
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <article className="rounded-xl border border-teal-200 bg-teal-50/40 p-5 dark:border-teal-900 dark:bg-teal-950/25">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{indicator.code} · {indicator.label}</h3>
            <p className="my-3 text-3xl font-semibold tabular-nums tracking-tight text-teal-800 dark:text-teal-300">{formatLeadRate(rate)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{numerator} / {denominator} {indicator.unit} × 100</p>
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400">{code === 'L1' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{indicator.goal}</p>
          </article>
          <div className="flex flex-col justify-center rounded-xl border border-slate-200 p-5 dark:border-slate-800">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cómo se calcula</p>
            <p className="mt-2 font-mono text-sm text-slate-800 dark:text-slate-200">{indicator.formula}</p>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Se suman las medidas antes de dividir. Los pendientes se excluyen. Sin casos resueltos, el indicador es «No calculable».</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Desglose de resultados</h3></div>
          <div className="overflow-x-auto" role="region" aria-label="Desglose dimensional LEAD" tabIndex={0}>
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400"><tr>
                {['Tratamiento', code === 'L1' ? 'Sede / Negociador' : code === 'L2' ? 'Promoción' : 'Sede / Profesional / Horario ofrecido', 'Aceptadas', code === 'L1' ? 'Sin acuerdo' : 'Rechazadas', ...(code === 'L1' ? [] : [code === 'L2' ? 'Por economía' : 'Por incompatibilidad']), indicator.code + ' (%)'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.data.rows.map((row, index) => <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.servicio}</td><td className="px-4 py-3">{row.grupo}</td>
                <td className="px-4 py-3 tabular-nums">{row.aceptadas}</td><td className="px-4 py-3 tabular-nums">{row.rechazadas}</td>
                {code !== 'L1' && <td className="px-4 py-3 tabular-nums">{row.especiales}</td>}<td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{formatLeadRate(martRate(code, row))}</td>
              </tr>)}</tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"><tr>
                <th scope="row" colSpan={2} className="px-4 py-3">Total del período filtrado</th><td className="px-4 py-3">{totals?.aceptadas}</td><td className="px-4 py-3">{totals?.rechazadas}</td>
                {code !== 'L1' && <td className="px-4 py-3">{totals?.especiales}</td>}<td className="whitespace-nowrap px-4 py-3">{formatLeadRate(rate)}</td>
              </tr></tfoot>
            </table>
          </div>
          {data.data.rows.length === 0 && <p className="p-5 text-center text-sm text-slate-500 dark:text-slate-400">Sin resultados cargados en el Mart para estos filtros.</p>}
        </div>
        <footer className="flex flex-wrap justify-between gap-2 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
          <span>Fuente: NexoSalud_Mart · Período: {selectedPeriod === 'all' ? 'Histórico completo' : selectedPeriod}</span>
          <span>Consulta: {new Date(data.data.consultedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Lima)</span>
          <p className="w-full">Estos resultados corresponden al último poblamiento disponible. Actualizar consulta vuelve a leer el Mart; no ejecuta el ETL.</p>
        </footer>
      </>}
    </div>
  </section>;
}
