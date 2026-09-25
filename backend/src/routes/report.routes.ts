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
  stage: 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER';
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
}

/**
 * Motor matricial dinámico:
 * Genera la matriz jerárquica (Categoría -> Ítems -> Subtotales -> Totales Generales)
 * sin hardcodear nombres de categorías, dimensiones o columnas.
 */
function buildDynamicMatrix(
  rows: Array<Record<string, any>>,
  options: {
    stage: 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER';
    reportTitle: string;
    period: string;
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
      subtotalLabel: `** Total ${catName} **`,
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
    grandTotalLabel: options.grandTotalLabel || '** Totales **',
    isCurrency: Boolean(options.isCurrency),
    generatedAt: new Date().toISOString(),
    sourceMart: options.sourceMart,
  };
}

// ── GET /api/reports/status ──────────────────────────────────────────────────
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const dbInfo = await queryMart<{ db: string; tiempoCount: number }>(`
      SELECT DB_NAME() as db, 
             (SELECT COUNT(*) FROM Dim_Tiempo) as tiempoCount
    `);

    const counts = await queryMart<{ tabla: string; registros: number }>(`
      SELECT 'Fact_CaptacionBuyer' as tabla, COUNT(*) as registros FROM Fact_CaptacionBuyer
      UNION ALL SELECT 'Fact_NegociacionLead', COUNT(*) FROM Fact_NegociacionLead
      UNION ALL SELECT 'Fact_GestionPayer', COUNT(*) FROM Fact_GestionPayer
      UNION ALL SELECT 'Fact_AtencionCustomer', COUNT(*) FROM Fact_AtencionCustomer
    `);

    res.json({
      status: 'online',
      source: 'NexoSalud_Mart (Datamart Dimensional)',
      driver: 'mssql/msnodesqlv8 (Sin Prisma)',
      database: dbInfo[0]?.db || 'NexoSalud_Mart',
      tables: counts,
    });
  } catch (error: any) {
    console.error('Error al consultar estado de NexoSalud_Mart:', error);
    res.status(500).json({ error: 'Error al conectar con NexoSalud_Mart', details: error.message });
  }
});

