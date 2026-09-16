import { describe, it, expect, beforeEach } from 'vitest';
import { buyerUseCases } from '../application/use-cases/buyer';
import { leadUseCases } from '../application/use-cases/lead';
import { payerUseCases } from '../application/use-cases/payer';
import { customerUseCases } from '../application/use-cases/customer';
import { turnedUseCases } from '../application/use-cases/turned';
import { LocalRepository } from '../infrastructure/repositories';
import { QUERY_KEYS } from '../shared/constants';
import type { CustomerJourney } from '../domain/entities';

// Reset localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

describe('E2E Integration Flow: BUYER -> LEAD -> PAYER -> CUSTOMER -> TURNED', () => {
  it('should successfully complete the entire journey', async () => {
    // 1. Create Buyer
    const buyer = await buyerUseCases.createBuyer({
      firstName: 'Juan',
      lastName: 'Pérez',
      documentType: 'DNI',
      documentNumber: '12345678',
      email: 'juan@test.com',
      phone: '987654321',
      channel: 'Web',
      attractionSource: 'Google',
      serviceOfInterestId: 'Implantes',
      contactAuthorization: true,
      concreteRequest: 'Cotización de implante',
    });
    
    expect(buyer).toBeDefined();
    expect(buyer.person.firstName).toBe('Juan');
    
    // Check journey
    const journeysRepo = new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS);
    let journeys = await journeysRepo.getAll();
    expect(journeys.length).toBe(1);
    expect(journeys[0].buyerId).toBe(buyer.id);
    expect(journeys[0].currentPhase).toBe('BUYER');
    
    // 2. Convert to Lead
    const lead = await buyerUseCases.convertToLead(buyer.id);
    expect(lead).toBeDefined();
    expect(lead.buyerId).toBe(buyer.id);
    
    journeys = await journeysRepo.getAll();
    expect(journeys[0].leadId).toBe(lead.id);
    expect(journeys[0].currentPhase).toBe('LEAD');
    
    // Test duplicate conversion check
    await expect(buyerUseCases.convertToLead(buyer.id)).rejects.toThrow('El BUYER ya ha sido convertido a LEAD');
    
    // 3. Negotiate (Add Alternative & Select)
    await leadUseCases.addAlternative(lead.id, {
      service: 'Implante Titanio', professional: 'Dr. Smith', branch: 'Sede Central',
      date: '2026-10-15', time: '10:00', price: 1500
    });
    const updatedLead = await leadUseCases.getLeadById(lead.id);
    const altId = updatedLead!.alternatives![0].id;
    await leadUseCases.selectAlternativeAndReserve(lead.id, altId);
    
    // 4. Convert to Payer
    const payer = await leadUseCases.convertToPayer(lead.id);
    expect(payer).toBeDefined();
    expect(payer.leadId).toBe(lead.id);
    expect(payer.amountToPay).toBe(1500);
    
    journeys = await journeysRepo.getAll();
    expect(journeys[0].payerId).toBe(payer.id);
    expect(journeys[0].currentPhase).toBe('PAYER');
    
    // Test duplicate conversion
    await expect(leadUseCases.convertToPayer(lead.id)).rejects.toThrow('El LEAD ya tiene un PAYER asociado');
    
    // 5. Pay and Convert to Customer
    await payerUseCases.registerPayment(payer.id, {
      channel: 'Web', operationNumber: 'OP123', operationDate: '2026-10-14'
    });
    await payerUseCases.validatePayment(payer.id);
    
    const customer = await payerUseCases.convertToCustomer(payer.id);
    expect(customer).toBeDefined();
    expect(customer.payerId).toBe(payer.id);
    
    journeys = await journeysRepo.getAll();
    expect(journeys[0].customerId).toBe(customer.id);
    expect(journeys[0].currentPhase).toBe('CUSTOMER');
    
    // 6. Clinical Attention
    await customerUseCases.startAttention(customer.id, '10:00');
    await customerUseCases.finishAttention(customer.id, '11:00');
    await customerUseCases.registerAttentionDetails(customer.id, {
      reasonForConsultation: 'Revisión', evaluation: 'Todo ok', procedure: 'Checkup', instructions: 'Reposo'
    });
    
    // 7. Convert to Turned
    const turned = await customerUseCases.convertToTurned(customer.id);
    expect(turned).toBeDefined();
    expect(turned.customerId).toBe(customer.id);
    
    journeys = await journeysRepo.getAll();
    expect(journeys[0].turnedId).toBe(turned.id);
    expect(journeys[0].currentPhase).toBe('TURNED');
    
    // 8. Test Reactivation
    const newBuyer = await turnedUseCases.createNewRequest(turned.id, {
      serviceOfInterestId: 'Blanqueamiento',
      concreteRequest: 'Quiere un blanqueamiento',
      channel: 'Teléfono',
      contactAuthorization: true
    });
    
    expect(newBuyer).toBeDefined();
    expect(newBuyer.personId).toBe(buyer.person.id); // Same person
    
    journeys = await journeysRepo.getAll();
    expect(journeys.length).toBe(2); // New independent journey created
    
    const newJourney = journeys.find(j => j.buyerId === newBuyer.id);
    expect(newJourney).toBeDefined();
    expect(newJourney?.currentPhase).toBe('BUYER');
    expect(newJourney?.leadId).toBeUndefined(); // Independent
  });

  it('should prevent invalid transitions', async () => {
    const buyer = await buyerUseCases.createBuyer({
      firstName: 'Ana', lastName: 'Gómez', channel: 'Web', attractionSource: 'Google', contactAuthorization: false
    });
    
    // Missing concreteRequest & authorization
    await expect(buyerUseCases.convertToLead(buyer.id)).rejects.toThrow();
  });
});
