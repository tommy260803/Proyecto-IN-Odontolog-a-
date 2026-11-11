import { queryMart } from '../db/mart';

/** Carga exclusivamente Buyer. Las otras fases conservan su ETL propio. */
export class MartSyncService {
  private static lastSyncTimestamp = 0;
  private static inFlight: Promise<number> | null = null;

  /**
   * Determina si la sincronización analítica está habilitada.
   * Se mantiene DESACTIVADA por defecto durante QA y pruebas automatizadas contra bases de datos reales
   * hasta verificar y acordar todos sus destinos transaccionales y dimensionales.
   */
  public static isSyncEnabled(): boolean {
    if (process.env.DISABLE_MART_SYNC === 'true') return false;
    if (process.env.RUN_SQL_TESTS === 'true' && process.env.ENABLE_MART_SYNC !== 'true') return false;
    if (process.env.QA_ENV === 'true' && process.env.ENABLE_MART_SYNC !== 'true') return false;
    return true;
  }

  public static syncBuyer(): Promise<number> {
    if (!this.isSyncEnabled()) {
      return Promise.resolve(this.lastSyncTimestamp);
    }
    if (this.inFlight) return this.inFlight;
    // Instalar primero el bloque 1 de poblamiento_merge_mart.sql y el archivo 06.
    // Una sola transaccion incluye ambos hechos. Los procedimientos usan el mismo bloqueo.
    this.inFlight = queryMart(`
      SET XACT_ABORT ON;
      BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.usp_SincronizarCaptacionBuyer;
        EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;
        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH;
    `).then(() => {
      this.lastSyncTimestamp = Date.now();
      return this.lastSyncTimestamp;
    }).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  public static async syncInversionCampanaBuyer(): Promise<void> {
    if (!this.isSyncEnabled()) return;
    await queryMart('EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;');
  }

  public static async syncAll(force: boolean = false): Promise<void> {
    if (!this.isSyncEnabled()) return;
    if (!force && Date.now() - this.lastSyncTimestamp < 10000) return;
    await this.syncBuyer();
  }
}
