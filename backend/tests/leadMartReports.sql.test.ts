import assert from 'node:assert/strict';
import { getMartPool, queryMart } from '../src/db/mart';
import { leadMartQuery, type LeadMartRow } from '../src/services/leadMartReports';

async function run() {
  // Sólo variables de tabla y SELECT: no modifica las tablas del usuario.
  const query = leadMartQuery('L2', { period: '2026-11', KeyPromocion: '1' });
  const sql = query.sql
    .replace('dbo.fact_propuestas_aceptadas_lead', '@aceptadas')
    .replace('dbo.fact_propuestas_rechazadas_lead', '@rechazadas')
    .replace('dbo.Dim_Servicio', "(SELECT 1 KeyServicio,N'Limpieza dental' ServicioOdontologico)")
    .replace('dbo.Dim_Promocion', "(SELECT 1 KeyPromocion,N'Promoción' PromocionAplicada)");
  const rows = await queryMart<LeadMartRow>(`
    DECLARE @aceptadas TABLE(KeyTiempo int,KeyServicio int,KeyPromocion int,propuesta_aceptada bigint);
    DECLARE @rechazadas TABLE(KeyTiempo int,KeyServicio int,KeyPromocion int,propuesta_rechazada bigint,propuesta_rechazada_economica bigint);
    INSERT @aceptadas VALUES (20261101,1,1,4),(20261001,1,1,100),(20261101,1,2,100);
    INSERT @rechazadas VALUES (20261101,1,1,1,1),(20261101,1,1,3,1),(20261101,1,2,100,100);
    ;${sql}`, query.params);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].aceptadas), 4, 'No duplicar aceptadas ante varios motivos de rechazo.');
  assert.equal(Number(rows[0].rechazadas), 4);
  assert.equal(Number(rows[0].especiales), 2);
  assert.equal(100 * Number(rows[0].especiales) / (Number(rows[0].aceptadas) + Number(rows[0].rechazadas)), 25);
  assert.throws(() => leadMartQuery('L2', { KeySede: '1' }), /no admite/);
  assert.throws(() => leadMartQuery('L1', { KeyServicio: '1 OR 1=1' }), /inválido/);
  assert.throws(() => leadMartQuery('L3', { period: '2026-13' }), /inválido/);
  console.log('LEAD Mart: sumas, filtro de período, promoción y rechazo de filtros inválidos correctos.');
}

run().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await (await getMartPool()).close(); });
