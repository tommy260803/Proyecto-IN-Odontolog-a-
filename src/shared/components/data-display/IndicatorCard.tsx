import type { IndicatorResult } from '@/domain/indicators';
import { HelpCircle, Calendar } from 'lucide-react';

export function IndicatorCard({ indicator, period }: { indicator: IndicatorResult, period: string }) {
  let statusBadge = {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    label: 'Óptimo'
  };
  
  if (indicator.status === 'amber') {
    statusBadge = {
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200/80',
      dot: 'bg-amber-500',
      label: 'En Alerta'
    };
  } else if (indicator.status === 'red') {
    statusBadge = {
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200/80',
      dot: 'bg-rose-500',
      label: 'Crítico'
    };
  }

  let displayValue = '';
  if (indicator.format === 'percentage') displayValue = indicator.value.toFixed(1) + '%';
  else if (indicator.format === 'number') displayValue = indicator.value.toFixed(1) + ' ' + (indicator.unit || '');
  else if (indicator.format === 'currency') displayValue = 'S/ ' + indicator.value.toFixed(2);
  else if (indicator.format === 'time') displayValue = indicator.value.toFixed(0) + ' ' + (indicator.unit || 'días');

  return (
    <div className="relative group bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 hover:border-teal-500/40 dark:hover:border-teal-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
      {/* Top Bar: ID + Name + Tooltip */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-800 text-teal-300 shadow-sm">
              {indicator.id}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.bg} ${statusBadge.color} ${statusBadge.border}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot} animate-pulse`} />
              {statusBadge.label}
            </span>
          </div>
          <div title={`Fórmula: ${indicator.formula}`} className="cursor-help text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug line-clamp-2 min-h-[32px]">
          {indicator.name}
        </p>
      </div>

      {/* Main Metric Value */}
      <div className="my-3 flex items-baseline gap-2">
        <h3 className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {displayValue}
        </h3>
      </div>

      {/* Bottom Sub-info */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
          <span className="truncate max-w-[140px]">{period}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 font-medium transition-colors">
          BI Metrix
        </span>
      </div>
    </div>
  );
}
