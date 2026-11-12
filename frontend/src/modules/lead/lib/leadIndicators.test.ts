import { expect, test } from 'vitest';
import { calculateLeadIndicators, formatLeadRate } from './leadIndicators';

test('L1, L2 y L3 usan sus ocho medidas y poblaciones resueltas', () => {
  const indicators = calculateLeadIndicators({
    oportunidad_aceptada: '3', oportunidad_cerrada_sin_acuerdo: '1',
    propuesta_aceptada: 4, propuesta_rechazada: 6, propuesta_rechazada_economica: 2,
    alternativa_aceptada: 8, alternativa_rechazada: 2, alternativa_rechazada_incompatibilidad: 1,
    pendientes: 100,
  });
  expect(indicators.map(item => item.value)).toEqual([75, 20, 10]);
  expect(indicators.map(item => item.denominator)).toEqual([4, 10, 10]);
});

test('cero rechazos es un 0 % real; sin resueltos no es calculable', () => {
  expect(calculateLeadIndicators({ propuesta_aceptada: 5 })[1].value).toBe(0);
  expect(calculateLeadIndicators({}).every(item => item.value === null)).toBe(true);
  expect(formatLeadRate(null)).toBe('No calculable');
  expect(formatLeadRate(0)).toMatch(/^0[.,]00 %$/);
});
