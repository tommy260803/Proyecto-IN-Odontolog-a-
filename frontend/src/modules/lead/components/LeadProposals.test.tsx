import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import LeadProposals from './LeadProposals';

test('muestra una propuesta raíz y conserva el rechazo y la promoción de su versión anterior', () => {
  const base = {
    id_propuesta_logica: 7, fecha_presentacion: '2026-11-01T12:00:00Z',
    sede: null, promocion_catalogo: null, id_promocion_lead: null,
  };
  render(<LeadProposals data={{
    oportunidad: { id_propuesta_aceptada_lead: null },
    tarifa_referencia: null,
    promociones_disponibles: [],
    propuestas: [
      { ...base, id_propuesta: 8, numero_version: 2, orden_version: 1, precio_cotizado: '90.00',
        estado: 'Pendiente', promocion_registrada: null, fecha_decision: null, motivo_rechazo: null, categoria_rechazo: null },
      { ...base, id_propuesta: 7, numero_version: 1, orden_version: 2, precio_cotizado: '120.00',
        estado: 'Rechazada', promocion_registrada: 'Campaña anterior', fecha_decision: '2026-11-02T12:00:00Z',
        motivo_rechazo: 'Supera el presupuesto', categoria_rechazo: 'ECONOMICO' },
    ],
  }} />);
  fireEvent.click(screen.getByText('Propuestas económicas (1)'));
  expect(screen.getAllByRole('heading', { name: 'Propuesta #7' })).toHaveLength(1);
  expect(screen.getByText('Versión 2 · Vigente')).toBeVisible();
  expect(screen.getByText('Promoción: Sin promoción')).toBeVisible();
  expect(screen.getByText(/Sin tarifa vigente/)).toBeVisible();
  fireEvent.click(screen.getByText('Versiones anteriores (1)'));
  expect(screen.getByText('Promoción: Campaña anterior')).toBeVisible();
  expect(screen.getByText('Motivo: Supera el presupuesto · Económico')).toBeVisible();
});
