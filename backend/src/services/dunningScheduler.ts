import { prisma } from '../db';
import { sendPaymentNoticeOrConfirmation, generateBackendPdfBase64 } from '../routes/payer.routes';
import { appointmentMidnightInLima } from './appointmentPolicy';
import { WhatsAppService } from './whatsappService';
import { DunningConfigService } from './dunningConfigService';
import { ScheduledNoticeService } from './scheduledNoticeService';

export interface DunningCycleResult {
  timestamp: string;
  evaluatedReservations: number;
  stage1RemindersSent: number;
  stage2UrgenciesSent: number;
  stage3CancellationsProcessed: number;
  freedSlots: number;
  scheduledCobrosCount?: number;
  scheduledCobrosExecuted?: number;
  scheduledCobrosPending?: number;
  scheduledCobros?: any[];
  logs: Array<{
    reservationId: number;
    patientName: string;
    stage: 'ETAPA_1_PREVENTIVO' | 'ETAPA_2_URGENCIA' | 'ETAPA_3_CANCELACION' | 'COBRO_AUTOMATICO' | 'SIN_ACCION';
    details: string;
    emailSent: boolean;
    emailRecipient?: string;
    sentAt?: string;
    amount?: number;
    channel?: string;
    status?: string;
  }>;
}

// Historial en memoria de última ejecución para el panel de BI
let lastExecutionStats: DunningCycleResult | null = null;

/**
 * Función principal que ejecuta el ciclo de cobranza en 3 etapas:
 * - Etapa 1 (T - 48h antes del día de la cita): Recordatorio Preventivo cordial por correo con PDF.
 * - Etapa 2 (T - 24h antes del día de la cita): Alerta de Urgencia Clínica (aviso de liberación a las 23:59).
 * - Etapa 3 (T = 00:00 hrs del día de la cita): Cancelación automática, liberación de sillón y correo formal de expiración.
 */
