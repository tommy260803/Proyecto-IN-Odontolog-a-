import { describe, expect, it } from 'vitest';
import { createPaymentDocumentPdf, formatAppointmentTime } from './paymentDocument';
import logoDataUrl from './Logo_NexoSalud.png?inline';

describe('documentos de pago', () => {
  it('muestra la hora de la cita en formato de 12 horas', () => {
    expect(formatAppointmentTime('14:00')).toBe('2:00 p. m.');
    expect(formatAppointmentTime('00:15')).toBe('12:15 a. m.');
    expect(formatAppointmentTime('12:30')).toBe('12:30 p. m.');
  });

  it.each(['ORDER', 'RECEIPT'] as const)('incluye el descuento real en %s', (type) => {
    const pdf = createPaymentDocumentPdf({
      type, code: 'PR-123', patientName: 'Paciente de prueba', serviceName: 'Consulta',
      appointmentTime: '14:00', amount: 212.5, originalPrice: 250.75,
    }, logoDataUrl);
    const output = pdf.output();
    expect(output).toContain('Descuento aplicado');
    expect(output).toContain('38.25');
    expect(output).toContain('2:00 p. m.');
  });

  it('omite el descuento cuando no hay precio regular mayor', () => {
    const pdf = createPaymentDocumentPdf({
      type: 'ORDER', code: 'PR-124', patientName: 'Paciente de prueba',
      serviceName: 'Consulta', amount: 212.5, originalPrice: 212.5,
    }, logoDataUrl);
    expect(pdf.output()).not.toContain('Descuento aplicado');
  });
});
