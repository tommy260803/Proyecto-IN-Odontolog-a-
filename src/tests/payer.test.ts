import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { payerUseCases } from '../application/use-cases/payer';
import { leadUseCases } from '../application/use-cases/lead';
import { buyerUseCases } from '../application/use-cases/buyer';
import { PayerState, CustomerState } from '../domain/enums';

describe('Payer Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  async function createTestPayer() {
    const newBuyer = await buyerUseCases.createBuyer({
      firstName: 'Payer',
      lastName: 'Test',
      channel: 'Web',
      attractionSource: 'Google',
      contactAuthorization: true,
      phone: '123456789',
      concreteRequest: 'Ortodoncia'
    });
    
    const lead = await buyerUseCases.convertToLead(newBuyer.id);
    const leadWithAlt = await leadUseCases.addAlternative(lead.id, {
      service: 'Ortodoncia',
      professional: 'Dr',
      branch: 'Sede',
      date: '2026-10-01',
      time: '10:00',
      price: 100
    });
    
    await leadUseCases.selectAlternativeAndReserve(lead.id, leadWithAlt.alternatives![0].id);
    const payer = await leadUseCases.convertToPayer(lead.id);
    return payer;
  }

  it('should register payment and move to IN_REVIEW', async () => {
    const payer = await createTestPayer();
    
    const payment = await payerUseCases.registerPayment(payer.id, {
      channel: 'Web',
      operationNumber: '1234',
      operationDate: '2026-09-15',
    });

    expect(payment).toBeDefined();
    
    const updated = await payerUseCases.getPayerById(payer.id);
    expect(updated?.state).toBe(PayerState.IN_REVIEW);
    expect(updated?.payment).toBeDefined();
  });

  it('should validate payment and allow conversion to Customer', async () => {
    const payer = await createTestPayer();
    await payerUseCases.registerPayment(payer.id, { channel: 'Web', operationNumber: '1234', operationDate: '2026-09-15' });
    
    await payerUseCases.validatePayment(payer.id);
    const updated = await payerUseCases.getPayerById(payer.id);
    expect(updated?.state).toBe(PayerState.VALIDATED);

    const customer = await payerUseCases.convertToCustomer(payer.id);
    expect(customer.state).toBe(CustomerState.SCHEDULED);
  });

  it('should reject payment and create incident', async () => {
    const payer = await createTestPayer();
    await payerUseCases.registerPayment(payer.id, { channel: 'Web', operationNumber: '1234', operationDate: '2026-09-15' });
    
    await payerUseCases.rejectPayment(payer.id, 'Motivo de rechazo de prueba');
    const updated = await payerUseCases.getPayerById(payer.id);
    expect(updated?.state).toBe(PayerState.REJECTED);
    expect(updated?.incidents.length).toBe(1);
    expect(updated?.incidents[0].reason).toBe('Motivo de rechazo de prueba');
  });

  it('should revert a validated payment and create incident', async () => {
    const payer = await createTestPayer();
    await payerUseCases.registerPayment(payer.id, { channel: 'Web', operationNumber: '1234', operationDate: '2026-09-15' });
    await payerUseCases.validatePayment(payer.id);
    
    await payerUseCases.revertPayment(payer.id, 'Motivo de reversión');
    const updated = await payerUseCases.getPayerById(payer.id);
    expect(updated?.state).toBe(PayerState.REVERTED);
    expect(updated?.incidents.length).toBe(1);
  });

  it('should fail conversion to Customer if not validated', async () => {
    const payer = await createTestPayer();
    await expect(payerUseCases.convertToCustomer(payer.id)).rejects.toThrow('El pago debe estar validado.');
  });
});
