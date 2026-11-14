import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduledNoticeModal } from './ScheduledNoticeModal';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { PayerState } from '@/domain/enums';

const mockPayer = {
  id: '764',
  leadId: '101',
  reservationId: '764',
  amountToPay: 150.0,
  originalPrice: 200.0,
  serviceName: 'Blanqueamiento Dental LED',
  currency: 'PEN',
  state: PayerState.PENDING,
  createdAt: '2026-09-15T10:00:00Z',
  person: {
    firstName: 'Diego',
    lastName: 'Villanueva',
    email: 'diego.villanueva@gmail.com',
    phone: '987654321',
    documentNumber: '72345678',
  },
  reservation: {
    id: '764',
    date: '2026-09-20',
    time: '11:00',
    branchId: 'Sede San Isidro',
    professionalId: 'Dra. Carmen Mendoza',
  },
} as unknown as PayerWithDetails;

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('ScheduledNoticeModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/notificaciones-cobro/764')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            notificaciones: [
              {
                id_notificacion: 1,
                id_reserva: 764,
                id_persona: 101,
                fecha_hora_programada: '2026-09-18T10:00:00Z',
                estado: 'PROGRAMADO',
                tipo_aviso: 'AVISO_COBRO',
                email_destinatario: 'diego.villanueva@gmail.com',
                monto_cobro: 150.0,
                asunto: 'Confirmación oficial',
                creado_por: 'Agente IA',
                fecha_creacion: '2026-09-15T10:00:00Z',
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    }));
  });

  it('renderiza correctamente los datos del paciente y el formulario de cobro directo', async () => {
    renderWithClient(
      <ScheduledNoticeModal
        payer={mockPayer}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Cobro Directo Automático y Constancia a Gmail/i)).toBeInTheDocument();
    expect(screen.getByText(/Diego Villanueva/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('diego.villanueva@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/Cobro Directo en Sistema y Emisión de Constancia Oficial/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/PROGRAMADO/i)).toBeInTheDocument();
    });
  });

  it('permite programar un cobro directo y llamar al endpoint correspondiente', async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/notificaciones-cobro/programar')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, notificacion: { id_notificacion: 2 } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, notificaciones: [] }),
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    renderWithClient(
      <ScheduledNoticeModal
        payer={mockPayer}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Guardar y Programar Cobro/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/notificaciones-cobro/programar'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
