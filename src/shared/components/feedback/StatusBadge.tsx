import { Badge } from '@/shared/components/ui/badge';

type StatusVariant = 'success' | 'warning' | 'error' | 'neutral' | 'primary';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
}

const variantStyles: Record<StatusVariant, string> = {
  success:
    'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200',
  error: 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200',
  neutral: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200',
  primary: 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200',
};

export function StatusBadge({ status, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={variantStyles[variant]}>
      {status}
    </Badge>
  );
}
