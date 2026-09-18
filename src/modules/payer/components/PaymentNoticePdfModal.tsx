import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
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
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header con Barra de Acciones */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-lg ${isValidated ? 'bg-emerald-600' : 'bg-teal-600'} text-white flex items-center justify-center shadow-sm`}>
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">
                {isValidated ? 'Visor Oficial de Constancia de Pago PDF' : 'Visor Oficial de Proforma PDF'}
              </DialogTitle>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {docCode} • Paciente: {payer.person.firstName} {payer.person.lastName}
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
                  {isValidated ? 'Enviar Constancia al Correo' : 'Enviar PDF al Correo'}
                </>
              )}
            </Button>

            {/* Botón Descargar PDF */}
            <Button
              onClick={handleDownloadPdf}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-700 rounded-xl text-xs gap-1.5 font-medium h-8 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              title="Descargar archivo PDF al dispositivo"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Visor Nativo de PDF (Iframe con el motor PDF del Navegador) */}
        <div className="flex-1 w-full bg-slate-900 flex justify-center items-center overflow-hidden">
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full border-0"
              title={`Visor de PDF - ${docCode}`}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400 text-xs animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
              Cargando documento PDF nativo...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
