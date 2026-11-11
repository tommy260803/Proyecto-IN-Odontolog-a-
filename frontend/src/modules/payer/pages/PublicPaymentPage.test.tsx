import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicPaymentPage from './PublicPaymentPage';

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-pdf') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Vista Pública de Pasarela de Pago (PublicPaymentPage)', () => {
  it('renderiza la pasarela pública con temporizador expirable, paciente y métodos de pago', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const dateStr = futureDate.toISOString().split('T')[0];

    const mockPayer = {
      id: 759,
      amountToPay: 200,
      originalPrice: 350,
      serviceName: 'Blanqueamiento Dental',
      state: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      person: {
        firstName: 'Natalia',
        lastName: 'Cueva',
        email: 'natalia.cueva@example.com',
        phone: '952000621',
        documentNumber: '42000621',
      },
      reservation: {
        date: dateStr,
        time: '09:00',
        branchId: 'Sede Centro Historico',
        professionalId: 'Dr. Mendoza',
      },
      payment: {
        preReservationCode: 'ORD-00759-2026',
      },
      incidents: [],
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/payer/759')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockPayer,
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/pasarela-pago/ORD-00759-2026']}>
        <Routes>
          <Route path="/pasarela-pago/:orderCode" element={<PublicPaymentPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Debe mostrar la cabecera pública de NexoSalud
    expect((await screen.findAllByText(/NexoSalud/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Natalia Cueva')).toBeInTheDocument();
    expect(screen.getAllByText(/ORD-00759-2026/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Blanqueamiento Dental/i)).toBeInTheDocument();
    expect(screen.getAllByText(/S\/ 200.00/i).length).toBeGreaterThan(0);

    // Debe mostrar el temporizador de tiempo límite para abonar
    expect(screen.getByText(/Tiempo Límite para Abonar/i)).toBeInTheDocument();

    // Métodos disponibles
    expect(screen.getAllByRole('button', { name: /Yape \/ Plin/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Tarjeta/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Transferencia/i }).length).toBeGreaterThan(0);
  });

  it('detecta enlace expirable cuando la reserva venció o fue cancelada', async () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 días atrás
    const mockExpiredPayer = {
      id: 759,
      amountToPay: 200,
      serviceName: 'Blanqueamiento Dental',
      state: 'REJECTED',
      createdAt: pastDate.toISOString(),
      person: {
        firstName: 'Natalia',
        lastName: 'Cueva',
      },
      reservation: {
        date: pastDate.toISOString().split('T')[0],
      },
      reservationHistory: [{ statusRaw: 'Cancelada' }],
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/payer/759')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockExpiredPayer,
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/pasarela-pago/ORD-00759-2026']}>
        <Routes>
          <Route path="/pasarela-pago/:orderCode" element={<PublicPaymentPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Debe mostrar la pantalla de enlace expirado
    expect(await screen.findByText(/Enlace de Pago Expirado/i)).toBeInTheDocument();
    expect(screen.getByText(/Plazo de Tolerancia Vencido/i)).toBeInTheDocument();
    expect(screen.getByText(/Reactivar Cupo por WhatsApp/i)).toBeInTheDocument();
  });

  it('permite pagar en modo test y muestra la pantalla triunfal de confirmación', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const mockPayer = {
      id: 759,
      amountToPay: 200,
      serviceName: 'Blanqueamiento Dental',
      state: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      person: {
        firstName: 'Natalia',
        lastName: 'Cueva',
      },
      reservation: {
        date: futureDate.toISOString().split('T')[0],
      },
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/payer/759/validate')) {
        return { ok: true, status: 200, json: async () => ({ success: true, state: 'VALIDADO' }) };
      }
      if (url.includes('/payer/759')) {
        return { ok: true, status: 200, json: async () => mockPayer };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/pasarela-pago/ORD-00759-2026']}>
        <Routes>
          <Route path="/pasarela-pago/:orderCode" element={<PublicPaymentPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Natalia Cueva')).toBeInTheDocument();

    const testBtn = screen.getByRole('button', { name: /⚡ Aprobar Test/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/¡Pago Confirmado, Natalia!/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Descargar Constancia Oficial PDF/i)).toBeInTheDocument();
  });
});
