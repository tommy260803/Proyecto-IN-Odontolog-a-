import { queryMart } from '../db/mart';

async function test() {
  console.log('--- 1. BUYER ---');
  const buyer = await queryMart(`
    SELECT 
      f.TipoOrigen AS categoria,
      c.NombreCanal AS item,
      e.EstadoCalidad AS columna,
      SUM(fc.ContactosRegistrados) AS valor
    FROM Fact_CaptacionBuyer fc
    JOIN Dim_Fuente f ON f.KeyFuente = fc.KeyFuente
    JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
    JOIN Dim_EstadoRegistro e ON e.KeyEstadoRegistro = fc.KeyEstadoRegistro
    GROUP BY f.TipoOrigen, c.NombreCanal, e.EstadoCalidad
  `);
  console.log('Buyer rows:', buyer.length, buyer);

  console.log('--- 2. LEAD ---');
  const lead = await queryMart(`
    SELECT 
      s.Sede AS categoria,
      n.NombreNegociador AS item,
      SUM(f.LeadsConvertidosPayer14Dias) AS convertidosPayer,
      SUM(f.LeadsEnNegociacion) AS enNegociacion,
      SUM(f.LeadsAbandonados) AS abandonados,
      SUM(f.LeadsCohorteEvaluable) AS totalLeads
    FROM Fact_NegociacionLead f
    JOIN Dim_Sede s ON s.KeySede = f.KeySede
    JOIN Dim_Negociador n ON n.KeyNegociador = f.KeyNegociador
    GROUP BY s.Sede, n.NombreNegociador
  `);
  console.log('Lead rows:', lead);

  console.log('--- 3. PAYER ---');
  const payer = await queryMart(`
    SELECT 
      p.TipoMedio AS categoria,
      p.MetodoPago AS item,
      c.EstadoPago AS columna,
      SUM(f.ImporteTotalCobro) AS valor
    FROM Fact_GestionPayer f
    JOIN Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
    JOIN Dim_Cobro c ON c.KeyCobro = f.KeyCobro
    GROUP BY p.TipoMedio, p.MetodoPago, c.EstadoPago
  `);
  console.log('Payer rows:', payer);

  console.log('--- 4. CUSTOMER ---');
  const customer = await queryMart(`
    SELECT 
      s.Categoria AS categoria,
      s.ServicioOdontologico AS item,
      e.EstadoFinal AS columna,
      SUM(f.CitasEvaluables) AS valor
    FROM Fact_AtencionCustomer f
    JOIN Dim_Servicio s ON s.KeyServicio = f.KeyServicio
    JOIN Dim_EstadoAtencion e ON e.KeyEstadoAtencion = f.KeyEstadoAtencion
    GROUP BY s.Categoria, s.ServicioOdontologico, e.EstadoFinal
  `);
  console.log('Customer rows:', customer);

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
