import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LeadChat } from './LeadChat';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const messages = [{ id_mensaje: 5, remitente: 'PACIENTE', texto: '¿Puedo ir por la tarde?', recibido_utc: 'registrado' }];

test('pide una sugerencia tras confirmar QA y permite copiarla al borrador sin enviarla', async () => {
  vi.stubEnv('VITE_LEAD_GEMINI_QA', 'true');
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  vi.stubGlobal('confirm', confirm);
  const fetch = vi.fn()
    .mockImplementationOnce(async () => Response.json({ mensajes: messages, revision: null }))
    .mockImplementationOnce(async () => Response.json({ intencion: 'HORARIO', sugerencia: '¿Qué horario prefieres?' }));
  vi.stubGlobal('fetch', fetch);
  render(<LeadChat requestId="12" token="prueba" staff />);
  const button = await screen.findByRole('button', { name: 'Pedir sugerencia a Gemini' });
  fireEvent.click(button);
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: 'Usar como borrador' }));
  expect(screen.getByLabelText('Mensaje')).toHaveValue('¿Qué horario prefieres?');
  expect(fetch).toHaveBeenCalledTimes(2);
  const [url, init] = fetch.mock.calls[1];
  expect(url).toMatch(/\/staff\/12\/suggestion$/);
  expect(JSON.parse(init.body)).toEqual({ id_mensaje: 5, datos_sinteticos: true });
});

test('oculta la función al paciente y la bloquea para el personal durante una pausa', async () => {
  vi.stubEnv('VITE_LEAD_GEMINI_QA', 'true');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.endsWith('/proposals')
    ? { propuestas: [] } : { mensajes: messages, revision: { id_revision: 1, pausado: true, motivo: 'Prueba' } })));
  const patient = render(<LeadChat requestId="12" token="paciente" />);
  await screen.findByText(messages[0].texto);
  expect(screen.queryByRole('button', { name: 'Pedir sugerencia a Gemini' })).toBeNull();
  patient.unmount();
  render(<LeadChat requestId="12" token="personal" staff />);
  expect(await screen.findByRole('button', { name: 'Pedir sugerencia a Gemini' })).toBeDisabled();
});
