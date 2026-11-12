// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/db', () => ({ prisma: { $queryRaw: vi.fn() } }));
import { LeadIntakeUnavailableError, registerLeadIntake } from '../src/services/leadIntake';

describe('Entrega Buyer: disponibilidad del receptor LEAD sin SQL real', () => {
  it.each([0, -1, 1.5, 2_147_483_648])('rechaza id_solicitud invalido %s antes de consultar', async id => {
    const query = vi.fn();
    await expect(registerLeadIntake(id, { $queryRaw: query } as any)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it.each([{ name: 'metadatos vacios', rows: [] }, { name: 'procedimiento ausente', rows: [{ existe: 0 }] }])('expone entrega no disponible sin ejecutar el receptor: $name', async ({ rows }) => {
    const query = vi.fn().mockResolvedValueOnce(rows);
    await expect(registerLeadIntake(123, { $queryRaw: query } as any)).rejects.toBeInstanceOf(LeadIntakeUnavailableError);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].join('')).toContain('OBJECT_ID');
    expect(query.mock.calls[0][0].join('')).not.toContain('EXEC');
  });

  it('cuando existe el procedimiento devuelve la misma entrada y consulta la solicitud indicada', async () => {
    const entry = { id_solicitud: 123, id_evento_etapa: 456, id_captacion: 789, id_persona: 12 };
    const query = vi.fn().mockResolvedValueOnce([{ existe: 1 }]).mockResolvedValueOnce([entry]);
    await expect(registerLeadIntake(123, { $queryRaw: query } as any)).resolves.toEqual(entry);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0].join('')).toContain('EXEC dbo.usp_RegistrarEntradaAgenteLead');
    expect(query.mock.calls[1][1]).toBe(123);
  });
});
