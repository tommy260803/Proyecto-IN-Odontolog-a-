import { describe, it, expect } from 'vitest';
import {
  calculateB1, calculateB2, calculateB3,
  calculateL2, calculateL3,
  calculateP1, calculateP3,
  calculateC1, calculateC2, calculateC3,
  calculateT1, calculateT2, calculateT3
} from '../domain/indicators';
import { BuyerState, LeadState, PayerState, CustomerState, TurnedState, Phase } from '../domain/enums';
import type { Buyer, Lead, Payer, Customer, TurnedRecord, CustomerJourney, DentalAttention } from '../domain/entities';

describe('Indicators Formulas', () => {
  const getMockJourney = (overrides: Partial<CustomerJourney>): CustomerJourney => ({
    id: 'j1', personId: 'p1', currentPhase: Phase.BUYER, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides
  });

  describe('BUYER Indicators', () => {
    it('B1: should handle zero denominators (no buyers)', () => {
      const result = calculateB1([], []);
      expect(result.value).toBe(0);
      expect(result.status).toBe('red');
    });

    it('B1: should calculate conversion in 14 days', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago
      
      const buyers: Buyer[] = [
        { id: 'b1', personId: 'p1', channel: 'Web', attractionSource: 'Google', contactAuthorization: true, state: BuyerState.CONVERTED, createdAt: past.toISOString() }, // Converted
        { id: 'b2', personId: 'p2', channel: 'Web', attractionSource: 'Google', contactAuthorization: true, state: BuyerState.NEW, createdAt: past.toISOString() } // Over 14 days evaluated but not converted
      ];
      
      const journeys: CustomerJourney[] = [
        getMockJourney({ buyerId: 'b1', leadId: 'l1', updatedAt: new Date(past.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() }) // converted in 2 days
      ];

      const result = calculateB1(buyers, journeys);
      expect(result.value).toBe(50); // 1 converted in <14 days out of 2 evaluated
    });

    it('B2: should calculate usable contacts', () => {
      const buyers: Buyer[] = [
        { id: 'b1', personId: 'p1', channel: 'Web', attractionSource: 'Google', contactAuthorization: true, state: BuyerState.NEW, createdAt: '' },
        { id: 'b2', personId: 'p2', channel: 'Web', attractionSource: 'Google', contactAuthorization: false, state: BuyerState.NEW, createdAt: '' },
      ];
      const result = calculateB2(buyers);
      expect(result.value).toBe(50);
    });

    it('B3: should calculate cost per lead safely', () => {
      const buyers: Buyer[] = [
        { id: 'b1', personId: 'p1', channel: 'Web', attractionSource: 'Facebook', contactAuthorization: true, state: BuyerState.CONVERTED, createdAt: '' } // Facebook = 500
      ];
      const resultEmpty = calculateB3(buyers, []);
      expect(resultEmpty.value).toBe(0); // Zero division protection

      const result = calculateB3(buyers, [{ id: 'l1' } as Lead]);
      expect(result.value).toBe(500); // 500 cost / 1 lead
    });
  });

  describe('LEAD Indicators', () => {
    it('L2: should handle business minutes correctly', () => {
      // 08:00 a 18:00
      const leads: Lead[] = [
        { 
          id: 'l1', buyerId: 'b1', requestedServiceId: 's1', state: LeadState.IN_NEGOTIATION, 
          createdAt: '2026-10-14T10:00:00Z', 
          receptionDate: '2026-10-14T10:00:00Z', 
          firstResponseDate: '2026-10-14T10:10:00Z' // 10 minutes (good)
        }
      ];
      const result = calculateL2(leads);
      expect(result.value).toBe(100);
    });

    it('L3: should calculate integrity', () => {
      const leads: Lead[] = [
        { id: 'l1', buyerId: 'b1', requestedServiceId: 's1', professionalId: 'p1', branchId: 'b1', date: '2026', state: LeadState.IN_NEGOTIATION, createdAt: '' }, // complete
        { id: 'l2', buyerId: 'b2', requestedServiceId: 's1', state: LeadState.IN_NEGOTIATION, createdAt: '' } // incomplete
      ];
      const result = calculateL3(leads);
      expect(result.value).toBe(50);
    });
  });

  describe('PAYER Indicators', () => {
    it('P1 & P3: should calculate validated and rejected', () => {
      const payers: Payer[] = [
        { id: 'p1', leadId: 'l1', reservationId: 'r1', amountToPay: 100, currency: 'PEN', state: PayerState.VALIDATED, createdAt: '' },
        { id: 'p2', leadId: 'l2', reservationId: 'r2', amountToPay: 100, currency: 'PEN', state: PayerState.REJECTED, createdAt: '' },
      ];
      expect(calculateP1(payers).value).toBe(50);
      expect(calculateP3(payers).value).toBe(50);
    });
  });

  describe('CUSTOMER Indicators', () => {
    it('C1 & C2: should calculate attended and no-shows', () => {
      const customers: Customer[] = [
        { id: 'c1', payerId: 'p1', reservationId: 'r1', state: CustomerState.ATTENDED, createdAt: '' },
        { id: 'c2', payerId: 'p2', reservationId: 'r2', state: CustomerState.NO_SHOW, createdAt: '' },
        { id: 'c3', payerId: 'p3', reservationId: 'r3', state: CustomerState.NO_SHOW, createdAt: '' },
      ];
      expect(calculateC1(customers).value).toBeCloseTo(33.33);
      expect(calculateC2(customers).value).toBeCloseTo(66.67);
    });

    it('C3: should calculate average attention time', () => {
      const attentions: DentalAttention[] = [
        { id: 'a1', customerId: 'c1', startTime: '10:00:00', endTime: '10:30:00' }, // 30 min
        { id: 'a2', customerId: 'c2', startTime: '11:00:00', endTime: '12:00:00' }, // 60 min
      ];
      const result = calculateC3(attentions);
      expect(result.value).toBe(45); // Average: 45 min
    });
  });

  describe('TURNED Indicators', () => {
    it('T1: should calculate on-time follow-ups', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days
      const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // -2 days
      
      const turneds: TurnedRecord[] = [
        { id: 't1', customerId: 'c1', state: TurnedState.FOLLOW_UP_PENDING, createdAt: '', nextContactDate: future.toISOString() }, // Not overdue (on time)
        { id: 't2', customerId: 'c2', state: TurnedState.IN_FOLLOW_UP, createdAt: '', nextContactDate: past.toISOString() }, // Overdue (not on time)
        { id: 't3', customerId: 'c3', state: TurnedState.CLOSED, createdAt: '' } // Closed, shouldn't be counted in active
      ];

      const result = calculateT1(turneds);
      expect(result.value).toBe(50); // 1 on-time out of 2 active
    });

    it('T2: should calculate satisfaction safely', () => {
      const turneds: TurnedRecord[] = [
        { id: 't1', customerId: 'c1', state: TurnedState.CLOSED, satisfaction: 5, createdAt: '' },
        { id: 't2', customerId: 'c2', state: TurnedState.CLOSED, satisfaction: 3, createdAt: '' },
      ];
      expect(calculateT2(turneds).value).toBe(4);
    });

    it('T3: should calculate reactivation', () => {
      const turneds: TurnedRecord[] = [
        { id: 't1', customerId: 'c1', state: TurnedState.NEW_REQUEST, createdAt: '' },
        { id: 't2', customerId: 'c2', state: TurnedState.CLOSED, createdAt: '' },
      ];
      expect(calculateT3(turneds).value).toBe(50);
    });
  });
});
