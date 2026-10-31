import { queryMart } from '../db/mart';

export class MartSyncService {
  private static lastSyncTimestamp = 0;

  /**
   * Asegura que la fecha actual exista en Dim_Tiempo para no violar claves foráneas.
   */
  public static async ensureCurrentDateInDimTiempo(date: Date = new Date()): Promise<number> {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const keyTiempo = parseInt(`${yyyy}${mm}${dd}`, 10);
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const quarter = Math.floor(date.getMonth() / 3) + 1;

    try {
      await queryMart(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo = ${keyTiempo})
        BEGIN
          INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
          VALUES (${keyTiempo}, '${dateStr}', ${yyyy}, ${quarter}, ${parseInt(mm, 10)}, ${parseInt(dd, 10)});
        END
      `);
    } catch (err: any) {
      console.warn('[MartSyncService] Error asegurando fecha en Dim_Tiempo:', err.message);
    }

    return keyTiempo;
  }

  /**
   * Sincroniza la etapa BUYER (Fact_CaptacionBuyer) desde NexoSaludDB hacia NexoSalud_Mart.
   */
  public static async syncBuyer(): Promise<number> {
    await this.ensureCurrentDateInDimTiempo();

    const sql = `
      ;WITH EventosLeadUnico AS (
          SELECT id_persona, MIN(fecha_hora) AS fecha_hora_lead
          FROM [NexoSaludDB].dbo.[EventosEtapa]
          WHERE etapa_destino = 2
          GROUP BY id_persona
      ),
      BuyerSource AS (
          SELECT 
              CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
              ISNULL(ds.KeySede, 1) AS KeySede,
              ISNULL(dc.KeyCanal, 4) AS KeyCanal,
              ISNULL(df.KeyFuente, 1) AS KeyFuente,
              CASE 
                  WHEN p.estado_calidad LIKE '%Valid%' AND p.autoriza_contacto = 1 THEN 4
                  WHEN p.estado_calidad LIKE '%Incomplet%' THEN 1
                  WHEN p.estado_calidad LIKE '%Duplicad%' THEN 2
                  WHEN p.estado_calidad LIKE '%Rechazad%' THEN 3
                  ELSE 4
              END AS KeyEstadoRegistro,
              COUNT(p.id_persona) AS contacto_registrado,
              SUM(CASE WHEN p.estado_calidad LIKE '%Valid%' AND p.autoriza_contacto = 1 THEN 1 ELSE 0 END) AS contacto_utilizable,
              SUM(CASE WHEN ev.fecha_hora_lead IS NOT NULL THEN 1 ELSE 0 END) AS conversion_lead,
              AVG(CASE 
                  WHEN ev.fecha_hora_lead >= p.fecha_registro
                  THEN DATEDIFF(DAY, p.fecha_registro, ev.fecha_hora_lead)
                  ELSE 0 
              END) AS tiempo_conversion_dia
          FROM [NexoSaludDB].dbo.[Personas] p
          OUTER APPLY (
              SELECT TOP (1) sede.KeySede
              FROM [NexoSalud_Mart].dbo.[Dim_Sede] sede
              WHERE sede.id_sede > 0 AND p.zona IS NOT NULL
                AND (sede.Zona = p.zona OR sede.Sede LIKE '%' + p.zona + '%')
              ORDER BY CASE WHEN sede.Zona = p.zona THEN 0 ELSE 1 END, sede.KeySede
          ) ds
          LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Canal] dc ON p.id_canal_origen = dc.id_canal
          LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Fuente] df ON p.id_campana_origen = df.id_campana
          LEFT JOIN EventosLeadUnico ev ON p.id_persona = ev.id_persona
          GROUP BY 
              CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT),
              ISNULL(ds.KeySede, 1),
              ISNULL(dc.KeyCanal, 4),
              ISNULL(df.KeyFuente, 1),
              CASE 
                  WHEN p.estado_calidad LIKE '%Valid%' AND p.autoriza_contacto = 1 THEN 4
                  WHEN p.estado_calidad LIKE '%Incomplet%' THEN 1
                  WHEN p.estado_calidad LIKE '%Duplicad%' THEN 2
                  WHEN p.estado_calidad LIKE '%Rechazad%' THEN 3
                  ELSE 4
              END
      )
      MERGE [NexoSalud_Mart].dbo.[fact_captacion_buyer] AS fact
      USING BuyerSource AS src
      ON fact.KeyTiempo = src.KeyTiempo 
         AND fact.KeySede = src.KeySede
         AND fact.KeyCanal = src.KeyCanal 
         AND fact.KeyFuente = src.KeyFuente 
         AND fact.KeyEstadoRegistro = src.KeyEstadoRegistro
      WHEN MATCHED THEN
          UPDATE SET 
              fact.contacto_registrado = src.contacto_registrado,
              fact.contacto_utilizable = src.contacto_utilizable,
              fact.conversion_lead = src.conversion_lead,
              fact.tiempo_conversion_dia = src.tiempo_conversion_dia
      WHEN NOT MATCHED BY TARGET THEN
          INSERT (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro, contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia)
          VALUES (src.KeyTiempo, src.KeySede, src.KeyCanal, src.KeyFuente, src.KeyEstadoRegistro, src.contacto_registrado, src.contacto_utilizable, src.conversion_lead, src.tiempo_conversion_dia)
      WHEN NOT MATCHED BY SOURCE THEN
          DELETE;
    `;

    await queryMart(sql);
    this.lastSyncTimestamp = Date.now();
    return this.lastSyncTimestamp;
  }

  /**
   * Sincroniza de forma completa si ha transcurrido un intervalo o bajo demanda.
   */
  public static async syncAll(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastSyncTimestamp < 10000) {
      return; // Throttled para evitar saturar en llamadas concurrentes
    }
    await this.syncBuyer();
  }
}
