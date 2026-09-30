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

const NAVY: [number, number, number] = [24, 42, 57];
const TEAL: [number, number, number] = [0, 117, 111];
const MUTED: [number, number, number] = [101, 117, 127];
const RULE: [number, number, number] = [219, 226, 229];

function dateLabel(value?: string | Date): string {
  if (!value) return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

export function createPaymentDocumentPdf(data: PaymentDocumentData): jsPDF {
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
    doc.setFontSize(7.3);
    doc.setTextColor(...MUTED);
    doc.text(value.toUpperCase(), x, y);
  };
  const field = (heading: string, value: string, x: number, y: number, width = 77) => {
    label(heading, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(fit(safe(value), width), x, y + 7);
  };
  const section = (number: string, heading: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TEAL);
    doc.text(number, 18, y);
    doc.setTextColor(...NAVY);
    doc.text(heading.toUpperCase(), 28, y);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(18, y + 4, 192, y + 4);
  };

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 210, 4, 'F');
  doc.setFillColor(...NAVY);
  doc.roundedRect(18, 17, 12, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('N', 24, 25.4, { align: 'center' });
  doc.setTextColor(...NAVY);
  doc.setFontSize(13);
  doc.text('NEXOSALUD', 34, 22.1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('CLÍNICA ODONTOLÓGICA ESPECIALIZADA', 34, 27.2);
  label('RUC 20608945123', 192 - 32, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('PERÚ', 192, 27, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...NAVY);
  doc.text(paid ? 'Constancia de pago' : 'Orden de pago', 18, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Pago validado y cita confirmada' : 'Pre-reserva registrada · pago pendiente', 18, 57);
  doc.setFillColor(244, 247, 247);
  doc.roundedRect(126, 42, 66, 21, 2, 2, 'F');
  label(paid ? 'NÚMERO DE CONSTANCIA' : 'REFERENCIA DE RESERVA', 130, 48);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(fit(data.code, 58), 130, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Emitido: ${dateLabel(data.issuedAt)}`, 130, 60);

  section('01', 'Paciente', 76);
  field('Nombre completo', data.patientName, 18, 87, 79);
  field('Documento de identidad', safe(data.documentNumber), 108, 87);
  field('Teléfono', safe(data.phone), 18, 104);
  field('Correo electrónico', safe(data.email), 108, 104);

  section('02', 'Atención odontológica', 126);
  field('Sede', safe(data.branch), 18, 137);
  field('Especialista', safe(data.professional), 108, 137);
  field('Fecha de la cita', data.appointmentDate ? dateLabel(data.appointmentDate) : 'Por coordinar', 18, 154);
  field('Hora', safe(data.appointmentTime), 108, 154);
  field(paid ? 'Medio de pago' : 'Medio de pago elegido', safe(data.paymentChannel), 18, 171);
  field(paid ? 'Referencia de operación' : data.familyPatient ? 'Paciente de la atención' : 'Estado de la reserva', paid ? safe(data.operationNumber) : data.familyPatient ? data.familyPatient : 'Pendiente de pago', 108, 171);

  section('03', 'Detalle económico', 198);
  label('CONCEPTO', 18, 209);
  label('IMPORTE', 192 - 25, 209);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text(fit(data.serviceName, 132), 18, 218);
  doc.text(`S/ ${data.amount.toFixed(2)}`, 192, 218, { align: 'right' });
  doc.setDrawColor(...RULE);
  doc.line(18, 223, 192, 223);
  if (data.originalPrice && data.originalPrice > data.amount) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Tarifa regular: S/ ${data.originalPrice.toFixed(2)}`, 18, 231);
    doc.text(`Beneficio aplicado: ${data.discountPercent ?? Math.round((1 - data.amount / data.originalPrice) * 100)}%`, 192, 231, { align: 'right' });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(paid ? 'Abono conciliado con la reserva.' : 'Importe correspondiente a la pre-reserva.', 18, 231);
  }

  doc.setFillColor(...NAVY);
  doc.roundedRect(18, 242, 174, 27, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(201, 225, 225);
  doc.text(paid ? 'TOTAL PAGADO' : 'TOTAL PENDIENTE', 24, 252);
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(`S/ ${data.amount.toFixed(2)}`, 186, 255, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(230, 239, 239);
  doc.text(paid ? 'Pago verificado · reserva confirmada' : 'Pago pendiente · reserva sujeta a confirmación', 24, 262);

  doc.setDrawColor(...RULE);
  doc.line(18, 278, 192, 278);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(paid ? 'Constancia administrativa emitida después de validar el pago.' : 'Esta orden no acredita un pago realizado ni confirma la cita.', 18, 284);
  doc.text('NexoSalud · Atención odontológica', 18, 289);
  doc.text('Página 1 de 1', 192, 289, { align: 'right' });
  return doc;
}
