type StatusVariant = 'success' | 'warning' | 'error' | 'neutral' | 'primary' | 'purple';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
}

const variantStyles: Record<StatusVariant, { pill: string; dot: string }> = {
  success: {
    pill: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500'
  },
  warning: {
    pill: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
    dot: 'bg-amber-500'
  },
  error: {
    pill: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80',
    dot: 'bg-rose-500'
  },
  purple: {
    pill: 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/80',
    dot: 'bg-purple-600 dark:bg-purple-400'
  },
  neutral: {
    pill: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700',
    dot: 'bg-slate-400 dark:bg-slate-500'
  },
  primary: {
    pill: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/80',
    dot: 'bg-teal-600 dark:bg-teal-400'
  },
};

export function StatusBadge({ status, variant = 'neutral' }: StatusBadgeProps) {
  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${current.pill} transition-colors shadow-sm`}>
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {status}
    </span>
  );
}
