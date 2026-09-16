import { LocalRepository } from '../repositories';
import type {
  Person,
  Buyer,
  Lead,
  Payer,
  Customer,
  TurnedRecord,
  CustomerJourney,
} from '@/domain/entities';
import {
  BuyerState,
  LeadState,
  PayerState,
  CustomerState,
  TurnedState,
  Phase,
} from '@/domain/enums';
import { QUERY_KEYS, DOMAIN_CONSTANTS } from '@/shared/constants';
import { storage } from '../storage';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para entornos de prueba básicos
  return 'uuid-' + Math.random().toString(36).substring(2, 9);
};

export async function initializeMockData(): Promise<void> {
  const isSeeded = await storage.getItem<boolean>(
    DOMAIN_CONSTANTS.SEED_FLAG_KEY,
  );
  if (isSeeded) return;

  const personsRepo = new LocalRepository<Person>(QUERY_KEYS.PERSONS);
  const buyersRepo = new LocalRepository<Buyer>(QUERY_KEYS.BUYERS);
  const leadsRepo = new LocalRepository<Lead>(QUERY_KEYS.LEADS);
  const payersRepo = new LocalRepository<Payer>(QUERY_KEYS.PAYERS);
  const customersRepo = new LocalRepository<Customer>(QUERY_KEYS.CUSTOMERS);
  const turnedRepo = new LocalRepository<TurnedRecord>(QUERY_KEYS.TURNED);
  const journeysRepo = new LocalRepository<CustomerJourney>(
    QUERY_KEYS.JOURNEYS,
  );

  // --- Seed Persona 1: Complete Journey (Turned) ---
  const person1: Person = {
    id: getUUID(),
    firstName: 'Carlos',
    lastName: 'Gómez',
    documentNumber: '12345678',
  };
  await personsRepo.create(person1);

  const buyer1: Buyer = {
    id: getUUID(),
    personId: person1.id,
    channel: 'WhatsApp',
    attractionSource: 'Facebook',
    contactAuthorization: true,
    state: BuyerState.CONVERTED,
    createdAt: new Date().toISOString(),
    concreteRequest: 'Información sobre blanqueamiento',
  };
  await buyersRepo.create(buyer1);

  const lead1: Lead = {
    id: getUUID(),
    buyerId: buyer1.id,
    requestedServiceId: 'srv-1',
    selectedAlternativeId: 'alt-1',
    reservationId: 'res-1',
    paymentRequestId: 'pr-1',
    state: LeadState.CONVERTED,
    createdAt: new Date().toISOString(),
  };
  await leadsRepo.create(lead1);

  const payer1: Payer = {
    id: getUUID(),
    leadId: lead1.id,
    reservationId: 'res-1',
    amountToPay: 150,
    currency: 'PEN',
    state: PayerState.VALIDATED,
    createdAt: new Date().toISOString(),
  };
  await payersRepo.create(payer1);

  const customer1: Customer = {
    id: getUUID(),
    payerId: payer1.id,
    reservationId: 'res-1',
    attentionId: 'att-1',
    state: CustomerState.ATTENDED,
    createdAt: new Date().toISOString(),
  };
  await customersRepo.create(customer1);

  const turned1: TurnedRecord = {
    id: getUUID(),
    customerId: customer1.id,
    finalResult: 'Servicio completado exitosamente',
    endDate: new Date().toISOString(),
    state: TurnedState.IN_FOLLOW_UP,
    createdAt: new Date().toISOString(),
  };
  await turnedRepo.create(turned1);

  const journey1: CustomerJourney = {
    id: getUUID(),
    personId: person1.id,
    currentPhase: Phase.TURNED,
    buyerId: buyer1.id,
    leadId: lead1.id,
    payerId: payer1.id,
    customerId: customer1.id,
    turnedId: turned1.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await journeysRepo.create(journey1);

  // --- Seed Persona 2: Only Buyer ---
  const person2: Person = {
    id: getUUID(),
    firstName: 'Ana',
    lastName: 'López',
    documentNumber: '87654321',
  };
  await personsRepo.create(person2);

  const buyer2: Buyer = {
    id: getUUID(),
    personId: person2.id,
    channel: 'Web',
    attractionSource: 'Google',
    contactAuthorization: true,
    state: BuyerState.NEW,
    createdAt: new Date().toISOString(),
  };
  await buyersRepo.create(buyer2);

  const journey2: CustomerJourney = {
    id: getUUID(),
    personId: person2.id,
    currentPhase: Phase.BUYER,
    buyerId: buyer2.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await journeysRepo.create(journey2);

  // Marcar como inicializado
  await storage.setItem(DOMAIN_CONSTANTS.SEED_FLAG_KEY, true);
}
