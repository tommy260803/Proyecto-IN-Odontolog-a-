import type { 
  Payer, Payment, PaymentIncident, Customer, Lead, Buyer, Person, Reservation, CustomerJourney 
} from '@/domain/entities';
import { PayerState, CustomerState, Phase } from '@/domain/enums';
import { LocalRepository } from '@/infrastructure/repositories';
import { QUERY_KEYS } from '@/shared/constants';
import { canTransitionPayerToCustomer } from '@/domain/transitions';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'uuid-' + Math.random().toString(36).substring(2, 9);
};

export type PayerWithDetails = Payer & { 
  lead: Lead;
  buyer: Buyer;
  person: Person;
  reservation: Reservation;
  payment?: Payment;
  incidents: PaymentIncident[];
};

export class PayerUseCases {
  private payersRepo = new LocalRepository<Payer>(QUERY_KEYS.PAYERS);
  private paymentsRepo = new LocalRepository<Payment>(QUERY_KEYS.PAYMENTS);
  private incidentsRepo = new LocalRepository<PaymentIncident>('payment-incidents');
  private leadsRepo = new LocalRepository<Lead>(QUERY_KEYS.LEADS);
  private buyersRepo = new LocalRepository<Buyer>(QUERY_KEYS.BUYERS);
  private personsRepo = new LocalRepository<Person>(QUERY_KEYS.PERSONS);
  private reservationsRepo = new LocalRepository<Reservation>(QUERY_KEYS.RESERVATIONS);
  private customersRepo = new LocalRepository<Customer>(QUERY_KEYS.CUSTOMERS);
  private journeysRepo = new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS);

  async getAllPayers(): Promise<PayerWithDetails[]> {
    try {
      const res = await fetch('http://localhost:3001/api/payer');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(d => ({
            ...d,
            lead: d.lead || { id: d.leadId, buyerId: d.leadId, state: 'PAYMENT_REQUESTED' },
            buyer: d.buyer || { id: d.leadId, personId: d.leadId },
            incidents: d.incidents || []
          }));
        }
      }
    } catch (e) {
      console.warn('[PayerUseCases] Backend API no disponible, usando fallback LocalStorage');
    }

    const payers = await this.payersRepo.getAll();
    const leads = await this.leadsRepo.getAll();
    const buyers = await this.buyersRepo.getAll();
    const persons = await this.personsRepo.getAll();
    const reservations = await this.reservationsRepo.getAll();
    const payments = await this.paymentsRepo.getAll();
    const incidents = await this.incidentsRepo.getAll();
    
    return payers.map(payer => {
      const lead = leads.find(l => l.id === payer.leadId)!;
      const buyer = lead ? buyers.find(b => b.id === lead.buyerId)! : {} as Buyer;
      const person = buyer ? persons.find(p => p.id === buyer.personId)! : {} as Person;
      const reservation = reservations.find(r => r.id === payer.reservationId)!;
      const payment = payments.find(p => p.id === payer.paymentId);
      const payerIncidents = incidents.filter(i => i.payerId === payer.id);

      return { ...payer, lead, buyer, person, reservation, payment, incidents: payerIncidents };
    }).filter(p => p.lead && p.buyer && p.person && p.reservation);
  }

  async getPayerById(id: string): Promise<PayerWithDetails | null> {
    // 1. Consultar la API REST de Express / SQL Server
    try {
      const res = await fetch(`http://localhost:3001/api/payer/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          return {
            ...data,
            lead: data.lead || { id: data.leadId, buyerId: data.leadId, state: 'PAYMENT_REQUESTED' },
            buyer: data.buyer || { id: data.leadId, personId: data.leadId },
            incidents: data.incidents || []
          } as PayerWithDetails;
        }
      }
    } catch (e) {
      console.warn('[PayerUseCases] Backend API no disponible, usando fallback LocalStorage');
    }

    // 2. Fallback a LocalRepository
    let payer = await this.payersRepo.getById(id);
    if (!payer) {
      const allPayers = await this.payersRepo.getAll();
      payer = allPayers.find(p => p.id === id || p.leadId === id || p.reservationId === id) || null;
    }
    if (!payer) return null;

    // Si la respuesta del repositorio (ej. ApiRepository) ya trae las relaciones integradas:
    if (payer && (payer as any).person && (payer as any).reservation) {
      return {
        ...payer,
        lead: (payer as any).lead || { id: payer.leadId, buyerId: payer.leadId, state: 'PAYMENT_REQUESTED' },
        buyer: (payer as any).buyer || { id: payer.leadId, personId: payer.leadId },
        incidents: (payer as any).incidents || []
      } as PayerWithDetails;
    }

    if (!payer) {
      // Intento de recuperación fallback si viene por leadId o personaId
      const leads = await this.leadsRepo.getAll();
      const leadMatch = leads.find(l => l.id === id || l.buyerId === id);
      if (leadMatch) {
        const buyers = await this.buyersRepo.getAll();
        const persons = await this.personsRepo.getAll();
        const buyerMatch = buyers.find(b => b.id === leadMatch.buyerId);
        const personMatch = buyerMatch ? persons.find(p => p.id === buyerMatch.personId) : undefined;
        const reservations = await this.reservationsRepo.getAll();
        const resMatch = reservations.find(r => r.leadId === leadMatch.id);

        if (personMatch || (leadMatch as any).person) {
          const finalPerson = personMatch || (leadMatch as any).person;
          return {
            id: id,
            leadId: leadMatch.id,
            reservationId: resMatch?.id || 'res-1',
            amountToPay: leadMatch.price || 1.00,
            currency: 'PEN',
            state: PayerState.PENDING,
            createdAt: new Date().toISOString(),
            lead: leadMatch,
            buyer: buyerMatch || { id: leadMatch.buyerId, personId: leadMatch.id } as any,
            person: finalPerson,
            reservation: resMatch || {
              id: 'res-1',
              leadId: leadMatch.id,
              date: new Date().toISOString().split('T')[0],
              time: '15:00 - 16:00',
              branchId: 'Sede Norte',
              professionalId: 'Dr. Perez',
              status: 'PENDING'
            },
            incidents: []
          } as PayerWithDetails;
        }
      }
      return null;
    }
    
    const lead = await this.leadsRepo.getById(payer.leadId);
    const buyer = lead ? await this.buyersRepo.getById(lead.buyerId) : null;
    const person = buyer ? await this.personsRepo.getById(buyer.personId) : null;
    const reservation = await this.reservationsRepo.getById(payer.reservationId);
    const payment = payer.paymentId ? await this.paymentsRepo.getById(payer.paymentId) : undefined;
    
    const allIncidents = await this.incidentsRepo.getAll();
    const incidents = allIncidents.filter(i => i.payerId === payer.id);

    const finalPerson = person || (payer as any).person || { firstName: 'Paciente', lastName: 'NexoSalud' };
    const finalReservation = reservation || (payer as any).reservation || { id: payer.reservationId, date: '2026-09-17', time: '15:00', branchId: 'Sede Norte', professionalId: 'Dr. Perez' };

    return { 
      ...payer, 
      lead: lead || { id: payer.leadId, buyerId: payer.leadId, state: 'PAYMENT_REQUESTED' } as any, 
      buyer: buyer || { id: payer.leadId, personId: payer.leadId } as any, 
      person: finalPerson as any, 
      reservation: finalReservation as any, 
      payment: payment || undefined, 
      incidents 
    };
  }

  async registerPayment(payerId: string, data: Omit<Payment, 'id' | 'payerId' | 'currency' | 'amount'>): Promise<Payment> {
    const payer = await this.payersRepo.getById(payerId);
    if (!payer) throw new Error('Payer no encontrado');

    const payment: Payment = {
      id: getUUID(),
      payerId: payer.id,
      amount: payer.amountToPay,
      currency: 'PEN',
      ...data,
    };
    await this.paymentsRepo.create(payment);

    await this.payersRepo.update(payerId, { 
      paymentId: payment.id,
      state: PayerState.IN_REVIEW 
    });

    return payment;
  }

  async validatePayment(payerId: string): Promise<Payer> {
    const payer = await this.payersRepo.getById(payerId);
    if (!payer) throw new Error('Payer no encontrado');
    if (!payer.paymentId) throw new Error('No hay pago registrado para validar');
    
    return this.payersRepo.update(payerId, { state: PayerState.VALIDATED });
  }

  async rejectPayment(payerId: string, reason: string): Promise<Payer> {
    const payer = await this.payersRepo.getById(payerId);
    if (!payer) throw new Error('Payer no encontrado');
    
    await this.incidentsRepo.create({
      id: getUUID(),
      payerId,
      reason,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    });

    return this.payersRepo.update(payerId, { state: PayerState.REJECTED });
  }

  async revertPayment(payerId: string, reason: string): Promise<Payer> {
    const payer = await this.payersRepo.getById(payerId);
    if (!payer) throw new Error('Payer no encontrado');
    if (payer.state !== PayerState.VALIDATED) {
      throw new Error('Solo se pueden revertir pagos validados');
    }

    await this.incidentsRepo.create({
      id: getUUID(),
      payerId,
      reason,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    });

    return this.payersRepo.update(payerId, { state: PayerState.REVERTED });
  }

  async convertToCustomer(payerId: string): Promise<Customer> {
    const payer = await this.payersRepo.getById(payerId);
    if (!payer) throw new Error('Payer no encontrado');
    
    const reservation = await this.reservationsRepo.getById(payer.reservationId);

    const validation = canTransitionPayerToCustomer(payer, reservation || undefined);
    if (!validation.success) {
      throw new Error(validation.error || 'No cumple los requisitos para convertirse en CUSTOMER');
    }

    const customers = await this.customersRepo.getAll();
    if (customers.some(c => c.payerId === payerId)) {
      throw new Error('El PAYER ya tiene un CUSTOMER asociado');
    }

    // Convertir Payer a Custom
    const customer: Customer = {
      id: getUUID(),
      payerId: payer.id,
      reservationId: payer.reservationId,
      state: CustomerState.SCHEDULED,
      createdAt: new Date().toISOString(),
    };
    await this.customersRepo.create(customer);

    // Actualizar Journey
    const journeys = await this.journeysRepo.getAll();
    const journey = journeys.find(j => j.payerId === payerId);
    if (journey) {
      await this.journeysRepo.update(journey.id, {
        customerId: customer.id,
        currentPhase: Phase.CUSTOMER,
        updatedAt: new Date().toISOString(),
      });
    }

    return customer;
  }
}

export const payerUseCases = new PayerUseCases();
