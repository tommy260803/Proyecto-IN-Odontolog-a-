import { z } from 'zod';

export const turnedDetailsSchema = z.object({
  finalResult: z.string().min(3, 'El resultado final es obligatorio'),
  satisfaction: z.coerce.number().min(1).max(5).optional(),
  customerComment: z.string().optional(),
  nextContactDate: z.string().optional(),
});

export type TurnedDetailsFormValues = z.infer<typeof turnedDetailsSchema>;

export const followUpSchema = z.object({
  channel: z.string().min(2, 'El canal es obligatorio'),
  contactResult: z.string().min(2, 'El resultado del contacto es obligatorio'),
  observations: z.string().min(3, 'Las observaciones son obligatorias'),
  nextFollowUpDate: z.string().optional(),
});

export type FollowUpFormValues = z.infer<typeof followUpSchema>;

export const newRequestSchema = z.object({
  serviceOfInterestId: z.string().min(2, 'El servicio de interés es obligatorio'),
  channel: z.string().min(2, 'El canal es obligatorio'),
  contactAuthorization: z.boolean(),
  concreteRequest: z.string().min(5, 'La observación es obligatoria para la nueva solicitud'),
});

export type NewRequestFormValues = z.infer<typeof newRequestSchema>;
