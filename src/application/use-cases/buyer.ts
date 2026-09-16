import type { Buyer, Person, Lead, CustomerJourney } from '@/domain/entities';
import { BuyerState, LeadState, Phase } from '@/domain/enums';
import { LocalRepository } from '@/infrastructure/repositories';
import { QUERY_KEYS } from '@/shared/constants';
import { canTransitionBuyerToLead } from '@/domain/transitions';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'uuid-' + Math.random().toString(36).substring(2, 9);
};

export type BuyerWithPerson = Buyer & { person: Person };

export class BuyerUseCases {
  private buyersRepo = new LocalRepository<Buyer>(QUERY_KEYS.BUYERS);
  private personsRepo = new LocalRepository<Person>(QUERY_KEYS.PERSONS);
  private leadsRepo = new LocalRepository<Lead>(QUERY_KEYS.LEADS);
  private journeysRepo = new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS);

  async getAllBuyers(): Promise<BuyerWithPerson[]> {
    const buyers = await this.buyersRepo.getAll();
    const persons = await this.personsRepo.getAll();
    
    return buyers.map(buyer => ({
      ...buyer,
      person: persons.find(p => p.id === buyer.personId)!
    })).filter(b => b.person);
  }

  async getBuyerById(id: string): Promise<BuyerWithPerson | null> {
    const buyer = await this.buyersRepo.getById(id);
    if (!buyer) return null;
    const person = await this.personsRepo.getById(buyer.personId);
    if (!person) return null;
    return { ...buyer, person };
  }

  async createBuyer(data: {
    firstName: string; lastName: string; documentType?: string; documentNumber?: string;
    email?: string; phone?: string; channel: string; attractionSource: string;
    serviceOfInterestId?: string; preferences?: string; contactAuthorization: boolean;
    concreteRequest?: string;
  }): Promise<BuyerWithPerson> {
    const person: Person = {
      id: getUUID(),
      firstName: data.firstName,
      lastName: data.lastName,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      email: data.email,
      phone: data.phone,
    };
    await this.personsRepo.create(person);

    const buyer: Buyer = {
      id: getUUID(),
      personId: person.id,
      channel: data.channel,
      attractionSource: data.attractionSource,
      serviceOfInterestId: data.serviceOfInterestId,
      preferences: data.preferences,
      contactAuthorization: data.contactAuthorization,
      concreteRequest: data.concreteRequest,
      state: BuyerState.NEW,
      createdAt: new Date().toISOString(),
    };
    await this.buyersRepo.create(buyer);

    const journey: CustomerJourney = {
      id: getUUID(),
      personId: person.id,
      buyerId: buyer.id,
      currentPhase: Phase.BUYER,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.journeysRepo.create(journey);

    return { ...buyer, person };
  }

  async updateBuyer(id: string, data: Partial<Buyer> & { person?: Partial<Person> }): Promise<BuyerWithPerson> {
    const buyer = await this.buyersRepo.getById(id);
    if (!buyer) throw new Error('Buyer no encontrado');

    const updatedBuyer = await this.buyersRepo.update(id, data);
    
    let updatedPerson = await this.personsRepo.getById(buyer.personId);
    if (data.person && updatedPerson) {
      updatedPerson = await this.personsRepo.update(buyer.personId, data.person);
    }

    return { ...updatedBuyer, person: updatedPerson! };
  }

  async convertToLead(buyerId: string): Promise<Lead> {
    const buyer = await this.buyersRepo.getById(buyerId);
    if (!buyer) throw new Error('Buyer no encontrado');

    const validation = canTransitionBuyerToLead(buyer);
    if (!validation.success) {
      throw new Error(validation.error || 'No cumple los requisitos para convertirse en LEAD');
    }

    if (buyer.state === BuyerState.CONVERTED) {
      throw new Error('El BUYER ya ha sido convertido a LEAD');
    }

    const leads = await this.leadsRepo.getAll();
    if (leads.some(l => l.buyerId === buyerId)) {
      throw new Error('El BUYER ya tiene un LEAD asociado');
    }

    // Convertir Buyer
    await this.buyersRepo.update(buyerId, { state: BuyerState.CONVERTED });

    // Crear Lead
    const lead: Lead = {
      id: getUUID(),
      buyerId: buyer.id,
      requestedServiceId: buyer.serviceOfInterestId || 'General',
      state: LeadState.IN_NEGOTIATION,
      createdAt: new Date().toISOString(),
    };
    await this.leadsRepo.create(lead);

    // Actualizar Journey
    const journeys = await this.journeysRepo.getAll();
    const journey = journeys.find(j => j.buyerId === buyerId);
    if (journey) {
      await this.journeysRepo.update(journey.id, {
        leadId: lead.id,
        currentPhase: Phase.LEAD,
        updatedAt: new Date().toISOString(),
      });
    }

    return lead;
  }
}

export const buyerUseCases = new BuyerUseCases();
