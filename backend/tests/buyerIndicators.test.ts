import { describe, expect, it } from 'vitest';
import { calculateBuyerIndicators } from '../src/services/buyerIndicators';

const date = (s: string) => new Date(s);
const person = (id = 1) => ({ id_persona:id,nombres:'QA',apellidos:'Sintetico',numero:null,
  email:'qa@example.invalid',autoriza_contacto:true,estado_calidad:'Valido',
  fecha_registro:date('2026-01-01T00:00:00Z'),Etapa:{nombre:'LEAD'},
  fecha_actualizacion:date('2050-12-31T00:00:00Z') });

describe('Indicadores Buyer: fuente de conversion y denominadores', () => {
  it('B1 parte de captacion y B3 de registro, sin usar fecha_actualizacion', () => {
    const r=calculateBuyerIndicators([person()],new Set(),[{id_persona:1,fecha_captacion:date('2026-01-02T00:00:00Z'),fecha_conversion:date('2026-01-04T00:00:00Z')}]);
    expect(r.b1).toMatchObject({numerator:1,denominator:1,rate:100});
    expect(r.b3).toMatchObject({conversions:1,totalDays:3,averageDays:3});
  });
  it('no fabrica un promedio parcial si un convertido carece de evento', () => {
    const r=calculateBuyerIndicators([person(1),person(2)],new Set(),[
      {id_persona:1,fecha_captacion:date('2026-01-01T00:00:00Z'),fecha_conversion:date('2026-01-03T00:00:00Z')},
      {id_persona:2,fecha_captacion:date('2026-01-01T00:00:00Z'),fecha_conversion:null},
    ]);
    expect(r.b1.rate).toBeNull();expect(r.b3).toMatchObject({conversions:2,totalDays:null,averageDays:null});
    expect(r.b3.explanation).toContain('1 conversiones sin evento');
  });
  it('incluye 14 dias exactos y excluye un milisegundo posterior', () => {
    const start=date('2026-01-01T00:00:00Z');
    const r=calculateBuyerIndicators([person(1),person(2)],new Set(),[
      {id_persona:1,fecha_captacion:start,fecha_conversion:date('2026-01-15T00:00:00Z')},
      {id_persona:2,fecha_captacion:start,fecha_conversion:date('2026-01-15T00:00:00.001Z')},
    ]);expect(r.b1).toMatchObject({numerator:1,denominator:2,rate:50});
  });
  it('aplica filtros de fecha a la cohorte correspondiente', () => {
    const p={...person(),fecha_registro:date('2026-01-31T12:00:00')};
    const r=calculateBuyerIndicators([p],new Set(),[{id_persona:1,fecha_captacion:date('2026-02-01T12:00:00'),fecha_conversion:date('2026-02-03T12:00:00')}],'2026-02-01','2026-02-28');
    expect(r.b1.denominator).toBe(1);expect(r.b2.denominator).toBe(0);expect(r.b3.conversions).toBe(0);
  });
  it('calidad no valida, duplicado o falta de consentimiento no cuentan como utilizables', () => {
    const r=calculateBuyerIndicators([person(1),{...person(2),estado_calidad:'Incompleto'},person(3),{...person(4),autoriza_contacto:false}],new Set([3]),[]);
    expect(r.b2).toMatchObject({numerator:1,denominator:4,rate:25});expect(r.b1.rate).toBeNull();
  });
});
