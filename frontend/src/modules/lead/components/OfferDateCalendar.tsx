import { useState } from 'react';
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';

const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const navClass = 'inline-flex size-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-35 dark:hover:bg-slate-800';

export function OfferDateCalendar({ dates, value, onChange, fieldClass, highlight }: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  fieldClass: string;
  highlight?: { 'data-actualizado'?: true; onFocus: () => void; onPointerDown: () => void };
}) {
  const [visibleMonth, setVisibleMonth] = useState('');
  const available = new Set(dates);
  const months = [...new Set(dates.map(date => date.slice(0, 7)))].sort();
  const initialMonth = value.slice(0, 7) || months[0];
  const month = months.includes(visibleMonth) ? visibleMonth : initialMonth;
  const monthIndex = months.indexOf(month);
  const start = month ? startOfMonth(parseISO(`${month}-01`)) : null;
  const days = start ? eachDayOfInterval({ start, end: endOfMonth(start) }) : [];
  const offset = start ? (start.getDay() + 6) % 7 : 0;

  return (
    <div className="grid min-w-0 gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
      <span>Fecha</span>
      <Popover onOpenChange={open => { if (open) setVisibleMonth(initialMonth); }}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={value ? `Fecha: ${format(parseISO(value), 'PPP', { locale: es })}` : 'Elegir fecha'}
            {...highlight}
            disabled={!dates.length} className={`${fieldClass} flex items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-teal-600/30`}>
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-teal-700 dark:text-teal-300" />
            <span>{value ? format(parseISO(value), 'PPP', { locale: es }) : 'Selecciona la fecha'}</span>
          </button>
        </PopoverTrigger>
        {start && <PopoverContent aria-label="Calendario de horarios disponibles" className="w-72 max-w-[calc(100vw-2rem)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" aria-label="Mes anterior con disponibilidad" className={navClass}
              disabled={monthIndex <= 0} onClick={() => setVisibleMonth(months[monthIndex - 1])}>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <p aria-live="polite" className="text-sm font-semibold capitalize">{format(start, 'MMMM yyyy', { locale: es })}</p>
            <button type="button" aria-label="Mes siguiente con disponibilidad" className={navClass}
              disabled={monthIndex >= months.length - 1} onClick={() => setVisibleMonth(months[monthIndex + 1])}>
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map(day => <span aria-hidden="true" key={day} className="py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{day}</span>)}
            {Array.from({ length: offset }, (_, index) => <span aria-hidden="true" key={`empty-${index}`} />)}
            {days.map(day => {
              const date = format(day, 'yyyy-MM-dd');
              return <PopoverClose asChild key={date}>
                <button type="button" disabled={!available.has(date)} aria-pressed={value === date}
                  aria-label={format(day, 'PPPP', { locale: es })} onClick={() => onChange(date)}
                  className="h-8 rounded-md bg-teal-50 text-xs font-semibold text-teal-800 hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 aria-pressed:bg-teal-700 aria-pressed:text-white disabled:bg-transparent disabled:font-normal disabled:text-slate-400 dark:bg-teal-950/70 dark:text-teal-200 dark:hover:bg-teal-900 dark:aria-pressed:bg-teal-700 dark:disabled:bg-transparent dark:disabled:text-slate-600">
                  {day.getDate()}
                </button>
              </PopoverClose>;
            })}
          </div>
        </PopoverContent>}
      </Popover>
    </div>
  );
}
