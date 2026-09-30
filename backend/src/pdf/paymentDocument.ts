import jsPDF from 'jspdf';

export interface PaymentDocumentData {
  type: 'ORDER' | 'RECEIPT';
  code: string;
  issuedAt?: string | Date;
  patientName: string;
  documentNumber?: string;
  phone?: string;
  email?: string;
  branch?: string;
  professional?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  serviceName: string;
  amount: number;
  originalPrice?: number;
  discountPercent?: number;
  paymentChannel?: string;
  operationNumber?: string;
  familyPatient?: string;
}

const INK: [number, number, number] = [37, 43, 47];
const MUTED: [number, number, number] = [104, 113, 119];
const RULE: [number, number, number] = [226, 230, 232];
const SOFT: [number, number, number] = [249, 250, 250];
const HEADER: [number, number, number] = [237, 247, 245];
const DEEP_TEAL: [number, number, number] = [0, 105, 101];

function dateLabel(value?: string | Date): string {
  if (!value) return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

export function formatAppointmentTime(value?: string): string {
  if (!value?.trim()) return 'Por coordinar';
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?(?:\s*-\s*(\d{1,2}):([0-5]\d)(?::[0-5]\d)?)?$/);
  if (!match) return value;
  const convert = (hours: string, minutes: string) => {
    const hour = Number(hours);
    if (hour > 23) return `${hours}:${minutes}`;
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
  };
  const start = convert(match[1], match[2]);
  return match[3] ? `${start} - ${convert(match[3], match[4])}` : start;
}

export function createPaymentDocumentPdf(data: PaymentDocumentData, logoDataUrl: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const paid = data.type === 'RECEIPT';
  const safe = (value?: string) => value?.trim() || 'No registrado';
  const fit = (value: string, width: number) => {
    if (doc.getTextWidth(value) <= width) return value;
    let text = value;
    while (doc.getTextWidth(`${text}...`) > width && text.length > 1) text = text.slice(0, -1);
    return `${text.trimEnd()}...`;
  };
  const label = (value: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(...MUTED);
    doc.text(value.toUpperCase(), x, y);
  };
  const detailRow = (heading: string, value: string, y: number, last = false) => {
    label(heading, 24, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.9);
    doc.setTextColor(...INK);
    doc.text(fit(safe(value), 105), 82, y);
    if (!last) {
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.18);
      doc.line(24, y + 3.8, 186, y + 3.8);
    }
  };
  const section = (heading: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DEEP_TEAL);
    doc.text(heading, 18, y);
  };

  // Cabecera suave con la marca original de NexoSalud.
  doc.setFillColor(...HEADER);
  doc.rect(0, 0, 210, 39, 'F');
  doc.setFillColor(...DEEP_TEAL);
  doc.rect(0, 0, 210, 2.2, 'F');
  doc.addImage(logoDataUrl, 'PNG', 18, 8, 42, 23.6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...INK);
  doc.text('DOCUMENTO DIGITAL', 192, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('RUC 20608945123  |  PERÚ', 192, 25, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18.5);
  doc.setTextColor(...INK);
  doc.text(paid ? 'Constancia de pago' : 'Orden de pago', 18, 53);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Pago validado y cita confirmada' : 'Documento de pre-reserva', 18, 61);
  doc.setFillColor(...HEADER);
  doc.setDrawColor(205, 228, 224);
  doc.roundedRect(148, 45, 44, 10, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...DEEP_TEAL);
  doc.text(paid ? 'PAGO VALIDADO' : 'PAGO PENDIENTE', 170, 51.4, { align: 'center' });

  label(paid ? 'NÚMERO DE CONSTANCIA' : 'REFERENCIA DE RESERVA', 18, 72);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(fit(data.code, 88), 18, 79);
  label('FECHA DE EMISIÓN', 137, 72);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(dateLabel(data.issuedAt), 137, 79);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.25);
  doc.line(18, 84, 192, 84);

  section('DATOS DEL PACIENTE', 92);
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...RULE);
  doc.roundedRect(18, 97, 174, 49, 2.5, 2.5, 'FD');
  detailRow('Nombre completo', data.patientName, 106);
  detailRow('Documento', safe(data.documentNumber), 115);
  detailRow('Teléfono', safe(data.phone), 124);
  detailRow('Correo electrónico', safe(data.email), 133);
  detailRow('Atención para', data.familyPatient || 'Titular de la reserva', 142, true);

  section('DETALLE DE LA CITA', 155);
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...RULE);
  doc.roundedRect(18, 160, 174, 55, 2.5, 2.5, 'FD');
  detailRow('Sede', safe(data.branch), 168);
  detailRow('Especialista', safe(data.professional), 177);
  detailRow('Fecha', data.appointmentDate ? dateLabel(data.appointmentDate) : 'Por coordinar', 186);
  detailRow('Hora', formatAppointmentTime(data.appointmentTime), 195);
  detailRow('Medio de pago', safe(data.paymentChannel), 204);
  detailRow(paid ? 'Operación' : 'Estado', paid ? safe(data.operationNumber) : 'Pendiente de pago', 212, true);

  section('DETALLE DEL IMPORTE', 224);
  doc.setDrawColor(...RULE);
  doc.line(18, 228, 192, 228);
  label('CONCEPTO', 18, 236);
  label('IMPORTE', 168, 236);

  const hasDiscount = Number.isFinite(data.originalPrice) && (data.originalPrice ?? 0) > data.amount + 0.005;
  const regularPrice = hasDiscount ? data.originalPrice! : data.amount;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...INK);
  doc.text(fit(data.serviceName, 129), 18, 245);
  doc.text(`S/ ${regularPrice.toFixed(2)}`, 192, 245, { align: 'right' });
  if (hasDiscount) {
    const discountValue = regularPrice - data.amount;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(...DEEP_TEAL);
    doc.text('Descuento aplicado', 18, 254);
    doc.text(`- S/ ${discountValue.toFixed(2)}`, 192, 254, { align: 'right' });
  }
  doc.setDrawColor(...RULE);
  doc.line(18, 259, 192, 259);

  doc.setFillColor(...HEADER);
  doc.roundedRect(18, 264, 174, 17, 2, 2, 'F');
  doc.setFillColor(...DEEP_TEAL);
  doc.rect(18, 264, 1.2, 17, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(paid ? 'TOTAL PAGADO' : 'TOTAL PENDIENTE', 24, 272);
  doc.setFontSize(16);
  doc.text(`S/ ${data.amount.toFixed(2)}`, 186, 274, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Pago verificado y reserva confirmada' : 'El pago está pendiente de validación', 24, 278);

  doc.setDrawColor(...RULE);
  doc.line(18, 286, 192, 286);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Constancia administrativa emitida después de validar el pago.' : 'Esta orden no acredita un pago realizado ni confirma la cita.', 18, 292);
  doc.text('1 / 1', 192, 292, { align: 'right' });
  return doc;
}
