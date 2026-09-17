import { type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Inbox } from 'lucide-react';

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
}

interface BaseTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
}

export function BaseTable<T>({
  columns,
  data,
  keyExtractor,
}: BaseTableProps<T>) {
  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="w-full text-left">
          <TableHeader className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
            <TableRow className="hover:bg-transparent border-none">
              {columns.map((col, index) => (
                <TableHead key={index} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-4 px-5">
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-400 dark:text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                    <p className="text-sm font-medium">No se encontraron registros en esta etapa.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={keyExtractor(item)} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-100 dark:border-slate-800">
                  {columns.map((col, index) => (
                    <TableCell key={index} className="py-4 px-5 text-sm text-slate-700 dark:text-slate-200 font-medium">
                      {col.cell
                        ? col.cell(item)
                        : String(item[col.accessorKey as keyof T])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