// ── BUILDER: BUYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getBuyerMatrix(): Promise<ExecutiveReportData> {
  const checkDistinct = await queryMart<{ c: number }>(`
    SELECT COUNT(DISTINCT e.EstadoCalidad) as c 
    FROM Fact_CaptacionBuyer fc
    JOIN Dim_EstadoRegistro e ON e.KeyEstadoRegistro = fc.KeyEstadoRegistro
    WHERE e.EstadoCalidad IS NOT NULL AND e.KeyEstadoRegistro > 0
  `);

  let rows: Array<Record<string, any>> = [];

  if (checkDistinct[0]?.c > 1) {
    const rawData = await queryMart<{
      categoria: string;
      item: string;
      columna: string;
      valor: number;
    }>(`
      SELECT 
        ISNULL(f.TipoOrigen, ISNULL(c.TipoMedio, 'Canal Digital')) AS categoria,
        ISNULL(c.NombreCanal, 'General') AS item,
        ISNULL(e.EstadoCalidad, 'Válidos') AS columna,
        SUM(fc.ContactosRegistrados) AS valor
      FROM Fact_CaptacionBuyer fc
      LEFT JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
      LEFT JOIN Dim_Fuente f ON f.KeyFuente = fc.KeyFuente
      LEFT JOIN Dim_EstadoRegistro e ON e.KeyEstadoRegistro = fc.KeyEstadoRegistro
      GROUP BY ISNULL(f.TipoOrigen, ISNULL(c.TipoMedio, 'Canal Digital')), c.NombreCanal, e.EstadoCalidad, e.KeyEstadoRegistro
      ORDER BY e.KeyEstadoRegistro ASC
    `);

    const itemMap = new Map<string, Record<string, any>>();
    rawData.forEach((r) => {
      const key = `${r.categoria}|||${r.item}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, { categoria: r.categoria, item: r.item });
      }
      itemMap.get(key)![r.columna] = Number(r.valor) || 0;
    });
    rows = Array.from(itemMap.values());
  } else {
    rows = await queryMart<Record<string, any>>(`
      SELECT 
        ISNULL(f.TipoOrigen, ISNULL(c.TipoMedio, 'Canal Digital')) AS categoria,
        ISNULL(c.NombreCanal, 'Sin Canal') AS item,
        SUM(fc.ContactosRegistrados) AS [Contactos Registrados],
        SUM(fc.ContactosUtilizables) AS [Contactos Utilizables],
        SUM(fc.ConversionesALead) AS [Conversiones a LEAD]
      FROM Fact_CaptacionBuyer fc
      LEFT JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
      LEFT JOIN Dim_Fuente f ON f.KeyFuente = fc.KeyFuente
      GROUP BY ISNULL(f.TipoOrigen, ISNULL(c.TipoMedio, 'Canal Digital')), c.NombreCanal
    `);
  }

  return buildDynamicMatrix(rows, {
    stage: 'BUYER',
    reportTitle: 'RESUMEN DE CAPTACIÓN. Etapa BUYER',
    period: 'Septiembre 2026',
    metric: 'Estado de Calidad y Registro del Contacto',
    rowHeader: 'Fuente de Atracción / Canal',
    superHeader: 'Estado de Calidad del Registro',
    totalColumnName: 'Total',
    grandTotalLabel: '** Totales Generales **',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.Fact_CaptacionBuyer',
    preferredColumnsOrder: ['Válidos', 'Incompletos', 'Duplicados', 'Rechazados'],
  });
}

// ── BUILDER: LEAD MATRIX (DINÁMICO) ──────────────────────────────────────────
async function getLeadMatrix(): Promise<ExecutiveReportData> {
  const rows = await queryMart<Record<string, any>>(`
    SELECT 
      ISNULL(s.Sede, 'Sede Principal') AS categoria,
      ISNULL(n.NombreNegociador, ISNULL(p.Odontologo, 'Operador Asignado')) AS item,
      SUM(f.LeadsConvertidosPayer14Dias) AS [Convertidos a PAYER],
      SUM(ISNULL(f.LeadsEnNegociacion, f.LeadsCohorteEvaluable - f.LeadsConvertidosPayer14Dias - f.LeadsAbandonados)) AS [En Negociación],
      SUM(f.LeadsAbandonados) AS [Abandonados]
    FROM Fact_NegociacionLead f
    LEFT JOIN Dim_Sede s ON s.KeySede = f.KeySede
    LEFT JOIN Dim_Negociador n ON n.KeyNegociador = f.KeyNegociador
    LEFT JOIN Dim_Profesional p ON p.KeyProfesional = f.KeyProfesional
    GROUP BY s.Sede, ISNULL(n.NombreNegociador, ISNULL(p.Odontologo, 'Operador Asignado'))
  `);

  return buildDynamicMatrix(rows, {
    stage: 'LEAD',
    reportTitle: 'RESUMEN DE NEGOCIACIÓN. Etapa LEAD',
    period: 'Septiembre 2026',
    metric: 'Estado del Embudo por Negociador',
    rowHeader: 'Sede / Negociador',
    superHeader: 'Estado del Embudo',
    totalColumnName: 'Total LEADs',
    grandTotalLabel: '** Totales **',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.Fact_NegociacionLead',
    preferredColumnsOrder: ['Convertidos a PAYER', 'En Negociación', 'Abandonados'],
  });
}

// ── BUILDER: PAYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getPayerMatrix(): Promise<ExecutiveReportData> {
  const checkDistinct = await queryMart<{ c: number }>(`
    SELECT COUNT(DISTINCT c.EstadoPago) as c 
    FROM Fact_GestionPayer fp
    JOIN Dim_Cobro c ON c.KeyCobro = fp.KeyCobro
    WHERE c.EstadoPago IS NOT NULL AND c.KeyCobro > 0
  `);

  let rows: Array<Record<string, any>> = [];

  if (checkDistinct[0]?.c > 1) {
    const rawData = await queryMart<{
      categoria: string;
      item: string;
      columna: string;
      valor: number;
    }>(`
      SELECT 
        ISNULL(p.TipoMedio, 'Bancarizado / Digital') AS categoria,
        ISNULL(p.MetodoPago, 'Canal General') AS item,
        ISNULL(c.EstadoPago, 'VALIDATED') AS columna,
        SUM(f.ImporteTotalCobro) AS valor
      FROM Fact_GestionPayer f
      LEFT JOIN Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
      LEFT JOIN Dim_Cobro c ON c.KeyCobro = f.KeyCobro
      GROUP BY p.TipoMedio, p.MetodoPago, c.EstadoPago, c.KeyCobro
      ORDER BY c.KeyCobro ASC
    `);

    const itemMap = new Map<string, Record<string, any>>();
    rawData.forEach((r) => {
      const key = `${r.categoria}|||${r.item}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, { categoria: r.categoria, item: r.item });
      }
      itemMap.get(key)![r.columna] = Number(r.valor) || 0;
    });
    rows = Array.from(itemMap.values());
  } else {
    rows = await queryMart<Record<string, any>>(`
      SELECT 
        ISNULL(p.TipoMedio, 'Canal de Recaudación') AS categoria,
        ISNULL(p.MetodoPago, 'Canal Digital') AS item,
        SUM(CASE WHEN f.PagosValidados > 0 THEN f.ImporteTotalCobro ELSE 0.0 END) AS [VALIDATED],
        0.0 AS [PENDING],
        0.0 AS [REJECTED]
      FROM Fact_GestionPayer f
      LEFT JOIN Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
      GROUP BY p.TipoMedio, p.MetodoPago
    `);
  }

  return buildDynamicMatrix(rows, {
    stage: 'PAYER',
    reportTitle: 'RESUMEN DE RECAUDACIÓN. Etapa PAYER',
    period: 'Septiembre 2026',
    metric: 'Importe Total (S/.) por Canal de Pago',
    rowHeader: 'Modalidad / Canal',
    superHeader: 'Estado del Pago',
    totalColumnName: 'Total (S/.)',
    grandTotalLabel: '** Totales **',
    isCurrency: true,
    sourceMart: 'NexoSalud_Mart.Fact_GestionPayer',
    preferredColumnsOrder: ['VALIDATED', 'PENDING', 'REJECTED'],
  });
}

