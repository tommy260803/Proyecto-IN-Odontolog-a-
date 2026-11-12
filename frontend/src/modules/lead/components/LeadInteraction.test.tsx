import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeadInteraction } from './LeadInteraction';

const fecha_hora = '2026-11-12T15:00:00.000Z';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Conversación de negociación', () => {
  it('muestra la actividad del Agente y las respuestas del ChatBot en tarjetas distintas', async () => {
    const onUpdateProposal = vi.fn().mockResolvedValue(undefined);
    const horario = { id_disponibilidad: 8, id_sede: 1, id_profesional: 2, fecha: '2026-11-20',
      inicio: '15:00', fin: '15:30', sede: 'Centro', profesional: 'Especialista' };
    vi.stubGlobal('fetch', vi.fn(async (input: string) => input.endsWith('/report-catalogs')
      ? Response.json({ canales: [] })
      : input.includes('comunicacion=presencial') ? Response.json({ mensajes: [], hay_anteriores: false }) : Response.json({
        mensajes: [
          { id_interaccion: 1, fecha_hora, tipo: 'Respuesta del paciente', resultado: 'WhatsApp', mensaje: 'Busco otro horario.' },
          {
            id_interaccion: 2, fecha_hora, tipo: 'Respuesta del chatbot', resultado: 'WhatsApp',
            mensaje: '*Horario:* 15:00', accion_chatbot: 'Compartió alternativas de horario',
            actividad_agente: { codigo: 'CAP-02', detalle: 'Encontró un horario compatible.' },
          },
          {
            id_interaccion: 3, fecha_hora, tipo: 'Respuesta del chatbot', resultado: 'WhatsApp',
            mensaje: 'Tengo otra propuesta vigente.', accion_chatbot: 'Ofreció una mejora comercial',
          },
          { id_interaccion: 4, fecha_hora, tipo: 'Respuesta del paciente', resultado: 'WhatsApp', mensaje: '2' },
          {
            id_interaccion: 5, fecha_hora, tipo: 'Respuesta del chatbot', resultado: 'Requiere asesor',
            mensaje: 'Anoté el horario que elegiste.',
            actualizacion: { id_opcion: 25, id_propuesta: 14, horario },
          },
        ], hay_anteriores: false,
      })));

    render(<LeadInteraction requestId={1} onAnalysis={vi.fn()} onChooseSlot={vi.fn()} onUpdateProposal={onUpdateProposal} />);

    const agenda = (await screen.findByText('Encontró un horario compatible.')).closest('article')!;
    expect(within(agenda).getByText('Agente Negociador')).toBeTruthy();
    expect(within(agenda).getByText('CAP-02 · Búsqueda de alternativas')).toBeTruthy();
    expect(within(agenda).getByText('Actividad interna')).toBeTruthy();
    expect(within(agenda).queryByText('ChatBot LEAD')).toBeNull();
    expect(screen.getByText('Horario:').tagName).toBe('STRONG');

    const promotion = screen.getByText('Ofreció una mejora comercial').closest('article')!;
    expect(within(promotion).getByText('ChatBot LEAD')).toBeTruthy();
    expect(within(promotion).getByText('WhatsApp')).toBeTruthy();
    expect(within(promotion).queryByText('Agente Negociador')).toBeNull();
    expect(within(promotion).queryByRole('button', { name: 'Actualizar' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    const confirmation = screen.getByText('Anoté el horario que elegiste.').closest('article')!;
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Actualizar' }));
    expect(onUpdateProposal).toHaveBeenCalledWith({ id_opcion: 25, id_propuesta: 14, horario });
    expect(await within(confirmation).findByRole('button', { name: 'Actualizado' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'WhatsApp' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Consultar al Agente' })).toBeNull();
  });

  it('permite usar un horario sugerido al analizar una interacción manual', async () => {
    const slot = {
      id_disponibilidad: 8, id_sede: 1, id_profesional: 2, fecha: '2026-11-20',
      inicio: '15:00', fin: '15:30', sede: 'Centro', profesional: 'Ana Pérez',
    };
    const onChooseSlot = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.endsWith('/report-catalogs')) return Response.json({ canales: [{ id_canal: 2, nombre: 'Llamada' }] });
      if (input.includes('/conversation?')) return Response.json({ mensajes: [], hay_anteriores: false });
      if (input.endsWith('/analyze')) return Response.json({ intencion: 'HORARIO', sugerencia: 'Revisa este horario.', alternativas: [slot] });
      return Response.json({ id_interaccion: 4, mensaje: 'Prefiere la tarde.', id_canal: 2, fecha_hora, tipo: 'Respuesta del paciente' });
    }));

    render(<LeadInteraction requestId={1} onAnalysis={vi.fn()} onChooseSlot={onChooseSlot} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Presencial/Llamada' }));
    await screen.findByText('Registra lo que comenta el paciente para consultar al Agente.');
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.change(screen.getByLabelText('¿Qué dijo el paciente?'), { target: { value: 'Prefiere la tarde.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar al Agente' }));

    const alternative = await screen.findByRole('button', { name: /usar en la propuesta/i });
    expect(within(alternative.closest('article')!).getByText('Agente Negociador')).toBeTruthy();
    fireEvent.click(alternative);
    expect(onChooseSlot).toHaveBeenCalledWith(slot);
  });

  it('recupera el análisis guardado y conserva el borrador al cambiar de pestaña', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith('/report-catalogs')) return Response.json({ canales: [
        { id_canal: 1, nombre: 'WhatsApp' }, { id_canal: 3, nombre: 'Presencial' },
      ] });
      if (input.includes('comunicacion=whatsapp')) return Response.json({ mensajes: [{
        id_interaccion: 7, fecha_hora, tipo: 'Respuesta del paciente', resultado: 'WhatsApp',
        mensaje: 'Mensaje recibido en WhatsApp.', id_canal: 1, nombre_canal: 'WhatsApp',
      }], hay_anteriores: false });
      return Response.json({ mensajes: [{
        id_interaccion: 8, fecha_hora, tipo: 'Respuesta del paciente', mensaje: 'Consulta en recepción.',
        id_canal: 3, nombre_canal: 'Presencial',
        analisis_agente: { intencion: 'PRECIO', sugerencia: 'Recomendación recuperada del Agente.', promociones: [] },
      }], hay_anteriores: false });
    });
    vi.stubGlobal('fetch', fetchMock);
    const props = { requestId: 1, onAnalysis: vi.fn(), onChooseSlot: vi.fn() };
    const view = render(<LeadInteraction {...props} />);
    await screen.findByText('Mensaje recibido en WhatsApp.');
    fireEvent.click(screen.getByRole('tab', { name: 'Presencial/Llamada' }));
    const panel = screen.getByRole('tabpanel', { name: 'Presencial/Llamada' });
    expect(await within(panel).findByText('Recomendación recuperada del Agente.')).toBeTruthy();
    expect(within(panel).queryByText('Mensaje recibido en WhatsApp.')).toBeNull();
    const input = screen.getByLabelText('¿Qué dijo el paciente?');
    expect(input).toHaveClass('dark:bg-slate-950', 'dark:text-slate-100');
    fireEvent.change(input, { target: { value: 'Borrador pendiente.' } });
    fireEvent.click(screen.getByRole('tab', { name: 'WhatsApp' }));
    expect(screen.queryByRole('button', { name: 'Consultar al Agente' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Presencial/Llamada' }));
    expect(screen.getByLabelText('¿Qué dijo el paciente?')).toHaveValue('Borrador pendiente.');
    expect(screen.queryByLabelText('Tipo de atención')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dictar nota' })).toHaveAttribute('title', 'Dictar nota');
    view.unmount();
    render(<LeadInteraction {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Presencial/Llamada' }));
    expect(await screen.findByText('Recomendación recuperada del Agente.')).toBeTruthy();
    const historyRequests = fetchMock.mock.calls.map(([url]) => url).filter(url => url.includes('/conversation?'));
    expect(historyRequests.some(url => url.includes('comunicacion=presencial'))).toBe(true);
    expect(historyRequests.some(url => url.includes('comunicacion=whatsapp'))).toBe(true);
  });
});
