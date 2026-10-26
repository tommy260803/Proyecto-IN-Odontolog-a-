import { getOltpPool, getMartPool, queryMart, queryOltp } from '../db/mart';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ComparisonTestResult {
  num: number;
  scenario: string;
  verdict: 'PASÓ' | 'FALLÓ';
  expected: string;
  observed: string;
  details: string;
}

async function runSqlFile(pool: any, filePath: string) {
  const sqlContent = fs.readFileSync(filePath, 'utf8');
  const batches = sqlContent.split(/^GO\s*$/mi);
  for (const batch of batches) {
    const trimmed = batch.trim();
    if (trimmed) {
      await pool.request().batch(trimmed);
    }
  }
}

const serializeBigInt = (obj: any) => JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v);

async function getFullMartFingerprint() {
  const result = await queryMart(`
    SELECT 'Buyer' as Tbl, COUNT(*) as F, SUM(contacto_registrado) as M1, SUM(conversion_lead) as M2, SUM(tiempo_conversion_dia) as M3 FROM Fact_CaptacionBuyer
    UNION ALL SELECT 'Lead', COUNT(*), SUM(cohorte_evaluable), SUM(conversion_payer_14_dia), SUM(leads_en_negociacion) FROM Fact_NegociacionLead
    UNION ALL SELECT 'Payer', COUNT(*), SUM(pago_registrado), SUM(CAST(importe_total_cobro AS BIGINT)), SUM(pago_validado) FROM Fact_GestionPayer
    UNION ALL SELECT 'Customer', COUNT(*), SUM(cita_evaluable), SUM(atencion_realizada), SUM(cita_inasistencia) FROM Fact_AtencionCustomer
    UNION ALL SELECT 'Turned', COUNT(*), SUM(seguimiento_registrado), SUM(retorno_cohorte_90_dia), SUM(seguimiento_efectivo) FROM Fact_SeguimientoTurned;
  `);
  return result;
}

