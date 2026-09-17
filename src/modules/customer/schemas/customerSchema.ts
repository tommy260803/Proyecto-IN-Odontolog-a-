import { z } from 'zod';

export const dentalAttentionSchema = z.object({
  reasonForConsultation: z.string().min(3, 'El motivo de consulta debe tener al menos 3 caracteres').optional().or(z.literal('')),
  relevantBackground: z.string().optional(),
  allergies: z.string().optional(),
  evaluation: z.string().min(3, 'La evaluación debe tener al menos 3 caracteres').optional().or(z.literal('')),
  procedure: z.string().min(3, 'El procedimiento debe tener al menos 3 caracteres').optional().or(z.literal('')),
  instructions: z.string().optional(),
  observations: z.string().optional(),
});

export type DentalAttentionFormValues = z.infer<typeof dentalAttentionSchema>;

export const customerIncidentSchema = z.object({
  reason: z.string().min(10, 'El motivo debe ser detallado (al menos 10 caracteres)'),
});

export type CustomerIncidentFormValues = z.infer<typeof customerIncidentSchema>;
