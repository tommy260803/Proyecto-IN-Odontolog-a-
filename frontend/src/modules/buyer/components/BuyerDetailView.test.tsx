import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import evidence from '../../../../../database/qa/buyer_presentacion/evidencias/despues.json';
import { BuyerDetailView } from './BuyerDetailView';
import { renderBuyerStatusBadge } from './BuyerListView';
import { buyerService } from '../services/buyer.service';
import { resolveBuyerPreferences } from '../lib/buyerPresentation';
import { BuyerState } from '@/domain/enums';
import { staffAuthService } from '@/shared/services/staffAuthService';

const state = vi.hoisted(() => ({ buyer: {} as any, evaluateMutate: vi.fn() }));
vi.mock('../hooks/useBuyerQueries', () => ({
  useBuyer: () => ({ data: state.buyer, isLoading: false, isError: false }),
  useUpdateBuyer: () => ({ isPending: false, mutate: vi.fn() }),
  useConvertBuyerToLead: () => ({ isPending: false, mutate: vi.fn() }),
  useEvaluateBuyer: () => ({ isPending: false, mutate: state.evaluateMutate }),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function show(buyer: any) {
  staffAuthService.saveSession({email:'qa@example.invalid',token:'Q'.repeat(43),expira_en:'2030-01-01T00:00:00Z',usuario:{id_usuario:7,nombres:'QA',apellidos:'Operador',rol:'Administrador'}});
  state.buyer = buyer;
  vi.spyOn(buyerService, 'getCatalogs').mockResolvedValue({
    canales: [], fuentes: [], servicios: [], sedes: [], modalidades: [],
    horarios: [{ id_horario: 1, hora_inicio: '1970-01-01T08:00:00.000Z', hora_fin: '1970-01-01T12:00:00.000Z' }],
  });
  return render(<QueryClientProvider client={new QueryClient()}>
    <MemoryRouter><BuyerDetailView buyerId={buyer.id} /></MemoryRouter>
  </QueryClientProvider>);
}

function field(label: string) {
  return screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!;
}

describe('Presentación Buyer sobre respuestas GET reales y sanitizadas', () => {
  it.each(evidence.subjects)('$id: ficha y perfilamiento no inventan preferencias ausentes', async ({ api }) => {
    show(api);
    expect(field('Sede de Preferencia')).toHaveTextContent(/^No informado$/);
    expect(field('Disponibilidad Horaria')).toHaveTextContent(/^No informado$/);
    expect(field('Sede:')).toHaveTextContent(/^No informado$/);
    expect(field('Horario:')).toHaveTextContent(/^No informado$/);
    expect(screen.queryByText('Sede California')).not.toBeInTheDocument();
    expect(screen.queryByText('Mañana / Tarde (Flexible)')).not.toBeInTheDocument();
    expect(screen.getByText(/no son inferencias de Gemini/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getAllByRole('combobox').slice(0, 2).map(e => (e as HTMLSelectElement).value)).toEqual(['', '']);
    // Esperar el catálogo para confirmar que su llegada no selecciona un valor por defecto.
    await screen.findByRole('option', { name: '08:00 - 12:00' });
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('');
  });

  it('usa los mismos valores registrados y las horas del catálogo, sin rótulos fijos por ID', async () => {
    show({ ...evidence.subjects[0].api, pref_sede_preferida: ' Sede El Golf ', pref_id_horario: '1',
      pref_horario: { hora_inicio: '08:00', hora_fin: '12:00' } });
    expect(field('Sede de Preferencia')).toHaveTextContent(/^Sede El Golf$/);
    expect(field('Sede:')).toHaveTextContent(/^Sede El Golf$/);
    expect(field('Disponibilidad Horaria')).toHaveTextContent(/^08:00 - 12:00$/);
    expect(field('Horario:')).toHaveTextContent(/^08:00 - 12:00$/);
    expect(resolveBuyerPreferences({ pref_id_horario: '42' }).schedule).toBe('Horario registrado #42');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('option', { name: '08:00 - 12:00' });
    expect(screen.getAllByRole('combobox')[0]).toHaveValue(' Sede El Golf ');
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('1');
  });

  it('11007 distingue PAYER actual y conversión histórica, sin atribuirla al mensaje nuevo', () => {
    const { api } = evidence.subjects.find(s => s.id === 11007)!;
    show(api);
    expect(screen.getAllByText(/Etapa actual: PAYER/).length).toBeGreaterThan(0);
    expect(screen.getByText('Conversión histórica a LEAD')).toBeInTheDocument();
    expect(screen.queryByText('Convertido a LEAD')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convertir a LEAD' })).not.toBeInTheDocument();
    expect(screen.getByText(/La consulta actual conserva la etapa PAYER/)).toBeInTheDocument();
    expect(screen.queryByText(/Debe permanecer en BUYER/)).not.toBeInTheDocument();
    expect(api.latestEvaluation.intencion).toBe('SOLO_CONSULTA');
  });

  it('no inventa un evento histórico a partir de CONVERTED y mantiene los estados de calidad', () => {
    show({ ...evidence.subjects[0].api, state: 'CONVERTED', currentStage: 'PAYER', convertedAt: undefined });
    expect(screen.queryByText('Conversión histórica a LEAD')).not.toBeInTheDocument();
    const badge = render(<>{renderBuyerStatusBadge(BuyerState.DUPLICATED, 'BUYER')}</>);
    expect(within(badge.container).getByText('Duplicado')).toBeInTheDocument();
  });

  it('no ejecuta una segunda llamada Gemini al pulsar Actualizar si existe conversación de chat', () => {
    state.evaluateMutate.mockClear();
    const chatBuyer = {
      ...evidence.subjects[0].api,
      hasChatConversation: true,
      latestEvaluation: {
        id_decision: 901,
        id_interaccion: 227,
        id_interaccion_vigente: 227,
        es_mensaje_vigente: true,
        es_contexto_vigente: true,
        estado: 'COMPLETADA',
        intencion: 'SOLICITA_RESERVA',
        accion: 'ACLARACION',
        explicacion: '¿En qué sede y horario te gustaría atenderte?',
        fecha_hora: '2026-11-12T10:00:00.000Z',
        isChatTurn: true,
        turnId: 227,
      },
    };
    show(chatBuyer);
    expect(screen.getByText(/Turno #227 · Evaluación persistida/)).toBeInTheDocument();
    expect(screen.getAllByText('¿En qué sede y horario te gustaría atenderte?').length).toBeGreaterThanOrEqual(1);

    const refreshBtn = within(screen.getByLabelText('Estado actual del agente Buyer')).getByRole('button', { name: 'Actualizar' });
    fireEvent.click(refreshBtn);
    expect(state.evaluateMutate).not.toHaveBeenCalled();
  });

  it('ejecuta evaluación Gemini al pulsar Actualizar en prospectos sin conversación de chat', () => {
    state.evaluateMutate.mockClear();
    const regularBuyer = {
      ...evidence.subjects[0].api,
      hasChatConversation: false,
      concreteRequest: 'Consulta general de precios',
      latestEvaluation: null,
    };
    show(regularBuyer);
    const refreshBtn = within(screen.getByLabelText('Estado actual del agente Buyer')).getByRole('button', { name: 'Actualizar' });
    fireEvent.click(refreshBtn);
    expect(state.evaluateMutate).toHaveBeenCalledTimes(1);
    expect(state.evaluateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: regularBuyer.id, message: 'Consulta general de precios' }),
      expect.any(Object)
    );
  });

  it('un turno en curso PROCESANDO/PENDIENTE conserva evaluación histórica y no marca mensaje vigente artificialmente', () => {
    const processingBuyer = {
      ...evidence.subjects[0].api,
      hasChatConversation: true,
      latestEvaluation: {
        id_decision: 902,
        id_interaccion: 228,
        id_interaccion_vigente: 228,
        es_mensaje_vigente: false,
        estado: 'PROCESANDO',
        accion: 'PROCESANDO',
        explicacion: 'Turno #228 · PROCESANDO — evaluación en curso',
        isChatTurn: true,
        turnId: 228,
      },
    };
    show(processingBuyer);
    expect(within(screen.getByLabelText('Estado actual del agente Buyer')).getByText('Turno #228 · PROCESANDO', {exact:true})).toBeInTheDocument();
    // No debe mostrarse como mensaje vigente listo para transferencia
    expect(screen.queryByText('Está preparado para iniciar la transferencia a LEAD.')).not.toBeInTheDocument();
  });
});