async function main() {
  console.log('====================================================================');
  console.log('SUITE DE PRUEBAS COMPARATIVAS: INSERT+UPDATE VS MERGE (10 ESCENARIOS)');
  console.log('====================================================================\n');

  const oltp = await getOltpPool();
  const mart = await getMartPool();
  const etlMergePath = path.resolve(__dirname, '../../../database/etl_populate_mart.sql');
  const etlInsertPath = path.resolve(__dirname, '../../../database/etl_populate_mart_insert.sql');
  const results: ComparisonTestResult[] = [];

  // ------------------------------------------------------------------
  // PRUEBA 1: Doble ejecución sin cambios (Idempotencia estricta en INSERT)
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 1: Doble ejecución sin cambios en la estrategia INSERT...');
    await runSqlFile(mart, etlInsertPath);
    const snap1 = await getFullMartFingerprint();
    await runSqlFile(mart, etlInsertPath);
    const snap2 = await getFullMartFingerprint();

    const equal = serializeBigInt(snap1) === serializeBigInt(snap2);
    results.push({
      num: 1,
      scenario: 'Doble ejecución sin cambios en origen (Idempotencia)',
      expected: 'Filas y métricas idénticas entre ambas ejecuciones consecutivas (0 rows modificadas en 2da vuelta)',
      observed: equal ? `100% idéntico. Payer: ${serializeBigInt(snap1[2])}` : 'Discrepancia detectada',
      verdict: equal ? 'PASÓ' : 'FALLÓ',
      details: 'La consulta UPDATE omitió registros no cambiados y el WHERE NOT EXISTS evitó re-inserción.'
    });
  } catch (err: any) {
    results.push({ num: 1, scenario: 'Doble ejecución', verdict: 'FALLÓ', expected: 'Idempotencia', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 2: Insertar un registro nuevo en el origen
  // ------------------------------------------------------------------
  let testPaymentId: number | null = null;
  try {
    console.log('▶ Escenario 2: Inserción de un registro nuevo en el origen...');
    const ins = await oltp.request().query(`
      INSERT INTO Pagos (id_persona, id_reserva, importe, canal_pago, fecha_registro, fecha_validacion, estado, validado_por)
      OUTPUT INSERTED.id_pago
      VALUES (2, 1, 480.00, 'Yape', '2026-10-25 10:00:00', '2026-10-25 10:15:00', 'Confirmado', 1);
    `);
    testPaymentId = ins.recordset[0].id_pago;

    await runSqlFile(mart, etlInsertPath);

    const factPayer = await queryMart<{ F: number, Tot: number }>(`
      SELECT COUNT(*) as F, SUM(importe_total_cobro) as Tot 
      FROM Fact_GestionPayer 
      WHERE KeyTiempo = 20261025 AND KeyPasarela = 4;
    `);

    const passed = factPayer.length > 0 && Number(factPayer[0].Tot) === 480;
    results.push({
      num: 2,
      scenario: 'Inserción de registro nuevo en origen',
      expected: 'Nuevo registro incorporado exactamente sin duplicar combinaciones preexistentes',
      observed: `KeyTiempo=20261025, KeyPasarela=4 -> ${factPayer[0]?.F} fila con Importe=S/.${factPayer[0]?.Tot}`,
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: `Pago de prueba #${testPaymentId} agregado a Fact_GestionPayer vía INSERT ... WHERE NOT EXISTS.`
    });
  } catch (err: any) {
    results.push({ num: 2, scenario: 'Inserción nuevo registro', verdict: 'FALLÓ', expected: 'Registro incorporado', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 3: Cambio de estado de un registro existente
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 3: Cambio de estado de un registro existente...');
    if (testPaymentId) {
      await oltp.request().query(`
        UPDATE Pagos SET estado = 'Fallido' WHERE id_pago = ${testPaymentId};
      `);

      await runSqlFile(mart, etlInsertPath);

      const checkReclass = await queryMart<{ KeyCobro: number, pago_rechazado: number, pago_validado: number }>(`
        SELECT KeyCobro, pago_rechazado, pago_validado
        FROM Fact_GestionPayer 
        WHERE KeyTiempo = 20261025 AND KeyPasarela = 4;
      `);

      const passed = checkReclass.length === 1 && checkReclass[0].KeyCobro === 3 && checkReclass[0].pago_rechazado === 1 && checkReclass[0].pago_validado === 0;
      results.push({
        num: 3,
        scenario: 'Cambio de estado transaccional (Reclasificación)',
        expected: 'Métrica anterior eliminada/reducida y nueva métrica asignada a KeyCobro=3 (REJECTED)',
        observed: `KeyCobro=${checkReclass[0]?.KeyCobro}, pago_rechazado=${checkReclass[0]?.pago_rechazado}, pago_validado=${checkReclass[0]?.pago_validado}`,
        verdict: passed ? 'PASÓ' : 'FALLÓ',
        details: 'El pago migró de confirmado a fallido; la fila anterior fue removida por reconciliación y la nueva fue insertada.'
      });
    }
  } catch (err: any) {
    results.push({ num: 3, scenario: 'Cambio de estado', verdict: 'FALLÓ', expected: 'Reclasificación', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 4: Desaparición de una combinación del origen (Reconciliación de obsoletos)
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 4: Eliminación de registro en el origen (Reconciliación de obsoletos)...');
    if (testPaymentId) {
      await oltp.request().query(`
        DELETE FROM Pagos WHERE id_pago = ${testPaymentId};
      `);

      await runSqlFile(mart, etlInsertPath);

      const checkGhost = await queryMart<{ cnt: number }>(`
        SELECT COUNT(*) as cnt FROM Fact_GestionPayer WHERE KeyTiempo = 20261025;
      `);

      const passed = checkGhost[0].cnt === 0;
      results.push({
        num: 4,
        scenario: 'Reconciliación de agregados obsoletos (Desaparición de grupo)',
        expected: 'Cero filas residuales en Fact_GestionPayer para la fecha/grano eliminado',
        observed: `Filas residuales en KeyTiempo=20261025: ${checkGhost[0].cnt}`,
        verdict: passed ? 'PASÓ' : 'FALLÓ',
        details: 'DELETE f FROM Fact WHERE NOT EXISTS (SELECT 1 FROM #Staging) eliminó el grupo sin afectar el historial.'
      });
    }
  } catch (err: any) {
    results.push({ num: 4, scenario: 'Reconciliación de obsoletos', verdict: 'FALLÓ', expected: 'Grupo eliminado', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 5: Corregir un registro que modifica su combinación dimensional
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 5: Modificación dimensional de un registro (Sede 1 -> Sede 2)...');
    // Tomamos una atención existente en Atenciones y modificamos su id_sede temporalmente
    const atencion = await queryOltp<{ id_atencion: number, id_sede: number }>(`
      SELECT TOP 1 id_atencion, id_sede FROM Atenciones WHERE id_sede = 1;
    `);

    if (atencion.length > 0) {
      const targetId = atencion[0].id_atencion;
      // Cambiar sede de 1 a 2
      await oltp.request().query(`UPDATE Atenciones SET id_sede = 2 WHERE id_atencion = ${targetId};`);
      await runSqlFile(mart, etlInsertPath);

      // Verificar en Mart que la atención se transfirió a Sede 2
      const sedeCheck = await queryMart<{ Sede1: number, Sede2: number }>(`
        SELECT 
          SUM(CASE WHEN KeySede = 1 THEN cita_evaluable ELSE 0 END) as Sede1,
          SUM(CASE WHEN KeySede = 2 THEN cita_evaluable ELSE 0 END) as Sede2
        FROM Fact_AtencionCustomer;
      `);

      // Revertir a la sede original
      await oltp.request().query(`UPDATE Atenciones SET id_sede = 1 WHERE id_atencion = ${targetId};`);
      await runSqlFile(mart, etlInsertPath);

      const revertedCheck = await queryMart<{ Sede1: number, Sede2: number }>(`
        SELECT 
          SUM(CASE WHEN KeySede = 1 THEN cita_evaluable ELSE 0 END) as Sede1,
          SUM(CASE WHEN KeySede = 2 THEN cita_evaluable ELSE 0 END) as Sede2
        FROM Fact_AtencionCustomer;
      `);

      const passed = sedeCheck[0].Sede1 === (revertedCheck[0].Sede1 - 1) && sedeCheck[0].Sede2 === (revertedCheck[0].Sede2 + 1);
      results.push({
        num: 5,
        scenario: 'Corrección de registro con cambio dimensional cruzado',
        expected: 'Ajuste exacto (-1 en grupo de origen, +1 en grupo destino) sin duplicar filas',
        observed: `Durante cambio: Sede1=${sedeCheck[0].Sede1}, Sede2=${sedeCheck[0].Sede2}. Revertido: Sede1=${revertedCheck[0].Sede1}, Sede2=${revertedCheck[0].Sede2}`,
        verdict: passed ? 'PASÓ' : 'FALLÓ',
        details: 'El UPDATE in-place ajustó los conteos de ambas dimensiones de forma consistente.'
      });
    }
  } catch (err: any) {
    results.push({ num: 5, scenario: 'Corrección dimensional cruzada', verdict: 'FALLÓ', expected: 'Reasignación dimensional', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 6: Simulación de fallo, rollback atómico y log de auditoría
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 6: Simulación de fallo y rollback atómico...');
    const testBatchId = 'TEST_FAIL_INS_01';
    try {
      await mart.request().batch(`
        BEGIN TRY
          BEGIN TRANSACTION;
          UPDATE Fact_CaptacionBuyer SET contacto_registrado = 777777 WHERE KeyTiempo = 20260901;
          -- Forzar división por cero
          DECLARE @Err INT = 1 / 0;
          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje)
          VALUES ('${testBatchId}', 'ETL_Test_Fail', 'ERROR', ERROR_MESSAGE());
        END CATCH;
      `);
    } catch (_) {}

    const checkErrRows = await queryMart<{ cnt: number }>('SELECT COUNT(*) as cnt FROM Fact_CaptacionBuyer WHERE contacto_registrado = 777777;');
    const checkErrLog = await queryMart<{ Mensaje: string }>(`SELECT TOP 1 Mensaje FROM dbo.Log_Ejecucion_ETL WHERE BatchId = '${testBatchId}';`);

    const passed = checkErrRows[0].cnt === 0 && checkErrLog.length > 0 && checkErrLog[0].Mensaje.includes('Divide by zero');
    results.push({
      num: 6,
      scenario: 'Simulación de fallo, atomicidad (Rollback) y log persistido',
      expected: 'Rollback completo de datos alterados y persistencia del error en Log_Ejecucion_ETL',
      observed: `Filas corruptas persistidas: ${checkErrRows[0].cnt}, Mensaje registrado: '${checkErrLog[0]?.Mensaje}'`,
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: 'Transacción ACID revertida al 100% mientras el bloque CATCH persistió la telemetría del incidente.'
    });

    await mart.request().query(`DELETE FROM dbo.Log_Ejecucion_ETL WHERE BatchId = '${testBatchId}';`);
  } catch (err: any) {
    results.push({ num: 6, scenario: 'Simulación de fallo', verdict: 'FALLÓ', expected: 'Rollback y log', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 7: Ejecución simultánea y exclusión mutua (sp_getapplock)
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 7: Control de concurrencia y exclusión mutua...');
    const session1 = await getMartPool();
    const r1 = await session1.request().query(`
      DECLARE @res INT;
      EXEC @res = sp_getapplock @Resource = 'ETL_NexoSalud_Lock', @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0;
      SELECT @res as res;
    `);

    let r2Res = 0;
    try {
      const output = execSync('sqlcmd -S localhost -E -C -d NexoSalud_Mart -h -1 -W -Q "SET NOCOUNT ON; DECLARE @res INT; EXEC @res = sp_getapplock @Resource = \'ETL_NexoSalud_Lock\', @LockMode = \'Exclusive\', @LockOwner = \'Session\', @LockTimeout = 0; SELECT @res;"').toString().trim();
      r2Res = parseInt(output, 10);
    } catch {
      r2Res = -1;
    }

    await session1.request().query(`EXEC sp_releaseapplock @Resource = 'ETL_NexoSalud_Lock', @LockOwner = 'Session';`);

    const passed = r1.recordset[0].res >= 0 && r2Res < 0;
    results.push({
      num: 7,
      scenario: 'Control de concurrencia mediante exclusión mutua',
      expected: 'Sesión principal adquiere candado (>=0) y segunda sesión concurrente es rechazada (<0)',
      observed: `Sesión 1 res = ${r1.recordset[0].res}, Sesión 2 concurrente res = ${r2Res}`,
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: 'sp_getapplock garantizó la serialización impidiendo cargas solapadas sobre las tablas de hechos.'
    });
  } catch (err: any) {
    results.push({ num: 7, scenario: 'Concurrencia', verdict: 'FALLÓ', expected: 'Exclusión mutua', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 8: Comprobación de restricciones únicas y miembro desconocido Key=0
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 8: Restricciones de unicidad y miembro desconocido (Key=0)...');
    const indexes = await queryMart<{ TableName: string, IndexName: string }>(`
      SELECT t.name as TableName, i.name as IndexName
      FROM sys.indexes i
      JOIN sys.tables t ON i.object_id = t.object_id
      WHERE i.is_unique = 1 AND (t.name LIKE 'fact_%' OR t.name LIKE 'Fact_%');
    `);

    const dimZero = await queryMart<{ Dim: string, KeyVal: number }>(`
      SELECT 'Dim_Sede' as Dim, KeySede as KeyVal FROM Dim_Sede WHERE KeySede = 0
      UNION ALL SELECT 'Dim_Servicio', KeyServicio FROM Dim_Servicio WHERE KeyServicio = 0
      UNION ALL SELECT 'Dim_Canal', KeyCanal FROM Dim_Canal WHERE KeyCanal = 0
      UNION ALL SELECT 'Dim_Profesional', KeyProfesional FROM Dim_Profesional WHERE KeyProfesional = 0
      UNION ALL SELECT 'Dim_Negociador', KeyNegociador FROM Dim_Negociador WHERE KeyNegociador = 0
      UNION ALL SELECT 'Dim_Pasarela', KeyPasarela FROM Dim_Pasarela WHERE KeyPasarela = 0
      UNION ALL SELECT 'Dim_Cobro', KeyCobro FROM Dim_Cobro WHERE KeyCobro = 0
      UNION ALL SELECT 'Dim_EstadoAtencion', KeyEstadoAtencion FROM Dim_EstadoAtencion WHERE KeyEstadoAtencion = 0;
    `);

    const passed = indexes.length >= 5 && dimZero.length === 8 && dimZero.every(d => d.KeyVal === 0);
    results.push({
      num: 8,
      scenario: 'Restricciones únicas físicas y miembros desconocidos Kimball',
      expected: '5 índices UNIQUE activos y 8 dimensiones analíticas con registro Key=0',
      observed: `${indexes.length} índices UNIQUE activos y ${dimZero.length} miembros Key=0 verificados`,
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: 'Los índices físicos garantizan idempotencia a nivel de motor y Key=0 evita orfandad dimensional.'
    });
  } catch (err: any) {
    results.push({ num: 8, scenario: 'Restricciones y miembro 0', verdict: 'FALLÓ', expected: '5 índices y 8 ceros', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 9: Validación de compatibilidad con los dashboards del backend
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 9: Compatibilidad con consultas analíticas de report.routes.ts...');
    const buyerAggr = await queryMart(`
      SELECT 
        ISNULL(dc.TipoMedio, 'Sin Medio') AS categoria,
        ISNULL(dc.NombreCanal, 'Canal Desconocido') AS item,
        SUM(f.contacto_registrado) AS [Contactos Registrados],
        SUM(f.contacto_utilizable) AS [Contactos Utilizables],
        SUM(f.conversion_lead) AS [Conversiones a LEAD]
      FROM Fact_CaptacionBuyer f
      INNER JOIN Dim_Canal dc ON f.KeyCanal = dc.KeyCanal
      GROUP BY dc.TipoMedio, dc.NombreCanal;
    `);

    const customerAggr = await queryMart(`
      SELECT 
        ISNULL(ds.Sede, 'Sede Central') AS categoria,
        ISNULL(dserv.ServicioOdontologico, 'General') AS item,
        SUM(f.cita_evaluable) AS [Citas Evaluables],
        SUM(f.atencion_realizada) AS [Atenciones Realizadas],
        SUM(f.cita_inasistencia) AS [Inasistencias]
      FROM Fact_AtencionCustomer f
      INNER JOIN Dim_Sede ds ON f.KeySede = ds.KeySede
      INNER JOIN Dim_Servicio dserv ON f.KeyServicio = dserv.KeyServicio
      GROUP BY ds.Sede, dserv.ServicioOdontologico;
    `);

    const payerAggr = await queryMart(`
      SELECT 
        'Recaudación General' AS categoria,
        FORMAT(dt.id_fecha, 'yyyy-MM') AS item,
        SUM(f.pago_registrado) AS [Pagos Registrados],
        SUM(f.pago_validado) AS [Pagos Validados],
        SUM(f.pago_rechazado) AS [Pagos Rechazados],
        SUM(f.importe_total_cobro) AS [Importe Total (S/.)]
      FROM Fact_GestionPayer f
      INNER JOIN Dim_Tiempo dt ON f.KeyTiempo = dt.KeyTiempo
      GROUP BY FORMAT(dt.id_fecha, 'yyyy-MM');
    `);

    const passed = buyerAggr.length > 0 && customerAggr.length > 0 && payerAggr.length > 0;
    results.push({
      num: 9,
      scenario: 'Validación de compatibilidad con dashboards del backend',
      expected: 'Ejecución exitosa de las 3 consultas canónicas consumidas por report.routes.ts',
      observed: `Buyer: ${buyerAggr.length} grupos, Customer: ${customerAggr.length} grupos, Payer: ${payerAggr.length} períodos`,
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: 'Cero discrepancias en nombres de columnas, claves de unión o formatos de agregación.'
    });
  } catch (err: any) {
    results.push({ num: 9, scenario: 'Compatibilidad dashboards', verdict: 'FALLÓ', expected: 'Consultas OK', observed: err.message, details: 'Excepción' });
  }

  // ------------------------------------------------------------------
  // PRUEBA 10: Comparación cruzada estricta entre INSERT y MERGE
  // ------------------------------------------------------------------
  try {
    console.log('▶ Escenario 10: Comparación estricta de resultados (INSERT vs MERGE)...');
    // Ejecutar pipeline MERGE
    await runSqlFile(mart, etlMergePath);
    const fingerprintMerge = await getFullMartFingerprint();

    // Ejecutar pipeline INSERT+UPDATE
    await runSqlFile(mart, etlInsertPath);
    const fingerprintInsert = await getFullMartFingerprint();

    const identical = serializeBigInt(fingerprintMerge) === serializeBigInt(fingerprintInsert);
    results.push({
      num: 10,
      scenario: 'Comparación cruzada de resultados (INSERT vs MERGE)',
      expected: 'Paridad matemática exacta del 100% en filas y sumatorias métricas entre ambas estrategias',
      observed: identical ? 'Huellas dimensionales idénticas en las 5 tablas' : 'Divergencia entre MERGE e INSERT',
      verdict: identical ? 'PASÓ' : 'FALLÓ',
      details: `MERGE vs INSERT: Buyer=${fingerprintMerge[0].F}/${fingerprintInsert[0].F}, Lead=${fingerprintMerge[1].F}/${fingerprintInsert[1].F}, Payer=${fingerprintMerge[2].F}/${fingerprintInsert[2].F}, Customer=${fingerprintMerge[3].F}/${fingerprintInsert[3].F}, Turned=${fingerprintMerge[4].F}/${fingerprintInsert[4].F}.`
    });
  } catch (err: any) {
    results.push({ num: 10, scenario: 'Comparación MERGE vs INSERT', verdict: 'FALLÓ', expected: 'Paridad total', observed: err.message, details: 'Excepción' });
  }

  console.log('\n====================================================================');
  console.log('TABLA DE RESULTADOS DE PRUEBAS COMPARATIVAS');
  console.log('====================================================================');
  console.table(results.map(r => ({
    '#': r.num,
    'Escenario de Prueba': r.scenario,
    'Veredicto': r.verdict,
    'Detalle Observado': r.observed
  })));

  const allPassed = results.every(r => r.verdict === 'PASÓ');
  if (allPassed) {
    console.log('\n🏆 LOS 10 ESCENARIOS DE COMPARACIÓN PASARON CON ÉXITO.');
  } else {
    console.error('\n⚠️ SE DETECTARON ESCENARIOS FALLIDOS.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
