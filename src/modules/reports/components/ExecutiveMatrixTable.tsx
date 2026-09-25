import React, { useRef, useState } from 'react';
import { Download, Printer, Database, Sparkles, CheckCircle2 } from 'lucide-react';
import type { ExecutiveReportData } from '@/shared/services/report.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExecutiveMatrixTableProps {
  data: ExecutiveReportData;
  containerId?: string;
}

export const ExecutiveMatrixTable: React.FC<ExecutiveMatrixTableProps> = ({
  data,
  containerId = `report-${data.stage.toLowerCase()}`,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const formatValue = (val: number) => {
    if (data.isCurrency) {
      return val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString('es-PE');
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      setIsExporting(true);

      // Capturar elemento visual en alta resolución
      const canvas = await html2canvas(printRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Dimensionar proporcionalmente en la página
      const imgWidth = pageWidth - 20; // 10mm márgenes
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const yOffset = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 10;

      pdf.addImage(imgData, 'PNG', 10, yOffset, imgWidth, Math.min(imgHeight, pageHeight - 20));
      pdf.save(`${data.reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_NexoSalud.pdf`);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar PDF. Intente imprimir directamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            {data.stage}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <Database className="h-3.5 w-3.5 text-teal-500" />
            <span>{data.sourceMart}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
            title="Imprimir documento"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 ${
              exportSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
          >
            {exportSuccess ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>PDF Descargado</span>
              </>
            ) : (
              <>
                <Download className={`h-3.5 w-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                <span>{isExporting ? 'Generando PDF...' : 'Exportar a PDF'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Printable Executive Sheet (Styled exactly like the sample corporate report) */}
      <div className="overflow-x-auto pb-4">
        <div
          ref={printRef}
          id={containerId}
          className="min-w-[840px] bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 mx-auto"
          style={{ fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif" }}
        >
          {/* Top Header Grid: Left Logo | Center Title & Period | Right Brand Badge */}
          <div className="grid grid-cols-[200px_1fr_180px] items-center mb-8 border-b pb-6 border-slate-100">
            {/* Left: NexoSalud Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-700 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="leading-tight">
                <span className="text-xl font-black tracking-tight text-slate-900 block">
                  Nexo<span className="text-teal-600">Salud</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                  Red Odontológica
                </span>
              </div>
            </div>

            {/* Center: Report Title & Period */}
            <div className="text-center px-4">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                {data.reportTitle}
              </h2>
              <p className="text-sm font-bold text-slate-800 mt-1">
                Período : {data.period}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Métrica: <span className="font-semibold text-slate-700">{data.metric}</span>
              </p>
            </div>

            {/* Right: Software / DataMart Brand Badge */}
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2 border border-amber-300 bg-amber-50/60 rounded-xl px-3 py-1.5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-xs shadow-inner">
                  .net
                </div>
                <div className="text-left leading-none">
                  <span className="text-[11px] font-black text-slate-900 uppercase block tracking-wider">
                    BI PREMIUM
                  </span>
                  <span className="text-[9px] text-slate-500 block font-medium mt-0.5">
                    NexoSalud Mart
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cross-Tab Executive Matrix Table */}
          <div className="border-2 border-[#4aa8b9] rounded-sm overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              {/* Grouped Header */}
              <thead>
                {/* Top Header Row */}
                <tr className="border-b border-[#4aa8b9]">
                  {/* Left Column Header Header */}
                  <th 
                    rowSpan={2} 
                    className="w-1/3 bg-[#42a2b4] text-white font-bold text-left px-4 py-2 border-r border-[#4aa8b9] align-bottom"
                  >
                    {data.rowHeader}
                  </th>
                  {/* Super Header (Center spanning status columns) */}
                  <th
                    colSpan={data.columns.length}
                    className="bg-[#3da0b2] text-white font-bold text-center py-1.5 border-r border-[#4aa8b9] tracking-wide text-sm"
                  >
                    {data.superHeader}
                  </th>
                  {/* Total Header spanning right */}
                  <th
                    rowSpan={2}
                    className="bg-[#42a2b4] text-white font-bold text-right px-4 py-2 align-bottom min-w-[110px]"
                  >
                    {data.totalColumnName}
                  </th>
                </tr>

                {/* Sub Header Row for Columns */}
                <tr className="bg-[#42a2b4] text-white border-b-2 border-[#4aa8b9]">
                  {data.columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-right font-bold border-r border-[#3492a3] text-xs min-w-[95px]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-[#bfe3eb]">
                {data.categories.map((category) => (
                  <React.Fragment key={category.categoryName}>
                    {/* Category Header Row (e.g. Aceites, Detergentes, Redes Sociales, Sede Centro) */}
                    <tr className="bg-[#edf7fa]">
                      <td
                        colSpan={data.columns.length + 2}
                        className="px-3 py-2 font-black text-slate-900 text-sm tracking-wide border-t border-[#4aa8b9]"
                      >
                        {category.categoryName}
                      </td>
                    </tr>

                    {/* Category Items Rows */}
                    {category.items.map((item) => (
                      <tr 
                        key={item.itemName} 
                        className="hover:bg-[#f6fcfe] transition-colors"
                      >
                        <td className="pl-6 pr-3 py-1.5 text-slate-800 border-r border-[#bfe3eb]">
                          {item.itemName}
                        </td>
                        {data.columns.map((col) => (
                          <td 
                            key={col} 
                            className="px-3 py-1.5 text-right font-medium text-slate-800 border-r border-[#bfe3eb]"
                          >
                            {formatValue(item.values[col] || 0)}
                          </td>
                        ))}
                        <td className="px-4 py-1.5 text-right font-semibold text-slate-900">
                          {formatValue(item.total)}
                        </td>
                      </tr>
                    ))}

                    {/* Category Subtotal Row */}
                    <tr className="bg-[#e4f3f7] font-bold text-slate-900 border-t border-b border-[#82c8d5]">
                      <td className="px-3 py-1.5 font-bold text-slate-900 border-r border-[#bfe3eb]">
                        {category.subtotalLabel}
                      </td>
                      {data.columns.map((col) => (
                        <td 
                          key={col} 
                          className="px-3 py-1.5 text-right font-bold text-slate-900 border-r border-[#bfe3eb]"
                        >
                          {formatValue(category.subtotals[col] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right font-bold text-slate-900">
                        {formatValue(category.subtotalTotal)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* Grand Total Row */}
                <tr className="bg-[#9cd2de] font-black text-slate-950 border-t-2 border-[#3ba0b2]">
                  <td className="px-3 py-2.5 font-black text-slate-950 border-r border-[#7dbdc9] text-sm">
                    {data.grandTotalLabel}
                  </td>
                  {data.columns.map((col) => (
                    <td 
                      key={col} 
                      className="px-3 py-2.5 text-right font-black text-slate-950 border-r border-[#7dbdc9] text-sm"
                    >
                      {formatValue(data.grandTotals[col] || 0)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-black text-slate-950 text-base">
                    {formatValue(data.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Report Footer / Signature Area */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
            <div>
              <span>Sistema: </span>
              <strong className="text-slate-700">NexoSalud BI DataMart</strong>
              <span> • Base de datos: </span>
              <strong className="font-mono text-slate-700">NexoSalud_Mart</strong>
            </div>
            <div>
              <span>Fecha de Emisión: </span>
              <span className="font-medium text-slate-700">
                {new Date(data.generatedAt).toLocaleDateString('es-PE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExecutiveMatrixTable;
