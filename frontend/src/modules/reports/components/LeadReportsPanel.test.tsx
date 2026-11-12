import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../pages/ReportsPage';
import { leadPercent, leadReportQuery } from './LeadReportsPanel';

function renderReports() {
  return render(<MemoryRouter initialEntries={['/reportes?period=2026-11']}><ReportsPage /></MemoryRouter>);
}

const fetchMock = vi.fn();
const catalogs = {
  servicios: [{ id_servicio: 1, nombre: 'Ortodoncia' }],
  sedes: [{ id_sede: 1, nombre: 'Centro' }],
  canales: [{ id_canal: 1, nombre: 'WhatsApp' }],
  fuentes: [{ id_fuente: 1, nombre: 'Referencia' }],
  negociadores: [{ id_usuario: 1, nombre: 'Asesor QA' }],
  promociones: [{ id_promocion: 1, nombre: 'Promoción QA' }],
  motivos: [
    { id_motivo_rechazo: 1, motivo: 'Presupuesto insuficiente', ambito: 'PROPUESTA' },
    { id_motivo_rechazo: 2, motivo: 'Incompatibilidad de horario', ambito: 'ALTERNATIVA' },
  ],
  horarios: [{ id_profesional: 1, profesional: 'Profesional QA', pref_turno_lead: 'Mañana', ofr_turno_lead: 'Tarde' }],
};
const pending = { Mes: '2026-11-01', Tratamiento: 'Ortodoncia', Ingresadas: 2, Aceptadas: 0,
  CerradasSinAcuerdo: 0, Pendientes: 1, SinResultadoDocumentado: 1, AceptacionPorcentaje: null, ValorAcordadoSoles: '0' };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => {
    const body = url.endsWith('/report-catalogs') ? catalogs :
      url.includes('/reports/R1?') ? [pending, { ...pending, EsTotal: true, Tratamiento: 'TOTAL' }] :
      url.includes('/reports/R2?') ? {
        detalle: [{ id_propuesta_logica: 11, id_version_vigente: 13, fecha_presentacion: '2026-11-02',
          Tratamiento: 'Ortodoncia', PrecioCotizado: '120.50', PromocionAplicada: 'Promoción QA',
          ConPromocion: true, Resultado: 'Rechazada', MotivoRechazo: 'Presupuesto insuficiente' }],
        resumen: [{ Presentadas: 1, Aceptadas: 0, Rechazadas: 1, Pendientes: 0, RechazosEconomicos: 1, L2Porcentaje: 100 }],
      } : {
        detalle: [{ id_solicitud: 5, id_opcion: 8, fecha_ofrecida: '2026-11-03', id_sede: 1,
          pref_dia_semana_lead: 2, pref_turno_lead: 'Mañana', pref_hora_inicio_lead: '09:00', pref_hora_fin_lead: '11:00',
          DiaOfrecido: 3, ofr_turno_lead: 'Tarde', HoraInicioOfrecida: '14:00', HoraFinOfrecida: '15:00',
          Resultado: 'Rechazada', MotivoRechazo: 'Incompatibilidad de horario', NumeroCambios: 2 }],
        resumen: [{ Presentadas: 1, Rechazadas: 1, Aceptadas: 0, Pendientes: 0, Modificadas: 1, RechazadasIncompatibilidad: 1, L3Porcentaje: 100 }],
      };
    const headers = url.includes('/reports/') ? { 'X-Lead-Cutoff-Utc': '2026-11-08T04:00:00.000Z' } : undefined;
    return new Response(JSON.stringify(body), { status: 200, headers });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test('R1 conserva sus filtros, separa pendientes de históricos y muestra No calculable', async () => {
  renderReports();
  const filters = within(screen.getByLabelText('Filtros del reporte'));
  expect(filters.getByLabelText('Período de ingreso a LEAD')).toBeTruthy();
  expect(filters.getByLabelText('Fecha de corte')).toBeTruthy();
  for (const label of ['Tratamiento', 'Canal de origen', 'Sede de interés', 'Negociador']) {
    expect(filters.getByLabelText(label)).toBeTruthy();
  }
  expect(filters.queryByLabelText('Motivo de rechazo')).toBeNull();
  await screen.findAllByText('No calculable');
  expect(screen.getByRole('tablist')).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Reporte de Resultados de Negociaciones Comerciales' })).toHaveAttribute('aria-selected', 'true');
  expect(within(screen.getByRole('region', { name: 'Indicador L1' })).getByText('M1 / (M1 + M2) × 100')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Detalle operativo' })).toBeNull();
  expect(filters.queryAllByRole('combobox')).toHaveLength(4);
  expect(filters.queryByLabelText('Fuente de captación')).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('inicio=2026-11-01'))).toBe(true);
  expect(screen.getByText('Sin resultado documentado: 1.')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Pendientes' })).toBeTruthy();
  expect(screen.getByText('TOTAL')).toBeTruthy();
});

test('R2 presenta una fila por propuesta con tres filtros', async () => {
  renderReports();
  fireEvent.click(screen.getByRole('tab', { name: 'Reporte de Precios, Promociones y Motivos de Rechazo' }));
  await screen.findByText(/PROP-11/);
  expect(screen.queryByText(/PROP-13/)).toBeNull();
  const row = screen.getByText(/PROP-11/).closest('tr')!;
  expect(within(row).getByText('Promoción QA')).toBeTruthy();
  expect(within(row).getByText('Rechazada')).toBeTruthy();
  expect(within(row).getByText('Presupuesto insuficiente')).toBeTruthy();
  expect(within(row).getByText(/120[.,]50/)).toBeTruthy();
  const indicator = within(screen.getByRole('region', { name: 'Indicador L2' }));
  expect(indicator.getByText('M5 / (M3 + M4) × 100')).toBeVisible();
  expect(indicator.getByText('(1 ÷ 1) × 100')).toBeVisible();
  expect(screen.getByLabelText('Promoción')).toBeTruthy();
  expect(screen.queryByLabelText('Mínimo')).toBeNull();
  expect(screen.queryByLabelText('Sede')).toBeNull();
  fireEvent.change(screen.getByLabelText('Promoción'), { target: { value: 'sin-promocion' } });
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('con_promocion=false'))).toBe(true));
  expect(screen.queryByLabelText('Fecha de corte')).toBeNull();
  expect(screen.getByRole('region', { name: 'Resultados de las propuestas económicas' })).toHaveAttribute('tabindex', '0');
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/reports/R2?'))
    .every(([url]) => !String(url).includes('corte_utc='))).toBe(true);
  expect(screen.queryByLabelText('Motivo de rechazo')).toBeNull();
});

