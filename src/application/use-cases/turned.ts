import type { 
  TurnedRecord, Customer, Payer, Lead, Buyer, Person, Reservation, DentalAttention, CustomerJourney, FollowUp 
} from '@/domain/entities';
import { TurnedState, BuyerState, Phase } from '@/domain/enums';
import { LocalRepository } from '@/infrastructure/repositories';
import { QUERY_KEYS } from '@/shared/constants';
import type { NewRequestFormValues } from '@/modules/turned/schemas/turnedSchema';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'uuid-' + Math.random().toString(36).substring(2, 9);
};

export type TurnedWithDetails = TurnedRecord & { 
  customer: Customer;
  payer: Payer;
  lead: Lead;
  buyer: Buyer;
  person: Person;
  reservation: Reservation;
  attention: DentalAttention;
  followUps: FollowUp[];
};

export class TurnedUseCases {
  private turnedsRepo = new LocalRepository<TurnedRecord>(QUERY_KEYS.TURNED);
  private customersRepo = new LocalRepository<Customer>(QUERY_KEYS.CUSTOMERS);
  private payersRepo = new LocalRepository<Payer>(QUERY_KEYS.PAYERS);
  private leadsRepo = new LocalRepository<Lead>(QUERY_KEYS.LEADS);
  private buyersRepo = new LocalRepository<Buyer>(QUERY_KEYS.BUYERS);
  private personsRepo = new LocalRepository<Person>(QUERY_KEYS.PERSONS);
  private reservationsRepo = new LocalRepository<Reservation>(QUERY_KEYS.RESERVATIONS);
  private attentionsRepo = new LocalRepository<DentalAttention>('dental-attentions');
  private followUpsRepo = new LocalRepository<FollowUp>('follow-ups');
  private journeysRepo = new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS);

  async getAllTurneds(): Promise<TurnedWithDetails[]> {
    const turneds = await this.turnedsRepo.getAll();
    const customers = await this.customersRepo.getAll();
    const payers = await this.payersRepo.getAll();
    const leads = await this.leadsRepo.getAll();
    const buyers = await this.buyersRepo.getAll();
    const persons = await this.personsRepo.getAll();
    const reservations = await this.reservationsRepo.getAll();
    const attentions = await this.attentionsRepo.getAll();
    const followUps = await this.followUpsRepo.getAll();
    
    return turneds.map(turned => {
      const customer = customers.find(c => c.id === turned.customerId)!;
      const payer = customer ? payers.find(p => p.id === customer.payerId)! : {} as Payer;
      const lead = payer ? leads.find(l => l.id === payer.leadId)! : {} as Lead;
      const buyer = lead ? buyers.find(b => b.id === lead.buyerId)! : {} as Buyer;
      const person = buyer ? persons.find(p => p.id === buyer.personId)! : {} as Person;
      const reservation = customer ? reservations.find(r => r.id === customer.reservationId)! : {} as Reservation;
      const attention = customer ? attentions.find(a => a.id === customer.attentionId)! : {} as DentalAttention;
      const turnedFollowUps = followUps.filter(f => f.turnedId === turned.id);

      return { 
        ...turned, customer, payer, lead, buyer, person, reservation, attention, followUps: turnedFollowUps 
      };
    }).filter(t => t.customer && t.payer && t.lead && t.buyer && t.person && t.attention);
  }

  async getTurnedById(id: string): Promise<TurnedWithDetails | null> {
    const turned = await this.turnedsRepo.getById(id);
    if (!turned) return null;
    
    const customer = await this.customersRepo.getById(turned.customerId);
    if (!customer) return null;
    const payer = await this.payersRepo.getById(customer.payerId);
    const lead = payer ? await this.leadsRepo.getById(payer.leadId) : null;
    const buyer = lead ? await this.buyersRepo.getById(lead.buyerId) : null;
    const person = buyer ? await this.personsRepo.getById(buyer.personId) : null;
    const reservation = await this.reservationsRepo.getById(customer.reservationId);
    const attention = customer.attentionId ? await this.attentionsRepo.getById(customer.attentionId) : null;
    
    if (!payer || !lead || !buyer || !person || !reservation || !attention) return null;

    const allFollowUps = await this.followUpsRepo.getAll();
    const followUps = allFollowUps.filter(f => f.turnedId === turned.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { 
      ...turned, customer, payer, lead, buyer, person, reservation, attention, followUps 
    };
  }

  async updateTurnedDetails(id: string, data: Partial<TurnedRecord>): Promise<TurnedRecord> {
    const turned = await this.turnedsRepo.getById(id);
    if (!turned) throw new Error('Turned no encontrado');

    const updateData: Partial<TurnedRecord> = { ...data };
    if (data.finalResult) {
      updateData.state = TurnedState.CLOSED;
      updateData.endDate = new Date().toISOString();
    }

    return this.turnedsRepo.update(id, updateData);
  }

  async addFollowUp(turnedId: string, data: Omit<FollowUp, 'id' | 'turnedId' | 'date'>): Promise<FollowUp> {
    const turned = await this.turnedsRepo.getById(turnedId);
    if (!turned) throw new Error('Turned no encontrado');

    const followUp: FollowUp = {
      id: getUUID(),
      turnedId,
      date: new Date().toISOString(),
      ...data,
    };
    await this.followUpsRepo.create(followUp);

    const updateData: Partial<TurnedRecord> = { state: TurnedState.IN_FOLLOW_UP };
    if (data.nextFollowUpDate) {
      updateData.nextContactDate = data.nextFollowUpDate;
    }
    await this.turnedsRepo.update(turnedId, updateData);

    return followUp;
  }

  async createNewRequest(turnedId: string, data: NewRequestFormValues): Promise<Buyer> {
    const turned = await this.getTurnedById(turnedId);
    if (!turned) throw new Error('Turned no encontrado');

    // 1. Create a new Buyer referencing the same Person
    const newBuyer: Buyer = {
      id: getUUID(),
      personId: turned.person.id,
      channel: data.channel,
      attractionSource: 'Postventa/Reactivación',
      serviceOfInterestId: data.serviceOfInterestId,
      state: BuyerState.NEW,
      contactAuthorization: data.contactAuthorization,
      createdAt: new Date().toISOString(),
      concreteRequest: data.concreteRequest,
    };
    await this.buyersRepo.create(newBuyer);

    // 2. Update turned state to NEW_REQUEST
    await this.turnedsRepo.update(turnedId, { state: TurnedState.NEW_REQUEST });

    // 3. Create a new CustomerJourney for this new Buyer
    const journey: CustomerJourney = {
      id: getUUID(),
      personId: turned.person.id,
      buyerId: newBuyer.id,
      currentPhase: Phase.BUYER,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.journeysRepo.create(journey);

    return newBuyer;
  }
}

export const turnedUseCases = new TurnedUseCases();
