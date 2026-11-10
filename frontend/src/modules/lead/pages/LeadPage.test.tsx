import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import LeadPage from './LeadPage';
import { leadCommercialService } from '../services/leadCommercial.service';

test('un enlace anterior a un paciente permite elegir entre sus solicitudes', async () => {
  const data = {
    id_persona: 42, nombres: 'Paciente', apellidos: 'QA', servicio: null,
    negociador: null, dia_ingreso: '2026-11-10', resultado_comercial_lead: null,
    archivada_lead_en: null, fecha_primera_respuesta: null, fecha_proximo_seguimiento: null,
    ultima_interaccion: null,
    estado_seguimiento: 'sin_programar' as const, prioridad_operativa: 4 as const,
  };
  const list = vi.spyOn(leadCommercialService, 'list').mockResolvedValue({
    oportunidades: [{ ...data, id_solicitud: 7 }, { ...data, id_solicitud: 8 }],
    hay_siguiente: false,
  });
  try {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/lead/42/negotiation']}>
          <Routes>
            <Route path="/lead/:id/negotiation" element={<LeadPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('link', { name: /Solicitud #7/ })).toHaveAttribute('href', '/lead/oportunidades/7');
    expect(screen.getByRole('link', { name: /Solicitud #8/ })).toHaveAttribute('href', '/lead/oportunidades/8');
    expect(list.mock.calls[0][0].get('id_persona')).toBe('42');
    expect(screen.getAllByText('Sin resultado documentado')).toHaveLength(2);
  } finally {
    list.mockRestore();
  }
});
