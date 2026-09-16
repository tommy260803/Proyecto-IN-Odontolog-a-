import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { leadUseCases } from '../application/use-cases/lead';
import { buyerUseCases } from '../application/use-cases/buyer';
import { LeadState, PayerState } from '../domain/enums';

describe('Lead Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should add alternative, select it, generate reservation, and convert to Payer', async () => {
    // 1. Arrange: Create Buyer -> Lead
    const newBuyer = await buyerUseCases.createBuyer({
      firstName: 'Test',
      lastName: 'Lead',
      channel: 'Web',
      attractionSource: 'Google',
      contactAuthorization: true,
      phone: '123456789',
      concreteRequest: 'Ortodoncia'
    });
    
    const lead = await buyerUseCases.convertToLead(newBuyer.id);
    
    // 2. Act: Add Alternative
    const leadWithAlt = await leadUseCases.addAlternative(lead.id, {
      service: 'Ortodoncia Metálica',
      professional: 'Dr. Smith',
      branch: 'Sede Central',
      date: '2026-10-01',
      time: '10:00',
      price: 500,
      conditions: 'Pago inicial del 50%'
    });
    
    expect(leadWithAlt.alternatives?.length).toBe(1);
    const altId = leadWithAlt.alternatives![0].id;

    // 3. Act: Select alternative and generate reservation
    const selectedLead = await leadUseCases.selectAlternativeAndReserve(lead.id, altId);
    expect(selectedLead.selectedAlternativeId).toBe(altId);
    expect(selectedLead.reservationId).toBeDefined();
    expect(selectedLead.state).toBe(LeadState.ALTERNATIVE_SELECTED);
    
    // 4. Act: Convert to Payer
    const payer = await leadUseCases.convertToPayer(lead.id);
    expect(payer).toBeDefined();
    expect(payer.state).toBe(PayerState.PENDING);
    expect(payer.amountToPay).toBe(500);
    
    // Check final Lead state
    const finalLead = await leadUseCases.getLeadById(lead.id);
    expect(finalLead?.state).toBe(LeadState.PAYMENT_REQUESTED);
  });

  it('should prevent converting to Payer if no alternative is selected', async () => {
    const newBuyer = await buyerUseCases.createBuyer({
      firstName: 'Test',
      lastName: 'Lead',
      channel: 'Web',
      attractionSource: 'Google',
      contactAuthorization: true,
      phone: '123456789',
      concreteRequest: 'Ortodoncia'
    });
    
    const lead = await buyerUseCases.convertToLead(newBuyer.id);
    
    // Attempt conversion without selection
    await expect(leadUseCases.convertToPayer(lead.id)).rejects.toThrow('Debe existir una alternativa seleccionada');
  });
});