test('al cambiar de R1 a R2 no renderiza los grupos de R1 como propuestas', async () => {
  const consoleErrors = vi.spyOn(console, 'error');
  try {
    renderReports();
    await screen.findByText('TOTAL');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Reporte de Resultados de Negociaciones Comerciales' }), { key: 'ArrowRight' });
    await screen.findByText(/PROP-11/);
    expect(consoleErrors.mock.calls.some(([message]) => String(message).includes('same key'))).toBe(false);
  } finally {
    consoleErrors.mockRestore();
  }
});

test('R2 pagina diez propuestas sin recalcular las medidas y vuelve al inicio al filtrar', async () => {
  const defaultFetch = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string) => {
    if (!url.includes('/reports/R2?')) return defaultFetch(url);
    return new Response(JSON.stringify({
      detalle: Array.from({ length: 13 }, (_, index) => ({ id_propuesta_logica: index + 100 })),
      resumen: [{ Aceptadas: 9, Rechazadas: 4, RechazosEconomicos: 2, L2Porcentaje: 15.38 }],
    }));
  });
  renderReports();
  fireEvent.click(screen.getByRole('tab', { name: 'Reporte de Precios, Promociones y Motivos de Rechazo' }));
  await screen.findByText('PROP-109');
  expect(screen.queryByText('PROP-110')).toBeNull();
  expect(screen.getByText('Filas 1–10 de 13')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  const indicator = within(screen.getByRole('region', { name: 'Indicador L2' }));
  expect(indicator.getByText('Propuestas rechazadas por cualquier motivo').closest('div')).toHaveTextContent('4');
  expect(indicator.getByText('Propuestas rechazadas por motivos económicos').closest('div')).toHaveTextContent('2');

  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(screen.getByText('PROP-112')).toBeVisible();
  expect(screen.queryByText('PROP-100')).toBeNull();
  expect(screen.getByText('Filas 11–13 de 13')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  expect(indicator.getByText('(2 ÷ 13) × 100')).toBeVisible();

  fireEvent.change(screen.getByLabelText('Promoción'), { target: { value: 'sin-promocion' } });
  expect(await screen.findByText('PROP-100')).toBeVisible();
  expect(screen.getByText('Página 1 de 2')).toBeVisible();
});

test('R3 presenta ambos horarios, el motivo tipificado y el conteo de cambios en la misma fila', async () => {
  renderReports();
  fireEvent.click(screen.getByRole('tab', { name: 'Reporte de Preferencias y Alternativas de Atención' }));
  const row = (await screen.findByText('ALT-8', { exact: false })).closest('tr')!;
  for (const label of ['Martes · Mañana', '09:00–11:00', 'Miércoles · Tarde', '14:00–15:00',
    'Rechazada', 'Incompatibilidad de horario', '2']) expect(within(row).getByText(label)).toBeTruthy();
  expect(screen.getByText('Total · 1 alternativas')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Indicador L3' })).getByText('M8 / (M6 + M7) × 100')).toBeVisible();
  expect(screen.getAllByRole('table')).toHaveLength(1);
  expect(screen.getByLabelText('Profesional ofrecido')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Horario ofrecido'), { target: { value: JSON.stringify([3, 'Tarde']) } });
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ofr_dia=3&ofr_turno=Tarde'))).toBe(true));
  expect(screen.queryByLabelText('Promoción')).toBeNull();
});

test('el corte incluye el día de Lima y un porcentaje real cero se conserva', () => {
  const query = leadReportQuery('R1', { periodo: '2026-12', corte: '2026-12-31' }, new Date('2027-01-02T00:00:00Z'));
  expect(query.get('inicio')).toBe('2026-12-01');
  expect(query.get('fin_exclusivo')).toBe('2027-01-01');
  expect(query.get('corte_utc')).toBe('2027-01-01T04:59:59.999Z');
  expect(leadPercent(null)).toBe('No calculable');
  expect(leadPercent(0)).toMatch(/^0[.,]00 %$/);
});
