import { z } from 'zod';

export const buyerSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  phone: z.string().min(6, 'Teléfono inválido').optional().or(z.literal('')),
  channel: z.string().min(1, 'Selecciona un canal de contacto'),
  attractionSource: z.string().min(1, 'Selecciona una fuente de atracción'),
  serviceOfInterestId: z.string().optional(),
  preferences: z.string().optional(),
  contactAuthorization: z.boolean().default(false),
  concreteRequest: z.string().optional(),
}).refine(data => {
  return (data.email && data.email.trim().length > 0) || (data.phone && data.phone.trim().length > 0);
}, {
  message: 'Debe existir al menos un medio de contacto utilizable (teléfono o correo)',
  path: ['phone']
});

export type BuyerFormValues = z.infer<typeof buyerSchema>;
