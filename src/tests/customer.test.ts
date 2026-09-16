import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { customerUseCases } from '../application/use-cases/customer';
import { payerUseCases } from '../application/use-cases/payer';
import { leadUseCases } from '../application/use-cases/lead';
import { buyerUseCases } from '../application/use-cases/buyer';
import { CustomerState, TurnedState } from '../domain/enums';

describe('Customer Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  async function createTestCustomer() {
    const newBuyer = await buyerUseCases.createBuyer({
      firstName: 'Customer',
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
    await payerUseCases.registerPayment(payer.id, { channel: 'Web', operationNumber: '123', operationDate: '2026-09-15' });
    await payerUseCases.validatePayment(payer.id);
    return await payerUseCases.convertToCustomer(payer.id);
  }

  it('should flow through attendance steps', async () => {
    const customer = await createTestCustomer();
    expect(customer.state).toBe(CustomerState.SCHEDULED);

    await customerUseCases.changeState(customer.id, CustomerState.ATTENDANCE_CONFIRMED);
    let updated = await customerUseCases.getCustomerById(customer.id);
    expect(updated?.state).toBe(CustomerState.ATTENDANCE_CONFIRMED);

    await customerUseCases.startAttention(customer.id, '10:00');
    updated = await customerUseCases.getCustomerById(customer.id);
    expect(updated?.state).toBe(CustomerState.IN_ATTENTION);
    expect(updated?.attentionId).toBeDefined();

    await customerUseCases.registerAttentionDetails(customer.id, {
      procedure: 'Procedimiento X',
      instructions: 'Instrucciones Y'
    });

    await customerUseCases.finishAttention(customer.id, '10:30');
    updated = await customerUseCases.getCustomerById(customer.id);
    expect(updated?.state).toBe(CustomerState.ATTENDED);
    expect(updated?.attention?.procedure).toBe('Procedimiento X');
    expect(updated?.attention?.endTime).toBe('10:30');
  });

  it('should convert to TURNED if rules are met', async () => {
    const customer = await createTestCustomer();
    await customerUseCases.changeState(customer.id, CustomerState.ATTENDANCE_CONFIRMED);
    await customerUseCases.startAttention(customer.id, '10:00');
    await customerUseCases.registerAttentionDetails(customer.id, {
      procedure: 'Procedimiento X',
      instructions: 'Instrucciones Y'
    });
    await customerUseCases.finishAttention(customer.id, '10:30');
    
    const turned = await customerUseCases.convertToTurned(customer.id);
    expect(turned.state).toBe(TurnedState.FOLLOW_UP_PENDING);
  });

  it('should fail conversion to TURNED if not attended or missing data', async () => {
    const customer = await createTestCustomer();
    
    // Scheduled state -> fail
    await expect(customerUseCases.convertToTurned(customer.id)).rejects.toThrow('El estado debe ser atendido para finalizar el recorrido.');

    // Attended but missing clinical data -> fail
    await customerUseCases.changeState(customer.id, CustomerState.ATTENDANCE_CONFIRMED);
    await customerUseCases.startAttention(customer.id, '10:00');
    await customerUseCases.finishAttention(customer.id, '10:30');
    await expect(customerUseCases.convertToTurned(customer.id)).rejects.toThrow('Debe existir información del procedimiento realizado.');
  });
});
