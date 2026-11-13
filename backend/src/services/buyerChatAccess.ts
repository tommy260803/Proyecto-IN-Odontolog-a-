import { Prisma } from '@prisma/client';
import type { LeadStaffIdentity } from './leadStaffAuth';

// Contrato ya utilizado por el chat y la mesa LEAD: asignación comercial real.
// No existe una definición de AsignacionesPersonal en el esquema del proyecto.
export function assignedBuyerRequest(db: Prisma.TransactionClient, personId: number, actorId: number) {
  return db.solicitudes.findFirst({ where: { id_persona: personId, id_negociador: actorId } });
}

export function buyerChatReadFilters(identity: LeadStaffIdentity | null) {
  const assignment = identity?.rol === 'Negociador'
    ? { Persona: { Solicitudes: { some: { id_negociador: identity.id_usuario } } } } : null;
  const admin = identity?.rol === 'Administrador';
  return {
    interactions: admin ? undefined : {
      OR: [{ tipo: { not: 'BUYER_CHAT_ENTRADA' } }, ...(assignment ? [assignment] : [])],
    },
    decisions: admin ? { agente: 'BUYER' } : { agente: 'BUYER', OR: [
      { entrada: null }, { NOT: { entrada: { contains: 'conversationTurnId' } } }, ...(assignment ? [assignment] : []),
    ] },
  };
}

// Defensa adicional al mapear DTOs, además del filtro SQL por cada persona.
export function protectBuyerChat<T extends { Solicitudes: any[]; Interacciones: any[]; DecisionesIA: any[] }>(
  person: T, identity: LeadStaffIdentity | null,
): T {
  const allowed = identity?.rol === 'Administrador' || (identity?.rol === 'Negociador' &&
    person.Solicitudes.some(s => s.id_negociador === identity.id_usuario));
  if (allowed) return person;
  return { ...person,
    Interacciones: person.Interacciones.filter(i => i.tipo !== 'BUYER_CHAT_ENTRADA'),
    DecisionesIA: person.DecisionesIA.filter(d => d.agente === 'BUYER' && !d.entrada?.includes('conversationTurnId')),
    // El motivo comercial puede copiar el mensaje de conversión del chat.
    Solicitudes: person.Solicitudes.map(s => ({ ...s, motivo: null })),
  };
}
