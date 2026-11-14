import { useId, useState, type ReactNode } from 'react';
import { formatAppointmentTime } from '@/shared/utils/appointmentTime';

type ProposalVersion = {
  precio?: string | number | null;
  sede?: string | null;
  especialista?: string | null;
  fecha?: string | null;
  inicio?: string | null;
  fin?: string | null;
  vigencia?: string | null;
  promocion?: string | null;
  condiciones?: string | null;
  servicio?: string | null;
};

const expiryFormat = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima', hour12: true,
});

function fields(proposal: ProposalVersion) {
  const expiry = proposal.vigencia ? new Date(proposal.vigencia) : null;
  return [
    ['Tarifa', proposal.precio == null ? '' : `S/ ${Number(proposal.precio).toFixed(2)}`],
    ['Sede', proposal.sede?.trim() ?? ''],
    ['Especialista', proposal.especialista?.trim() ?? ''],
    ['Fecha de la cita', proposal.fecha ?? ''],
    ['Horario', proposal.inicio && proposal.fin ? formatAppointmentTime(`${proposal.inicio} - ${proposal.fin}`) : ''],
    ['Tarifa vigente hasta', expiry && !Number.isNaN(expiry.getTime()) ? expiryFormat.format(expiry) : ''],
    ['Promoción', proposal.promocion ?? ''],
    ['Tratamiento', proposal.servicio?.trim() ?? ''],
  ] as const;
}

export function LeadProposalVersions({ initial, current, actions }: {
  initial?: ProposalVersion;
  current: ProposalVersion;
  actions: ReactNode;
}) {
  const id = useId();
  const [tab, setTab] = useState(1);
  const latest = fields(current);
  const original = initial ? fields(initial) : latest;
  const changed = latest.map(([, value], index) => original[index][1] !== value);
  const hasChanges = changed.some(Boolean);
  const active = hasChanges ? tab : 1;
  return <div className="min-w-0 space-y-3">
    <div onClick={event => event.stopPropagation()} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
      {hasChanges && <div role="tablist" aria-label="Versiones de la propuesta" className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
        {['Propuesta inicial', 'Propuesta actualizada'].map((label, index) => <button key={label} type="button" role="tab"
          id={`${id}-${index}`} aria-controls={`${id}-panel`} aria-selected={active === index} tabIndex={active === index ? 0 : -1}
          onClick={() => setTab(index)} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
            setTab(next);
            document.getElementById(`${id}-${next}`)?.focus();
          }} className={`rounded-md px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-teal-600 ${active === index
            ? 'bg-white text-teal-800 shadow-sm dark:bg-slate-800 dark:text-teal-300'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}>
          {label}
        </button>)}
      </div>}
      <div className="ml-auto flex items-center gap-1">{active === 1 && actions}</div>
    </div>
    <div id={`${id}-panel`} role={hasChanges ? 'tabpanel' : undefined} aria-labelledby={hasChanges ? `${id}-${active}` : undefined}>
      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        {(active === 0 ? original : latest).map(([label, value], index) => (value || changed[index]) && <div key={label}
          className={active === 1 && changed[index] ? 'rounded-md border-l-2 border-teal-600 bg-teal-50 px-2 py-1 dark:border-teal-400 dark:bg-teal-950/60' : 'px-2 py-1'}>
          <dt className="font-medium text-slate-500 dark:text-slate-400">{label}
            {active === 1 && changed[index] && <span className="sr-only"> (actualizado)</span>}</dt>
          <dd className={`mt-0.5 break-words text-slate-900 dark:text-slate-100 ${index === 0 ? 'font-mono text-sm font-bold tabular-nums' : 'font-medium'}`}>{value || '—'}</dd>
        </div>)}
      </dl>
      {active === 1 && current.condiciones && <p className="mt-2 px-2 text-xs text-slate-500 dark:text-slate-400">{current.condiciones}</p>}
    </div>
  </div>;
}
