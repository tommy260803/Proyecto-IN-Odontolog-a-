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
      driver: 'mssql (Sin Prisma)',
      database: dbInfo[0]?.db || 'NexoSalud_Mart',
      tables: counts,
    });
  } catch (error: any) {
    console.error('Error al consultar estado de NexoSalud_Mart:', error);
    res.status(500).json({ error: 'Error al conectar con NexoSalud_Mart', details: error.message });
  }
});

// ── BUILDER: BUYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getBuyerMatrix(measure: string = 'contactos_registrados'): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(fc.ContactosRegistrados)';
  let isCurrency = false;
  let metricTitle = 'Contactos Registrados [Cant.]';

  switch (measure) {
    case 'contactos_utilizables':
      measureSQL = 'SUM(fc.ContactosUtilizables)';
      metricTitle = 'Contactos Utilizables [Cant.]';
      break;
    case 'conversiones_lead':
      measureSQL = 'SUM(fc.ConversionesALead)';
      metricTitle = 'Conversiones a LEAD [Cant.]';
      break;
    case 'tiempo_conversion':
      measureSQL = 'AVG(CAST(fc.TiempoConversionDias AS FLOAT))';
      metricTitle = 'Tiempo de Conversión [Días]';
      break;
    case 'costo_atribuido':
      measureSQL = 'SUM(fc.CostoAtribuido)';
      metricTitle = 'Costo Atribuido de Captación [S/.]';
      isCurrency = true;
      break;
  }

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
    GROUP BY f.TipoOrigen, c.NombreCanal, s.Sede
  `);

  const itemMap = new Map<string, Record<string, any>>();
  rawData.forEach((r) => {
    const key = `${r.categoria}|||${r.item}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, { categoria: r.categoria, item: r.item });
    }
    itemMap.get(key)![r.columna] = Number(r.valor) || 0;
  });
  const rows = Array.from(itemMap.values());

  return buildDynamicMatrix(rows, {
    stage: 'BUYER',
    reportTitle: 'RESUMEN DE CAPTACIÓN. Etapa BUYER',
    period: 'Septiembre 2026',
    metric: metricTitle,
    rowHeader: 'Fuente de Atracción / Canal',
    superHeader: 'Sede Física',
    totalColumnName: 'Total',
    grandTotalLabel: '** Totales Generales **',
    isCurrency,
    sourceMart: 'NexoSalud_Mart.Fact_CaptacionBuyer',
  });
}

// ── BUILDER: LEAD MATRIX (DINÁMICO) ──────────────────────────────────────────
async function getLeadMatrix(measure: string = 'leads_cohorte'): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(f.LeadsCohorteEvaluable)';
  let metricTitle = 'LEADs de Cohorte Evaluable [Cant.]';

  switch (measure) {
    case 'leads_convertidos_14d':
      measureSQL = 'SUM(f.LeadsConvertidosPayer14Dias)';
      metricTitle = 'LEADs Convertidos a PAYER en ≤ 14 días [Cant.]';
      break;
    case 'leads_requieren_resp':
      measureSQL = 'SUM(f.LeadsRequierenRespuesta)';
      metricTitle = 'LEADs que Requieren Respuesta [Cant.]';
      break;
    case 'leads_resp_15m':
      measureSQL = 'SUM(f.LeadsPrimeraRespuesta15Min)';
      metricTitle = 'LEADs con Primera Respuesta ≤ 15 min [Cant.]';
      break;
    case 'leads_resultado_final':
      measureSQL = 'SUM(f.LeadsConResultadoFinal)';
      metricTitle = 'LEADs con Resultado Final [Cant.]';
      break;
    case 'leads_abandonados':
      measureSQL = 'SUM(f.LeadsAbandonados)';
      metricTitle = 'LEADs Abandonados [Cant.]';
      break;
  }

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
    GROUP BY s.Sede, n.NombreNegociador, serv.Categoria
  `);

  const itemMap = new Map<string, Record<string, any>>();
  rawData.forEach((r) => {
    const key = `${r.categoria}|||${r.item}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, { categoria: r.categoria, item: r.item });
    }
    itemMap.get(key)![r.columna] = Number(r.valor) || 0;
  });
  const rows = Array.from(itemMap.values());

  return buildDynamicMatrix(rows, {
    stage: 'LEAD',
    reportTitle: 'RESUMEN DE NEGOCIACIÓN. Etapa LEAD',
    period: 'Septiembre 2026',
    metric: metricTitle,
    rowHeader: 'Sede / Negociador',
    superHeader: 'Categoría de Servicio',
    totalColumnName: 'Total LEADs',
    grandTotalLabel: '** Totales **',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.Fact_NegociacionLead',
  });
}

