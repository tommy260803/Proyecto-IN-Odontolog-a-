// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { findManyNotif, updateNotif, findUniqueNotif, updateReserva, updatePago, createPago, findFirstAtencion, createAtencion, updatePersona, findFirstEtapa } = vi.hoisted(() => ({
  findManyNotif: vi.fn(),
  updateNotif: vi.fn(),
  findUniqueNotif: vi.fn(),
  updateReserva: vi.fn(),
  updatePago: vi.fn(),
  createPago: vi.fn(),
  findFirstAtencion: vi.fn(),
  createAtencion: vi.fn(),
  updatePersona: vi.fn(),
  findFirstEtapa: vi.fn(),
}));

vi.mock('../src/db', () => ({
  prisma: {
    notificacionesCobroProgramadas: {
      findMany: findManyNotif,
      update: updateNotif,
      findUnique: findUniqueNotif,
    },
    reservas: { update: updateReserva },
    pagos: { update: updatePago, create: createPago },
    personas: { update: updatePersona },
    etapas: { findFirst: findFirstEtapa },
    atenciones: { findFirst: findFirstAtencion, create: createAtencion },
    incidencias: { create: vi.fn().mockResolvedValue({}) },
    profesionales: { findFirst: vi.fn().mockResolvedValue({ id_profesional: 1 }) },
    sedes: { findFirst: vi.fn().mockResolvedValue({ id_sede: 1 }) },
  },
}));

const mockSendEmail = vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' });
vi.mock('../src/routes/payer.routes', () => ({
  sendPaymentNoticeOrConfirmation: mockSendEmail,
  generateBackendPdfBase64: vi.fn().mockResolvedValue('JVBERi0xLjQK...'),
}));

beforeEach(() => {
  vi.resetAllMocks();
  findFirstEtapa.mockResolvedValue({ id_etapa: 4, nombre: 'CUSTOMER' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('procesarPendientes() no despacha si no hay notificaciones cuya fecha_hora_programada <= now', async () => {
  const { ScheduledNoticeService } = await import('../src/services/scheduledNoticeService');
  findManyNotif.mockResolvedValue([]);

  const res = await ScheduledNoticeService.procesarPendientes();
  expect(res.procesadas).toBe(0);
  expect(mockSendEmail).not.toHaveBeenCalled();
});

test('procesarPendientes() despacha a la hora programada cuando fecha_hora_programada <= now', async () => {
  const { ScheduledNoticeService } = await import('../src/services/scheduledNoticeService');

  const now = new Date();
  const pastScheduled = new Date(now.getTime() - 60000); // 1 minuto en el pasado

  findManyNotif.mockResolvedValue([
    {
      id_notificacion: 42,
      id_reserva: 105,
      id_persona: 7,
      fecha_hora_programada: pastScheduled,
      estado: 'PROGRAMADO',
      email_destinatario: 'paciente.test@gmail.com',
      monto_cobro: 180.00,
      asunto: 'Confirmación de Cobro',
      mensaje_personalizado: 'Cobro procesado.',
    },
  ]);

  findUniqueNotif.mockResolvedValue({
    id_notificacion: 42,
    id_reserva: 105,
    id_persona: 7,
    estado: 'PROGRAMADO',
    email_destinatario: 'paciente.test@gmail.com',
    monto_cobro: 180.00,
    asunto: 'Confirmación de Cobro',
    Reserva: {
      id_reserva: 105,
      id_persona: 7,
      Persona: { nombres: 'Carlos', apellidos: 'López', dni: '72345678', numero: '987654321' },
      Opcion: {
        precio_ofrecido: 180.00,
        Disponibilidad: {
          fecha: new Date(),
          hora_inicio: new Date(),
          Sede: { nombre: 'Sede Central' },
          Profesional: { nombres: 'Ana', apellidos: 'Torres' },
        },
      },
      Solicitud: { Servicio: { nombre: 'Ortodoncia', Tarifas: [{ precio: 200.00 }] } },
      Pagos: [],
    },
  });

  updatePago.mockResolvedValue({});
  createPago.mockResolvedValue({ id_pago: 99, estado: 'Validado' });
  updateReserva.mockResolvedValue({});
  updatePersona.mockResolvedValue({});
  updateNotif.mockResolvedValue({ id_notificacion: 42, estado: 'ENVIADO' });

  const res = await ScheduledNoticeService.procesarPendientes();

  expect(res.procesadas).toBe(1);
  // Verifica que se validó el pago en SQL Server
  expect(createPago).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      estado: 'Validado',
      id_reserva: 105,
    }),
  }));
  // Verifica que la reserva se confirmó
  expect(updateReserva).toHaveBeenCalledWith(expect.objectContaining({
    where: { id_reserva: 105 },
    data: expect.objectContaining({ estado: 'Confirmada', confirmacion_explicita: true }),
  }));
  // Verifica que se envió el correo con constancia PDF a Gmail
  expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
    toEmail: 'paciente.test@gmail.com',
    isValidated: true,
    includePdf: true,
  }));
  // Verifica que la notificación pasó a ENVIADO
  expect(updateNotif).toHaveBeenCalledWith(expect.objectContaining({
    where: { id_notificacion: 42 },
    data: expect.objectContaining({ estado: 'ENVIADO' }),
  }));
});
