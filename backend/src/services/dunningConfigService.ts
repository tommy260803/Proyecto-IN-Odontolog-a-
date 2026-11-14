import { prisma } from '../db';

export interface DunningRulesData {
  id_regla?: number;
  clave?: string;
  etapa1_preventivo_horas: number;
  etapa2_urgencia_horas: number;
  prorroga_express_horas: number;
  anticipacion_minima_horas: number;
  frecuencia_cron_minutos: number;
  auto_cancelar_medianoche: boolean;
  whatsapp_activo: boolean;
  email_activo: boolean;
  fecha_actualizacion?: Date | string;
  actualizado_por?: string | null;
  motivo_calibracion?: string | null;
}

const DEFAULT_RULES: DunningRulesData = {
  clave: 'GLOBAL',
  etapa1_preventivo_horas: 48,
  etapa2_urgencia_horas: 24,
  prorroga_express_horas: 24,
  anticipacion_minima_horas: 72,
  frecuencia_cron_minutos: 60,
  auto_cancelar_medianoche: true,
  whatsapp_activo: true,
  email_activo: true,
  actualizado_por: 'Sistema',
  motivo_calibracion: 'Valores predeterminados de fábrica',
};

// Caché en memoria para evitar queries innecesarias en cada tick
let cachedRules: DunningRulesData | null = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 15000; // 15 segundos

export class DunningConfigService {
  /**
   * Obtiene las reglas vigentes desde la base de datos (con fallback y caché)
   */
  static async getRules(forceRefresh = false): Promise<DunningRulesData> {
    const now = Date.now();
    if (!forceRefresh && cachedRules && now - lastCacheTimestamp < CACHE_TTL_MS) {
      return cachedRules;
    }

    try {
      let record = await prisma.reglasAgentePayer.findUnique({
        where: { clave: 'GLOBAL' },
      });

      if (!record) {
        record = await prisma.reglasAgentePayer.create({
          data: {
            clave: 'GLOBAL',
            etapa1_preventivo_horas: DEFAULT_RULES.etapa1_preventivo_horas,
            etapa2_urgencia_horas: DEFAULT_RULES.etapa2_urgencia_horas,
            prorroga_express_horas: DEFAULT_RULES.prorroga_express_horas,
            anticipacion_minima_horas: DEFAULT_RULES.anticipacion_minima_horas,
            frecuencia_cron_minutos: DEFAULT_RULES.frecuencia_cron_minutos,
            auto_cancelar_medianoche: DEFAULT_RULES.auto_cancelar_medianoche,
            whatsapp_activo: DEFAULT_RULES.whatsapp_activo,
            email_activo: DEFAULT_RULES.email_activo,
            actualizado_por: 'Sistema',
            motivo_calibracion: 'Autosembrado inicial',
          },
        });
      }

      cachedRules = record;
      lastCacheTimestamp = now;
      return record;
    } catch (error: any) {
      console.warn('⚠️ Error al consultar ReglasAgentePayer en BD, usando fallback:', error.message);
      return cachedRules || DEFAULT_RULES;
    }
  }

  /**
   * Actualiza las reglas en la base de datos
   */
  static async updateRules(
    updates: Partial<DunningRulesData>,
    updatedBy: string = 'Administrador',
    reason?: string
  ): Promise<DunningRulesData> {
    // Validaciones de coherencia de negocio
    const e1 = updates.etapa1_preventivo_horas !== undefined ? Number(updates.etapa1_preventivo_horas) : undefined;
    const e2 = updates.etapa2_urgencia_horas !== undefined ? Number(updates.etapa2_urgencia_horas) : undefined;

    if (e1 !== undefined && e2 !== undefined && e1 <= e2) {
      throw new Error(
        `Inconsistencia temporal: El recordatorio preventivo (Etapa 1: ${e1}h) debe ser mayor a la alerta de urgencia (Etapa 2: ${e2}h).`
      );
    }

    const current = await this.getRules(true);

    const newE1 = e1 !== undefined ? e1 : current.etapa1_preventivo_horas;
    const newE2 = e2 !== undefined ? e2 : current.etapa2_urgencia_horas;

    if (newE1 <= newE2) {
      throw new Error(
        `Inconsistencia temporal: El recordatorio preventivo (${newE1}h) debe ser mayor a la alerta de urgencia (${newE2}h).`
      );
    }

    const updated = await prisma.reglasAgentePayer.upsert({
      where: { clave: 'GLOBAL' },
      create: {
        clave: 'GLOBAL',
        etapa1_preventivo_horas: newE1,
        etapa2_urgencia_horas: newE2,
        prorroga_express_horas: updates.prorroga_express_horas ?? current.prorroga_express_horas,
        anticipacion_minima_horas: updates.anticipacion_minima_horas ?? current.anticipacion_minima_horas,
        frecuencia_cron_minutos: updates.frecuencia_cron_minutos ?? current.frecuencia_cron_minutos,
        auto_cancelar_medianoche: updates.auto_cancelar_medianoche !== undefined ? Boolean(updates.auto_cancelar_medianoche) : current.auto_cancelar_medianoche,
        whatsapp_activo: updates.whatsapp_activo !== undefined ? Boolean(updates.whatsapp_activo) : current.whatsapp_activo,
        email_activo: updates.email_activo !== undefined ? Boolean(updates.email_activo) : current.email_activo,
        actualizado_por: updatedBy,
        motivo_calibracion: reason || 'Calibración desde panel de administración',
      },
      update: {
        etapa1_preventivo_horas: newE1,
        etapa2_urgencia_horas: newE2,
        ...(updates.prorroga_express_horas !== undefined && { prorroga_express_horas: Number(updates.prorroga_express_horas) }),
        ...(updates.anticipacion_minima_horas !== undefined && { anticipacion_minima_horas: Number(updates.anticipacion_minima_horas) }),
        ...(updates.frecuencia_cron_minutos !== undefined && { frecuencia_cron_minutos: Number(updates.frecuencia_cron_minutos) }),
        ...(updates.auto_cancelar_medianoche !== undefined && { auto_cancelar_medianoche: Boolean(updates.auto_cancelar_medianoche) }),
        ...(updates.whatsapp_activo !== undefined && { whatsapp_activo: Boolean(updates.whatsapp_activo) }),
        ...(updates.email_activo !== undefined && { email_activo: Boolean(updates.email_activo) }),
        actualizado_por: updatedBy,
        motivo_calibracion: reason || 'Calibración desde panel de administración',
        fecha_actualizacion: new Date(),
      },
    });

    cachedRules = updated;
    lastCacheTimestamp = Date.now();
    return updated;
  }
}
