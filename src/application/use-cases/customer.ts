import type { 
  Customer, Payer, Lead, Buyer, Person, Reservation, DentalAttention, CustomerIncident, TurnedRecord, CustomerJourney 
} from '@/domain/entities';
import { CustomerState, TurnedState, Phase } from '@/domain/enums';
import { LocalRepository } from '@/infrastructure/repositories';
import { QUERY_KEYS } from '@/shared/constants';
import { canTransitionCustomerToTurned } from '@/domain/transitions';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'uuid-' + Math.random().toString(36).substring(2, 9);
};

export type CustomerWithDetails = Customer & { 
  payer: Payer;
  lead: Lead;
  buyer: Buyer;
  person: Person;
  reservation: Reservation;
  attention?: DentalAttention;
  incidents: CustomerIncident[];
};

export class CustomerUseCases {
  private customersRepo = new LocalRepository<Customer>(QUERY_KEYS.CUSTOMERS);
  private payersRepo = new LocalRepository<Payer>(QUERY_KEYS.PAYERS);
  private leadsRepo = new LocalRepository<Lead>(QUERY_KEYS.LEADS);
  private buyersRepo = new LocalRepository<Buyer>(QUERY_KEYS.BUYERS);
  private personsRepo = new LocalRepository<Person>(QUERY_KEYS.PERSONS);
  private reservationsRepo = new LocalRepository<Reservation>(QUERY_KEYS.RESERVATIONS);
  private attentionsRepo = new LocalRepository<DentalAttention>('dental-attentions');
  private incidentsRepo = new LocalRepository<CustomerIncident>('customer-incidents');
  private turnedsRepo = new LocalRepository<TurnedRecord>(QUERY_KEYS.TURNED);
  private journeysRepo = new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS);

  async getAllCustomers(): Promise<CustomerWithDetails[]> {
    const customers = await this.customersRepo.getAll();
    const payers = await this.payersRepo.getAll();
    const leads = await this.leadsRepo.getAll();
    const buyers = await this.buyersRepo.getAll();
    const persons = await this.personsRepo.getAll();
    const reservations = await this.reservationsRepo.getAll();
    const attentions = await this.attentionsRepo.getAll();
    const incidents = await this.incidentsRepo.getAll();
    
    return customers.map(customer => {
      const payer = payers.find(p => p.id === customer.payerId)!;
      const lead = payer ? leads.find(l => l.id === payer.leadId)! : {} as Lead;
      const buyer = lead ? buyers.find(b => b.id === lead.buyerId)! : {} as Buyer;
      const person = buyer ? persons.find(p => p.id === buyer.personId)! : {} as Person;
      const reservation = reservations.find(r => r.id === customer.reservationId)!;
      const attention = attentions.find(a => a.id === customer.attentionId);
      const customerIncidents = incidents.filter(i => i.customerId === customer.id);

      return { 
        ...customer, payer, lead, buyer, person, reservation, attention, incidents: customerIncidents 
      };
    }).filter(c => c.payer && c.lead && c.buyer && c.person && c.reservation);
  }

  async getCustomerById(id: string): Promise<CustomerWithDetails | null> {
    const customer = await this.customersRepo.getById(id);
    if (!customer) return null;
    
    const payer = await this.payersRepo.getById(customer.payerId);
    if (!payer) return null;
    const lead = await this.leadsRepo.getById(payer.leadId);
    if (!lead) return null;
    const buyer = await this.buyersRepo.getById(lead.buyerId);
    if (!buyer) return null;
    const person = await this.personsRepo.getById(buyer.personId);
    if (!person) return null;
    const reservation = await this.reservationsRepo.getById(customer.reservationId);
    if (!reservation) return null;
    
    const attention = customer.attentionId ? await this.attentionsRepo.getById(customer.attentionId) : undefined;
    const allIncidents = await this.incidentsRepo.getAll();
    const incidents = allIncidents.filter(i => i.customerId === customer.id);

    return { 
      ...customer, payer, lead, buyer, person, reservation, attention: attention || undefined, incidents 
    };
  }

  async changeState(id: string, state: CustomerState): Promise<Customer> {
    const customer = await this.customersRepo.getById(id);
    if (!customer) throw new Error('Customer no encontrado');
    return this.customersRepo.update(id, { state });
  }

  async startAttention(id: string, startTime: string): Promise<Customer> {
    const customer = await this.customersRepo.getById(id);
    if (!customer) throw new Error('Customer no encontrado');

    let attentionId = customer.attentionId;
    if (!attentionId) {
      attentionId = getUUID();
      await this.attentionsRepo.create({
        id: attentionId,
        customerId: id,
        startTime,
      });
    } else {
      await this.attentionsRepo.update(attentionId, { startTime });
    }

    return this.customersRepo.update(id, { state: CustomerState.IN_ATTENTION, attentionId });
  }

  async finishAttention(id: string, endTime: string): Promise<Customer> {
    const customer = await this.customersRepo.getById(id);
    if (!customer) throw new Error('Customer no encontrado');
    if (!customer.attentionId) throw new Error('No hay una atención iniciada');

    await this.attentionsRepo.update(customer.attentionId, { endTime });
    return this.customersRepo.update(id, { state: CustomerState.ATTENDED });
  }

  async registerAttentionDetails(id: string, data: Partial<DentalAttention>): Promise<DentalAttention> {
    const customer = await this.customersRepo.getById(id);
    if (!customer) throw new Error('Customer no encontrado');
    
    let attentionId = customer.attentionId;
    if (!attentionId) {
      attentionId = getUUID();
      await this.customersRepo.update(id, { attentionId });
      const newAttention: DentalAttention = {
        id: attentionId,
        customerId: id,
        ...data,
      };
      return this.attentionsRepo.create(newAttention);
    } else {
      return this.attentionsRepo.update(attentionId, data);
    }
  }

  async registerIncident(customerId: string, reason: string): Promise<CustomerIncident> {
    const customer = await this.customersRepo.getById(customerId);
    if (!customer) throw new Error('Customer no encontrado');
    
    const incident: CustomerIncident = {
      id: getUUID(),
      customerId,
      reason,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };
    return this.incidentsRepo.create(incident);
  }

  async convertToTurned(customerId: string): Promise<TurnedRecord> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error('Customer no encontrado');
    
    const validation = canTransitionCustomerToTurned(customer, customer.attention);
    if (!validation.success) {
      throw new Error(validation.error || 'No cumple los requisitos para convertirse en TURNED');
    }

    const turneds = await this.turnedsRepo.getAll();
    if (turneds.some(t => t.customerId === customerId)) {
      throw new Error('El CUSTOMER ya tiene un registro TURNED asociado');
    }

    const turned: TurnedRecord = {
      id: getUUID(),
      customerId,
      state: TurnedState.FOLLOW_UP_PENDING,
      createdAt: new Date().toISOString(),
    };
    await this.turnedsRepo.create(turned);

    // Actualizar Journey
    const journeys = await this.journeysRepo.getAll();
    const journey = journeys.find(j => j.customerId === customerId);
    if (journey) {
      await this.journeysRepo.update(journey.id, {
        turnedId: turned.id,
        currentPhase: Phase.TURNED,
        updatedAt: new Date().toISOString(),
      });
    }

    return turned;
  }
}

export const customerUseCases = new CustomerUseCases();
