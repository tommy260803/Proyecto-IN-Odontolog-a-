import { queryMart } from '../db/mart';

async function run() {
  console.log('--- 1. BUYER ---');
  const buyer = await queryMart(`
    SELECT 
      ISNULL(c.TipoMedio, 'Digital') AS categoria,
      ISNULL(c.NombreCanal, 'Sin Canal') AS item,
      SUM(fc.contacto_registrado) AS [Contactos Registrados],
      SUM(fc.contacto_utilizable) AS [Contactos Utilizables],
      SUM(fc.conversion_lead) AS [Conversiones a LEAD]
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
      SUM(fa.cita_evaluable) AS [Citas Evaluables],
      SUM(fa.atencion_realizada) AS [Atenciones Realizadas],
      SUM(fa.cita_inasistencia) AS [Inasistencias]
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
      CONVERT(VARCHAR(7), t.id_fecha, 120) AS item,
      SUM(fp.pago_registrado) AS [Pagos Registrados],
      SUM(fp.pago_validado) AS [Pagos Validados],
      SUM(fp.pago_rechazado) AS [Pagos Rechazados],
      SUM(fp.importe_total_cobro) AS [Importe Total (S/.)]
    FROM Fact_GestionPayer fp
    LEFT JOIN Dim_Tiempo t ON t.KeyTiempo = fp.KeyTiempo
    GROUP BY CONVERT(VARCHAR(7), t.id_fecha, 120)
  `);
  console.log('Payer aggregated:', payer);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