// ── BUILDER: CUSTOMER MATRIX (DINÁMICO) ──────────────────────────────────────
async function getCustomerMatrix(): Promise<ExecutiveReportData> {
  const checkDistinct = await queryMart<{ c: number }>(`
    SELECT COUNT(DISTINCT dea.EstadoFinal) as c 
    FROM Fact_AtencionCustomer fa
    JOIN Dim_EstadoAtencion dea ON dea.KeyEstadoAtencion = fa.KeyEstadoAtencion
    WHERE dea.EstadoFinal IS NOT NULL AND dea.KeyEstadoAtencion > 0
  `);

  let rows: Array<Record<string, any>> = [];

  if (checkDistinct[0]?.c > 1) {
    const rawData = await queryMart<{
      categoria: string;
      item: string;
      columna: string;
      valor: number;
    }>(`
      SELECT 
        ISNULL(serv.Categoria, ISNULL(s.Sede, 'Clínica Odontológica')) AS categoria,
        ISNULL(serv.ServicioOdontologico, 'Consulta General') AS item,
        ISNULL(dea.EstadoFinal, ISNULL(dea.Asistencia, 'Atendidos')) AS columna,
        SUM(fa.CitasEvaluables) AS valor
      FROM Fact_AtencionCustomer fa
      LEFT JOIN Dim_Sede s ON s.KeySede = fa.KeySede
      LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = fa.KeyServicio
      LEFT JOIN Dim_EstadoAtencion dea ON dea.KeyEstadoAtencion = fa.KeyEstadoAtencion
      GROUP BY ISNULL(serv.Categoria, ISNULL(s.Sede, 'Clínica Odontológica')), serv.ServicioOdontologico, ISNULL(dea.EstadoFinal, ISNULL(dea.Asistencia, 'Atendidos')), dea.KeyEstadoAtencion
      ORDER BY dea.KeyEstadoAtencion ASC
    `);

    const itemMap = new Map<string, Record<string, any>>();
    rawData.forEach((r) => {
      const key = `${r.categoria}|||${r.item}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, { categoria: r.categoria, item: r.item });
      }
      itemMap.get(key)![r.columna] = Number(r.valor) || 0;
    });
    rows = Array.from(itemMap.values());
  } else {
    rows = await queryMart<Record<string, any>>(`
      SELECT 
        ISNULL(s.Sede, 'Sede Principal') AS categoria,
        ISNULL(serv.ServicioOdontologico, 'Consulta General') AS item,
        SUM(fa.AtencionesRealizadas) AS [Atendidos],
        SUM(fa.CitasConInasistencia) AS [No Asistió (No-Show)],
        SUM(fa.CitasEvaluables - fa.AtencionesRealizadas - fa.CitasConInasistencia) AS [Cancelados]
      FROM Fact_AtencionCustomer fa
      LEFT JOIN Dim_Sede s ON s.KeySede = fa.KeySede
      LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = fa.KeyServicio
      GROUP BY s.Sede, serv.ServicioOdontologico
    `);
  }

  return buildDynamicMatrix(rows, {
    stage: 'CUSTOMER',
    reportTitle: 'RESUMEN DE PRESTACIÓN CLÍNICA. Etapa CUSTOMER',
    period: 'Septiembre 2026',
    metric: 'Asistencia y Deserción por Servicio',
    rowHeader: 'Categoría / Servicio',
    superHeader: 'Asistencia y Deserción',
    totalColumnName: 'Total Citas',
    grandTotalLabel: '** Totales **',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.Fact_AtencionCustomer',
    preferredColumnsOrder: ['Atendidos', 'No Asistió (No-Show)', 'Cancelados'],
  });
}

// ── GET /api/reports/executive/:stage ───────────────────────────────────────
router.get('/executive/:stage', async (req: Request, res: Response) => {
  try {
    const stage = String(req.params.stage || '').toLowerCase();
    let data: ExecutiveReportData;
    switch (stage) {
      case 'buyer':
        data = await getBuyerMatrix();
        break;
      case 'lead':
        data = await getLeadMatrix();
        break;
      case 'payer':
        data = await getPayerMatrix();
        break;
      case 'customer':
        data = await getCustomerMatrix();
        break;
      default:
        return res.status(400).json({ error: `Etapa inválida: ${stage}. Use buyer, lead, payer o customer.` });
    }
    res.json(data);
  } catch (error: any) {
    console.error(`Error en /api/reports/executive/${req.params.stage}:`, error);
    res.status(500).json({ error: 'Error al consultar DataMart', details: error.message });
  }
});

// ── GET /api/reports/all-executive ──────────────────────────────────────────
router.get('/all-executive', async (_req: Request, res: Response) => {
  try {
    const [buyer, lead, payer, customer] = await Promise.all([
      getBuyerMatrix(),
      getLeadMatrix(),
      getPayerMatrix(),
      getCustomerMatrix(),
    ]);

    res.json({
      buyer,
      lead,
      payer,
      customer,
    });
  } catch (error: any) {
    console.error('Error en /api/reports/all-executive:', error);
    res.status(500).json({ error: 'Error al consultar reportes ejecutivos', details: error.message });
  }
});

export default router;
