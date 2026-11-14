import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { LeadOperationalFollowUp } from './LeadOperationalFollowUp';
import { leadWhatsAppControlChanged } from '../services/leadWhatsAppAlerts';

vi.mock('../services/leadWhatsAppAlerts', () => ({
  requiresLeadStaff: false,
  useLeadStaffSession: () => null,
  leadWhatsAppControlChanged: 'lead-whatsapp-control-changed',
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('conserva la fecha visible mientras atiende el asesor y refresca al devolver el control', async () => {
  let advisor = true;
  const fetchMock = vi.fn(async (url: string) => Response.json(url.endsWith('/priorities') ? [] : {
    instalado: true, automatico_disponible: true, fecha: '2026-11-16T13:00:00Z',
    seguimiento: { estado: 'PROGRAMADO', origen_whatsapp: 'PACIENTE', turno_whatsapp: null,
      motivo: 'El paciente pidió que le escribamos el 16 de noviembre de 2026.', espera_asesor: advisor },
  }));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><LeadOperationalFollowUp requestId={1031} /></QueryClientProvider>);

  expect(await screen.findByText('Programado', { exact: true })).toBeVisible();
  expect(screen.getByText(/Próximo contacto/)).toHaveTextContent(/16 nov\.? 2026/);
  expect(screen.getByText(/El envío automático queda en espera/)).toBeVisible();

  advisor = false;
  window.dispatchEvent(new Event(leadWhatsAppControlChanged));
  await waitFor(() => expect(screen.queryByText(/El envío automático queda en espera/)).toBeNull());
  expect(screen.getByText('Programado', { exact: true })).toBeVisible();
  expect(screen.getByText(/Próximo contacto/)).toHaveTextContent(/16 nov\.? 2026/);
  client.clear();
});
