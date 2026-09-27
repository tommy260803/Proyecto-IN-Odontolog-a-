import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Download, Send, FileText, RefreshCw, Printer } from 'lucide-react';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { useToast } from '@/shared/hooks/use-toast';
import jsPDF from 'jspdf';

import { PayerState } from '@/domain/enums';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface PaymentNoticePdfModalProps {
  payer: PayerWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  customMessage?: string;
  emailSubject?: string;
  emailBody?: string;
}

export function generatePayerProformaPdf(payer: PayerWithDetails, customMessage?: string): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isValidated = payer.state === PayerState.VALIDATED;
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 15;
  let y = 18;

  // Header Colors
  const primaryColor = isValidated ? [16, 185, 129] : [13, 148, 136]; // #10b981 (Emerald) or #0d9488 (Teal)
  const darkColor = [15, 23, 42]; // #0f172a
  const grayColor = [100, 116, 139]; // #64748b
  const lightBg = [248, 250, 252]; // #f8fafc

  // Brand Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('NEXOSALUD', margin, y);

  // Document Tag on right
  const docCode = isValidated
    ? `CONST-${String(payer.id).padStart(5, '0')}-${new Date().getFullYear()}`
    : `PRF-${String(payer.id).padStart(5, '0')}-${new Date().getFullYear()}`;
  
  const tagTitle = isValidated ? 'CONSTANCIA DE PAGO' : 'ESTADO DE COBRO';
  const tagWidth = isValidated ? 52 : 45;

  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFillColor(isValidated ? 236 : 240, isValidated ? 253 : 253, isValidated ? 245 : 250);
  doc.roundedRect(pageWidth - margin - tagWidth, y - 6, tagWidth, 8, 2, 2, 'F');
  doc.text(tagTitle, pageWidth - margin - (tagWidth / 2), y - 1, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Clínica Odontológica Especializada', margin, y);
  doc.text(docCode, pageWidth - margin, y, { align: 'right' });

  y += 4;
  doc.text('RUC: 20608945123 • Trujillo / Lima, Perú', margin, y);
  const currentDate = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Emisión: ${currentDate}`, pageWidth - margin, y, { align: 'right' });

  // Divider Line
  y += 5;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  // 1. Datos del Paciente Box
  y += 7;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 26, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DATOS DEL PACIENTE', margin + 4, y + 6);

  doc.setFontSize(8);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Nombre Completo:', margin + 4, y + 13);
  doc.text('Documento:', margin + 95, y + 13);
  doc.text('Teléfono:', margin + 4, y + 20);
  doc.text('Correo:', margin + 95, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`${payer.person.firstName} ${payer.person.lastName}`, margin + 32, y + 13);
  doc.text(`${payer.person.documentType || 'DNI'}: ${payer.person.documentNumber || 'No especificado'}`, margin + 115, y + 13);
  doc.text(payer.person.phone || 'No registrado', margin + 32, y + 20);
  doc.text(payer.person.email || 'No registrado', margin + 115, y + 20);

  // 2. Detalle de Cita Box
  y += 31;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 26, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DETALLE DE CITA Y TRATAMIENTO ODONTOLÓGICO', margin + 4, y + 6);

  doc.setFontSize(8);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Servicio:', margin + 4, y + 13);
  doc.text('Sede:', margin + 95, y + 13);
  doc.text('Fecha Programada:', margin + 4, y + 20);
  doc.text('Hora:', margin + 95, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Consulta y Tratamiento Odontológico Especializado', margin + 20, y + 13);
  doc.text(payer.reservation?.branchId || 'Sede Principal', margin + 106, y + 13);
  doc.text(payer.reservation?.date || 'Por coordinar', margin + 34, y + 20);
  doc.text(payer.reservation?.time || 'Turno asignado', margin + 106, y + 20);

  // 3. Tabla de Conceptos
  y += 32;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 8, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Descripción del Concepto', margin + 4, y + 5.5);
  doc.text('Cant.', margin + 120, y + 5.5, { align: 'center' });
  doc.text('Importe', pageWidth - margin - 4, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, pageWidth - (margin * 2), 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(
    isValidated
      ? 'Abono Validado de Consulta Odontológica'
      : 'Abono / Reserva de Consulta Odontológica',
    margin + 4,
    y + 5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(
    isValidated
      ? 'Reserva asegurada y confirmada en agenda clínica'
      : 'Garantía de turno en agenda clínica',
    margin + 4,
    y + 9
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('1', margin + 120, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text(`S/ ${payer.amountToPay.toFixed(2)}`, pageWidth - margin - 4, y + 6, { align: 'right' });

  // 4. Banner Total
  y += 16;
  const bannerWidth = 76;
  const bannerX = pageWidth - margin - bannerWidth;
  doc.setFillColor(isValidated ? 236 : 240, isValidated ? 253 : 253, isValidated ? 245 : 250);
  doc.setDrawColor(isValidated ? 167 : 153, isValidated ? 243 : 246, isValidated ? 208 : 228);
  doc.roundedRect(bannerX, y, bannerWidth, 16, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isValidated ? 5 : 15, isValidated ? 150 : 118, isValidated ? 105 : 110);
  doc.text(
    isValidated ? 'TOTAL ABONADO / CANCELADO' : 'TOTAL PENDIENTE DE ABONO',
    bannerX + (bannerWidth / 2),
    y + 5,
    { align: 'center' }
  );

  doc.setFontSize(14);
  doc.text(`S/ ${payer.amountToPay.toFixed(2)}`, bannerX + (bannerWidth / 2), y + 12.5, { align: 'center' });

  // 5. Canales / Detalle de Pago
  y += 20;
  if (isValidated) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(5, 150, 105);
    doc.text('✓ ESTADO DEL PAGO: VALIDADO Y CONCILIADO', margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`• Canal / Medio de Pago: ${payer.payment?.channel || 'Pasarela / Yape / Transferencia Bancaria'}`, margin + 4, y + 10);
    doc.text(`• N° de Operación / Ref: ${payer.payment?.operationNumber || 'CONCILIADO-OK'}`, margin + 4, y + 14.5);
    doc.text(`• Estado en Agenda: Cita Confirmada y Programada (${payer.reservation?.date || 'Fecha coordinada'} - ${payer.reservation?.time || 'Hora asignada'})`, margin + 4, y + 19);
  } else {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text('✓ CANALES DE PAGO HABILITADOS:', margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('• Yape Oficial: Pagos directos desde la app con código de aprobación al 970 292 710 (Clínica NexoSalud)', margin + 4, y + 10);
    doc.text('• Tarjeta de Débito / Crédito: Visa, Mastercard, American Express mediante pasarela web integrada', margin + 4, y + 14.5);
    doc.text('• Transferencia Bancaria BCP: Cta Cte 191-2345678-0-12 (CCI: 002-191002345678012-54)', margin + 4, y + 19);
  }

  // 6. Mensaje IA (si existe)
  if (customMessage) {
    y += 26;
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(204, 251, 241);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    const splitMsg = doc.splitTextToSize(`"${customMessage}"`, pageWidth - (margin * 2) - 8);
    doc.text(splitMsg, margin + 4, y + 5);
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 280, pageWidth - margin, 280);
  doc.text('NexoSalud Odontología Digital • Central Telefónica: (01) 680-4500 • WhatsApp: +51 987 654 321', pageWidth / 2, 284, { align: 'center' });
  doc.text(
    isValidated
      ? 'Este documento es una constancia de confirmación y comprobante oficial de reserva de atención odontológica.'
      : 'Este documento es una proforma informativa emitida para fines de cobranza y confirmación de citas.',
    pageWidth / 2,
    288,
    { align: 'center' }
  );

  return doc;
}

export function PaymentNoticePdfModal({
  payer,
  isOpen,
  onClose,
  customMessage,
  emailSubject,
  emailBody,
}: PaymentNoticePdfModalProps) {
  const { toast } = useToast();
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;
    if (isOpen && payer) {
      try {
        const doc = generatePayerProformaPdf(payer, customMessage);
        const pdfBlob = doc.output('blob');
        currentUrl = URL.createObjectURL(pdfBlob);
        setPdfBlobUrl(currentUrl);
      } catch (err) {
        console.error('Error generando blob de PDF:', err);
      }
    } else {
      setPdfBlobUrl(null);
    }

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [isOpen, payer?.id, customMessage]);

  if (!isOpen || !payer) return null;

  const isValidated = payer.state === PayerState.VALIDATED;

  // Descargar archivo .PDF directamente al computador
  const handleDownloadPdf = () => {
    try {
      const doc = generatePayerProformaPdf(payer, customMessage);
      const prefix = isValidated ? 'Constancia_Pago' : 'Proforma_Aviso_Cobro';
      const fileName = `${prefix}_${payer.person.lastName}_${payer.id}.pdf`;
      doc.save(fileName);

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
        description: isValidated 
          ? 'Adjuntando Constancia oficial de Pago para enviar al correo...'
          : 'Adjuntando Proforma PDF oficial para enviar al correo...',
      });

      const doc = generatePayerProformaPdf(payer, customMessage);
      const pdfBase64 = doc.output('datauristring');
      const filename = isValidated
        ? `Constancia_Pago_${payer.person.lastName.replace(/\s+/g, '_')}_${payer.id}.pdf`
        : `Proforma_Aviso_Cobro_${payer.person.lastName.replace(/\s+/g, '_')}_${payer.id}.pdf`;

      const defaultSubject = isValidated
        ? `Constancia Oficial de Pago y Confirmación de Cita - NexoSalud`
        : `Aviso de Cobro & Proforma Oficial de Atención - NexoSalud`;

      const defaultBody = isValidated
        ? `Estimado(a) ${payer.person.firstName}, le confirmamos que su pago ha sido validado exitosamente. Adjuntamos su constancia oficial de pago y reserva de cita.`
        : `Estimado(a) ${payer.person.firstName}, le adjuntamos su proforma de cobro para confirmar su cita odontológica.`;

      const payload = {
        payerId: payer.id,
        toEmail: targetEmail,
        patientName: `${payer.person.firstName} ${payer.person.lastName}`,
        subject: emailSubject || defaultSubject,
        message: emailBody || customMessage || defaultBody,
        amount: payer.amountToPay,
        serviceName: 'Consulta y Tratamiento Odontológico Especializado',
        reservationDate: payer.reservation?.date,
        reservationTime: payer.reservation?.time,
        branch: payer.reservation?.branchId,
        professional: payer.reservation?.professionalId,
        filename,
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
        description: isValidated
          ? `La constancia oficial fue enviada exitosamente a ${targetEmail}.`
          : `La proforma oficial fue enviada exitosamente a ${targetEmail}.`,
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

  const docCode = isValidated
    ? `CONST-${String(payer.id).padStart(5, '0')}-${new Date().getFullYear()}`
    : `PRF-${String(payer.id).padStart(5, '0')}-${new Date().getFullYear()}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[94vh] overflow-hidden p-0 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col">
        {/* Header del Modal - Color Entero Sólido (Sin Gradiente) */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs border border-slate-200">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <div>
              <DialogTitle className="text-sm font-extrabold text-white tracking-tight leading-tight">
                {isValidated ? 'Comprobante Oficial de Pago & Constancia de Cita' : 'Vista Previa del Comprobante & Orden de Cobro'}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-400 leading-tight">
                Documento digital para trazabilidad de pagos y pre-reservas NexoSalud Dental
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${isValidated ? 'bg-emerald-500 text-slate-950' : 'bg-teal-500 text-slate-950'} font-black text-[10px] px-2.5 py-0.5 shadow-xs`}>
              {isValidated ? 'PAGO VALIDADO' : 'PENDIENTE DE PAGO'}
            </Badge>
          </div>
        </div>

        {/* Visor de Documento PDF (Fondo de Visor con Hoja Blanca Realista Centrada) */}
        <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950/80 p-4 sm:p-6">
          {/* Hoja de Comprobante PDF (Documento Clínico Estilo Hoja Impresa) */}
          <div
            id="voucher-print-area"
            className="bg-white text-slate-900 font-sans p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200/90 max-w-2xl mx-auto space-y-5 ring-1 ring-slate-900/5"
          >
            {/* Cabecera del Documento Oficial con Logo Normal NexoSalud */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b-2 border-slate-900 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs">
                  <img src="/Logo_NexoSalud.png" alt="NexoSalud Dental" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase">
                    NexoSalud Odontología Especializada
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    RUC: 20608945231 · Central de Citas: (01) 710-9000
                  </p>
                  <p className="text-[10px] text-teal-700 font-semibold">
                    Portal de Emisión Digital · {isValidated ? 'Constancia Oficial de Pago' : 'Orden de Cobro y Pre-Reserva'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right bg-slate-50 border border-slate-200 p-3 rounded-xl sm:min-w-[190px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Código Comprobante</span>
                <span className="text-lg font-black text-slate-950 tracking-wider block font-mono">
                  {docCode}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Emisión: {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Grid de Información del Paciente y Cita */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/90 text-xs">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Datos del Paciente</span>
                <p className="font-extrabold text-sm text-slate-950">{payer.person.firstName} {payer.person.lastName}</p>
                {payer.person.documentId && <p className="text-slate-600 font-medium"><span className="text-slate-400">Doc. Identidad:</span> {payer.person.documentId}</p>}
                {payer.person.phone && <p className="text-slate-600 font-medium"><span className="text-slate-400">WhatsApp:</span> {payer.person.phone}</p>}
                {payer.person.email && <p className="text-slate-600 font-medium"><span className="text-slate-400">Correo:</span> {payer.person.email}</p>}
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Detalles de la Cita Médica</span>
                <p className="font-bold text-slate-900">
                  <span className="text-slate-400 font-normal">Sede:</span> {payer.reservation?.branchId || 'Sede Principal NexoSalud'}
                </p>
                <p className="font-bold text-slate-900">
                  <span className="text-slate-400 font-normal">Especialista:</span> {payer.reservation?.professionalId || 'Especialista de Turno'}
                </p>
                <p className="font-bold text-slate-900">
                  <span className="text-slate-400 font-normal">Fecha programada:</span> {payer.reservation?.date || 'Por coordinar'}
                </p>
                <p className="font-bold text-slate-900">
                  <span className="text-slate-400 font-normal">Turno:</span> {payer.reservation?.time || 'Horario Flexible'}
                </p>
                <p className="font-bold text-slate-900">
                  <span className="text-slate-400 font-normal">Medio de Pago:</span> {payer.payment?.channel || 'Yape / Plin / Pasarela Digital'}
                </p>
              </div>
            </div>

            {/* Cuadro de Liquidación Tarifaria */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Descripción del Servicio Odontológico</span>
                <span>Importe</span>
              </div>
              <div className="p-4 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-extrabold text-sm text-slate-900">Consulta y Tratamiento Odontológico Especializado</p>
                    <p className="text-[11px] text-slate-500 max-w-md mt-0.5">
                      Atención clínica integral con tecnología de diagnóstico digital y garantía oficial NexoSalud.
                    </p>
                  </div>
                  <span className="font-mono text-slate-500 line-through">
                    S/ {(Number(payer.amountToPay) * 1.18).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-slate-100">
                  <span>Descuento Promocional de Campaña Aplicado</span>
                  <span>- S/ {(Number(payer.amountToPay) * 0.18).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 text-sm font-black text-slate-950">
                  <span>{isValidated ? 'TOTAL ABONADO / CANCELADO:' : 'TOTAL A PAGAR EN CLÍNICA:'}</span>
                  <span className={`text-xl ${isValidated ? 'text-emerald-700' : 'text-teal-700'} font-mono`}>
                    S/ {Number(payer.amountToPay).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Estado de Pago y Cláusula de Validez */}
            <div className={`p-3.5 ${isValidated ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-teal-50/80 border-teal-200 text-teal-900'} border rounded-xl text-[11px] space-y-1`}>
              <div className="flex items-center gap-1.5 font-bold">
                <FileText className="w-4 h-4 shrink-0" />
                <span>
                  {isValidated ? '✓ Estado del Pago: Conciliado y Validado' : 'Garantía de Tarifa Oficial Congelada por 48 Horas'}
                </span>
              </div>
              <p className="text-[10.5px] leading-relaxed">
                {isValidated
                  ? `Operación N° ${payer.payment?.operationNumber || 'CONCILIADO-OK'} verificada y registrada para su atención en sede.`
                  : `Presenta este comprobante (en digital o impreso) o menciona el código ${docCode} en recepción para aplicar tu tarifa preferencial.`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Footer de Acciones del Modal */}
        <div className="bg-white dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto text-xs font-semibold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
          >
            Cerrar Vista Previa
          </Button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Botón Enviar por Correo */}
            <Button
              onClick={handleSendEmailWithPdf}
              disabled={isSendingEmail}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-md cursor-pointer"
              title={`Enviar comprobante a ${payer.person.email || 'correo'}`}
            >
              {isSendingEmail ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Enviar al Correo
                </>
              )}
            </Button>

            {/* Botón Imprimir o Guardar PDF */}
            <Button
              onClick={() => {
                window.print();
              }}
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs gap-2 shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
