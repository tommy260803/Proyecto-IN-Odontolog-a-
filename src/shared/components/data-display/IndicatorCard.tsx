import { Card, CardContent } from '@/shared/components/ui/card';
import type { IndicatorResult } from '@/domain/indicators';
import { HelpCircle } from 'lucide-react';


export function IndicatorCard({ indicator, period }: { indicator: IndicatorResult, period: string }) {
  let color = 'text-gray-500';
  let bgColor = 'bg-gray-100';
  
  if (indicator.status === 'green') {
    color = 'text-green-600';
    bgColor = 'bg-green-100';
  } else if (indicator.status === 'amber') {
    color = 'text-amber-600';
    bgColor = 'bg-amber-100';
  } else if (indicator.status === 'red') {
    color = 'text-red-600';
    bgColor = 'bg-red-100';
  }

  let displayValue = '';
  if (indicator.format === 'percentage') displayValue = indicator.value.toFixed(1) + '%';
  else if (indicator.format === 'number') displayValue = indicator.value.toFixed(1) + ' ' + indicator.unit;
  else if (indicator.format === 'currency') displayValue = 'S/ ' + indicator.value.toFixed(2);
  else if (indicator.format === 'time') displayValue = indicator.value.toFixed(0) + ' ' + indicator.unit;

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${bgColor}`} />
      <CardContent className="p-4 pl-5">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm font-medium text-muted-foreground leading-tight">{indicator.id} - {indicator.name}</p>
          <div title={`Fórmula: ${indicator.formula}`}>
            <HelpCircle className="w-4 h-4 text-muted-foreground opacity-50 hover:opacity-100 cursor-help flex-shrink-0" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className={`text-2xl font-bold ${color}`}>{displayValue}</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Periodo: {period}</p>
      </CardContent>
    </Card>
  );
}
