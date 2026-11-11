import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { FileSpreadsheet, Download, CheckCircle2, Layers, Table, Sparkles, ShieldCheck, BarChart3, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';

interface PayerExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalRecords?: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function PayerExcelExportModal({ isOpen, onClose, totalRecords = 124 }: PayerExcelExportModalProps) {
  const { toast } = useToast();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const handleDownload = async (type: 'general' | 'full_bi') => {
    setDownloadingType(type);
    try {
      const response = await fetch(`${API_URL}/payer/export/excel?type=${type}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Error al generar el archivo Excel en el servidor');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = type === 'full_bi' 
        ? `PAYER_Libro_Completo_BI_${dateStr}.xlsx` 
        : `PAYER_Consolidado_General_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: '¡Excel Generado con Éxito!',
        description: type === 'full_bi' 
          ? 'Se descargó el libro multi-hoja con R1, R2, R3, KPIs y Consolidado.' 
          : 'Se descargó la tabla general con formato para Power BI y Excel.',
      });
    } catch (error: any) {
      console.error('Error al exportar Excel:', error);
      toast({
        title: 'Error de exportación',
        description: error.message || 'No se pudo generar el archivo .xlsx',
        variant: 'destructive',
      });
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera con banner degradado */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 p-6 text-white shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  Exportar Datos PAYER en Excel (.xlsx)
                </DialogTitle>
                <DialogDescription className="text-emerald-100 text-xs mt-1">
                  Archivos nativos Microsoft Excel con celdas formateadas, monedas en soles (S/), semáforos y filtros automáticos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Contenido / Opciones de descarga */}
        <div className="p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {/* Opción 1: Consolidado General (Power BI) */}
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 hover:shadow-md transition-all space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    1. Tabla General Consolidada (Plana) · Recomendado para Power BI
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {totalRecords} Filas
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Contiene todas las variables desnormalizadas en una sola hoja lista para arrastrar a Power BI sin necesidad de modelar relaciones.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">✓ Formato S/ #,##0.00</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">✓ Estados coloreados</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">✓ Scoring IA</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">✓ Filtros automáticos</span>
            </div>

            <Button
              type="button"
              onClick={() => handleDownload('general')}
              disabled={downloadingType !== null}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Download className={`w-3.5 h-3.5 ${downloadingType === 'general' ? 'animate-bounce' : ''}`} />
              <span>{downloadingType === 'general' ? 'Generando Excel...' : 'Descargar Consolidado (.xlsx)'}</span>
            </Button>
          </div>

          {/* Opción 2: Libro Multi-Hoja BI Completo */}
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 hover:shadow-md transition-all space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    2. Libro Multi-Hoja BI Completo · Para Auditoría y Sustentación
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    5 Pestañas
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Libro con las 5 pestañas dimensionales oficiales del modelo analítico de PAYER:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                <span>Hoja 1: Resumen KPIs Oficiales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                <span>Hoja 2: Reporte R1 (Recaudación)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Hoja 3: Reporte R2 (Incidencias)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Hoja 4: Reporte R3 (Cadencia Dunning)</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => handleDownload('full_bi')}
              disabled={downloadingType !== null}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Download className={`w-3.5 h-3.5 ${downloadingType === 'full_bi' ? 'animate-bounce' : ''}`} />
              <span>{downloadingType === 'full_bi' ? 'Generando Libro Multi-Hoja...' : 'Descargar Libro Completo BI (.xlsx)'}</span>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs h-8 px-4"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

