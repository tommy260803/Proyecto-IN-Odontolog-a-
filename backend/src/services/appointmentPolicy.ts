/** Medianoche del día de la cita en Perú (UTC-5) para un campo Prisma @db.Date. */
export function appointmentMidnightInLima(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 5));
}
