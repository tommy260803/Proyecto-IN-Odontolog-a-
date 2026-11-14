// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../src/db', () => ({
  prisma: {
    reservas: { findMany },
    reglasAgentePayer: {
      findUnique: vi.fn().mockResolvedValue({
        id_regla: 1,
        clave: 'GLOBAL',
        etapa1_preventivo_horas: 48,
        etapa2_urgencia_horas: 24,
        prorroga_express_horas: 24,
        anticipacion_minima_horas: 72,
        frecuencia_cron_minutos: 60,
        auto_cancelar_medianoche: true,
        whatsapp_activo: true,
        email_activo: true,
      }),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock('../src/routes/payer.routes', () => ({ sendPaymentNoticeOrConfirmation: vi.fn(), generateBackendPdfBase64: vi.fn() }));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  findMany.mockReset().mockResolvedValue([]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
test('desactivar cobranza impide la consulta inicial y el temporizador', async () => {
  vi.stubEnv('DUNNING_ENABLED', 'false');
  const { startDunningScheduler } = await import('../src/services/dunningScheduler');
  startDunningScheduler();
  expect(findMany).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
test('sin configurar el flag conserva la ejecucion anterior', async () => {
  vi.stubEnv('DUNNING_ENABLED', undefined);
  const { startDunningScheduler } = await import('../src/services/dunningScheduler');
  startDunningScheduler();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1);
});
