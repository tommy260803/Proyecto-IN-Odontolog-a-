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
const ACCENT: [number, number, number] = [0, 131, 128];

function dateLabel(value?: string | Date): string {
  if (!value) return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
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
  const field = (heading: string, value: string, x: number, y: number, width = 73) => {
    label(heading, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.3);
    doc.setTextColor(...INK);
    doc.text(fit(safe(value), width), x, y + 6.5);
  };

  // Identidad: el archivo de public es la única nota de color del encabezado.
  doc.addImage(logoDataUrl, 'PNG', 18, 10.5, 43, 24.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...INK);
  doc.text('DOCUMENTO DIGITAL', 192, 21, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('RUC 20608945123  |  PERÚ', 192, 28, { align: 'right' });
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(18, 42, 192, 42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...INK);
  doc.text(paid ? 'Constancia de pago' : 'Orden de pago', 18, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Pago validado y cita confirmada' : 'Documento de pre-reserva', 18, 67);

  doc.setFillColor(...SOFT);
  doc.setDrawColor(...RULE);
  doc.roundedRect(148, 50, 44, 10, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(...INK);
  doc.text(paid ? 'PAGO VALIDADO' : 'PAGO PENDIENTE', 170, 56.4, { align: 'center' });

  label(paid ? 'NÚMERO DE CONSTANCIA' : 'REFERENCIA DE RESERVA', 18, 79);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(fit(data.code, 86), 18, 86);
  label('FECHA DE EMISIÓN', 137, 79);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(dateLabel(data.issuedAt), 137, 86);
  doc.setDrawColor(...RULE);
  doc.line(18, 93, 192, 93);

  // Dos paneles de lectura rápida, sin bloques de color intensos.
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...RULE);
  doc.roundedRect(18, 102, 84, 101, 2.5, 2.5, 'FD');
  doc.roundedRect(108, 102, 84, 101, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(...INK);
  doc.text('PACIENTE', 23, 112);
  doc.text('DETALLE DE LA CITA', 113, 112);
  doc.setDrawColor(...RULE);
  doc.line(23, 116, 97, 116);
  doc.line(113, 116, 187, 116);

  field('Nombre completo', data.patientName, 23, 125);
  field('Documento', safe(data.documentNumber), 23, 143);
  field('Teléfono', safe(data.phone), 23, 161);
  field('Correo electrónico', safe(data.email), 23, 179);
  field('Atención para', data.familyPatient || 'Titular de la reserva', 23, 193);

  field('Sede', safe(data.branch), 113, 125);
  field('Especialista', safe(data.professional), 113, 143);
  field('Fecha y hora', data.appointmentDate ? `${dateLabel(data.appointmentDate)}  |  ${safe(data.appointmentTime)}` : 'Por coordinar', 113, 161);
  field('Medio de pago', safe(data.paymentChannel), 113, 179);
  field(paid ? 'Operación' : 'Estado', paid ? safe(data.operationNumber) : 'Pendiente de pago', 113, 193);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.7);
  doc.setTextColor(...INK);
  doc.text('DETALLE DEL IMPORTE', 18, 215);
  doc.setDrawColor(...RULE);
  doc.line(18, 219, 192, 219);
  label('CONCEPTO', 18, 228);
  label('IMPORTE', 168, 228);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK);
  doc.text(fit(data.serviceName, 132), 18, 239);
  doc.text(`S/ ${data.amount.toFixed(2)}`, 192, 239, { align: 'right' });
  doc.setDrawColor(...RULE);
  doc.line(18, 244, 192, 244);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (data.originalPrice && data.originalPrice > data.amount) {
    doc.text(`Tarifa regular  S/ ${data.originalPrice.toFixed(2)}`, 18, 252);
    doc.text(`Descuento  ${data.discountPercent ?? Math.round((1 - data.amount / data.originalPrice) * 100)}%`, 192, 252, { align: 'right' });
  } else {
    doc.text(paid ? 'Abono conciliado con la reserva.' : 'Importe correspondiente a la pre-reserva.', 18, 252);
  }

  doc.setFillColor(245, 247, 247);
  doc.roundedRect(18, 260, 174, 19, 2, 2, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(18, 260, 1.1, 19, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(paid ? 'TOTAL PAGADO' : 'TOTAL PENDIENTE', 24, 269);
  doc.setFontSize(17);
  doc.text(`S/ ${data.amount.toFixed(2)}`, 186, 270.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Pago verificado y reserva confirmada' : 'El pago está pendiente de validación', 24, 275);

  doc.setDrawColor(...RULE);
  doc.line(18, 285, 192, 285);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Constancia administrativa emitida después de validar el pago.' : 'Esta orden no acredita un pago realizado ni confirma la cita.', 18, 291);
  doc.text('1 / 1', 192, 291, { align: 'right' });
  return doc;
}
