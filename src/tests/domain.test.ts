import { describe, it, expect } from 'vitest';
import {
  canTransitionBuyerToLead,
  canTransitionLeadToPayer,
  canTransitionPayerToCustomer,
  canTransitionCustomerToTurned,
} from '../domain/transitions';
import {
  BuyerState,
  LeadState,
  PayerState,
  CustomerState,
} from '../domain/enums';
import type {
  Buyer,
  Lead,
  Payer,
  Customer,
  DentalAttention,
  Reservation,
} from '../domain/entities';

describe('Domain Transitions', () => {
  it('should validate BUYER -> LEAD correctly', () => {
    const validBuyer = {
      id: '1',
      personId: 'p1',
      channel: 'Web',
      attractionSource: 'Google',
      contactAuthorization: true,
      concreteRequest: 'Quiero cita',
      state: BuyerState.CONTACTED,
      createdAt: '',
    } as Buyer;

    expect(canTransitionBuyerToLead(validBuyer).success).toBe(true);

    const invalidBuyer = { ...validBuyer, concreteRequest: undefined };
    const res = canTransitionBuyerToLead(invalidBuyer);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Debe existir una solicitud concreta.');
  });

  it('should validate LEAD -> PAYER correctly', () => {
    const validLead = {
      id: '1',
      buyerId: 'b1',
      requestedServiceId: 'srv-1',
      selectedAlternativeId: 'alt1',
      reservationId: 'res1',
      paymentRequestId: 'pr1',
      state: LeadState.IN_NEGOTIATION,
      createdAt: '',
    } as Lead;

    expect(canTransitionLeadToPayer(validLead).success).toBe(true);

    const invalidLead = { ...validLead, selectedAlternativeId: undefined };
    expect(canTransitionLeadToPayer(invalidLead).success).toBe(false);
  });

  it('should validate PAYER -> CUSTOMER correctly', () => {
    const validPayer = {
      id: '1',
      leadId: 'l1',
      reservationId: 'res1',
      amountToPay: 100,
      currency: 'PEN',
      state: PayerState.VALIDATED,
      createdAt: '',
    } as Payer;
    const reservation = {
      id: 'res1',
      leadId: 'l1',
      date: '',
      time: '',
      status: 'PENDING',
    } as Reservation;

    expect(canTransitionPayerToCustomer(validPayer, reservation).success).toBe(
      true,
    );

    const invalidPayer = { ...validPayer, state: PayerState.PENDING };
    expect(
      canTransitionPayerToCustomer(invalidPayer, reservation).success,
    ).toBe(false);
  });

  it('should validate CUSTOMER -> TURNED correctly', () => {
    const validCustomer = {
      id: '1',
      payerId: 'p1',
      reservationId: 'res1',
      state: CustomerState.ATTENDED,
      createdAt: '',
    } as Customer;
    const attention: DentalAttention = {
      id: 'a1',
      customerId: '1',
      procedure: 'Proc',
      instructions: 'Ind',
      startTime: '10:00',
      endTime: '11:00',
    };

    expect(
      canTransitionCustomerToTurned(validCustomer, attention).success,
    ).toBe(true);

    const invalidCustomer = {
      ...validCustomer,
      state: CustomerState.IN_ATTENTION,
    };
    expect(
      canTransitionCustomerToTurned(invalidCustomer, attention).success,
    ).toBe(false);
  });
});
