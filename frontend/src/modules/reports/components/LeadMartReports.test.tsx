import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import { LeadMartReports, martRate } from './LeadMartReports';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('el total se calcula con sumas y no promediando porcentajes de grupos', () => {
  // Grupos: 1/1=100 % y 1/9=11,11 %. El total correcto es 2/10=20 %.
  expect(martRate('L1', { aceptadas: 2, rechazadas: 8, especiales: 0 })).toBe(20);
  expect(martRate('L2', { aceptadas: 4, rechazadas: 6, especiales: 3 })).toBe(30);
  expect(martRate('L3', { aceptadas: 4, rechazadas: 6, especiales: 2 })).toBe(20);
  expect(martRate('L1', { aceptadas: 0, rechazadas: 0, especiales: 0 })).toBeNull();
});

test('el análisis dimensional respeta el período, filtra con keys y no ofrece sede para L2', async () => {
  const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/catalogs') ? {
    KeyServicio: [{ id: 7, nombre: 'Limpieza dental' }], KeySede: [{ id: 3, nombre: 'California' }],
    KeyPromocion: [{ id: 5, nombre: 'Campaña escolar' }],
  } : { rows: [{ servicio: 'Limpieza dental', grupo: 'Campaña escolar', aceptadas: 4, rechazadas: 6, especiales: 3 }],
    totals: { aceptadas: 4, rechazadas: 6, especiales: 3 }, source: 'NexoSalud_Mart', consultedAt: '2026-11-12T10:00:00Z' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><LeadMartReports period="2025-03" /></QueryClientProvider>);
  await screen.findByRole('region', { name: 'Desglose dimensional LEAD' });
  expect(screen.getByLabelText('Sede')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /L2.*Tasa de rechazo/ }));
  await screen.findAllByText(/30[.,]00 %/);
  expect(screen.queryByLabelText('Sede')).toBeNull();
  expect(screen.queryByLabelText('Negociador')).toBeNull();
  fireEvent.change(screen.getByLabelText('Promoción'), { target: { value: '5' } });
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('report=L2&period=2025-03&KeyPromocion=5'))).toBe(true));
  expect(within(await screen.findByRole('region', { name: 'Desglose dimensional LEAD' })).getByText('Campaña escolar')).toBeVisible();
  client.clear();
});

test('un Mart vacío muestra No calculable y permite volver a consultar', async () => {
  const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/catalogs') ? {} : {
    rows: [], totals: { aceptadas: 0, rechazadas: 0, especiales: 0 }, source: 'NexoSalud_Mart', consultedAt: '2026-11-12T10:00:00Z',
  })));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><LeadMartReports period="all" /></QueryClientProvider>);
  await screen.findByText('Sin resultados cargados en el Mart para estos filtros.');
  expect(screen.getAllByText('No calculable')).toHaveLength(2);
  const count = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar consulta' }));
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(count));
  client.clear();
});