// ── BUILDER: PAYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getPayerMatrix(measure: string = 'pagos_registrados'): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(f.PagosRegistrados)';
  let metricTitle = 'Pagos Registrados [Cant.]';
  let isCurrency = false;

  switch (measure) {
    case 'pagos_validados':
      measureSQL = 'SUM(f.PagosValidados)';
      metricTitle = 'Pagos Validados [Cant.]';
      break;
    case 'pagos_rechazados':
      measureSQL = 'SUM(f.PagosRechazados)';
      metricTitle = 'Pagos Rechazados [Cant.]';
      break;
    case 'conversiones_customer':
      measureSQL = 'SUM(f.ConversionesACustomer)';
      metricTitle = 'Conversiones a CUSTOMER [Cant.]';
      break;
    case 'importe_total':
      measureSQL = 'SUM(f.ImporteTotalCobro)';
      metricTitle = 'Importe Total de Cobro [S/.]';
      isCurrency = true;
      break;
    case 'costo_transacciones':
      measureSQL = 'SUM(f.CostoTotalTransacciones)';
      metricTitle = 'Costo Total de Transacciones [S/.]';
      isCurrency = true;
      break;
    case 'tiempo_validacion':
      measureSQL = 'AVG(CAST(f.TiempoValidacionMin AS FLOAT))';
      metricTitle = 'Tiempo Total de Validación [Min.]';
      break;
  }

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
      ${measureSQL} AS valor
    FROM Fact_GestionPayer f
    LEFT JOIN Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
    LEFT JOIN Dim_Cobro c ON c.KeyCobro = f.KeyCobro
    GROUP BY p.TipoMedio, p.MetodoPago, c.EstadoPago
  `);

  const itemMap = new Map<string, Record<string, any>>();
  rawData.forEach((r) => {
    const key = `${r.categoria}|||${r.item}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, { categoria: r.categoria, item: r.item });
    }
    itemMap.get(key)![r.columna] = Number(r.valor) || 0;
  });
  const rows = Array.from(itemMap.values());

  return buildDynamicMatrix(rows, {
    stage: 'PAYER',
    reportTitle: 'RESUMEN DE RECAUDACIÓN. Etapa PAYER',
    period: 'Septiembre 2026',
    metric: metricTitle,
    rowHeader: 'Modalidad / Canal',
    superHeader: 'Estado del Pago',
    totalColumnName: 'Total',
    grandTotalLabel: '** Totales **',
    isCurrency,
    sourceMart: 'NexoSalud_Mart.Fact_GestionPayer',
    preferredColumnsOrder: ['VALIDATED', 'PENDING', 'REJECTED'],
  });
}

// ── BUILDER: CUSTOMER MATRIX (DINÁMICO) ──────────────────────────────────────
async function getCustomerMatrix(measure: string = 'citas_evaluables'): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(fa.CitasEvaluables)';
  let metricTitle = 'Citas Evaluables [Cant.]';

  switch (measure) {
    case 'atenciones_realizadas':
      measureSQL = 'SUM(fa.AtencionesRealizadas)';
      metricTitle = 'Atenciones Realizadas [Cant.]';
      break;
    case 'citas_inasistencia':
      measureSQL = 'SUM(fa.CitasConInasistencia)';
      metricTitle = 'Citas con Inasistencia [Cant.]';
      break;
    case 'tiempo_sillon':
      measureSQL = 'AVG(CAST(fa.TiempoSillonDentalMin AS FLOAT))';
      metricTitle = 'Tiempo en Sillón Dental [Min.]';
      break;
    case 'atenciones_conformes':
      measureSQL = 'SUM(fa.AtencionesFinalizadasConformes)';
      metricTitle = 'Atenciones Finalizadas Conformes [Cant.]';
      break;
  }

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
    GROUP BY serv.Categoria, serv.ServicioOdontologico, s.Sede
  `);

  const itemMap = new Map<string, Record<string, any>>();
  rawData.forEach((r) => {
    const key = `${r.categoria}|||${r.item}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, { categoria: r.categoria, item: r.item });
    }
    itemMap.get(key)![r.columna] = Number(r.valor) || 0;
  });
  const rows = Array.from(itemMap.values());

  return buildDynamicMatrix(rows, {
    stage: 'CUSTOMER',
    reportTitle: 'RESUMEN DE PRESTACIÓN CLÍNICA. Etapa CUSTOMER',
    period: 'Septiembre 2026',
    metric: metricTitle,
    rowHeader: 'Categoría / Servicio',
    superHeader: 'Sede Clínica',
    totalColumnName: 'Total',
    grandTotalLabel: '** Totales **',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.Fact_AtencionCustomer',
  });
}

// ── GET /api/reports/executive/:stage ───────────────────────────────────────
router.get('/executive/:stage', async (req: Request, res: Response) => {
  try {
    const stage = String(req.params.stage || '').toLowerCase();
    const measure = req.query.measure ? String(req.query.measure) : undefined;
    let data: ExecutiveReportData;
    switch (stage) {
      case 'buyer':
        data = await getBuyerMatrix(measure);
        break;
      case 'lead':
        data = await getLeadMatrix(measure);
        break;
      case 'payer':
        data = await getPayerMatrix(measure);
        break;
      case 'customer':
        data = await getCustomerMatrix(measure);
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
router.get('/all-executive', async (req: Request, res: Response) => {
  try {
    const buyerMeasure = req.query.buyerMeasure ? String(req.query.buyerMeasure) : undefined;
    const leadMeasure = req.query.leadMeasure ? String(req.query.leadMeasure) : undefined;
    const payerMeasure = req.query.payerMeasure ? String(req.query.payerMeasure) : undefined;
    const customerMeasure = req.query.customerMeasure ? String(req.query.customerMeasure) : undefined;

    const [buyer, lead, payer, customer] = await Promise.all([
      getBuyerMatrix(buyerMeasure),
      getLeadMatrix(leadMeasure),
      getPayerMatrix(payerMeasure),
      getCustomerMatrix(customerMeasure),
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
