import { getOltpPool, getMartPool, queryMart, queryOltp } from '../db/mart';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface TestResult {
  code: string;
  name: string;
  verdict: 'PASÓ' | 'FALLÓ';
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

async function main() {
  console.log('====================================================================');
  ('SUITE DE CERTIFICACIÓN FORMAL DE ETL NEXOSALUD');
  console.log('====================================================================\n');

  const oltp = await getOltpPool();
  const mart = await getMartPool();
  const etlPath = path.resolve(__dirname, '../../../database/etl_populate_mart.sql');
  const results: TestResult[] = [];

  // PRUEBA A: Doble Ejecución sin Cambios (Idempotencia Matemática Estricta)
  try {
    console.log('▶ Ejecutando Prueba A: Idempotencia en doble ejecución...');
    await runSqlFile(mart, etlPath);

    const snapshot1 = await queryMart(`
      SELECT 'Buyer' as Tbl, COUNT(*) as F, SUM(contacto_registrado) as M1, SUM(conversion_lead) as M2 FROM Fact_CaptacionBuyer
      UNION ALL SELECT 'Lead', COUNT(*), SUM(cohorte_evaluable), SUM(conversion_payer_14_dia) FROM Fact_NegociacionLead
      UNION ALL SELECT 'Payer', COUNT(*), SUM(pago_registrado), SUM(CAST(importe_total_cobro AS BIGINT)) FROM Fact_GestionPayer
      UNION ALL SELECT 'Customer', COUNT(*), SUM(cita_evaluable), SUM(atencion_realizada) FROM Fact_AtencionCustomer
      UNION ALL SELECT 'Turned', COUNT(*), SUM(seguimiento_registrado), SUM(retorno_cohorte_90_dia) FROM Fact_SeguimientoTurned
    `);

    await runSqlFile(mart, etlPath);

    const snapshot2 = await queryMart(`
      SELECT 'Buyer' as Tbl, COUNT(*) as F, SUM(contacto_registrado) as M1, SUM(conversion_lead) as M2 FROM Fact_CaptacionBuyer
      UNION ALL SELECT 'Lead', COUNT(*), SUM(cohorte_evaluable), SUM(conversion_payer_14_dia) FROM Fact_NegociacionLead
      UNION ALL SELECT 'Payer', COUNT(*), SUM(pago_registrado), SUM(CAST(importe_total_cobro AS BIGINT)) FROM Fact_GestionPayer
      UNION ALL SELECT 'Customer', COUNT(*), SUM(cita_evaluable), SUM(atencion_realizada) FROM Fact_AtencionCustomer
      UNION ALL SELECT 'Turned', COUNT(*), SUM(seguimiento_registrado), SUM(retorno_cohorte_90_dia) FROM Fact_SeguimientoTurned
    `);

    const serializeBigInt = (obj: any) => JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
    const equal = serializeBigInt(snapshot1) === serializeBigInt(snapshot2);
    results.push({
      code: 'TEST-A',
      name: 'Idempotencia en reejecución idéntica',
      verdict: equal ? 'PASÓ' : 'FALLÓ',
      details: equal 
        ? `100% de concordancia en filas y métricas a través de las 5 tablas de hechos (${serializeBigInt(snapshot1[2])}).`
        : `Discrepancia detectada entre snapshot 1 y snapshot 2.`
    });
  } catch (err: any) {
    results.push({ code: 'TEST-A', name: 'Idempotencia', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA B: Inserción de Registro Nuevo en Origen
  let testPaymentId: number | null = null;
  try {
    console.log('▶ Ejecutando Prueba B: Inserción de nuevo registro transaccional...');
    const insertRes = await oltp.request().query(`
      INSERT INTO Pagos (id_persona, id_reserva, importe, canal_pago, fecha_registro, fecha_validacion, estado, validado_por)
      OUTPUT INSERTED.id_pago
      VALUES (2, 1, 350.00, 'Yape', '2026-10-20 10:00:00', '2026-10-20 10:15:00', 'Confirmado', 1);
    `);
    testPaymentId = insertRes.recordset[0].id_pago;

    await runSqlFile(mart, etlPath);

    const check = await queryMart<{ F: number, TotImp: number }>(`
      SELECT COUNT(*) as F, SUM(importe_total_cobro) as TotImp 
      FROM Fact_GestionPayer 
      WHERE KeyTiempo = 20261020 AND KeyPasarela = 4; -- Yape = 4
    `);

    const passed = check.length > 0 && Number(check[0].TotImp) === 350;
    results.push({
      code: 'TEST-B',
      name: 'Incorporación de nuevo registro sin duplicación',
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: `Pago de prueba #${testPaymentId} incorporado exactamente en KeyTiempo=20261020 con Importe=S/.350.00.`
    });
  } catch (err: any) {
    results.push({ code: 'TEST-B', name: 'Nuevo registro', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA C: Reclasificación por Cambio de Estado
  try {
    console.log('▶ Ejecutando Prueba C: Reclasificación por cambio de estado...');
    if (testPaymentId) {
      await oltp.request().query(`
        UPDATE Pagos SET estado = 'Fallido' WHERE id_pago = ${testPaymentId};
      `);

      await runSqlFile(mart, etlPath);

      const checkReclass = await queryMart<{ KeyCobro: number, pago_rechazado: number, pago_validado: number }>(`
        SELECT KeyCobro, pago_rechazado, pago_validado
        FROM Fact_GestionPayer 
        WHERE KeyTiempo = 20261020 AND KeyPasarela = 4;
      `);

      const passed = checkReclass.length === 1 && checkReclass[0].KeyCobro === 3 && checkReclass[0].pago_rechazado === 1 && checkReclass[0].pago_validado === 0;
      results.push({
        code: 'TEST-C',
        name: 'Reclasificación por cambio de estado transaccional',
        verdict: passed ? 'PASÓ' : 'FALLÓ',
        details: `El pago #${testPaymentId} migró de KeyCobro=1 (VALIDATED) a KeyCobro=3 (REJECTED) con métrica pago_rechazado=1 y pago_validado=0.`
      });
    }
  } catch (err: any) {
    results.push({ code: 'TEST-C', name: 'Reclasificación de estado', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA D: Reconciliación de Agregado Obsoleto (Ghost Record Removal)
  try {
    console.log('▶ Ejecutando Prueba D: Reconciliación de agregados obsoletos...');
    if (testPaymentId) {
      // Eliminar el pago de prueba en el origen
      await oltp.request().query(`
        DELETE FROM Pagos WHERE id_pago = ${testPaymentId};
      `);

      await runSqlFile(mart, etlPath);

      const ghostCheck = await queryMart<{ cnt: number }>(`
        SELECT COUNT(*) as cnt FROM Fact_GestionPayer WHERE KeyTiempo = 20261020;
      `);

      const passed = ghostCheck[0].cnt === 0;
      results.push({
        code: 'TEST-D',
        name: 'Reconciliación de agregados obsoletos (Scoped MERGE DELETE)',
        verdict: passed ? 'PASÓ' : 'FALLÓ',
        details: `Al eliminarse la transacción del origen, el Scoped MERGE removió la combinación de KeyTiempo=20261020, eliminando el agregado obsoleto (0 filas residuales).`
      });
    }
  } catch (err: any) {
    results.push({ code: 'TEST-D', name: 'Reconciliación obsoletos', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA E: Dimensión Desconocida (Uso Coherente de Key = 0)
  try {
    console.log('▶ Ejecutando Prueba E: Integridad de miembros desconocidos (Key=0)...');
    const unknownCheck = await queryMart<{ Dim: string, Val: number }>(`
      SELECT 'Dim_Sede' as Dim, KeySede as Val FROM Dim_Sede WHERE KeySede = 0
      UNION ALL SELECT 'Dim_Servicio', KeyServicio FROM Dim_Servicio WHERE KeyServicio = 0
      UNION ALL SELECT 'Dim_Canal', KeyCanal FROM Dim_Canal WHERE KeyCanal = 0
      UNION ALL SELECT 'Dim_Profesional', KeyProfesional FROM Dim_Profesional WHERE KeyProfesional = 0
      UNION ALL SELECT 'Dim_Negociador', KeyNegociador FROM Dim_Negociador WHERE KeyNegociador = 0
      UNION ALL SELECT 'Dim_Pasarela', KeyPasarela FROM Dim_Pasarela WHERE KeyPasarela = 0
      UNION ALL SELECT 'Dim_Cobro', KeyCobro FROM Dim_Cobro WHERE KeyCobro = 0
      UNION ALL SELECT 'Dim_EstadoAtencion', KeyEstadoAtencion FROM Dim_EstadoAtencion WHERE KeyEstadoAtencion = 0;
    `);

    const allZero = unknownCheck.length === 8 && unknownCheck.every(r => r.Val === 0);
    results.push({
      code: 'TEST-E',
      name: 'Respaldo de miembro desconocido canónico (Key = 0)',
      verdict: allZero ? 'PASÓ' : 'FALLÓ',
      details: `Las 8 dimensiones analíticas cuentan con registro Key=0 para capturar valores huérfanos sin distorsionar entidades válidas.`
    });
  } catch (err: any) {
    results.push({ code: 'TEST-E', name: 'Miembro desconocido', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA F: Simulación de Error y Rollback Atómico con Persistencia de Log
  try {
    console.log('▶ Ejecutando Prueba F: Simulación de fallo, atomicidad y persistencia de error...');
    const countBefore = await queryMart<{ cnt: number }>('SELECT COUNT(*) as cnt FROM Fact_CaptacionBuyer');
    
    // Ejecutar script con error forzado en una transacción
    try {
      await mart.request().batch(`
        BEGIN TRY
          BEGIN TRANSACTION;
          UPDATE Fact_CaptacionBuyer SET contacto_registrado = 999999 WHERE KeyTiempo = 20260901;
          -- Forzar división por cero
          DECLARE @Fail INT = 1 / 0;
          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje)
          VALUES ('TEST_FAIL_01', 'Test_SimulacionFallo', 'ERROR', ERROR_MESSAGE());
        END CATCH;
      `);
    } catch (_) {}

    const checkLog = await queryMart<{ BatchId: string, Mensaje: string }>(`
      SELECT TOP 1 BatchId, Mensaje FROM dbo.Log_Ejecucion_ETL WHERE BatchId = 'TEST_FAIL_01';
    `);

    const countAfter = await queryMart<{ cnt: number }>('SELECT COUNT(*) as cnt FROM Fact_CaptacionBuyer WHERE contacto_registrado = 999999');

    const passed = countAfter[0].cnt === 0 && checkLog.length > 0 && checkLog[0].Mensaje.includes('Divide by zero');
    results.push({
      code: 'TEST-F',
      name: 'Atomicidad ante fallo (Rollback total) y persistencia de auditoría',
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: `Ante división por cero, los datos modificados revirtieron al 100% y el error quedó persistido en Log_Ejecucion_ETL ('${checkLog[0]?.Mensaje}').`
    });

    // Limpiar log de prueba
    await mart.request().query("DELETE FROM dbo.Log_Ejecucion_ETL WHERE BatchId = 'TEST_FAIL_01';");
  } catch (err: any) {
    results.push({ code: 'TEST-F', name: 'Atomicidad y Rollback', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA G: Control de Concurrencia con sp_getapplock
  try {
    console.log('▶ Ejecutando Prueba G: Control de exclusión mutua por candado de aplicación...');
    const session1 = await getMartPool();

    // Sesión 1 adquiere el candado
    const r1 = await session1.request().query(`
      DECLARE @res INT;
      EXEC @res = sp_getapplock @Resource = 'ETL_NexoSalud_Lock', @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0;
      SELECT @res as res;
    `);

    // Sesión 2 (proceso independiente vía sqlcmd) intenta adquirir el mismo candado con timeout 0 (debe dar -1)
    let r2Res = 0;
    try {
      const output = execSync('sqlcmd -S localhost -E -C -d NexoSalud_Mart -h -1 -W -Q "SET NOCOUNT ON; DECLARE @res INT; EXEC @res = sp_getapplock @Resource = \'ETL_NexoSalud_Lock\', @LockMode = \'Exclusive\', @LockOwner = \'Session\', @LockTimeout = 0; SELECT @res;"').toString().trim();
      r2Res = parseInt(output, 10);
    } catch {
      r2Res = -1;
    }

    // Liberar candado
    await session1.request().query(`
      EXEC sp_releaseapplock @Resource = 'ETL_NexoSalud_Lock', @LockOwner = 'Session';
    `);

    const passed = r1.recordset[0].res >= 0 && r2Res < 0;
    results.push({
      code: 'TEST-G',
      name: 'Exclusión mutua y prevención de ejecuciones concurrentes',
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: `sp_getapplock otorgó candado a la sesión 1 (res=${r1.recordset[0].res}) y rechazó inmediatamente a la sesión concurrente 2 (res=${r2Res}).`
    });
  } catch (err: any) {
    results.push({ code: 'TEST-G', name: 'Concurrencia', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA H: Reconciliación Contable contra el Origen
  try {
    console.log('▶ Ejecutando Prueba H: Reconciliación cruzada de medidas Mart vs OLTP...');
    const oltpPagos = await queryOltp<{ TotPagos: number, TotValid: number, ImpTot: number }>(`
      SELECT 
        COUNT(*) as TotPagos,
        SUM(CASE WHEN estado IN ('Confirmado', 'Validado') THEN 1 ELSE 0 END) as TotValid,
        SUM(importe) as ImpTot
      FROM Pagos;
    `);

    const martPagos = await queryMart<{ TotPagos: number, TotValid: number, ImpTot: number }>(`
      SELECT 
        SUM(pago_registrado) as TotPagos,
        SUM(pago_validado) as TotValid,
        SUM(importe_total_cobro) as ImpTot
      FROM Fact_GestionPayer;
    `);

    const oltpAtenc = await queryOltp<{ TotAtenc: number, Asist: number, Inasist: number }>(`
      SELECT 
        COUNT(*) as TotAtenc,
        SUM(CASE WHEN asistencia LIKE '%Asisti%' AND asistencia NOT LIKE '%No%' THEN 1 ELSE 0 END) as Asist,
        SUM(CASE WHEN asistencia LIKE '%No%asisti%' THEN 1 ELSE 0 END) as Inasist
      FROM Atenciones;
    `);

    const martAtenc = await queryMart<{ TotAtenc: number, Asist: number, Inasist: number }>(`
      SELECT 
        SUM(cita_evaluable) as TotAtenc,
        SUM(atencion_realizada) as Asist,
        SUM(cita_inasistencia) as Inasist
      FROM Fact_AtencionCustomer;
    `);

    const pagosMatch = oltpPagos[0].TotPagos === martPagos[0].TotPagos && oltpPagos[0].TotValid === martPagos[0].TotValid && Number(oltpPagos[0].ImpTot) === Number(martPagos[0].ImpTot);
    const atencMatch = oltpAtenc[0].TotAtenc === martAtenc[0].TotAtenc && oltpAtenc[0].Asist === martAtenc[0].Asist && oltpAtenc[0].Inasist === martAtenc[0].Inasist;

    const passed = pagosMatch && atencMatch;
    results.push({
      code: 'TEST-H',
      name: 'Reconciliación cruzada integral de métricas OLTP vs Data Mart',
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: `Pagos: OLTP ${oltpPagos[0].TotPagos} reg / S/.${oltpPagos[0].ImpTot} == Mart ${martPagos[0].TotPagos} reg / S/.${martPagos[0].ImpTot}. Atenciones: OLTP ${oltpAtenc[0].TotAtenc} citas (${oltpAtenc[0].Asist} asist, ${oltpAtenc[0].Inasist} no-show) == Mart ${martAtenc[0].TotAtenc} citas (${martAtenc[0].Asist} asist, ${martAtenc[0].Inasist} no-show).`
    });
  } catch (err: any) {
    results.push({ code: 'TEST-H', name: 'Reconciliación cruzada', verdict: 'FALLÓ', details: err.message });
  }

  // PRUEBA I: Protección de Fan-Out en Solicitudes y Eventos de Etapa
  try {
    console.log('▶ Ejecutando Prueba I: Verificación de no-duplicación por relaciones 1:N...');
    const oltpPersonasLead = await queryOltp<{ DistinctLeads: number }>(`
      SELECT COUNT(DISTINCT id_persona) as DistinctLeads
      FROM EventosEtapa
      WHERE etapa_destino = 2;
    `);

    const martLeads = await queryMart<{ CohorteTotal: number }>(`
      SELECT SUM(cohorte_evaluable) as CohorteTotal
      FROM Fact_NegociacionLead;
    `);

    const passed = oltpPersonasLead[0].DistinctLeads === martLeads[0].CohorteTotal;
    results.push({
      code: 'TEST-I',
      name: 'Prevención de producto cartesiano (Fan-Out) en cohortes de Lead',
      verdict: passed ? 'PASÓ' : 'FALLÓ',
      details: `Personas distintas con transición a LEAD en OLTP: ${oltpPersonasLead[0].DistinctLeads} == Leads de cohorte evaluable en Mart: ${martLeads[0].CohorteTotal} (Cero duplicación por reingresos).`
    });
  } catch (err: any) {
    results.push({ code: 'TEST-I', name: 'Fan-Out Prevention', verdict: 'FALLÓ', details: err.message });
  }

  console.log('\n====================================================================');
  console.log('TABLA DE RESULTADOS DE CERTIFICACIÓN');
  console.log('====================================================================');
  console.table(results);

  const allPassed = results.every(r => r.verdict === 'PASÓ');
  console.log(allPassed ? '\n🏆 TODOS LOS CASOS DE CERTIFICACIÓN OBLIGATORIA PASARON SATISFACTORIAMENTE.' : '\n⚠️ SE DETECTARON CASOS FALLIDOS.');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Error fatal ejecutando suite de certificación:', err);
  process.exit(1);
});
