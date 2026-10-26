import { Router, Request, Response } from 'express';
import { queryMart } from '../db/mart';

const router = Router();

export interface ExecutiveReportCategory {
  categoryName: string;
  items: Array<{
    itemName: string;
    values: Record<string, number>;
    total: number;
  }>;
  subtotals: Record<string, number>;
  subtotalTotal: number;
  subtotalLabel: string;
}

export interface ExecutiveReportData {
  stage: 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER' | 'TURNED';
  reportTitle: string;
  period: string;
  metric: string;
  rowHeader: string;
  superHeader: string;
  columns: string[];
  totalColumnName: string;
  categories: ExecutiveReportCategory[];
  grandTotals: Record<string, number>;
  grandTotal: number;
  grandTotalLabel: string;
  isCurrency: boolean;
  generatedAt: string;
  sourceMart: string;
  /** Código del período consultado: 'all' o 'YYYY-MM'. */
  periodKey: string;
  /** Comparación contra el período inmediatamente anterior (null si no aplica). */
  comparison: { periodKey: string; period: string; grandTotal: number } | null;
}

// ── PERÍODOS (Dim_Tiempo.KeyTiempo = yyyyMMdd) ──────────────────────────────
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface PeriodRange {
  key: string;
  label: string;
  from?: number;
  to?: number;
}

const ALL_PERIODS: PeriodRange = { key: 'all', label: 'Histórico completo' };

function monthRange(year: number, month: number): PeriodRange {
  const ym = year * 100 + month;
  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    label: `${MONTHS_ES[month - 1]} ${year}`,
    from: ym * 100 + 1,
    to: ym * 100 + 31,
  };
}

/** Interpreta `?period=` ('all' | 'YYYY-MM') y calcula su período de comparación. */
function resolvePeriod(raw?: unknown): { current: PeriodRange; previous: PeriodRange | null } {
  const value = typeof raw === 'string' ? raw.trim() : '';
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return { current: ALL_PERIODS, previous: null };

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return { current: ALL_PERIODS, previous: null };

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return { current: monthRange(year, month), previous: monthRange(prevYear, prevMonth) };
}

/** Cláusula WHERE parametrizada para filtrar una tabla de hechos por rango de KeyTiempo. */
function timeFilter(alias: string, range: PeriodRange): { sql: string; params: Record<string, number> } {
  if (range.from === undefined || range.to === undefined) return { sql: '', params: {} };
  return {
    sql: `WHERE ${alias}.KeyTiempo BETWEEN @fromKey AND @toKey`,
    params: { fromKey: range.from, toKey: range.to },
  };
}

type MatrixBuilder = (measure: string | undefined, range: PeriodRange) => Promise<ExecutiveReportData>;

/** Ejecuta el builder para el período actual y adjunta el total general del período anterior. */
async function withComparison(
  builder: MatrixBuilder,
  measure: string | undefined,
  period: { current: PeriodRange; previous: PeriodRange | null }
): Promise<ExecutiveReportData> {
  const current = await builder(measure, period.current);
  const previous = period.previous ? await builder(measure, period.previous) : null;
  return {
    ...current,
    comparison:
      previous && period.previous
        ? { periodKey: period.previous.key, period: period.previous.label, grandTotal: previous.grandTotal }
        : null,
  };
}

