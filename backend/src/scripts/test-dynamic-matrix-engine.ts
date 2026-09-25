import { queryMart } from '../db/mart';

export interface DynamicMatrixResult {
  stage: string;
  columns: string[];
  categories: Array<{
    categoryName: string;
    items: Array<{ itemName: string; values: Record<string, number>; total: number }>;
    subtotals: Record<string, number>;
    subtotalTotal: number;
    subtotalLabel: string;
  }>;
  grandTotals: Record<string, number>;
  grandTotal: number;
}

export function buildDynamicMatrix(
  rows: Array<Record<string, any>>,
  categoryKey = 'categoria',
  itemKey = 'item'
): DynamicMatrixResult {
  // 1. Descubrir columnas de métricas (todas las propiedades excepto categoryKey e itemKey)
  const columns: string[] = [];
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (k !== categoryKey && k !== itemKey && !columns.includes(k)) {
        columns.push(k);
      }
    });
  });

  // 2. Agrupar por categoría
  const categoryMap = new Map<string, Map<string, Record<string, number>>>();
  const categoryOrder: string[] = [];

  rows.forEach((r) => {
    const cat = String(r[categoryKey] || 'General');
    const it = String(r[itemKey] || 'Total');

    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, new Map());
      categoryOrder.push(cat);
    }
    const itemMap = categoryMap.get(cat)!;
    if (!itemMap.has(it)) {
      itemMap.set(it, {});
    }

    const itemValues = itemMap.get(it)!;
    columns.forEach((col) => {
      itemValues[col] = (itemValues[col] || 0) + (Number(r[col]) || 0);
    });
  });

  // 3. Construir jerarquía con subtotales y totales
  const categories: DynamicMatrixResult['categories'] = [];
  const grandTotals: Record<string, number> = {};
  columns.forEach((c) => (grandTotals[c] = 0));
  let grandTotal = 0;

  for (const catName of categoryOrder) {
    const itemMap = categoryMap.get(catName)!;
    const items: Array<{ itemName: string; values: Record<string, number>; total: number }> = [];
    const subtotals: Record<string, number> = {};
    columns.forEach((c) => (subtotals[c] = 0));
    let subtotalTotal = 0;

    for (const [itemName, values] of itemMap.entries()) {
      let rowTotal = 0;
      columns.forEach((col) => {
        const val = values[col] || 0;
        rowTotal += val;
        subtotals[col] += val;
        grandTotals[col] += val;
      });

      subtotalTotal += rowTotal;
      grandTotal += rowTotal;

      items.push({
        itemName,
        values,
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
    stage: 'MATRIX',
    columns,
    categories,
    grandTotals,
    grandTotal,
  };
}

async function testAllStages() {
  console.log('=== TEST DYNAMIC MATRIX ENGINE WITH CURRENT MART DATA ===');

  // 1. BUYER
  const buyerRows = await queryMart(`
    SELECT 
      ISNULL(f.TipoOrigen, ISNULL(c.TipoMedio, 'Digital')) AS categoria,
      ISNULL(c.NombreCanal, 'Sin Canal') AS item,
      SUM(fc.ContactosRegistrados) AS [Contactos Registrados],
      SUM(fc.ContactosUtilizables) AS [Contactos Utilizables],
      SUM(fc.ConversionesALead) AS [Conversiones a LEAD]
    FROM Fact_CaptacionBuyer fc
    LEFT JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
    LEFT JOIN Dim_Fuente f ON f.KeyFuente = fc.KeyFuente
    GROUP BY ISNULL(f.TipoOrigen, ISNULL(c.TipoMedio, 'Digital')), c.NombreCanal
  `);
  console.log('BUYER Dynamic Matrix:', JSON.stringify(buildDynamicMatrix(buyerRows), null, 2));

  // 2. CUSTOMER
  const customerRows = await queryMart(`
    SELECT 
      ISNULL(s.Sede, 'Sede Centro') AS categoria,
      ISNULL(serv.ServicioOdontologico, 'Evaluación') AS item,
      SUM(fa.CitasEvaluables) AS [Citas Evaluables],
      SUM(fa.AtencionesRealizadas) AS [Atendidos],
      SUM(fa.CitasConInasistencia) AS [Inasistencias]
    FROM Fact_AtencionCustomer fa
    LEFT JOIN Dim_Sede s ON s.KeySede = fa.KeySede
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = fa.KeyServicio
    GROUP BY s.Sede, serv.ServicioOdontologico
  `);
  console.log('CUSTOMER Dynamic Matrix:', JSON.stringify(buildDynamicMatrix(customerRows), null, 2));

  process.exit(0);
}

testAllStages().catch(err => {
  console.error(err);
  process.exit(1);
});
