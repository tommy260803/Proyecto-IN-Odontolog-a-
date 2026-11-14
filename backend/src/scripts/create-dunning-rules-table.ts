import { prisma } from '../db';

async function main() {
  console.log('📦 Creando y verificando tabla ReglasAgentePayer en NexoSaludDB...');

  try {
    const createTableSql = `
      IF OBJECT_ID('NexoSaludDB.dbo.ReglasAgentePayer', 'U') IS NULL
      BEGIN
        CREATE TABLE NexoSaludDB.dbo.ReglasAgentePayer (
          id_regla INT IDENTITY(1,1) PRIMARY KEY,
          clave VARCHAR(50) NOT NULL UNIQUE DEFAULT 'GLOBAL',
          etapa1_preventivo_horas INT NOT NULL DEFAULT 48,
          etapa2_urgencia_horas INT NOT NULL DEFAULT 24,
          prorroga_express_horas INT NOT NULL DEFAULT 24,
          anticipacion_minima_horas INT NOT NULL DEFAULT 72,
          frecuencia_cron_minutos INT NOT NULL DEFAULT 60,
          auto_cancelar_medianoche BIT NOT NULL DEFAULT 1,
          whatsapp_activo BIT NOT NULL DEFAULT 1,
          email_activo BIT NOT NULL DEFAULT 1,
          fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          actualizado_por VARCHAR(100) DEFAULT 'Admin',
          motivo_calibracion VARCHAR(255) NULL
        );
        PRINT 'Tabla ReglasAgentePayer creada exitosamente.';
      END
      ELSE
      BEGIN
        PRINT 'Tabla ReglasAgentePayer ya existe.';
      END
    `;

    await prisma.$executeRawUnsafe(createTableSql);

    // Sembrar registro GLOBAL si no existe
    const seedSql = `
      IF NOT EXISTS (SELECT 1 FROM NexoSaludDB.dbo.ReglasAgentePayer WHERE clave = 'GLOBAL')
      BEGIN
        INSERT INTO NexoSaludDB.dbo.ReglasAgentePayer (
          clave, etapa1_preventivo_horas, etapa2_urgencia_horas, prorroga_express_horas,
          anticipacion_minima_horas, frecuencia_cron_minutos, auto_cancelar_medianoche,
          whatsapp_activo, email_activo, actualizado_por, motivo_calibracion
        )
        VALUES (
          'GLOBAL', 48, 24, 24, 72, 60, 1, 1, 1, 'Sistema', 'Calibración inicial de fábrica'
        );
        PRINT 'Registro GLOBAL inicial sembrado.';
      END
    `;

    await prisma.$executeRawUnsafe(seedSql);

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM NexoSaludDB.dbo.ReglasAgentePayer WHERE clave = 'GLOBAL';
    `);

    console.log('✅ Reglas vigentes en base de datos:', rows[0]);
  } catch (error: any) {
    console.error('❌ Error creando tabla ReglasAgentePayer:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
