import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { turnedUseCases } from '../application/use-cases/turned';
import { customerUseCases } from '../application/use-cases/customer';
import { payerUseCases } from '../application/use-cases/payer';
import { leadUseCases } from '../application/use-cases/lead';
import { buyerUseCases } from '../application/use-cases/buyer';
import { TurnedState, CustomerState, BuyerState } from '../domain/enums';

describe('Turned Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  async function createTestTurned() {
    const newBuyer = await buyerUseCases.createBuyer({
      firstName: 'Turned',
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
    
    const customer = await payerUseCases.convertToCustomer(payer.id);
    await customerUseCases.changeState(customer.id, CustomerState.ATTENDANCE_CONFIRMED);
    await customerUseCases.startAttention(customer.id, '10:00');
    await customerUseCases.registerAttentionDetails(customer.id, {
      procedure: 'Procedimiento X',
      instructions: 'Instrucciones Y'
    });
    await customerUseCases.finishAttention(customer.id, '10:30');
    
    return await customerUseCases.convertToTurned(customer.id);
  }

  it('should add follow-up and change state to IN_FOLLOW_UP', async () => {
    const turned = await createTestTurned();
    expect(turned.state).toBe(TurnedState.FOLLOW_UP_PENDING);

    const followUp = await turnedUseCases.addFollowUp(turned.id, {
      channel: 'Teléfono',
      contactResult: 'Respondió',
      observations: 'Cliente contento',
      nextFollowUpDate: '2026-10-10'
    });

    expect(followUp.channel).toBe('Teléfono');

    const updated = await turnedUseCases.getTurnedById(turned.id);
    expect(updated?.state).toBe(TurnedState.IN_FOLLOW_UP);
    expect(updated?.followUps.length).toBe(1);
    expect(updated?.nextContactDate).toBe('2026-10-10');
  });

  it('should close the flow when final result is set', async () => {
    const turned = await createTestTurned();
    
    await turnedUseCases.updateTurnedDetails(turned.id, {
      finalResult: 'Alta médica exitosa',
      satisfaction: 5,
      customerComment: 'Excelente servicio'
    });

    const updated = await turnedUseCases.getTurnedById(turned.id);
    expect(updated?.state).toBe(TurnedState.CLOSED);
    expect(updated?.endDate).toBeDefined();
    expect(updated?.satisfaction).toBe(5);
  });

  it('should create a new Request (Reactivation) successfully', async () => {
    const turned = await createTestTurned();
    
    const newBuyer = await turnedUseCases.createNewRequest(turned.id, {
      serviceOfInterestId: 'Blanqueamiento',
      channel: 'WhatsApp',
      contactAuthorization: true,
      concreteRequest: 'Desea cotizar blanqueamiento luego de su ortodoncia'
    });

    expect(newBuyer.attractionSource).toBe('Postventa/Reactivación');
    expect(newBuyer.state).toBe(BuyerState.NEW);

    const updated = await turnedUseCases.getTurnedById(turned.id);
    expect(updated?.state).toBe(TurnedState.NEW_REQUEST);
  });
});
