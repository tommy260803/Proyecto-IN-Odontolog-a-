import type { 
  Lead, Buyer, Person, CustomerJourney, NegotiationAlternative, Reservation, Payer 
} from '@/domain/entities';
import { LeadState, PayerState, Phase } from '@/domain/enums';
import { LocalRepository } from '@/infrastructure/repositories';
import { QUERY_KEYS } from '@/shared/constants';
import { canTransitionLeadToPayer } from '@/domain/transitions';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'uuid-' + Math.random().toString(36).substring(2, 9);
};

export type LeadWithDetails = Lead & { 
  buyer: Buyer; 
  person: Person;
  reservation?: Reservation;
};

export class LeadUseCases {
  private leadsRepo = new LocalRepository<Lead>(QUERY_KEYS.LEADS);
  private buyersRepo = new LocalRepository<Buyer>(QUERY_KEYS.BUYERS);
  private personsRepo = new LocalRepository<Person>(QUERY_KEYS.PERSONS);
  private journeysRepo = new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS);
  private reservationsRepo = new LocalRepository<Reservation>(QUERY_KEYS.RESERVATIONS);
  private payersRepo = new LocalRepository<Payer>(QUERY_KEYS.PAYERS);

  async getAllLeads(): Promise<LeadWithDetails[]> {
    const leads = await this.leadsRepo.getAll();
    const buyers = await this.buyersRepo.getAll();
    const persons = await this.personsRepo.getAll();
    const reservations = await this.reservationsRepo.getAll();
    
    return leads.map(lead => {
      const buyer = buyers.find(b => b.id === lead.buyerId)!;
      const person = buyer ? persons.find(p => p.id === buyer.personId)! : {} as Person;
      const reservation = reservations.find(r => r.id === lead.reservationId);
      return { ...lead, buyer, person, reservation };
    }).filter(l => l.buyer && l.person);
  }

  async getLeadById(id: string): Promise<LeadWithDetails | null> {
    const lead = await this.leadsRepo.getById(id);
    if (!lead) return null;
    const buyer = await this.buyersRepo.getById(lead.buyerId);
    if (!buyer) return null;
    const person = await this.personsRepo.getById(buyer.personId);
    if (!person) return null;
    let reservation = undefined;
    if (lead.reservationId) {
      reservation = await this.reservationsRepo.getById(lead.reservationId) || undefined;
    }
    return { ...lead, buyer, person, reservation };
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
    return this.leadsRepo.update(id, data);
  }

  async addAlternative(leadId: string, altData: Omit<NegotiationAlternative, 'id' | 'leadId'>): Promise<Lead> {
    const lead = await this.leadsRepo.getById(leadId);
    if (!lead) throw new Error('Lead no encontrado');

    const newAlt: NegotiationAlternative = {
      id: getUUID(),
      leadId,
      ...altData
    };

    const alternatives = lead.alternatives ? [...lead.alternatives, newAlt] : [newAlt];
    return this.leadsRepo.update(leadId, { alternatives });
  }

  async selectAlternativeAndReserve(leadId: string, altId: string): Promise<Lead> {
    const lead = await this.leadsRepo.getById(leadId);
    if (!lead) throw new Error('Lead no encontrado');
    if (!lead.alternatives) throw new Error('El Lead no tiene alternativas registradas');
    
    const selectedAlt = lead.alternatives.find(a => a.id === altId);
    if (!selectedAlt) throw new Error('Alternativa no encontrada');

    // Create reservation
    const reservation: Reservation = {
      id: getUUID(),
      leadId,
      date: selectedAlt.date,
      time: selectedAlt.time,
      professionalId: selectedAlt.professional, // Using name as ID for mock
      branchId: selectedAlt.branch, // Using name as ID for mock
      status: 'PENDING',
    };
    await this.reservationsRepo.create(reservation);

    // Update Lead
    return this.leadsRepo.update(leadId, {
      selectedAlternativeId: selectedAlt.id,
      reservationId: reservation.id,
      state: LeadState.ALTERNATIVE_SELECTED,
      price: selectedAlt.price,
    });
  }

  async convertToPayer(leadId: string): Promise<Payer> {
    const lead = await this.leadsRepo.getById(leadId);
    if (!lead) throw new Error('Lead no encontrado');

    // Generar solicitud de pago ficticia para cumplir la regla
    // En el futuro esto creará un PaymentRequest real.
    const paymentRequestId = getUUID();
    await this.leadsRepo.update(leadId, { paymentRequestId });
    lead.paymentRequestId = paymentRequestId;

    const validation = canTransitionLeadToPayer(lead);
    if (!validation.success) {
      throw new Error(validation.error || 'No cumple los requisitos para convertirse en PAYER');
    }

    const payers = await this.payersRepo.getAll();
    if (payers.some(p => p.leadId === leadId)) {
      throw new Error('El LEAD ya tiene un PAYER asociado');
    }

    const selectedAlt = lead.alternatives?.find(a => a.id === lead.selectedAlternativeId);
    const amountToPay = selectedAlt ? selectedAlt.price : (lead.price || 0);

    // Crear Payer
    const payer: Payer = {
      id: getUUID(),
      leadId: lead.id,
      reservationId: lead.reservationId!,
      amountToPay,
      currency: 'PEN',
      state: PayerState.PENDING,
      createdAt: new Date().toISOString(),
    };
    await this.payersRepo.create(payer);

    // Actualizar Lead
    await this.leadsRepo.update(leadId, { state: LeadState.PAYMENT_REQUESTED });

    // Actualizar Journey
    const journeys = await this.journeysRepo.getAll();
    const journey = journeys.find(j => j.leadId === leadId);
    if (journey) {
      await this.journeysRepo.update(journey.id, {
        payerId: payer.id,
        currentPhase: Phase.PAYER,
        updatedAt: new Date().toISOString(),
      });
    }

    return payer;
  }
}

export const leadUseCases = new LeadUseCases();
