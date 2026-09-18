import { z } from 'zod';

export const buyerSchema = z.object({
  firstName: z.string().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)'),
  lastName: z.string().min(2, 'El apellido es obligatorio (mínimo 2 caracteres)'),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  email: z.string().email('Ingresa un correo electrónico válido').optional().or(z.literal('')),
  phone: z.string().regex(/^$|^[0-9+ -]{6,20}$/, 'Número de teléfono inválido (mínimo 6 dígitos)').optional().or(z.literal('')),
  channel: z.string().min(1, 'Selecciona un canal de contacto'),
  attractionSource: z.string().min(1, 'Selecciona una fuente de atracción'),
  serviceOfInterestId: z.string().optional(),
  // Preferencias específicas
  pref_id_canal: z.string().optional(),
  pref_id_horario: z.string().optional(),
  pref_id_modalidad: z.string().optional(),
  pref_sede_preferida: z.string().optional(),
  pref_profesional_preferido: z.string().optional(),
  
  contactAuthorization: z.boolean().default(false),
  concreteRequest: z.string().optional(),
  
  // Nuevos campos opcionales según Mesa de Negociación
  // Datos Estudiante
  estudianteAplica: z.boolean().default(false).optional(),
  universidad: z.string().optional(),
  carrera: z.string().optional(),
  ciclo: z.string().optional(),
  
  // Datos Laborales
  laboralAplica: z.boolean().default(false).optional(),
  ocupacion: z.string().optional(),
  empresa: z.string().optional(),
  modalidadLaboral: z.string().optional(),
  disponibilidadLaboral: z.string().optional(),

  // Salud Odontológica
  ultima_visita_odontologica: z.string().optional(),
  motivo_consulta_odonto: z.string().optional(),
  tratamiento_previo: z.string().optional(),
  nivel_dolor: z.string().optional(),
  presenta_sensibilidad: z.string().optional(),
  sangrado_o_inflamacion: z.string().optional(),
  usa_aparato_o_protesis: z.string().optional(),
  condicion_atencion_especial: z.string().optional(),

}).superRefine((data, ctx) => {
  if (data.documentType === 'DNI' && data.documentNumber && data.documentNumber.length > 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_big,
      maximum: 8,
      type: 'string',
      inclusive: true,
      message: 'El DNI no puede tener más de 8 caracteres',
      path: ['documentNumber'],
    });
  }

  const hasEmail = Boolean(data.email && data.email.trim().length > 0);
  const hasPhone = Boolean(data.phone && data.phone.trim().length > 0);
  if (!hasEmail && !hasPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Debe ingresar al menos un medio de contacto (teléfono o correo)',
      path: ['phone']
    });
  }
});

export type BuyerFormValues = z.infer<typeof buyerSchema>;
