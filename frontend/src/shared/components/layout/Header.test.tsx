import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { leadWhatsAppControlChanged } from '@/modules/lead/services/leadWhatsAppAlerts';
import { Header } from './Header';
import { Toaster } from '@/shared/components/ui/toaster';
import type { WhatsAppAlert } from '@/modules/lead/services/leadWhatsAppAlerts';

vi.mock('@/shared/context/SidebarContext', () => ({
  CLINIC_BRANCH_OPTIONS: [],
  useSidebar: () => ({ activeBranch: 'California', setActiveBranch: vi.fn(), commandOpen: false, setCommandOpen: vi.fn() }),
}));
vi.mock('@/shared/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('./Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./CommandPaletteModal', () => ({ CommandPaletteModal: () => null }));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function CurrentRoute() {
  const location = useLocation();
  return <output>{location.pathname + location.search}</output>;
}

it('conserva las notificaciones leídas al volver a cargar la aplicación', () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ alerts: [] }) })));
  const mount = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Header /></MemoryRouter></QueryClientProvider>);
  const bell = () => screen.getByRole('button', { name: 'Notificaciones' });

  const first = mount();
  expect(bell()).toHaveTextContent('2');
  fireEvent.click(bell());
  fireEvent.click(screen.getByRole('button', { name: /3 nuevos prospectos en Buyer/ }));
  first.unmount();

  const second = mount();
  expect(bell()).toHaveTextContent('1');
  fireEvent.click(bell());
  fireEvent.click(screen.getByRole('button', { name: 'Marcar leídas' }));
  second.unmount();

  mount();
  expect(bell().textContent).toBe('');
  fireEvent.click(bell());
  expect(screen.queryByRole('button', { name: 'Marcar leídas' })).not.toBeInTheDocument();
});

it('shows an urgent LEAD notification until the opportunity is taken and links to its WhatsApp conversation', async () => {
  let alerts = [{ id: '15', requestId: 90, personId: 55, receivedAt: '2026-11-12T20:24:00.000Z' }];
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ alerts }) })));
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MemoryRouter><Header /><CurrentRoute /></MemoryRouter></QueryClientProvider>);

  const bell = await screen.findByRole('button', { name: /1 alerta urgente de WhatsApp LEAD/ });
  expect(bell.querySelector('svg')).toHaveClass('lead-alert-bell');
  fireEvent.click(bell);
  fireEvent.click(screen.getByRole('button', { name: 'Marcar leídas' }));
  const notification = screen.getByRole('link', { name: /URGENTE.*Solicitud #90/ });
  fireEvent.click(notification);
  expect(screen.getByText('/lead/55/negotiation?solicitud=90&conversacion=whatsapp')).toBeVisible();

  alerts = [];
  act(() => { window.dispatchEvent(new Event(leadWhatsAppControlChanged)); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Notificaciones' }).querySelector('svg'))
    .not.toHaveClass('lead-alert-bell'));
});

it('shows one alert and chime for a live batch and refreshes when the stream disconnects', async () => {
  let alerts: WhatsAppAlert[] = [];
  const fetchAlerts = vi.fn(async () => ({ ok: true, json: async () => ({ alerts }) }));
  let feed: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { feed = controller; } });
  const encode = (text: string) => new TextEncoder().encode(text);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/alerts/stream')
    ? new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }) : fetchAlerts()));
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const start = vi.fn();
  class MockAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    close = async () => {};
    createGain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
    createOscillator = () => ({ frequency: { setValueAtTime: vi.fn() }, connect: (node: unknown) => node, start, stop: vi.fn() });
  }
  vi.stubGlobal('AudioContext', MockAudioContext);
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/payer']}><Header /><Toaster /></MemoryRouter></QueryClientProvider>);
  fireEvent.pointerDown(window);
  await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(1));

  alerts = [90, 91].map(requestId => ({ id: String(requestId), requestId, personId: 55, receivedAt: '2026-11-12T20:24:00.000Z' }));
  await act(async () => {
    feed.enqueue(encode(': heartbeat\n\ndata: ref'));
    feed.enqueue(encode('resh\n\n'));
  });
  const notice = await screen.findByText('2 conversaciones requieren atención del asesor.');
  expect(notice).toBeVisible();
  expect(notice.closest('li')).toHaveAttribute('data-below-header', 'true');
  expect(notice.closest('ol')).toHaveClass('notification-viewport');
  expect(screen.getAllByText('URGENTE · WhatsApp LEAD')).toHaveLength(1);
  expect(start).toHaveBeenCalledTimes(2);
  await act(async () => { await client.invalidateQueries({ queryKey: ['lead', 'whatsapp-alerts'] }); });
  expect(start).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Ver notificaciones' }));
  expect(screen.getAllByRole('link', { name: /URGENTE.*Solicitud/ })).toHaveLength(2);

  alerts = [];
  await act(async () => { feed.close(); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Notificaciones' }).querySelector('svg'))
    .not.toHaveClass('lead-alert-bell'));
});
