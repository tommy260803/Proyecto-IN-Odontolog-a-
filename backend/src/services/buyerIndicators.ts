interface IndicatorPerson {
  id_persona: number;
  nombres: string | null;
  apellidos: string | null;
  numero: string | null;
  email: string | null;
  autoriza_contacto: boolean;
  estado_calidad: string | null;
  fecha_registro: Date;
  Etapa: { nombre: string } | null;
}
export interface BuyerTemporalEvidence {
  id_persona: number;
  fecha_captacion: Date | null;
  fecha_conversion: Date | null;
}

/** B1 parte de captacion; B3 del registro. Ambos terminan en el primer evento BUYER -> LEAD. */
export function calculateBuyerIndicators(
  persons: IndicatorPerson[], duplicates: Set<number>, evidence: BuyerTemporalEvidence[],
  fromDate = '', toDate = ''
) {
  const dates = new Map(evidence.map(row => [row.id_persona, row]));
  const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Infinity;
  const inPeriod = (date: Date | null | undefined) => !!date && date.getTime() >= from && date.getTime() <= to;
  const usable = (p: IndicatorPerson) => Boolean(p.nombres?.trim() && p.apellidos?.trim()
    && (p.numero?.trim() || p.email?.trim()) && p.autoriza_contacto === true
    && p.estado_calidad === 'Valido' && !duplicates.has(p.id_persona));
  const advanced = (p: IndicatorPerson) => ['LEAD','PAYER','CUSTOMER','TURNED'].includes(p.Etapa?.nombre || '');
  const days = (end: Date, start: Date) => (end.getTime() - start.getTime()) / 86400000;
  const registered = persons.filter(p => inPeriod(p.fecha_registro));
  const capturedUsable = persons.filter(p => usable(p) && inPeriod(dates.get(p.id_persona)?.fecha_captacion));
  const missingCapture = persons.filter(p => usable(p) && !dates.get(p.id_persona)?.fecha_captacion).length;
  const missingB1 = capturedUsable.filter(p => {
    const d = dates.get(p.id_persona)!;
    return (advanced(p) && !d.fecha_conversion) || (d.fecha_conversion && days(d.fecha_conversion, d.fecha_captacion!) < 0);
  }).length;
  const within14 = capturedUsable.filter(p => {
    const d = dates.get(p.id_persona)!;
    return d.fecha_conversion && days(d.fecha_conversion, d.fecha_captacion!) >= 0 && days(d.fecha_conversion, d.fecha_captacion!) <= 14;
  }).length;
  const converted = registered.filter(p => advanced(p) || dates.get(p.id_persona)?.fecha_conversion);
  const durations = converted.map(p => {
    const end = dates.get(p.id_persona)?.fecha_conversion;
    return end ? days(end, p.fecha_registro) : NaN;
  });
  const missingB3 = durations.filter(d => !Number.isFinite(d) || d < 0).length;
  const totalDays = converted.length && !missingB3 ? durations.reduce((a,b) => a+b, 0) : null;
  const usableRegistered = registered.filter(usable).length;
  return {
    period: fromDate || toDate ? `Filtros: ${fromDate || 'inicio'} a ${toDate || 'hoy'}` : 'Histórico completo',
    b1: { numerator: within14, denominator: capturedUsable.length,
      rate: !missingCapture && !missingB1 && capturedUsable.length ? within14 / capturedUsable.length * 100 : null,
      explanation: missingCapture || missingB1 ? `${missingCapture} sin captación y ${missingB1} sin evento/fecha de conversión verificable; no se estima el porcentaje.`
        : capturedUsable.length ? 'Cohorte por fecha de captación; primer evento BUYER → LEAD dentro de 14 días. Utilizabilidad actual.' : 'Sin contactos utilizables captados en el período.',
      source: 'CaptacionesBuyer.fecha_captacion / EventosEtapa.fecha_hora (BUYER→LEAD)' },
    b2: { numerator: usableRegistered, denominator: registered.length,
      rate: registered.length ? usableRegistered / registered.length * 100 : null,
      explanation: registered.length ? 'Registros del período con nombres, contacto informado, autorización y calidad Valido, excluyendo duplicados detectados.' : 'Sin registros en el período.',
      source: 'Personas / fecha_registro; datos registrados, no verificación de identidad o contacto' },
    b3: { averageDays: totalDays === null ? null : totalDays / converted.length,
      conversions: converted.length, totalDays,
      explanation: missingB3 ? `${missingB3} conversiones sin evento BUYER → LEAD o intervalo válido; no se estima el promedio.`
        : converted.length ? 'Cohorte por fecha de registro; registro → primer evento BUYER → LEAD. El divisor corresponde a esos mismos intervalos.' : 'Sin conversiones verificables en el período.',
      source: 'Personas.fecha_registro / EventosEtapa.fecha_hora (BUYER→LEAD)' },
  };
}
