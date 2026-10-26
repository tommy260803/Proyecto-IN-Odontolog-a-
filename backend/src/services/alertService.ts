import { prisma } from '../db';

export interface ResolveAlertDTO {
  id_usuario?: number;
  motivo_resolucion: string;
}

export class AlertService {
  /**
   * Lista alertas con filtros y relaciones.
   */
  static async listAlerts(filters: {
    estado?: string;
    prioridad?: string;
    tipo?: string;
    id_oportunidad?: number;
  }) {
    const where: any = {};
    if (filters.estado) where.estado = filters.estado;
    if (filters.prioridad) where.prioridad = filters.prioridad;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.id_oportunidad) where.id_oportunidad = Number(filters.id_oportunidad);

    return await prisma.impulseAlerts.findMany({
      where,
      orderBy: [
        { prioridad: 'desc' },
        { fecha_generacion: 'desc' }
      ],
      include: {
        Persona: true,
        Oportunidad: {
          include: { Canal: true, Fuente: true, ServicioInteres: true }
        },
        UsuarioResolutor: true
      }
    });
  }

  /**
   * Resuelve una alerta activa.
   */
  static async resolveAlert(idAlerta: number, dto: ResolveAlertDTO) {
    if (!dto.motivo_resolucion || dto.motivo_resolucion.trim() === '') {
      throw new Error('Debe proporcionar un motivo de resolución.');
    }

    const alert = await prisma.impulseAlerts.findUnique({ where: { id_alerta: idAlerta } });
    if (!alert) {
      throw new Error(`Alerta #${idAlerta} no encontrada.`);
    }

    if (alert.estado === 'RESUELTA') {
      return alert;
    }

    return await prisma.impulseAlerts.update({
      where: { id_alerta: idAlerta },
      data: {
        estado: 'RESUELTA',
        fecha_resolucion: new Date(),
        id_usuario_resolutor: dto.id_usuario || null,
        motivo_resolucion: dto.motivo_resolucion
      }
    });
  }

  /**
   * Escanea oportunidades abiertas para detectar violación del SLA de 15 minutos sin primera respuesta.
   */
  static async scanSlaBreaches(thresholdMinutes = 15) {
    const thresholdDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    // Oportunidades activas registradas hace más de thresholdMinutes y sin primera respuesta
    const overdueOpportunities = await prisma.oportunidadesCaptacion.findMany({
      where: {
        estado_oportunidad: { in: ['NUEVO', 'INCOMPLETO', 'EN_CALIFICACION', 'AMBIGUO'] },
        fecha_primera_respuesta: null,
        fecha_registro: { lte: thresholdDate }
      },
      include: {
        Persona: true,
        ImpulseAlerts: {
          where: { codigo_alerta: 'BUYER-05-SLA_VENCIDO', estado: 'ACTIVA' }
        }
      }
    });

    const newAlerts = [];
    for (const op of overdueOpportunities) {
      // Evitar duplicar alerta activa si ya existe
      if (op.ImpulseAlerts.length === 0) {
        const elapsedMinutes = Math.round((Date.now() - op.fecha_registro.getTime()) / 60000);
        const createdAlert = await prisma.impulseAlerts.create({
          data: {
            codigo_alerta: 'BUYER-05-SLA_VENCIDO',
            tipo: 'OPERATIVO',
            id_oportunidad: op.id_oportunidad,
            id_persona: op.id_persona,
            prioridad: 'CRITICA',
            descripcion: `Tiempo de primera respuesta vencido: ${elapsedMinutes} minutos sin atención inicial (Umbral SLA: ${thresholdMinutes} min).`,
            evidencia: `Registrado el ${op.fecha_registro.toISOString()} sin fecha de primera respuesta.`,
            accion_sugerida: 'Asignar inmediatamente a un asesor de guardia para contactar al interesado.',
            estado: 'ACTIVA'
          }
        });
        newAlerts.push(createdAlert);
      }
    }

    return {
      scannedCount: overdueOpportunities.length,
      alertsCreatedCount: newAlerts.length,
      alerts: newAlerts
    };
  }
}
