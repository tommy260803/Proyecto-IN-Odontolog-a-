import type { Buyer } from '@/domain/entities';

// Solo datos de la preferencia vigente resuelta por la API; sin inferencias de IA.
export function resolveBuyerPreferences(buyer: Pick<Buyer, 'pref_sede_preferida' | 'pref_id_horario' | 'pref_horario'>) {
  const horarioId = buyer.pref_id_horario?.trim();
  const horario = buyer.pref_horario;
  return {
    branch: buyer.pref_sede_preferida?.trim() || 'No informado',
    schedule: !horarioId ? 'No informado'
      : horario?.hora_inicio && horario?.hora_fin
        ? `${horario.hora_inicio} - ${horario.hora_fin}`
        : `Horario registrado #${horarioId}`,
  };
}
