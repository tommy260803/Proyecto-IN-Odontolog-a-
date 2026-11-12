import { queryMart } from '../db/mart';

export type LeadReportCode = 'L1' | 'L2' | 'L3';
export type LeadMartRow = { servicio: string; grupo: string; aceptadas: number; rechazadas: number; especiales: number };

// Cada UNION conserva el grano de su hecho. Un JOIN entre aceptadas y
// rechazadas multiplicaría las medidas cuando hay varios motivos de rechazo.
const sources = {
  L1: `SELECT KeyTiempo,KeyServicio,KeyCanal,KeySede,KeyNegociador,
    oportunidad_aceptada aceptadas,oportunidad_cerrada_sin_acuerdo rechazadas,
    CAST(0 AS bigint) especiales FROM dbo.fact_oportunidades_lead`,
  L2: `SELECT KeyTiempo,KeyServicio,KeyPromocion,propuesta_aceptada aceptadas,
    CAST(0 AS bigint) rechazadas,CAST(0 AS bigint) especiales FROM dbo.fact_propuestas_aceptadas_lead
    UNION ALL SELECT KeyTiempo,KeyServicio,KeyPromocion,0,propuesta_rechazada,
    propuesta_rechazada_economica FROM dbo.fact_propuestas_rechazadas_lead`,
  L3: `SELECT KeyTiempo,KeyServicio,KeySede,KeyProfesional,KeyHorarioPreferido,KeyHorarioOfrecido,
    alternativa_aceptada aceptadas,CAST(0 AS bigint) rechazadas,CAST(0 AS bigint) especiales
    FROM dbo.fact_alternativas_aceptadas_lead
    UNION ALL SELECT KeyTiempo,KeyServicio,KeySede,KeyProfesional,KeyHorarioPreferido,KeyHorarioOfrecido,
    0,alternativa_rechazada,alternativa_rechazada_incompatibilidad FROM dbo.fact_alternativas_rechazadas_lead`,
};

export const leadReportKeys = {
  L1: ['KeyServicio', 'KeyCanal', 'KeySede', 'KeyNegociador'],
  L2: ['KeyServicio', 'KeyPromocion'],
  L3: ['KeyServicio', 'KeySede', 'KeyProfesional', 'KeyHorarioPreferido', 'KeyHorarioOfrecido'],
} as const;

export function leadMartQuery(report: LeadReportCode, filters: Record<string, unknown>) {
  const params: Record<string, number> = {};
  const conditions: string[] = [];
  if (filters.period && filters.period !== 'all') {
    if (typeof filters.period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(filters.period)) throw new Error('Período inválido.');
    const ym = Number(filters.period.replace('-', ''));
    params.fromKey = ym * 100 + 1;
    params.toKey = ym * 100 + 31;
    conditions.push('f.KeyTiempo BETWEEN @fromKey AND @toKey');
  }
  for (const key of leadReportKeys[report]) {
    const value = filters[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || !/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Math.abs(Number(value)) > 2147483647) {
      throw new Error('Filtro dimensional inválido.');
    }
    params[key] = Number(value);
    conditions.push(`f.${key}=@${key}`);
  }
  // No se admite silenciosamente un filtro que el hecho no puede representar.
  for (const key of Object.keys(filters)) {
    if (key.startsWith('Key') && !(leadReportKeys[report] as readonly string[]).includes(key)) throw new Error('Este reporte no admite ese filtro.');
  }
  const group = report === 'L1' ? "COALESCE(s.Sede,N'Sin sede') + N' · ' + COALESCE(n.NombreNegociador,N'Sin negociador')"
    : report === 'L2' ? "COALESCE(p.PromocionAplicada,N'Sin promoción informada')"
    : "COALESCE(s.Sede,N'Sin sede') + N' · ' + COALESCE(p.Odontologo,N'Sin profesional') + N' · ' + COALESCE(h.DiaSemana,N'Sin día') + N' · ' + COALESCE(h.Turno,N'Sin turno')";
  const joins = report === 'L1' ? 'LEFT JOIN dbo.Dim_Sede s ON s.KeySede=f.KeySede LEFT JOIN dbo.Dim_Negociador n ON n.KeyNegociador=f.KeyNegociador'
    : report === 'L2' ? 'LEFT JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion'
    : 'LEFT JOIN dbo.Dim_Sede s ON s.KeySede=f.KeySede LEFT JOIN dbo.Dim_Profesional p ON p.KeyProfesional=f.KeyProfesional LEFT JOIN dbo.Dim_Horario h ON h.KeyHorario=f.KeyHorarioOfrecido';
  return {
    sql: `WITH f AS (${sources[report]}) SELECT COALESCE(v.ServicioOdontologico,N'Sin tratamiento') servicio,
      ${group} grupo,SUM(f.aceptadas) aceptadas,SUM(f.rechazadas) rechazadas,SUM(f.especiales) especiales
      FROM f LEFT JOIN dbo.Dim_Servicio v ON v.KeyServicio=f.KeyServicio ${joins}
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      GROUP BY v.ServicioOdontologico,${group} ORDER BY servicio,grupo`, params,
  };
}

export async function readLeadMartReport(report: LeadReportCode, filters: Record<string, unknown>) {
  const query = leadMartQuery(report, filters);
  const raw = await queryMart<LeadMartRow>(query.sql, query.params);
  const rows = raw.map(row => ({ ...row, aceptadas: Number(row.aceptadas), rechazadas: Number(row.rechazadas), especiales: Number(row.especiales) }));
  return { report, rows, source: 'NexoSalud_Mart', consultedAt: new Date().toISOString(),
    totals: rows.reduce((sum, row) => ({ aceptadas: sum.aceptadas + row.aceptadas,
      rechazadas: sum.rechazadas + row.rechazadas, especiales: sum.especiales + row.especiales }),
    { aceptadas: 0, rechazadas: 0, especiales: 0 }) };
}

export async function readLeadMartCatalogs() {
  const entries = await Promise.all([
    ['KeyServicio', 'Dim_Servicio', 'ServicioOdontologico'], ['KeyCanal', 'Dim_Canal', 'NombreCanal'],
    ['KeySede', 'Dim_Sede', 'Sede'], ['KeyNegociador', 'Dim_Negociador', 'NombreNegociador'],
    ['KeyPromocion', 'Dim_Promocion', 'PromocionAplicada'], ['KeyProfesional', 'Dim_Profesional', 'Odontologo'],
    ['KeyHorario', 'Dim_Horario', "COALESCE(DiaSemana,N'Sin día')+N' · '+COALESCE(Turno,TipoMiembro)+N' · '+COALESCE(CONVERT(varchar(5),HoraInicio,108)+N'–'+CONVERT(varchar(5),HoraFin,108),N'Sin intervalo')"],
  ].map(async ([key, table, label]) => [key, await queryMart(`SELECT ${key} id,${label} nombre FROM dbo.${table} ORDER BY nombre,${key}`)]));
  return Object.fromEntries(entries);
}