export async function runDunningCycle(): Promise<DunningCycleResult> {
  const rules = await DunningConfigService.getRules();
  const now = new Date();
  const logs: DunningCycleResult['logs'] = [];
  let stage1Count = 0;
  let stage2Count = 0;
  let stage3Count = 0;
  let freedCount = 0;

  try {
    // Procesar cualquier notificación de cobro puntual programada cuya fecha/hora haya llegado
    if (typeof process.env.VITEST === 'undefined') {
      await ScheduledNoticeService.procesarPendientes().catch(e => console.error('❌ [Dunning] Error procesando notificaciones programadas:', e));
    }

    // Buscar todas las reservas que no estén ya validadas
    const reservas = await prisma.reservas.findMany({
      include: {
        Persona: true,
        Solicitud: { include: { Servicio: { include: { Tarifas: { where: { activo: true }, orderBy: { fecha_inicio: 'desc' }, take: 1 } } } } },
        Opcion: {
          include: {
            Disponibilidad: {
              include: { Sede: true, Profesional: true }
            }
          }
        },
        Pagos: true,
        Incidencias: true
      }
    });

    for (const r of reservas) {
      const pago = r.Pagos.length > 0 ? r.Pagos[0] : null;
      // Un comprobante en revisión ya fue presentado; el pendiente aún requiere avisos.
      if (pago && ['Validado', 'VALIDADO', 'En_Revision', 'En revisión', 'En Revisión', 'EN_REVISION', 'IN_REVIEW'].includes(pago.estado)) {
        continue;
      }

      // Si la reserva ya fue cancelada o marcada como vencida previamente
      if (r.estado === 'Cancelada' || r.estado === 'Vencida') {
        continue;
      }

      // La fecha de reserva es el día de la compra, nunca el día de la cita.
      const apptDate = r.Opcion?.Disponibilidad?.fecha;
      if (!apptDate || isNaN(apptDate.getTime())) {
        continue;
      }

      // Inicio del día de la cita en Perú, independiente de la zona del servidor.
      const appointmentDayStart = appointmentMidnightInLima(apptDate);
      const hoursUntilMidnightDeadline = (appointmentDayStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      const patientName = `${r.Persona.nombres} ${r.Persona.apellidos}`;
      const patientEmail = r.Persona.email || '';
      const serviceName = r.Solicitud?.Servicio?.nombre || 'Consulta Odontológica Especializada';
      const originalPrice = r.Solicitud?.Servicio?.Tarifas[0] ? Number(r.Solicitud.Servicio.Tarifas[0].precio) : undefined;
      const branchName = r.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal';
      const professionalName = `Esp. ${r.Opcion?.Disponibilidad?.Profesional?.apellidos || 'Torres'}`;
      const reservationDateStr = apptDate.toISOString().split('T')[0];
      const orderCode = `ORD-${String(r.id_reserva).padStart(5, '0')}-${apptDate.getUTCFullYear()}`;
      const reservationTimeStr = r.Opcion?.Disponibilidad?.hora_inicio
        ? r.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16)
        : '15:00';
      const amountToPay = Number(r.Opcion?.precio_ofrecido || 150.00);

      // Revisar si ya se enviaron notificaciones previas en Incidencias/Interacciones
      const sentStage1 = r.Incidencias.some(inc => inc.descripcion?.includes('NOTIFICACION_ETAPA_1_PREVENTIVA'));
      const sentStage2 = r.Incidencias.some(inc => inc.descripcion?.includes('NOTIFICACION_ETAPA_2_URGENCIA'));

      // Etapa 3: Vencimiento a las 00:00 hrs del día de la cita (cancelación y liberación de cupo)
      if (rules.auto_cancelar_medianoche && hoursUntilMidnightDeadline <= 0) {
        await prisma.reservas.update({
          where: { id_reserva: r.id_reserva },
          data: { 
            estado: 'Vencida',
            ultima_alerta_dunning: 'T-00:00 Cancelación Automática'
          }
        });

        if (r.Opcion?.Disponibilidad?.id_disponibilidad) {
          await prisma.disponibilidad.update({
            where: { id_disponibilidad: r.Opcion.Disponibilidad.id_disponibilidad },
            data: { estado: 'Disponible' }
          });
          freedCount++;
        }

        try {
          await prisma.incidencias.create({
            data: {
              id_persona: r.id_persona,
              id_reserva: r.id_reserva,
              tipo: 'AUTO_CANCELACION',
              motivo_tipificado: 'Cancelación Automática por Vencimiento de Plazo',
              descripcion: `ETAPA_3_CANCELACION: Plazo límite de abono expirado (00:00 hrs del ${reservationDateStr}). Sillón liberado automáticamente.`,
              estado: 'Cerrada'
            }
          });
        } catch (e) {
          console.warn('⚠️ No se pudo registrar incidencia de dunning:', e);
        }

        let emailSent = false;
        if (rules.email_activo && patientEmail) {
          const cancelHtmlMessage = `
            Estimado(a) <strong>${patientName}</strong>,<br/><br/>
            Le informamos que su cita programada para el día <strong>${reservationDateStr}</strong> a las <strong>${reservationTimeStr} hrs</strong> con el <strong>${professionalName}</strong> en nuestra <strong>${branchName}</strong> ha sido <strong>CANCELADA AUTOMÁTICAMENTE</strong> por nuestro sistema al no registrarse el abono correspondiente antes del plazo límite (00:00 hrs del día de hoy).<br/><br/>
            El sillón odontológico ha sido puesto a disposición de otros pacientes en lista de espera.<br/><br/>
            Si desea reagendar una nueva fecha de atención, por favor contáctenos a nuestra central de atención o ingrese a nuestro portal.
          `;

          const emailRes = await sendPaymentNoticeOrConfirmation({
            toEmail: patientEmail,
            patientName,
            documentNumber: r.Persona.dni,
            phone: r.Persona.numero,
            subject: `Aviso de Cancelación de Cita Odontológica - NexoSalud (${reservationDateStr})`,
            message: cancelHtmlMessage,
            amount: amountToPay,
            originalPrice,
            serviceName,
            reservationDate: reservationDateStr,
            reservationTime: reservationTimeStr,
            branch: branchName,
            professional: professionalName,
            isValidated: false,
            includePdf: false
          });
          emailSent = emailRes.success;
        }

        stage3Count++;
        logs.push({
          reservationId: r.id_reserva,
          patientName,
          stage: 'ETAPA_3_CANCELACION',
          details: `Cita cancelada a las 00:00 hrs. Sillón liberado para reasignación.`,
          emailSent,
          emailRecipient: patientEmail,
          sentAt: now.toISOString()
        });
        continue;
      }

      // Etapa 2: Ventana de urgencia (dinámica según configuración del agente)
      if (hoursUntilMidnightDeadline <= rules.etapa2_urgencia_horas && hoursUntilMidnightDeadline > 0 && !sentStage2) {
        let emailSent = false;
        if (rules.email_activo && patientEmail) {
          const urgencyMessage = `
            Estimado(a) <strong>${patientName}</strong>,<br/><br/>
            Le informamos que el sillón odontológico para su cita de <strong>${serviceName}</strong> con el <strong>${professionalName}</strong> programada para mañana <strong>${reservationDateStr} (${reservationTimeStr} hrs)</strong> se encuentra en <strong>RESERVA TEMPORAL</strong>.<br/><br/>
            Para evitar que el sistema libere automáticamente su cupo a las <strong>00:00 horas</strong> a otro paciente en espera, por favor confirme su abono de <strong>S/ ${amountToPay.toFixed(2)}</strong> hoy mediante Yape o transferencia bancaria.<br/><br/>
            Adjunto encontrará su Orden de Pago con el importe pendiente.
          `;

          const emailRes = await sendPaymentNoticeOrConfirmation({
            toEmail: patientEmail,
            patientName,
            documentNumber: r.Persona.dni,
            phone: r.Persona.numero,
            subject: `⚠️ URGENTE: Confirmación Requerida para su Cita de Mañana - NexoSalud`,
            message: urgencyMessage,
            amount: amountToPay,
            originalPrice,
            serviceName,
            reservationDate: reservationDateStr,
            reservationTime: reservationTimeStr,
            branch: branchName,
            professional: professionalName,
            isValidated: false,
            code: orderCode
          });
          emailSent = emailRes.success;
        }

        // Envío multicanal mediante WhatsApp con enlace de pago y opción de prórroga
        let waSent = false;
        if (rules.whatsapp_activo && r.Persona.numero) {
          try {
            const waRes = await WhatsAppService.sendDunningUrgencyWhatsApp({
              toPhone: r.Persona.numero,
              patientName,
              serviceName,
              amount: amountToPay,
              orderCode,
              reservaId: r.id_reserva,
              dueDateStr: reservationDateStr,
              appointmentDateStr: reservationDateStr,
              appointmentTimeStr: reservationTimeStr
            });
            waSent = waRes.success;
          } catch (waErr) {
            console.warn('⚠️ No se pudo enviar WhatsApp de dunning:', waErr);
          }
        }

        await prisma.reservas.update({
          where: { id_reserva: r.id_reserva },
          data: {
            ultima_alerta_dunning: `T-${rules.etapa2_urgencia_horas}h Urgencia Clínica`
          }
        });

        await prisma.incidencias.create({
          data: {
            id_persona: r.id_persona,
            id_reserva: r.id_reserva,
            tipo: 'DUNNING_URGENCY',
            motivo_tipificado: `Alerta Dunning T-${rules.etapa2_urgencia_horas}h Urgencia`,
            descripcion: `NOTIFICACION_ETAPA_2_URGENCIA: Alerta de vencimiento enviada a ${patientEmail || 'Email N/D'} y WhatsApp ${r.Persona.numero || 'N/D'}.`,
            estado: 'Abierta'
          }
        });

        stage2Count++;
        logs.push({
          reservationId: r.id_reserva,
          patientName,
          stage: 'ETAPA_2_URGENCIA',
          details: `Alerta de urgencia (vencimiento hoy a las 23:59) enviada (Email: ${emailSent ? 'OK' : 'N/D'}, WhatsApp: ${waSent ? 'OK' : 'N/D'}).`,
          emailSent,
          emailRecipient: patientEmail,
          sentAt: now.toISOString()
        });
        continue;
      }

      // Etapa 1: Ventana preventiva (dinámica según configuración del agente)
      if (hoursUntilMidnightDeadline <= rules.etapa1_preventivo_horas && hoursUntilMidnightDeadline > rules.etapa2_urgencia_horas && !sentStage1) {
        let emailSent = false;
        if (rules.email_activo && patientEmail) {
          const friendlyMessage = `
            Estimado(a) <strong>${patientName}</strong>,<br/><br/>
            Esperamos que se encuentre muy bien. Le saludamos cordialmente de la Clínica Odontológica NexoSalud.<br/><br/>
            Le recordamos que tiene una cita programada de <strong>${serviceName}</strong> con el <strong>${professionalName}</strong> para el día <strong>${reservationDateStr}</strong> a las <strong>${reservationTimeStr} hrs</strong> en nuestra <strong>${branchName}</strong>.<br/><br/>
            Para garantizar la reserva de su horario y la preparación de los insumos clínicos, puede regularizar su abono de <strong>S/ ${amountToPay.toFixed(2)}</strong> a través de nuestros canales oficiales (Yape o Transferencia).<br/><br/>
            Adjunto encontrará su Orden de Pago en PDF. ¡Quedamos atentos para recibirle!
          `;

          const emailRes = await sendPaymentNoticeOrConfirmation({
            toEmail: patientEmail,
            patientName,
            documentNumber: r.Persona.dni,
            phone: r.Persona.numero,
            subject: `Recordatorio Preventivo de Cita Odontológica - NexoSalud (${reservationDateStr})`,
            message: friendlyMessage,
            amount: amountToPay,
            originalPrice,
            serviceName,
            reservationDate: reservationDateStr,
            reservationTime: reservationTimeStr,
            branch: branchName,
            professional: professionalName,
            isValidated: false,
            code: orderCode
          });
          emailSent = emailRes.success;
        }

        await prisma.reservas.update({
          where: { id_reserva: r.id_reserva },
          data: {
            ultima_alerta_dunning: `T-${rules.etapa1_preventivo_horas}h Preventivo`
          }
        });

        await prisma.incidencias.create({
          data: {
            id_persona: r.id_persona,
            id_reserva: r.id_reserva,
            tipo: 'DUNNING_REMINDER',
            motivo_tipificado: `Recordatorio Dunning T-${rules.etapa1_preventivo_horas}h Preventivo`,
            descripcion: `NOTIFICACION_ETAPA_1_PREVENTIVA: Recordatorio cordial enviado a ${patientEmail}.`,
            estado: 'Abierta'
          }
        });

        stage1Count++;
        logs.push({
          reservationId: r.id_reserva,
          patientName,
          stage: 'ETAPA_1_PREVENTIVO',
          details: `Recordatorio preventivo (T-48h) enviado por correo.`,
          emailSent,
          emailRecipient: patientEmail,
          sentAt: now.toISOString()
        });
        continue;
      }

      // Sin acción requerida en este ciclo
      logs.push({
        reservationId: r.id_reserva,
        patientName,
        stage: 'SIN_ACCION',
        details: `Cita para ${reservationDateStr} (${hoursUntilMidnightDeadline.toFixed(1)}h restantes). Dentro del margen regular.`,
        emailSent: false,
        sentAt: now.toISOString()
      });
    }

    // Obtener los cobros automáticos para auditoría en el modal del Cron Job
    let scheduledCobrosRaw: any[] = [];
    if (typeof process.env.VITEST === 'undefined') {
      try {
        scheduledCobrosRaw = await ScheduledNoticeService.listarTodas(50);
      } catch (scErr) {
        console.warn('No se pudo listar cobros programados para auditoría:', scErr);
      }
    }

    const scheduledCobrosList = (scheduledCobrosRaw || []).map(sc => ({
      id: sc.id_notificacion,
      reservationId: sc.id_reserva,
      patientName: sc.Persona ? `${sc.Persona.nombres} ${sc.Persona.apellidos}` : 'Paciente',
      patientPhone: sc.Persona?.numero,
      patientEmail: sc.email_destinatario || sc.Persona?.email,
      documentNumber: sc.Persona?.dni,
      amount: Number(sc.monto_cobro),
      scheduledDate: sc.fecha_hora_programada ? sc.fecha_hora_programada.toISOString() : null,
      status: sc.estado, // PROGRAMADO, ENVIADO, CANCELADO, FALLIDO
      sentAt: sc.fecha_envio_real ? sc.fecha_envio_real.toISOString() : null,
      serviceName: sc.Reserva?.Solicitud?.Servicio?.nombre || 'Tratamiento Dental',
      branch: sc.Reserva?.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal',
      professional: sc.Reserva?.Opcion?.Disponibilidad?.Profesional ? `Dr. ${sc.Reserva.Opcion.Disponibilidad.Profesional.nombres} ${sc.Reserva.Opcion.Disponibilidad.Profesional.apellidos}` : 'Especialista',
      createdBy: sc.creado_por || 'Agente IA',
      customMessage: sc.mensaje_personalizado,
    }));

    const scheduledCobrosExecuted = scheduledCobrosList.filter(sc => sc.status === 'ENVIADO').length;
    const scheduledCobrosPending = scheduledCobrosList.filter(sc => sc.status === 'PROGRAMADO').length;

    // Agregar cobros automáticos a los logs de la consola Live Tail
    for (const sc of scheduledCobrosList) {
      logs.push({
        reservationId: sc.reservationId,
        patientName: sc.patientName,
        stage: 'COBRO_AUTOMATICO',
        details: sc.status === 'ENVIADO'
          ? `[COBRO AUTOMÁTICO EJECUTADO] S/ ${sc.amount.toFixed(2)} conciliado y aprobado en SQL Server. Constancia Oficial PDF despachada a Gmail.`
          : sc.status === 'PROGRAMADO'
          ? `[COBRO PROGRAMADO PENDIENTE] Programado para ${sc.scheduledDate ? new Date(sc.scheduledDate).toLocaleString('es-PE') : 'fecha acordada'} por S/ ${sc.amount.toFixed(2)}.`
          : `[COBRO CANCELADO/INACTIVO] Programación cancelada o sustituida por nuevo acuerdo.`,
        emailSent: sc.status === 'ENVIADO',
        emailRecipient: sc.patientEmail,
        sentAt: sc.sentAt || sc.scheduledDate || now.toISOString(),
        amount: sc.amount,
        channel: 'Gmail Constancia PDF',
        status: sc.status,
      });
    }

    const result: DunningCycleResult = {
      timestamp: now.toISOString(),
      evaluatedReservations: reservas.length,
      stage1RemindersSent: stage1Count,
      stage2UrgenciesSent: stage2Count,
      stage3CancellationsProcessed: stage3Count,
      freedSlots: freedCount,
      scheduledCobrosCount: scheduledCobrosList.length,
      scheduledCobrosExecuted,
      scheduledCobrosPending,
      scheduledCobros: scheduledCobrosList,
      logs
    };

    lastExecutionStats = result;
    return result;
  } catch (error: any) {
    console.error('Error ejecutando ciclo de dunning:', error);
    throw error;
  }
}

