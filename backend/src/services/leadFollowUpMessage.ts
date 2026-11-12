export type FollowUpMessageContext = {
  name: string;
  service: string;
  contactAt: Date;
  now: Date;
  replies: string[]; // newest first; only actual patient responses for this request
  proposals: { id: number; price: string; expiresAt: Date }[];
};

const clean = (value: string, limit: number) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);

/** Evidence-based draft, without a model call or unverified availability/promotional claims. */
export function buildLeadFollowUpMessage(context: FollowUpMessageContext): string {
  const parts = [`Hola ${clean(context.name, 80)}, te contactamos de NexoSalud para retomar tu consulta sobre ${clean(context.service, 120)}.`];
  const replies = [...new Set(context.replies.map(text => clean(text, 240)).filter(Boolean))].slice(0, 2).reverse();
  if (replies.length) parts.push(`En nuestro último contacto nos comentaste: ${replies.map(text => `«${text}»`).join('; después, ')}.`);
  const cutoff = Math.max(context.now.getTime(), context.contactAt.getTime());
  const proposals = context.proposals.filter(p => p.expiresAt.getTime() > cutoff && Number.isFinite(Number(p.price)) && Number(p.price) >= 0);
  if (proposals.length === 1) {
    const proposal = proposals[0];
    const expiry = proposal.expiresAt.toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false });
    parts.push(`La propuesta económica que te presentamos es de S/ ${Number(proposal.price).toFixed(2)}, con vigencia hasta ${expiry} (hora de Lima).`);
  } else if (proposals.length > 1) {
    parts.push('Tenemos varias propuestas económicas registradas; podemos revisar cuál se ajusta a lo que necesitas.');
  } else {
    parts.push('Antes de ofrecerte un importe o un turno, debemos comprobar nuevamente las condiciones y la disponibilidad.');
  }
  const latest = clean(context.replies[0] ?? '', 240).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const topics: string[] = [];
  if (/\b(precio|car[oa]|dinero|presupuesto|soles|pagar|descuento|promocion|cuotas)\b/.test(latest))
    topics.push('Podemos revisar si existe una condición económica autorizada que se ajuste a lo que nos comentaste; cualquier cambio de importe requiere una nueva propuesta confirmada.');
  if (/\b(sede|lejos|distancia|ubicacion|zona)\b/.test(latest))
    topics.push('Podemos revisar otra sede para el mismo servicio, respetando las ubicaciones que ya nos indicaste que no te convienen.');
  if (/\b(horario|hora|manana|tarde|noche|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(latest))
    topics.push('Podemos buscar un nuevo horario que respete las restricciones que nos indicaste; primero comprobaremos la agenda del especialista.');
  if (/\b(especialista|profesional|doctor|doctora)\b/.test(latest))
    topics.push('Podemos revisar qué otros especialistas están habilitados para este servicio y comprobar su disponibilidad.');
  parts.push(...topics);
  parts.push(replies.length
    ? '¿Deseas que retomemos la revisión con lo que nos comentaste o cambió alguna de tus preferencias? Ningún turno queda reservado por este mensaje.'
    : '¿Qué necesitas revisar para continuar: el importe, la sede, el especialista o el horario?');
  return parts.join('\n\n');
}