/** Pivotea filas (categoria, item, columna, valor) a filas anchas por ítem. */
function pivotRows(rawData: Array<{ categoria: string; item: string; columna: string; valor: number }>) {
  const itemMap = new Map<string, Record<string, any>>();
  rawData.forEach((r) => {
    const key = `${r.categoria}|||${r.item}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, { categoria: r.categoria, item: r.item });
    }
    itemMap.get(key)![r.columna] = Number(r.valor) || 0;
  });
  return Array.from(itemMap.values());
}

/**
 * Motor matricial dinámico:
 * Genera la matriz jerárquica (Categoría -> Ítems -> Subtotales -> Totales Generales)
 * sin hardcodear nombres de categorías, dimensiones o columnas.
 */
function buildDynamicMatrix(
  rows: Array<Record<string, any>>,
  options: {
    stage: 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER' | 'TURNED';
    reportTitle: string;
    period: string;
    periodKey: string;
    metric: string;
    rowHeader: string;
    superHeader: string;
    totalColumnName?: string;
    grandTotalLabel?: string;
    isCurrency?: boolean;
    sourceMart: string;
    categoryKey?: string;
    itemKey?: string;
    preferredColumnsOrder?: string[];
  }
): ExecutiveReportData {
  const catKey = options.categoryKey || 'categoria';
  const itKey = options.itemKey || 'item';

  // 1. Descubrir columnas de métricas en orden de aparición excluyendo claves de agrupación
  const columns: string[] = [];
  const totalColName = options.totalColumnName || (options.isCurrency ? 'Total (S/.)' : 'Total');

  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (
        k !== catKey &&
        k !== itKey &&
        k.toLowerCase() !== 'total' &&
        k.toLowerCase() !== 'rowtotal' &&
        k !== totalColName &&
        !columns.includes(k)
      ) {
        columns.push(k);
      }
    });
  });

  if (options.preferredColumnsOrder && options.preferredColumnsOrder.length > 0) {
    columns.sort((a, b) => {
      const idxA = options.preferredColumnsOrder!.indexOf(a);
      const idxB = options.preferredColumnsOrder!.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  // 2. Agrupar filas dinámicamente por categoría e ítem
  const categoryMap = new Map<string, Map<string, { values: Record<string, number>; explicitTotal?: number }>>();
  const categoryOrder: string[] = [];

  rows.forEach((r) => {
    const cat = String(r[catKey] || 'General');
    const it = String(r[itKey] || 'Sin Asignar');

    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, new Map());
      categoryOrder.push(cat);
    }
    const itemMap = categoryMap.get(cat)!;
    if (!itemMap.has(it)) {
      itemMap.set(it, { values: {} });
    }

    const itemObj = itemMap.get(it)!;
    columns.forEach((col) => {
      itemObj.values[col] = (itemObj.values[col] || 0) + (Number(r[col]) || 0);
    });

    if (r[totalColName] !== undefined || r['total'] !== undefined || r['Total'] !== undefined) {
      itemObj.explicitTotal = Number(r[totalColName] ?? r['total'] ?? r['Total']) || 0;
    }
  });

  // 3. Calcular subtotales por categoría y totales generales
  const categories: ExecutiveReportCategory[] = [];
  const grandTotals: Record<string, number> = {};
  columns.forEach((c) => (grandTotals[c] = 0));
  let grandTotal = 0;

  for (const catName of categoryOrder) {
    const itemMap = categoryMap.get(catName)!;
    const items: Array<{ itemName: string; values: Record<string, number>; total: number }> = [];
    const subtotals: Record<string, number> = {};
    columns.forEach((c) => (subtotals[c] = 0));
    let subtotalTotal = 0;

    for (const [itemName, itemObj] of itemMap.entries()) {
      let rowTotal = 0;
      const normalizedValues: Record<string, number> = {};

      columns.forEach((col) => {
        const val = itemObj.values[col] || 0;
        normalizedValues[col] = val;
        subtotals[col] += val;
        grandTotals[col] += val;
      });

      if (itemObj.explicitTotal !== undefined) {
        rowTotal = itemObj.explicitTotal;
      } else if (normalizedValues['Contactos Registrados'] !== undefined) {
        rowTotal = normalizedValues['Contactos Registrados'];
      } else {
        columns.forEach((col) => {
          rowTotal += normalizedValues[col];
        });
      }

      subtotalTotal += rowTotal;
      grandTotal += rowTotal;

      items.push({
        itemName,
        values: normalizedValues,
        total: rowTotal,
      });
    }

    categories.push({
      categoryName: catName,
      items,
      subtotals,
      subtotalTotal,
      // Etiqueta limpia: el formato visual (negrita, fondo) lo aplica el frontend.
      subtotalLabel: `Subtotal ${catName}`,
    });
  }

  return {
    stage: options.stage,
    reportTitle: options.reportTitle,
    period: options.period,
    metric: options.metric,
    rowHeader: options.rowHeader,
    superHeader: options.superHeader,
    columns,
    totalColumnName: options.totalColumnName || (options.isCurrency ? 'Total (S/.)' : 'Total'),
    categories,
    grandTotals,
    grandTotal,
    grandTotalLabel: options.grandTotalLabel || 'Total general',
    isCurrency: Boolean(options.isCurrency),
    generatedAt: new Date().toISOString(),
    sourceMart: options.sourceMart,
    periodKey: options.periodKey,
    comparison: null,
  };
}

// ── GET /api/reports/status ──────────────────────────────────────────────────
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const dbInfo = await queryMart<{ db: string; tiempoCount: number; serverVersion: string }>(`
      SELECT DB_NAME() as db,
             (SELECT COUNT(*) FROM Dim_Tiempo) as tiempoCount,
             CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(64)) as serverVersion
    `);

    const counts = await queryMart<{ tabla: string; registros: number; ultimaFecha: number | null }>(`
      SELECT 'Fact_CaptacionBuyer' as tabla, COUNT(*) as registros, MAX(KeyTiempo) as ultimaFecha FROM Fact_CaptacionBuyer
      UNION ALL SELECT 'Fact_NegociacionLead', COUNT(*), MAX(KeyTiempo) FROM Fact_NegociacionLead
      UNION ALL SELECT 'Fact_GestionPayer', COUNT(*), MAX(KeyTiempo) FROM Fact_GestionPayer
      UNION ALL SELECT 'Fact_AtencionCustomer', COUNT(*), MAX(KeyTiempo) FROM Fact_AtencionCustomer
      UNION ALL SELECT 'Fact_SeguimientoTurned', COUNT(*), MAX(KeyTiempo) FROM Fact_SeguimientoTurned
    `);

    const latestKey = counts.reduce<number | null>(
      (max, t) => (t.ultimaFecha && (!max || t.ultimaFecha > max) ? t.ultimaFecha : max),
      null
    );
    const latestDataDate = latestKey
      ? `${String(latestKey).slice(0, 4)}-${String(latestKey).slice(4, 6)}-${String(latestKey).slice(6, 8)}`
      : null;

    res.json({
      status: 'online',
      source: 'NexoSalud_Mart (Datamart Dimensional)',
      driver: 'SQL Server · mssql',
      serverVersion: dbInfo[0]?.serverVersion || null,
      database: dbInfo[0]?.db || 'NexoSalud_Mart',
      checkedAt: new Date().toISOString(),
      latestDataDate,
      tables: counts.map(({ tabla, registros }) => ({ tabla, registros })),
    });
  } catch (error: any) {
    console.error('Error al consultar estado de NexoSalud_Mart:', error);
    res.status(500).json({ error: 'Error al conectar con NexoSalud_Mart', details: error.message });
  }
});

// ── GET /api/reports/periods ─────────────────────────────────────────────────
// Meses que contienen hechos en cualquiera de las 4 tablas, del más reciente al más antiguo.
router.get('/periods', async (_req: Request, res: Response) => {
  try {
    const rows = await queryMart<{ ym: number }>(`
      SELECT DISTINCT ym FROM (
        SELECT KeyTiempo / 100 AS ym FROM Fact_CaptacionBuyer
        UNION SELECT KeyTiempo / 100 FROM Fact_NegociacionLead
        UNION SELECT KeyTiempo / 100 FROM Fact_GestionPayer
        UNION SELECT KeyTiempo / 100 FROM Fact_AtencionCustomer
      ) p
      WHERE ym IS NOT NULL
      ORDER BY ym DESC
    `);

    const periods = rows.map(({ ym }) => {
      const range = monthRange(Math.floor(ym / 100), ym % 100);
      return { value: range.key, label: range.label };
    });

    res.json([{ value: ALL_PERIODS.key, label: ALL_PERIODS.label }, ...periods]);
  } catch (error: any) {
    console.error('Error en /api/reports/periods:', error);
    res.status(500).json({ error: 'Error al consultar períodos disponibles', details: error.message });
  }
});

// ── GET /api/reports/buyer/kpis ──────────────────────────────────────────────
// KPIs oficiales de la fase BUYER: B1 (Conversión 14d), B2 (% Utilizables), B3 (CPL)
export async function getBuyerKpisData(periodQuery?: unknown) {
  const period = resolvePeriod(periodQuery);
  const currentRange = period.current;
  const previousRange = period.previous;

  const currentWhere = currentRange.from !== undefined && currentRange.to !== undefined
    ? `WHERE f.KeyTiempoCaptacion BETWEEN ${currentRange.from} AND ${currentRange.to}`
    : '';

  const prevWhere = previousRange && previousRange.from !== undefined && previousRange.to !== undefined
    ? `WHERE f.KeyTiempoCaptacion BETWEEN ${previousRange.from} AND ${previousRange.to}`
    : '';

  // 1. Métricas agregadas período actual
  const [currTotals] = await queryMart<{
    total_registrados: number;
    total_utilizables: number;
    conv_utilizables_14d: number;
    total_conversiones: number;
    total_costo: number;
    avg_tiempo_dias: number;
  }>(`
    SELECT 
      ISNULL(SUM(f.contacto_registrado), 0) AS total_registrados,
      ISNULL(SUM(f.contacto_utilizable), 0) AS total_utilizables,
      ISNULL(SUM(CASE WHEN f.contacto_utilizable = 1 AND f.conversion_lead = 1 AND f.tiempo_conversion_dia <= 14 THEN 1 ELSE 0 END), 0) AS conv_utilizables_14d,
      ISNULL(SUM(f.conversion_lead), 0) AS total_conversiones,
      ISNULL(SUM(f.costo_atribuido_captacion), 0) AS total_costo,
      ISNULL(ROUND(AVG(CAST(CASE WHEN f.conversion_lead = 1 THEN f.tiempo_conversion_dia END AS FLOAT)), 1), 0) AS avg_tiempo_dias
    FROM Fact_OportunidadCaptacion f
    ${currentWhere}
  `);

  // 2. Métricas período anterior
  let prevTotals: typeof currTotals | null = null;
  if (prevWhere) {
    const [prev] = await queryMart<typeof currTotals>(`
      SELECT 
        ISNULL(SUM(f.contacto_registrado), 0) AS total_registrados,
        ISNULL(SUM(f.contacto_utilizable), 0) AS total_utilizables,
        ISNULL(SUM(CASE WHEN f.contacto_utilizable = 1 AND f.conversion_lead = 1 AND f.tiempo_conversion_dia <= 14 THEN 1 ELSE 0 END), 0) AS conv_utilizables_14d,
        ISNULL(SUM(f.conversion_lead), 0) AS total_conversiones,
        ISNULL(SUM(f.costo_atribuido_captacion), 0) AS total_costo,
        ISNULL(ROUND(AVG(CAST(CASE WHEN f.conversion_lead = 1 THEN f.tiempo_conversion_dia END AS FLOAT)), 1), 0) AS avg_tiempo_dias
      FROM Fact_OportunidadCaptacion f
      ${prevWhere}
    `);
    prevTotals = prev;
  }

  // 3. Desgloses analíticos
  const byChannel = await queryMart<{
    name: string;
    total: number;
    utilizables: number;
    conversiones: number;
    conv_14d: number;
    cost: number;
  }>(`
    SELECT 
      ISNULL(c.NombreCanal, 'Canal Desconocido') AS name,
      SUM(f.contacto_registrado) AS total,
      SUM(f.contacto_utilizable) AS utilizables,
      SUM(f.conversion_lead) AS conversiones,
      SUM(CASE WHEN f.contacto_utilizable = 1 AND f.conversion_lead = 1 AND f.tiempo_conversion_dia <= 14 THEN 1 ELSE 0 END) AS conv_14d,
      SUM(f.costo_atribuido_captacion) AS cost
    FROM Fact_OportunidadCaptacion f
    LEFT JOIN Dim_Canal c ON f.KeyCanal = c.KeyCanal
    ${currentWhere}
    GROUP BY c.NombreCanal
    ORDER BY total DESC
  `);

  const bySource = await queryMart<{
    name: string;
    total: number;
    utilizables: number;
    conversiones: number;
    conv_14d: number;
    cost: number;
  }>(`
    SELECT 
      ISNULL(fu.Campana, ISNULL(fu.TipoOrigen, 'Fuente Desconocida')) AS name,
      SUM(f.contacto_registrado) AS total,
      SUM(f.contacto_utilizable) AS utilizables,
      SUM(f.conversion_lead) AS conversiones,
      SUM(CASE WHEN f.contacto_utilizable = 1 AND f.conversion_lead = 1 AND f.tiempo_conversion_dia <= 14 THEN 1 ELSE 0 END) AS conv_14d,
      SUM(f.costo_atribuido_captacion) AS cost
    FROM Fact_OportunidadCaptacion f
    LEFT JOIN Dim_Fuente fu ON f.KeyFuente = fu.KeyFuente
    ${currentWhere}
    GROUP BY fu.Campana, fu.TipoOrigen
    ORDER BY total DESC
  `);

  const bySede = await queryMart<{
    name: string;
    total: number;
    utilizables: number;
    conversiones: number;
    conv_14d: number;
    cost: number;
  }>(`
    SELECT 
      ISNULL(s.Sede, 'Sede Principal') AS name,
      SUM(f.contacto_registrado) AS total,
      SUM(f.contacto_utilizable) AS utilizables,
      SUM(f.conversion_lead) AS conversiones,
      SUM(CASE WHEN f.contacto_utilizable = 1 AND f.conversion_lead = 1 AND f.tiempo_conversion_dia <= 14 THEN 1 ELSE 0 END) AS conv_14d,
      SUM(f.costo_atribuido_captacion) AS cost
    FROM Fact_OportunidadCaptacion f
    LEFT JOIN Dim_Sede s ON f.KeySede = s.KeySede
    ${currentWhere}
    GROUP BY s.Sede
    ORDER BY total DESC
  `);

  // Cálculos de KPI B1, B2, B3
  const b1Current = currTotals.total_utilizables > 0
    ? Math.round((currTotals.conv_utilizables_14d / currTotals.total_utilizables) * 10000) / 100
    : 0;
  const b1Prev = prevTotals && prevTotals.total_utilizables > 0
    ? Math.round((prevTotals.conv_utilizables_14d / prevTotals.total_utilizables) * 10000) / 100
    : null;
  const b1Delta = b1Prev !== null ? Math.round((b1Current - b1Prev) * 100) / 100 : null;
  const b1Status: 'optimo' | 'alerta' | 'critico' = b1Current >= 30 ? 'optimo' : (b1Current >= 20 ? 'alerta' : 'critico');

  const b2Current = currTotals.total_registrados > 0
    ? Math.round((currTotals.total_utilizables / currTotals.total_registrados) * 10000) / 100
    : 0;
  const b2Prev = prevTotals && prevTotals.total_registrados > 0
    ? Math.round((prevTotals.total_utilizables / prevTotals.total_registrados) * 10000) / 100
    : null;
  const b2Delta = b2Prev !== null ? Math.round((b2Current - b2Prev) * 100) / 100 : null;
  const b2Status: 'optimo' | 'alerta' | 'critico' = b2Current >= 85 ? 'optimo' : (b2Current >= 70 ? 'alerta' : 'critico');

  const b3Current = currTotals.total_conversiones > 0
    ? Math.round((Number(currTotals.total_costo) / currTotals.total_conversiones) * 100) / 100
    : 0;
  const b3Prev = prevTotals && prevTotals.total_conversiones > 0
    ? Math.round((Number(prevTotals.total_costo) / prevTotals.total_conversiones) * 100) / 100
    : null;
  const b3Delta = b3Prev !== null ? Math.round((b3Current - b3Prev) * 100) / 100 : null;
  const b3Status: 'optimo' | 'alerta' | 'critico' = b3Current <= 45 ? 'optimo' : (b3Current <= 65 ? 'alerta' : 'critico');

  return {
    period: currentRange.label,
    periodKey: currentRange.key,
    generatedAt: new Date().toISOString(),
    sourceMart: 'NexoSalud_Mart.Fact_OportunidadCaptacion',
    summary: {
      totalRegistrados: Number(currTotals.total_registrados),
      totalUtilizables: Number(currTotals.total_utilizables),
      totalConversiones: Number(currTotals.total_conversiones),
      totalCostoAtribuido: Number(currTotals.total_costo),
      promedioTiempoConversionDias: Number(currTotals.avg_tiempo_dias),
    },
    kpis: {
      b1: {
        code: 'B1',
        name: 'Tasa de Conversión a LEAD en ≤ 14 días',
        currentValue: b1Current,
        formattedValue: `${b1Current.toFixed(1)}%`,
        target: 30.0,
        targetLabel: '≥ 30.0%',
        status: b1Status,
        unit: '%',
        formula: 'Contactos utilizables convertidos a LEAD en ≤ 14 días / Total de contactos utilizables × 100',
        description: 'Mide la eficiencia de la captación en transformar oportunidades utilizables en prospectos reales con intención asistencial dentro de la ventana de oportunidad.',
        numerator: Number(currTotals.conv_utilizables_14d),
        numeratorLabel: 'Conversiones a LEAD en ≤ 14 días',
        denominator: Number(currTotals.total_utilizables),
        denominatorLabel: 'Contactos Utilizables',
        trend: b1Delta === null ? null : (b1Delta > 0 ? 'up' : (b1Delta < 0 ? 'down' : 'stable')),
        delta: b1Delta,
        previousValue: b1Prev,
        breakdown: {
          byChannel: byChannel.map(c => ({
            name: c.name,
            total: Number(c.total),
            utilizables: Number(c.utilizables),
            conversiones: Number(c.conversiones),
            rate: Number(c.utilizables) > 0 ? Math.round((Number(c.conv_14d) / Number(c.utilizables)) * 1000) / 10 : 0,
            cost: Number(c.cost)
          })),
          bySource: bySource.map(s => ({
            name: s.name,
            total: Number(s.total),
            utilizables: Number(s.utilizables),
            conversiones: Number(s.conversiones),
            rate: Number(s.utilizables) > 0 ? Math.round((Number(s.conv_14d) / Number(s.utilizables)) * 1000) / 10 : 0,
            cost: Number(s.cost)
          })),
          bySede: bySede.map(sd => ({
            name: sd.name,
            total: Number(sd.total),
            utilizables: Number(sd.utilizables),
            conversiones: Number(sd.conversiones),
            rate: Number(sd.utilizables) > 0 ? Math.round((Number(sd.conv_14d) / Number(sd.utilizables)) * 1000) / 10 : 0,
            cost: Number(sd.cost)
          }))
        }
      },
      b2: {
        code: 'B2',
        name: 'Porcentaje de Contactos Utilizables',
        currentValue: b2Current,
        formattedValue: `${b2Current.toFixed(1)}%`,
        target: 85.0,
        targetLabel: '≥ 85.0%',
        status: b2Status,
        unit: '%',
        formula: 'Contactos utilizables (calidad válida + consentimiento Ley 29733 + teléfono ≥ 9 dígitos) / Total de contactos registrados × 100',
        description: 'Mide la calidad de la captación y el cumplimiento normativo legal de protección de datos personales antes de derivar al embudo de ventas.',
        numerator: Number(currTotals.total_utilizables),
        numeratorLabel: 'Contactos Utilizables',
        denominator: Number(currTotals.total_registrados),
        denominatorLabel: 'Contactos Registrados',
        trend: b2Delta === null ? null : (b2Delta > 0 ? 'up' : (b2Delta < 0 ? 'down' : 'stable')),
        delta: b2Delta,
        previousValue: b2Prev,
        breakdown: {
          byChannel: byChannel.map(c => ({
            name: c.name,
            total: Number(c.total),
            utilizables: Number(c.utilizables),
            conversiones: Number(c.conversiones),
            rate: Number(c.total) > 0 ? Math.round((Number(c.utilizables) / Number(c.total)) * 1000) / 10 : 0,
            cost: Number(c.cost)
          })),
          bySource: bySource.map(s => ({
            name: s.name,
            total: Number(s.total),
            utilizables: Number(s.utilizables),
            conversiones: Number(s.conversiones),
            rate: Number(s.total) > 0 ? Math.round((Number(s.utilizables) / Number(s.total)) * 1000) / 10 : 0,
            cost: Number(s.cost)
          })),
          bySede: bySede.map(sd => ({
            name: sd.name,
            total: Number(sd.total),
            utilizables: Number(sd.utilizables),
            conversiones: Number(sd.conversiones),
            rate: Number(sd.total) > 0 ? Math.round((Number(sd.utilizables) / Number(sd.total)) * 1000) / 10 : 0,
            cost: Number(sd.cost)
          }))
        }
      },
      b3: {
        code: 'B3',
        name: 'Costo por LEAD Atribuible (CPL)',
        currentValue: b3Current,
        formattedValue: `S/. ${b3Current.toFixed(2)}`,
        target: 45.0,
        targetLabel: '≤ S/. 45.00',
        status: b3Status,
        unit: 'PEN',
        formula: 'Gasto total de captación atribuido a la cohorte / Conversiones totales a LEAD',
        description: 'Mide la rentabilidad del marketing de captación, prorrateando el gasto publicitario de campañas entre los leads efectivamente transferidos a negociación.',
        numerator: Number(currTotals.total_costo),
        numeratorLabel: 'Gasto de Captación Atribuido (S/.)',
        denominator: Number(currTotals.total_conversiones),
        denominatorLabel: 'LEADs Convertidos',
        trend: b3Delta === null ? null : (b3Delta < 0 ? 'up' : (b3Delta > 0 ? 'down' : 'stable')),
        delta: b3Delta,
        previousValue: b3Prev,
        breakdown: {
          byChannel: byChannel.map(c => ({
            name: c.name,
            total: Number(c.total),
            utilizables: Number(c.utilizables),
            conversiones: Number(c.conversiones),
            rate: Number(c.conversiones) > 0 ? Math.round((Number(c.cost) / Number(c.conversiones)) * 100) / 100 : 0,
            cost: Number(c.cost)
          })),
          bySource: bySource.map(s => ({
            name: s.name,
            total: Number(s.total),
            utilizables: Number(s.utilizables),
            conversiones: Number(s.conversiones),
            rate: Number(s.conversiones) > 0 ? Math.round((Number(s.cost) / Number(s.conversiones)) * 100) / 100 : 0,
            cost: Number(s.cost)
          })),
          bySede: bySede.map(sd => ({
            name: sd.name,
            total: Number(sd.total),
            utilizables: Number(sd.utilizables),
            conversiones: Number(sd.conversiones),
            rate: Number(sd.conversiones) > 0 ? Math.round((Number(sd.cost) / Number(sd.conversiones)) * 100) / 100 : 0,
            cost: Number(sd.cost)
          }))
        }
      }
    }
  };
}

router.get('/buyer/kpis', async (req: Request, res: Response) => {
  try {
    const data = await getBuyerKpisData(req.query.period);
    res.json(data);
  } catch (error: any) {
    console.error('Error en /api/reports/buyer/kpis:', error);
    res.status(500).json({ error: 'Error al calcular KPIs oficiales de BUYER', details: error.message });
  }
});

// ── BUILDER: BUYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getBuyerMatrix(measure: string = 'contacto_registrado', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(fc.contacto_registrado)';
  let isCurrency = false;
  let metricTitle = 'contacto_registrado';

  switch (measure) {
    case 'contacto_utilizable':
    case 'contactos_utilizables':
      measureSQL = 'SUM(fc.contacto_utilizable)';
      metricTitle = 'contacto_utilizable';
      break;
    case 'conversion_lead':
    case 'conversiones_lead':
      measureSQL = 'SUM(fc.conversion_lead)';
      metricTitle = 'conversion_lead';
      break;
    case 'tiempo_conversion_dia':
    case 'tiempo_conversion':
      measureSQL = 'ROUND(AVG(CAST(fc.tiempo_conversion_dia AS FLOAT)), 1)';
      metricTitle = 'tiempo_conversion_dia';
      break;
    case 'costo_atribuido_captacion':
    case 'costo_atribuido':
      measureSQL = 'SUM(fc.costo_atribuido_captacion)';
      metricTitle = 'costo_atribuido_captacion';
      isCurrency = true;
      break;
    case 'contacto_registrado':
    case 'contactos_registrados':
    default:
      measureSQL = 'SUM(fc.contacto_registrado)';
      metricTitle = 'contacto_registrado';
      break;
  }

  const filter = timeFilter('fc', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(f.TipoOrigen, 'Canal Digital') AS categoria,
      ISNULL(c.NombreCanal, 'General') AS item,
      ISNULL(s.Sede, 'Sede Principal') AS columna,
      ${measureSQL} AS valor
    FROM Fact_CaptacionBuyer fc
    LEFT JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
    LEFT JOIN Dim_Fuente f ON f.KeyFuente = fc.KeyFuente
    LEFT JOIN Dim_Sede s ON s.KeySede = fc.KeySede
    ${filter.sql}
    GROUP BY f.TipoOrigen, c.NombreCanal, s.Sede
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'BUYER',
    reportTitle: 'Resumen de captación',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Fuente de Atracción / Canal',
    superHeader: 'Sede Física',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency,
    sourceMart: 'NexoSalud_Mart.fact_captacion_buyer',
    preferredColumnsOrder: ['Sede Centro Historico', 'Sede California'],
  });
}

// ── BUILDER: LEAD MATRIX (DINÁMICO) ──────────────────────────────────────────
async function getLeadMatrix(measure: string = 'cohorte_evaluable', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(f.cohorte_evaluable)';
  let metricTitle = 'cohorte_evaluable';

  switch (measure) {
    case 'conversion_payer_14_dia':
    case 'leads_convertidos_14d':
      measureSQL = 'SUM(f.conversion_payer_14_dia)';
      metricTitle = 'conversion_payer_14_dia';
      break;
    case 'solicitud_requiere_respuesta':
    case 'leads_requieren_resp':
      measureSQL = 'SUM(f.solicitud_requiere_respuesta)';
      metricTitle = 'solicitud_requiere_respuesta';
      break;
    case 'respuesta_util_15_min':
    case 'leads_resp_15m':
      measureSQL = 'SUM(f.respuesta_util_15_min)';
      metricTitle = 'respuesta_util_15_min';
      break;
    case 'negociacion_finalizada':
    case 'leads_resultado_final':
      measureSQL = 'SUM(f.negociacion_finalizada)';
      metricTitle = 'negociacion_finalizada';
      break;
    case 'negociacion_abandonada':
    case 'leads_abandonados':
      measureSQL = 'SUM(f.negociacion_abandonada)';
      metricTitle = 'negociacion_abandonada';
      break;
    case 'cohorte_evaluable':
    case 'leads_cohorte':
    default:
      measureSQL = 'SUM(f.cohorte_evaluable)';
      metricTitle = 'cohorte_evaluable';
      break;
  }

  const filter = timeFilter('f', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(s.Sede, 'Sede Principal') AS categoria,
      ISNULL(n.NombreNegociador, 'Operador Asignado') AS item,
      ISNULL(serv.Categoria, 'Clínica Odontológica') AS columna,
      ${measureSQL} AS valor
    FROM Fact_NegociacionLead f
    LEFT JOIN Dim_Sede s ON s.KeySede = f.KeySede
    LEFT JOIN Dim_Negociador n ON n.KeyNegociador = f.KeyNegociador
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = f.KeyServicio
    ${filter.sql}
    GROUP BY s.KeySede, s.Sede, n.KeyNegociador, n.NombreNegociador, serv.Categoria
    ORDER BY s.KeySede ASC, n.KeyNegociador ASC
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'LEAD',
    reportTitle: 'Resumen de negociación',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Sede / Negociador',
    superHeader: 'Categoría del tratamiento',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.fact_negociacion_lead',
    preferredColumnsOrder: ['Odontología Preventiva', 'Odontología Especializada'],
  });
}

// ── BUILDER: PAYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getPayerMatrix(measure: string = 'pago_registrado', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(f.pago_registrado)';
  let metricTitle = 'pago_registrado';
  let isCurrency = false;

  switch (measure) {
    case 'pago_validado':
    case 'pagos_validados':
      measureSQL = 'SUM(f.pago_validado)';
      metricTitle = 'pago_validado';
      break;
    case 'pago_rechazado':
    case 'pagos_rechazados':
      measureSQL = 'SUM(f.pago_rechazado)';
      metricTitle = 'pago_rechazado';
      break;
    case 'conversion_customer':
    case 'conversiones_customer':
      measureSQL = 'SUM(f.conversion_customer)';
      metricTitle = 'conversion_customer';
      break;
    case 'costo_transaccion':
    case 'costo_transacciones':
      measureSQL = 'SUM(f.costo_transaccion)';
      metricTitle = 'costo_transaccion';
      isCurrency = true;
      break;
    case 'tiempo_validacion_minuto':
    case 'tiempo_validacion':
      measureSQL = 'ROUND(AVG(CAST(f.tiempo_validacion_minuto AS FLOAT)), 1)';
      metricTitle = 'tiempo_validacion_minuto';
      break;
    case 'importe_total_cobro':
    case 'importe_total':
      measureSQL = 'SUM(f.importe_total_cobro)';
      metricTitle = 'importe_total_cobro';
      isCurrency = true;
      break;
    case 'pago_registrado':
    case 'pagos_registrados':
    default:
      measureSQL = 'SUM(f.pago_registrado)';
      metricTitle = 'pago_registrado';
      break;
  }

  const filter = timeFilter('f', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(p.TipoMedio, 'Bancarizado / Digital') AS categoria,
      ISNULL(p.MetodoPago, 'Canal General') AS item,
      CASE 
        WHEN UPPER(TRIM(c.EstadoPago)) IN ('VALIDATED', 'VALIDADO') THEN 'VALIDADO'
        WHEN UPPER(TRIM(c.EstadoPago)) IN ('PENDING', 'PENDIENTE') THEN 'PENDIENTE'
        WHEN UPPER(TRIM(c.EstadoPago)) IN ('REJECTED', 'RECHAZADO') THEN 'RECHAZADO'
        WHEN UPPER(TRIM(c.EstadoPago)) IN ('IN_REVIEW', 'EN_REVISION') THEN 'EN_REVISION'
        ELSE ISNULL(c.EstadoPago, 'VALIDADO')
      END AS columna,
      ${measureSQL} AS valor
    FROM Fact_GestionPayer f
    LEFT JOIN Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
    LEFT JOIN Dim_Cobro c ON c.KeyCobro = f.KeyCobro
    ${filter.sql}
    GROUP BY p.TipoMedio, p.MetodoPago, c.EstadoPago
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'PAYER',
    reportTitle: 'Resumen de recaudación',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Modalidad / Canal',
    superHeader: 'Estado del Pago',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency,
    sourceMart: 'NexoSalud_Mart.fact_gestion_payer',
    preferredColumnsOrder: ['VALIDADO', 'PENDIENTE', 'RECHAZADO'],
  });
}

// ── BUILDER: CUSTOMER MATRIX (DINÁMICO) ──────────────────────────────────────
async function getCustomerMatrix(measure: string = 'cita_evaluable', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(fa.cita_evaluable)';
  let metricTitle = 'cita_evaluable';

  switch (measure) {
    case 'atencion_realizada':
    case 'atenciones_realizadas':
      measureSQL = 'SUM(fa.atencion_realizada)';
      metricTitle = 'atencion_realizada';
      break;
    case 'cita_inasistencia':
    case 'citas_inasistencia':
      measureSQL = 'SUM(fa.cita_inasistencia)';
      metricTitle = 'cita_inasistencia';
      break;
    case 'tiempo_sillon_dental_minuto':
    case 'tiempo_sillon':
      measureSQL = 'ROUND(AVG(CAST(fa.tiempo_sillon_dental_minuto AS FLOAT)), 1)';
      metricTitle = 'tiempo_sillon_dental_minuto';
      break;
    case 'atencion_finalizada_conforme':
    case 'atenciones_conformes':
      measureSQL = 'SUM(fa.atencion_finalizada_conforme)';
      metricTitle = 'atencion_finalizada_conforme';
      break;
    case 'cita_evaluable':
    case 'citas_evaluables':
    default:
      measureSQL = 'SUM(fa.cita_evaluable)';
      metricTitle = 'cita_evaluable';
      break;
  }

  const filter = timeFilter('fa', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(serv.Categoria, 'Clínica Odontológica') AS categoria,
      ISNULL(serv.ServicioOdontologico, 'Consulta General') AS item,
      ISNULL(s.Sede, 'Sede Principal') AS columna,
      ${measureSQL} AS valor
    FROM Fact_AtencionCustomer fa
    LEFT JOIN Dim_Sede s ON s.KeySede = fa.KeySede
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = fa.KeyServicio
    ${filter.sql}
    GROUP BY serv.Categoria, serv.ServicioOdontologico, s.Sede
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'CUSTOMER',
    reportTitle: 'Resumen de prestación clínica',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Categoría / Servicio',
    superHeader: 'Sede Clínica',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.fact_atencion_customer',
    preferredColumnsOrder: ['Sede Centro Historico', 'Sede California'],
  });
}


// ── BUILDER: TURNED MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getTurnedMatrix(measure: string = 'seguimiento_registrado', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(ft.seguimiento_registrado)';
  let metricTitle = 'seguimiento_registrado';

  switch (measure) {
    case 'seguimiento_efectivo':
    case 'seguimientos_efectivos':
      measureSQL = 'SUM(ft.seguimiento_efectivo)';
      metricTitle = 'seguimiento_efectivo';
      break;
    case 'incidencia_reportada':
    case 'incidencias_reportadas':
      measureSQL = 'SUM(ft.incidencia_reportada)';
      metricTitle = 'incidencia_reportada';
      break;
    case 'incidencia_resuelta_24_hora':
    case 'incidencias_resueltas':
      measureSQL = 'SUM(ft.incidencia_resuelta_24_hora)';
      metricTitle = 'incidencia_resuelta_24_hora';
      break;
    case 'retorno_cohorte_90_dia':
    case 'retornos_cohorte':
    case 'retornos_90dias':
      measureSQL = 'SUM(ft.retorno_cohorte_90_dia)';
      metricTitle = 'retorno_cohorte_90_dia';
      break;
    case 'paciente_elegible_retorno':
    case 'pacientes_elegibles':
      measureSQL = 'SUM(ft.paciente_elegible_retorno)';
      metricTitle = 'paciente_elegible_retorno';
      break;
    case 'seguimiento_registrado':
    case 'seguimientos_registrados':
    default:
      measureSQL = 'SUM(ft.seguimiento_registrado)';
      metricTitle = 'seguimiento_registrado';
      break;
  }

  const filter = timeFilter('ft', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(serv.Categoria, 'Fidelización Postventa') AS categoria,
      ISNULL(serv.ServicioOdontologico, 'Control Odontológico') AS item,
      ISNULL(s.Sede, 'Sede Principal') AS columna,
      ${measureSQL} AS valor
    FROM Fact_SeguimientoTurned ft
    LEFT JOIN Dim_Sede s ON s.KeySede = ft.KeySede
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = ft.KeyServicio
    ${filter.sql}
    GROUP BY serv.Categoria, serv.ServicioOdontologico, s.Sede
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'TURNED',
    reportTitle: 'Resumen de fidelización y retorno',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Categoría / Servicio',
    superHeader: 'Sede Clínica',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.fact_seguimiento_turned',
    preferredColumnsOrder: ['Sede Centro Historico', 'Sede California'],
  });
}

const BUILDERS: Record<'buyer' | 'lead' | 'payer' | 'customer' | 'turned', MatrixBuilder> = {
  buyer: getBuyerMatrix,
  lead: getLeadMatrix,
  payer: getPayerMatrix,
  customer: getCustomerMatrix,
  turned: getTurnedMatrix,
};

// ── GET /api/reports/executive/:stage?measure=&period= ──────────────────────
router.get('/executive/:stage', async (req: Request, res: Response) => {
  try {
    const stage = String(req.params.stage || '').toLowerCase() as keyof typeof BUILDERS;
    const measure = req.query.measure ? String(req.query.measure) : undefined;
    const builder = BUILDERS[stage];
    if (!builder) {
      return res.status(400).json({ error: `Etapa inválida: ${stage}. Use buyer, lead, payer, customer o turned.` });
    }
    const data = await withComparison(builder, measure, resolvePeriod(req.query.period));
    res.json(data);
  } catch (error: any) {
    console.error(`Error en /api/reports/executive/${req.params.stage}:`, error);
    res.status(500).json({ error: 'Error al consultar DataMart', details: error.message });
  }
});

// ── GET /api/reports/all-executive ──────────────────────────────────────────
router.get('/all-executive', async (req: Request, res: Response) => {
  try {
    const buyerMeasure = req.query.buyerMeasure ? String(req.query.buyerMeasure) : undefined;
    const leadMeasure = req.query.leadMeasure ? String(req.query.leadMeasure) : undefined;
    const payerMeasure = req.query.payerMeasure ? String(req.query.payerMeasure) : undefined;
    const customerMeasure = req.query.customerMeasure ? String(req.query.customerMeasure) : undefined;
    const turnedMeasure = req.query.turnedMeasure ? String(req.query.turnedMeasure) : undefined;
    const period = resolvePeriod(req.query.period);

    const buyer = await withComparison(getBuyerMatrix, buyerMeasure, period);
    const lead = await withComparison(getLeadMatrix, leadMeasure, period);
    const payer = await withComparison(getPayerMatrix, payerMeasure, period);
    const customer = await withComparison(getCustomerMatrix, customerMeasure, period);
    const turned = await withComparison(getTurnedMatrix, turnedMeasure, period);

    res.json({
      buyer,
      lead,
      payer,
      customer,
      turned,
    });
  } catch (error: any) {
    console.error('Error en /api/reports/all-executive:', error);
    res.status(500).json({ error: 'Error al consultar reportes ejecutivos', details: error.message });
  }
});

export default router;
