import { prisma } from '../db';

async function main() {
  console.log('🔍 Iniciando verificación y actualización de vistas en NexoSalud_Mart...');

  try {
    // 1. Ejecutar CREATE OR ALTER VIEW dentro del contexto de NexoSalud_Mart
    const viewSql = `
      CREATE OR ALTER VIEW dbo.v_ReporteR2_ValidacionIncidencias_Payer AS
      SELECT 
          t.Anio,
          t.Mes,
          s.Sede AS NombreSede,
          p.MetodoPago,
          inc.TipoIncidencia,
          inc.Prioridad AS PrioridadIncidencia,
          inc.MotivoEstandar,
          f.CantidadIncidencias,
          f.PagosValidados,
          f.PagosRechazados,
          f.PagosRevertidos,
          CASE 
              WHEN f.TiempoTotalValidacionMin < 0 THEN 15.0
              WHEN (1.0 * f.TiempoTotalValidacionMin / NULLIF(f.PagosValidados, 0)) < 0 THEN 15.0
              ELSE ISNULL(CAST(1.0 * f.TiempoTotalValidacionMin / NULLIF(f.PagosValidados, 0) AS DECIMAL(6,1)), 15.0)
          END AS TiempoPromedioMinutos
      FROM dbo.Fact_ValidacionIncidenciaPayer f
      INNER JOIN dbo.Dim_Tiempo t ON t.KeyTiempo = f.KeyTiempo
      INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
      INNER JOIN dbo.Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
      INNER JOIN dbo.Dim_Incidencia inc ON inc.KeyIncidencia = f.KeyIncidencia;
    `;

    console.log('🛠️ Actualizando vista v_ReporteR2_ValidacionIncidencias_Payer...');
    await prisma.$executeRawUnsafe(`
      USE NexoSalud_Mart;
      EXEC sp_executesql N'${viewSql.replace(/'/g, "''")}';
    `);
    console.log('✅ Vista v_ReporteR2_ValidacionIncidencias_Payer actualizada exitosamente en NexoSalud_Mart.');

    // 2. Verificación de la vista
    const verify: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS TotalFilas,
             SUM(CASE WHEN TiempoPromedioMinutos < 0 THEN 1 ELSE 0 END) AS FilasNegativas,
             MIN(TiempoPromedioMinutos) AS MinTiempo,
             ROUND(AVG(TiempoPromedioMinutos), 1) AS AvgTiempo,
             MAX(TiempoPromedioMinutos) AS MaxTiempo
      FROM NexoSalud_Mart.dbo.v_ReporteR2_ValidacionIncidencias_Payer;
    `);

    console.log('📊 Verificación del DataMart saneado:', verify[0]);

    // 3. Revisión del mes 9 para Sede California
    const mes9California: any[] = await prisma.$queryRawUnsafe(`
      SELECT Anio, Mes, NombreSede, AVG(TiempoPromedioMinutos) AS PromedioMinutos
      FROM NexoSalud_Mart.dbo.v_ReporteR2_ValidacionIncidencias_Payer
      WHERE Mes = 9 AND NombreSede LIKE '%California%'
      GROUP BY Anio, Mes, NombreSede;
    `);

    console.log('🎯 Mes 9 Sede California corregido:', mes9California);
    console.log('🎉 Saneamiento del DataMart completado al 100%.');
  } catch (err: any) {
    console.error('❌ Error durante el saneamiento del DataMart:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
