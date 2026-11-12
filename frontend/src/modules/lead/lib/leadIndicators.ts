export type LeadMeasures = Partial<Record<string, number | string | null>>;
export const LEAD_INDICATORS = [
  { code: 'L1', label: 'Tasa de aceptación de oportunidades comerciales',
    numerator: 'oportunidad_aceptada', accepted: 'oportunidad_aceptada', rejected: 'oportunidad_cerrada_sin_acuerdo',
    formula: 'M1 / (M1 + M2) × 100', goal: 'Aumentar la aceptación', unit: 'oportunidades resueltas' },
  { code: 'L2', label: 'Tasa de rechazo de propuestas por motivos económicos',
    numerator: 'propuesta_rechazada_economica', accepted: 'propuesta_aceptada', rejected: 'propuesta_rechazada',
    formula: 'M5 / (M3 + M4) × 100', goal: 'Reducir el rechazo económico', unit: 'propuestas resueltas' },
  { code: 'L3', label: 'Tasa de rechazo de alternativas por incompatibilidad',
    numerator: 'alternativa_rechazada_incompatibilidad', accepted: 'alternativa_aceptada', rejected: 'alternativa_rechazada',
    formula: 'M8 / (M6 + M7) × 100', goal: 'Reducir la incompatibilidad de atención', unit: 'alternativas resueltas' },
] as const;

export function calculateLeadIndicators(measures: LeadMeasures) {
  const count = (name: string) => Number(measures[name] ?? 0);
  return LEAD_INDICATORS.map(indicator => {
    const numerator = count(indicator.numerator);
    const denominator = count(indicator.accepted) + count(indicator.rejected);
    return { ...indicator, numerator, denominator, value: denominator > 0 ? 100 * numerator / denominator : null };
  });
}

export function formatLeadRate(value: number | null) {
  return value === null ? 'No calculable' : new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value) + ' %';
}
