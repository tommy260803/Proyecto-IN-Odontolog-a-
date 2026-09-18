import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Printer, Download, Mail, Send, Building2, Calendar, Clock, User, Phone, FileText, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { useToast } from '@/shared/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface PaymentNoticePdfModalProps {
  payer: PayerWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  customMessage?: string;
  emailSubject?: string;
  emailBody?: string;
}

export function PaymentNoticePdfModal({
  payer,
  isOpen,
  onClose,
  customMessage,
  emailSubject,
  emailBody,
}: PaymentNoticePdfModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen || !payer) return null;

  // Generar buffer Base64 del PDF desde el DOM
  const generatePdfBase64 = async (): Promise<string | null> => {
    const element = printRef.current;
    if (!element) return null;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('datauristring');
    } catch (error) {
      console.error('Error generando canvas PDF:', error);
      return null;
    }
  };

  // Descargar archivo .PDF directamente al computador
  const handleDownloadPdf = async () => {
    const element = printRef.current;
    if (!element) return;

    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const fileName = `Proforma_Aviso_Cobro_${payer.person.lastName}_${payer.id}.pdf`;
      pdf.save(fileName);

      toast({
        title: 'PDF Descargado',
        description: `Se descargó "${fileName}" exitosamente.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error al generar PDF',
        description: err.message || 'No se pudo descargar el PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Enviar el correo oficial con el PDF adjunto al buzón del paciente
  const handleSendEmailWithPdf = async () => {
    const targetEmail = payer.person.email;
    if (!targetEmail) {
      toast({
        title: 'Sin correo registrado',
        description: 'El paciente no tiene una dirección de correo configurada.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      toast({
        title: 'Generando documento...',
        description: 'Renderizando Proforma PDF oficial para adjuntar al correo...',
      });

      const pdfBase64 = await generatePdfBase64();

      const payload = {
        payerId: payer.id,
        toEmail: targetEmail,
        patientName: `${payer.person.firstName} ${payer.person.lastName}`,
        subject: emailSubject || `Aviso de Cobro & Proforma Oficial de Atención - NexoSalud`,
        message: emailBody || customMessage || `Estimado(a) ${payer.person.firstName}, le adjuntamos su proforma de cobro para confirmar su cita odontológica.`,
        amount: payer.amountToPay,
        serviceName: 'Consulta y Tratamiento Odontológico Especializado',
        reservationDate: payer.reservation?.date,
        reservationTime: payer.reservation?.time,
        branch: payer.reservation?.branchId,
        professional: payer.reservation?.professionalId,
        pdfBase64,
      };

      const res = await fetch(`${API_URL}/payer/send-notice-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar el correo');
      }

      toast({
        title: '¡Correo y PDF Enviados!',
        description: `La proforma oficial fue enviada exitosamente a ${targetEmail}.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error de envío',
        description: err.message || 'No se pudo enviar el correo al paciente.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Imprimir directamente
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Aviso_Cobro_NexoSalud_${payer.person.lastName}_${payer.id}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; padding: 24px; color: #0f172a; background-color: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; }
            .logo-title { font-size: 24px; font-weight: 800; color: #0d9488; margin: 0; }
            .clinic-info { font-size: 11px; color: #64748b; line-height: 1.4; }
            .doc-type { text-align: right; }
            .doc-type h2 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
            .doc-type p { font-size: 11px; color: #64748b; margin: 0; }
            .section { margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
            .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0d9488; margin-top: 0; margin-bottom: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; }
            .label { font-weight: 600; color: #64748b; }
            .val { color: #0f172a; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background-color: #0d9488; color: white; text-align: left; padding: 8px 12px; border-radius: 6px 6px 0 0; }
            td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
            .total-box { display: flex; justify-content: flex-end; margin-top: 16px; }
            .total-card { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 12px 20px; text-align: right; }
            .total-card .amount { font-size: 20px; font-weight: 800; color: #0f766e; }
            .channels { margin-top: 24px; padding: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; font-size: 11px; color: #92400e; }
            .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const proformaNumber = `PRF-${String(payer.id).padStart(5, '0')}-${new Date().getFullYear()}`;
  const currentDate = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header con Barra de Acciones */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">
                Proforma Oficial & Aviso de Cobro
              </DialogTitle>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {proformaNumber} • Paciente: {payer.person.firstName} {payer.person.lastName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Enviar por Correo con PDF */}
            <Button
              onClick={handleSendEmailWithPdf}
              disabled={isSendingEmail}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs gap-1.5 shadow-sm font-medium h-8"
              title={`Enviar PDF adjunto a ${payer.person.email || 'correo'}`}
            >
              {isSendingEmail ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Enviando PDF...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Enviar PDF al Correo
                </>
              )}
            </Button>

            {/* Botón Descargar PDF */}
            <Button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-700 rounded-xl text-xs gap-1.5 font-medium h-8 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              title="Descargar archivo PDF al dispositivo"
            >
              {isGeneratingPdf ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-teal-600" />
              )}
              Descargar PDF
            </Button>

            {/* Botón Imprimir */}
            <Button
              onClick={handlePrint}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-700 rounded-xl text-xs gap-1.5 font-medium h-8 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              title="Imprimir proforma"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Cuerpo Imprimible */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 dark:bg-slate-950/60 flex justify-center">
          <div
            ref={printRef}
            className="w-full max-w-2xl bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-200/80 font-sans"
            style={{ minHeight: '650px' }}
          >
            {/* Encabezado del Documento */}
            <div className="flex justify-between items-start border-b-2 border-teal-600 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-extrabold text-teal-700 tracking-tight flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-teal-600" /> NEXOSALUD
                </h1>
                <p className="text-xs text-slate-500 mt-1">Clínica Odontológica Especializada</p>
                <p className="text-[11px] text-slate-400">RUC: 20608945123 • Trujillo / Lima, Perú</p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg text-xs font-bold mb-1">
                  ESTADO DE COBRO
                </span>
                <p className="text-xs font-bold text-slate-700">{proformaNumber}</p>
                <p className="text-[11px] text-slate-400">Emisión: {currentDate}</p>
              </div>
            </div>

            {/* Datos del Paciente */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
              <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2.5">
                Datos del Paciente
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Nombre Completo: </span>
                  <span className="font-bold text-slate-900">{payer.person.firstName} {payer.person.lastName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Documento: </span>
                  <span className="font-bold text-slate-900">{payer.person.documentType || 'DNI'}: {payer.person.documentNumber || 'No especificado'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Teléfono: </span>
                  <span className="font-bold text-slate-900">{payer.person.phone || 'No registrado'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Correo: </span>
                  <span className="font-bold text-slate-900">{payer.person.email || 'No registrado'}</span>
                </div>
              </div>
            </div>

            {/* Detalle del Tratamiento y Cita */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
              <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2.5">
                Detalle de Cita y Tratamiento Odontológico
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Servicio: </span>
                  <span className="font-bold text-slate-900">Consulta y Tratamiento Odontológico</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Sede: </span>
                  <span className="font-bold text-slate-900">{payer.reservation?.branchId || 'Sede Principal'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Fecha Programada: </span>
                  <span className="font-bold text-slate-900">{payer.reservation?.date || 'Por coordinar'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Hora: </span>
                  <span className="font-bold text-slate-900">{payer.reservation?.time || 'Turno asignado'}</span>
                </div>
              </div>
            </div>

            {/* Tabla de Importes */}
            <table className="w-full text-xs border-collapse mb-4">
              <thead>
                <tr className="bg-teal-700 text-white font-semibold">
                  <th className="p-2.5 text-left rounded-tl-lg">Descripción del Concepto</th>
                  <th className="p-2.5 text-center">Cant.</th>
                  <th className="p-2.5 text-right rounded-tr-lg">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2.5 font-medium text-slate-800">
                    Abono / Reserva de Consulta Odontológica
                    <span className="block text-[10px] text-slate-500">Garantía de turno en agenda clínica</span>
                  </td>
                  <td className="p-2.5 text-center font-medium">1</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">S/ {payer.amountToPay.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Total */}
            <div className="flex justify-end mb-6">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 px-5 text-right">
                <p className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">Total Pendiente de Abono</p>
                <p className="text-2xl font-black text-teal-900">S/ {payer.amountToPay.toFixed(2)}</p>
              </div>
            </div>

            {/* Canales Habilitados */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 mb-6">
              <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-950">
                <CheckCircle2 className="w-4 h-4 text-amber-700" /> Canales de Pago Habilitados:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900">
                <li><strong>Yape Oficial:</strong> Pagos directos desde la app con código de aprobación al 970 292 710.</li>
                <li><strong>Tarjeta de Débito / Crédito:</strong> Visa, Mastercard, American Express mediante pasarela en línea.</li>
                <li><strong>Transferencia BCP:</strong> Cta Cte 191-2345678-0-12 (CCI: 002-191002345678012-54).</li>
              </ul>
            </div>

            {customMessage && (
              <div className="bg-teal-50/50 border border-teal-100 rounded-lg p-3 text-[11px] text-slate-600 mb-4 italic">
                "{customMessage}"
              </div>
            )}

            {/* Pie de Página */}
            <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
              <p>NexoSalud Odontología Digital • Central Telefónica: (01) 680-4500 • WhatsApp: +51 987 654 321</p>
              <p className="mt-0.5">Este documento es una proforma informativa emitida para fines de cobranza y gestión de reservas.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
