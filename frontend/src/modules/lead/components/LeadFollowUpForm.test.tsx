import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import LeadFollowUpForm from './LeadFollowUpForm';

test('conserva el borrador ante un conflicto y exige aceptar la fecha vigente antes de reintentar', async () => {
  const current = '2100-01-01T04:30:00.000Z';
  const next = '2100-01-01T04:45:00.000Z';
  const send = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Otro operador cambió el seguimiento.' }), { status: 409 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ fecha_proximo_seguimiento: next }), { status: 200 }));
  vi.stubGlobal('fetch', send);
  const client = new QueryClient();
  const form = (date: string | null) => (
    <QueryClientProvider client={client}><LeadFollowUpForm requestId="12" token="sesión-de-prueba" current={date} /></QueryClientProvider>
  );
  try {
    const view = render(form(null));
    const field = screen.getByLabelText('Fecha y hora de Lima');
    const save = screen.getByRole('button', { name: 'Guardar seguimiento' });
    fireEvent.change(field, { target: { value: '2099-12-31T23:45' } });
    fireEvent.click(save);
    await screen.findByText('Otro operador cambió el seguimiento.');
    view.rerender(form(current));
    expect(field).toHaveValue('2099-12-31T23:45');
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar la fecha registrada como referencia' }));
    fireEvent.click(save);
    await screen.findByText('Seguimiento guardado.');
    expect(send.mock.calls.map(([, options]) => JSON.parse(options.body).fecha_esperada_utc)).toEqual([null, current]);
  } finally {
    vi.unstubAllGlobals();
  }
});
