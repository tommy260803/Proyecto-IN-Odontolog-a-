import { queryMart } from '../db/mart';

async function run() {
  console.log('--- 1. BUYER ---');
  const buyer = await queryMart(`
    SELECT 
      ISNULL(c.TipoMedio, 'Digital') AS categoria,
      ISNULL(c.NombreCanal, 'Sin Canal') AS item,
      SUM(fc.ContactosRegistrados) AS [Contactos Registrados],
      SUM(fc.ContactosUtilizables) AS [Contactos Utilizables],
      SUM(fc.ConversionesALead) AS [Conversiones a LEAD]
    FROM Fact_CaptacionBuyer fc
    LEFT JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
    GROUP BY c.TipoMedio, c.NombreCanal
  `);
  console.log('Buyer aggregated:', buyer);

  console.log('--- 2. CUSTOMER ---');
  const customer = await queryMart(`
    SELECT 
      ISNULL(s.Sede, 'Sin Sede') AS categoria,
      ISNULL(serv.ServicioOdontologico, 'Sin Servicio') AS item,
      SUM(fa.CitasEvaluables) AS [Citas Evaluables],
      SUM(fa.AtencionesRealizadas) AS [Atenciones Realizadas],
      SUM(fa.CitasConInasistencia) AS [Inasistencias]
    FROM Fact_AtencionCustomer fa
    LEFT JOIN Dim_Sede s ON s.KeySede = fa.KeySede
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = fa.KeyServicio
    GROUP BY s.Sede, serv.ServicioOdontologico
  `);
  console.log('Customer aggregated:', customer);

  console.log('--- 3. PAYER ---');
  const payer = await queryMart(`
    SELECT 
      'Recaudación General' AS categoria,
      CONVERT(VARCHAR(7), t.Fecha, 120) AS item,
      SUM(fp.PagosRegistrados) AS [Pagos Registrados],
      SUM(fp.PagosValidados) AS [Pagos Validados],
      SUM(fp.PagosRechazados) AS [Pagos Rechazados],
      SUM(fp.ImporteTotalCobro) AS [Importe Total (S/.)]
    FROM Fact_GestionPayer fp
    LEFT JOIN Dim_Tiempo t ON t.KeyTiempo = fp.KeyTiempo
    GROUP BY CONVERT(VARCHAR(7), t.Fecha, 120)
  `);
  console.log('Payer aggregated:', payer);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