export function getLastExecutionStats(): DunningCycleResult | null {
  return lastExecutionStats;
}

/**
 * Inicia el cron de cobranza automática periódica (cada 15 minutos y a medianoche)
 */
export function startDunningScheduler() {
  if (process.env.DUNNING_ENABLED?.trim().toLowerCase() === 'false') {
    console.log('[Dunning Scheduler] Desactivado por configuracion local (DUNNING_ENABLED=false).');
    return;
  }

  console.log('⚡ [Dunning Scheduler] Inicializando motor de cobranza automática en 3 etapas...');

  // Ejecutar un ciclo inicial al arrancar el servidor
  runDunningCycle()
    .then(stats => {
      console.log(`✅ [Dunning Scheduler] Ciclo inicial completado: ${stats.evaluatedReservations} evaluadas, ${stats.stage1RemindersSent} preventivas, ${stats.stage2UrgenciesSent} urgencias, ${stats.stage3CancellationsProcessed} canceladas.`);
    })
    .catch(err => {
      console.error('❌ [Dunning Scheduler] Error en ciclo inicial:', err);
    });

  // Ejecutar periódicamente:
  // - Cada 30 segundos (TICK_INTERVAL_MS): escaneo de alta precisión de Cobros Automáticos Programados para despachar exactamente a su Fecha y Hora Programada
  // - Cada 15 minutos (30 ticks): escaneo completo del ciclo de cobranza de 3 etapas (T-48h, T-24h y 00:00h)
  let tickCounter = 0;
  const TICK_INTERVAL_MS = 30 * 1000; // 30 segundos
  const TICKS_FOR_FULL_DUNNING = 30;  // 30 * 30s = 15 minutos

  setInterval(async () => {
    tickCounter++;
    try {
      // 1. Siempre evaluar notificaciones de cobro programadas cuya fecha y hora exacta ya llegó
      let processedAny = false;
      if (typeof process.env.VITEST === 'undefined') {
        const res = await ScheduledNoticeService.procesarPendientes().catch(e => {
          console.error('❌ [Dunning Scheduler] Error procesando notificaciones programadas:', e);
          return { procesadas: 0 };
        });
        if (res && res.procesadas > 0) {
          processedAny = true;
          console.log(`⏰ [Dunning Scheduler] ¡Hora exacta alcanzada! Despachados ${res.procesadas} cobros automáticos programados con constancia PDF.`);
        }
      }

      // Si se despachó alguna notificación a su hora exacta o es el tick de los 15 minutos:
      if (processedAny || (tickCounter % TICKS_FOR_FULL_DUNNING === 0)) {
        if (tickCounter % TICKS_FOR_FULL_DUNNING === 0) {
          console.log('⏰ [Dunning Scheduler] Ejecutando escaneo periódico completo de reservas...');
        }
        const stats = await runDunningCycle();
        if (processedAny) {
          console.log(`🚀 [Dunning Scheduler] Cobro programado ejecutado y auditoría actualizada en tiempo real.`);
        } else {
          console.log(`✅ [Dunning Scheduler] Ciclo periódico finalizado: ${stats.stage3CancellationsProcessed} canceladas, ${stats.freedSlots} sillones liberados.`);
        }
      }
    } catch (err) {
      console.error('❌ [Dunning Scheduler] Error en ciclo periódico:', err);
    }
  }, TICK_INTERVAL_MS);
}

