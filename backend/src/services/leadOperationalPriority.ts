export function leadOperationalPriority(row: {
  active: boolean; followUp: Date | null; firstResponse: Date | null; paused?: boolean;
}, now = new Date()) {
  if (!row.active) return { orden: 5, motivo: 'Negociación finalizada', accion: 'Consultar historial' };
  if (row.paused) return { orden: 4, motivo: 'Seguimiento pausado', accion: 'Revisar motivo de pausa' };
  if (row.followUp && row.followUp <= now) return { orden: 1, motivo: 'Seguimiento vencido', accion: 'Atender seguimiento' };
  const limaDay = (date: Date) => new Date(date.getTime() - 5 * 3600000).toISOString().slice(0, 10);
  if (row.followUp && limaDay(row.followUp) === limaDay(now)) return { orden: 2, motivo: 'Seguimiento de hoy', accion: 'Revisar contacto programado' };
  if (!row.firstResponse) return { orden: 3, motivo: 'Sin primera respuesta útil registrada', accion: 'Revisar atención pendiente' };
  return { orden: 4, motivo: row.followUp ? 'Seguimiento futuro' : 'Sin seguimiento programado',
    accion: row.followUp ? 'Esperar fecha programada' : 'Definir próxima acción' };
}
