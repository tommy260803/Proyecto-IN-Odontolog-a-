import { z } from 'zod';

export const buyerSchema = z.object({
  firstName: z.string().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)'),
  lastName: z.string().min(2, 'El apellido es obligatorio (mínimo 2 caracteres)'),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  email: z.string().email('Ingresa un correo electrónico válido').optional().or(z.literal('')),
  phone: z.string().regex(/^$|^[0-9+ -]{6,15}$/, 'Número de teléfono inválido (mínimo 6 dígitos)').optional().or(z.literal('')),
  channel: z.string().min(1, 'Selecciona un canal de contacto'),
  attractionSource: z.string().min(1, 'Selecciona una fuente de atracción'),
  serviceOfInterestId: z.string().optional(),
  preferences: z.string().optional(),
  contactAuthorization: z.boolean().default(false),
  concreteRequest: z.string().optional(),
}).refine(data => {
  const hasEmail = Boolean(data.email && data.email.trim().length > 0);
  const hasPhone = Boolean(data.phone && data.phone.trim().length > 0);
  return hasEmail || hasPhone;
}, {
  message: 'Debe ingresar al menos un medio de contacto (teléfono o correo)',
  path: ['phone']
});

export type BuyerFormValues = z.infer<typeof buyerSchema>;
