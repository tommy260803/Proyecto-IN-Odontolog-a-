import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buyerSchema } from '../modules/buyer/schemas/buyerSchema';
import { buyerUseCases } from '../application/use-cases/buyer';
import { BuyerState } from '../domain/enums';

describe('Buyer Module', () => {
  describe('Zod Schema Validations', () => {
    it('should pass with valid data (phone only)', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '987654321',
        channel: 'WhatsApp',
        attractionSource: 'Google',
        contactAuthorization: true,
      };
      const result = buyerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should pass with valid data (email only)', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        channel: 'WhatsApp',
        attractionSource: 'Google',
        contactAuthorization: true,
      };
      const result = buyerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail when both phone and email are missing or empty', () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
        channel: 'WhatsApp',
        attractionSource: 'Google',
        contactAuthorization: true,
      };
      const result = buyerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Debe ingresar al menos un medio de contacto (teléfono o correo)');
      }
    });
  });

  describe('Use Cases: Conversion to LEAD', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should convert buyer to lead successfully when conditions are met', async () => {
      // 1. Create a buyer
      const newBuyer = await buyerUseCases.createBuyer({
        firstName: 'Alice',
        lastName: 'Smith',
        channel: 'WhatsApp',
        attractionSource: 'Facebook',
        contactAuthorization: true,
        phone: '123456789'
      });

      // 2. Add concrete request to meet transition requirements
      await buyerUseCases.updateBuyer(newBuyer.id, { concreteRequest: 'Quiero una cita' });

      // 3. Convert to Lead
      const lead = await buyerUseCases.convertToLead(newBuyer.id);
      
      expect(lead).toBeDefined();
      expect(lead.buyerId).toBe(newBuyer.id);
      
      // 4. Check Buyer state is updated
      const updatedBuyer = await buyerUseCases.getBuyerById(newBuyer.id);
      expect(updatedBuyer?.state).toBe(BuyerState.CONVERTED);
    });

    it('should fail conversion if concrete request is missing', async () => {
      const newBuyer = await buyerUseCases.createBuyer({
        firstName: 'Bob',
        lastName: 'Jones',
        channel: 'WhatsApp',
        attractionSource: 'Facebook',
        contactAuthorization: true,
        phone: '123456789'
      });

      await expect(buyerUseCases.convertToLead(newBuyer.id)).rejects.toThrow('Debe existir una solicitud concreta.');
    });
  });
});
