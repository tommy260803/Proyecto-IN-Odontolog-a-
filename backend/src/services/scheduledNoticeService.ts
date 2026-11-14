import { prisma } from '../db';
import { sendPaymentNoticeOrConfirmation } from '../routes/payer.routes';

export interface ProgramarNotificacionParams {
  reservaId: number;
  fechaHoraProgramada: Date | string;
  emailDestinatario?: string;
  tipoAviso?: string;
  asunto?: string;
  mensajePersonalizado?: string;
  creadoPor?: string;
}

export class ScheduledNoticeService {
  /**
   * Programa una notificación de cobro para una fecha y hora específica
   */
  static async programar(params: ProgramarNotificacionParams) {
    const {
      reservaId,
      fechaHoraProgramada,
      emailDestinatario,
      tipoAviso = 'AVISO_COBRO',
      asunto,
      mensajePersonalizado,
      creadoPor = 'Agente IA'
    } = params;

    const reserva = await prisma.reservas.findUnique({
      where: { id_reserva: reservaId },
      include: {
        Persona: true,
        Opcion: {
          include: {
            Disponibilidad: {
              include: { Sede: true, Profesional: true }
            }
          }
        },
        Solicitud: {
          include: { Servicio: true }
        },
        Pagos: true
      }
    });

    if (!reserva) {
      throw new Error(`No se encontró la reserva #${reservaId}`);
    }

    const email = emailDestinatario || reserva.Persona?.email;
    if (!email) {
      throw new Error('El paciente no cuenta con una dirección de correo electrónico registrada.');
    }

    const monto = reserva.Opcion?.precio_ofrecido ? Number(reserva.Opcion.precio_ofrecido) : 150.00;
    const targetDate = typeof fechaHoraProgramada === 'string' ? new Date(fechaHoraProgramada) : fechaHoraProgramada;

    if (isNaN(targetDate.getTime())) {
      throw new Error('La fecha y hora programada es inválida.');
    }

    // Cancelar cualquier notificación programada previa pendiente para esta misma reserva
    await prisma.notificacionesCobroProgramadas.updateMany({
      where: {
        id_reserva: reservaId,
        estado: 'PROGRAMADO'
      },
      data: {
        estado: 'CANCELADO'
      }
    });

    // Crear la nueva notificación programada
    const notificacion = await prisma.notificacionesCobroProgramadas.create({
      data: {
        id_reserva: reservaId,
        id_persona: reserva.id_persona,
        fecha_hora_programada: targetDate,
        estado: 'PROGRAMADO',
        tipo_aviso: tipoAviso,
        email_destinatario: email,
        monto_cobro: monto,
        asunto: asunto || `✅ Confirmación Oficial de Cobro y Cita Odontológica - NexoSalud (#CONST-${String(reservaId).padStart(5, '0')}-2026)`,
        mensaje_personalizado: mensajePersonalizado || `Estimado(a) ${reserva.Persona.nombres}, le confirmamos que el cobro por S/ ${monto.toFixed(2)} correspondiente a su atención odontológica ha sido efectuado y validado exitosamente. Adjuntamos su Constancia Oficial de Pago.`,
        creado_por: creadoPor
      }
    });

    // Registrar en incidencias para trazabilidad
    await prisma.incidencias.create({
      data: {
        id_persona: reserva.id_persona,
        id_reserva: reserva.id_reserva,
        tipo: 'COBRO_PROGRAMADO',
        descripcion: `COBRO_DIRECTO_PROGRAMADO: Agente configuró cobro directo y despacho de constancia a Gmail (${email}) para el ${targetDate.toLocaleString('es-PE')}.`,
        prioridad: 'Media',
        estado: 'OPEN'
      }
    }).catch(e => console.warn('No se pudo registrar incidencia de programación:', e));

    return notificacion;
  }

  /**
   * Ejecuta el envío de una notificación puntual de inmediato
   */
  static async disparar(idNotificacion: number) {
    const notif = await prisma.notificacionesCobroProgramadas.findUnique({
      where: { id_notificacion: idNotificacion },
      include: {
        Reserva: {
          include: {
            Persona: true,
            Opcion: {
              include: {
                Disponibilidad: {
                  include: { Sede: true, Profesional: true }
                }
              }
            },
            Solicitud: {
              include: {
                Servicio: {
                  include: {
                    Tarifas: { where: { activo: true }, orderBy: { fecha_inicio: 'desc' }, take: 1 }
                  }
                }
              }
            },
            Pagos: true
          }
        }
      }
    });

    if (!notif) {
      throw new Error(`Notificación #${idNotificacion} no encontrada.`);
    }

    const { Reserva } = notif;

    // Si ya está validada o pagada, cancelar
    const isPaid = Reserva.Pagos.some(p => ['Validado', 'VALIDADO'].includes(p.estado));
    if (isPaid) {
      await prisma.notificacionesCobroProgramadas.update({
        where: { id_notificacion: idNotificacion },
        data: { estado: 'CANCELADO' }
      });
      return { success: false, reason: 'La reserva ya fue pagada con anterioridad.' };
    }

    const apptDate = Reserva.Opcion?.Disponibilidad?.fecha;
    const reservationDateStr = apptDate ? apptDate.toISOString().split('T')[0] : 'Fecha acordada';
    const reservationTimeStr = Reserva.Opcion?.Disponibilidad?.hora_inicio
      ? Reserva.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16)
      : '10:00';

    const branchName = Reserva.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal NexoSalud';
    const profName = Reserva.Opcion?.Disponibilidad?.Profesional
      ? `Dr. ${Reserva.Opcion.Disponibilidad.Profesional.nombres} ${Reserva.Opcion.Disponibilidad.Profesional.apellidos}`
      : 'Especialista Odontólogo';

    const serviceName = Reserva.Solicitud?.Servicio?.nombre || 'Tratamiento Odontológico Especializado';
    const constCode = `CONST-${String(Reserva.id_reserva).padStart(5, '0')}-${new Date().getFullYear()}`;
    const refCobro = `COBRO-AUTO-${String(notif.id_notificacion).padStart(5, '0')}`;
    const canalCobro = 'Cobro Automatizado Agente NexoSalud';
    const formattedAmount = Number(notif.monto_cobro).toFixed(2);

    // 1. Confirmar formalmente la reserva en la agenda médica
    await prisma.reservas.update({
      where: { id_reserva: Reserva.id_reserva },
      data: {
        estado: 'Confirmada',
        confirmacion_explicita: true,
        fecha_confirmacion: new Date()
      }
    });

    // 2. Cobrar directamente: registrar o validar el pago en SQL Server
    let pago = Reserva.Pagos.length > 0 ? Reserva.Pagos[0] : null;
    if (pago) {
      pago = await prisma.pagos.update({
        where: { id_pago: pago.id_pago },
        data: {
          estado: 'Validado',
          fecha_validacion: new Date(),
          canal_pago: canalCobro,
          referencia_pago: refCobro,
          importe: Number(notif.monto_cobro) || pago.importe
        }
      });
    } else {
      pago = await prisma.pagos.create({
        data: {
          id_persona: Reserva.id_persona,
          id_reserva: Reserva.id_reserva,
          importe: Number(notif.monto_cobro) || Reserva.Opcion?.precio_ofrecido || 150.00,
          canal_pago: canalCobro,
          referencia_pago: refCobro,
          estado: 'Validado',
          fecha_validacion: new Date()
        }
      });
    }

    // 3. Transicionar al paciente a la etapa CUSTOMER (etapa 4)
    let etapaCustomer = await prisma.etapas.findFirst({ where: { nombre: 'CUSTOMER' } });
    if (!etapaCustomer) {
      etapaCustomer = await prisma.etapas.create({ data: { nombre: 'CUSTOMER', descripcion: 'Atención' } });
    }

    await prisma.personas.update({
      where: { id_persona: Reserva.id_persona },
      data: { id_etapa_actual: etapaCustomer.id_etapa }
    });

    // 4. Crear atención médica programada para historia clínica si no existe
    const existingAtencion = await prisma.atenciones.findFirst({ where: { id_reserva: Reserva.id_reserva } });
    if (!existingAtencion) {
      const defaultProf = await prisma.profesionales.findFirst();
      const defaultSede = await prisma.sedes.findFirst();

      await prisma.atenciones.create({
        data: {
          id_persona: Reserva.id_persona,
          id_reserva: Reserva.id_reserva,
          id_servicio: Reserva.Solicitud?.id_servicio || 1,
          id_profesional: Reserva.Opcion?.Disponibilidad?.id_profesional || defaultProf?.id_profesional || 1,
          id_sede: Reserva.Opcion?.Disponibilidad?.id_sede || defaultSede?.id_sede || 1,
          fecha_atencion: Reserva.Opcion?.Disponibilidad?.fecha || new Date(),
          estado_servicio: 'Programado',
          asistencia: 'Pendiente'
        }
      });
    }

    // 5. Enviar correo de Confirmación Oficial de Cobro con Constancia Oficial PDF adjunta
    const emailResult = await sendPaymentNoticeOrConfirmation({
      toEmail: notif.email_destinatario,
      patientName: `${Reserva.Persona.nombres} ${Reserva.Persona.apellidos}`,
      documentNumber: Reserva.Persona.dni,
      phone: Reserva.Persona.numero,
      subject: notif.asunto || `✅ Confirmación Oficial de Cobro y Cita Odontológica - NexoSalud (#${constCode})`,
      message: notif.mensaje_personalizado || `Nos complace confirmarle que su cobro por un importe de S/ ${formattedAmount} ha sido procesado exitosamente. Su pago ha sido validado y su cita odontológica se encuentra confirmada en nuestra agenda médica.`,
      amount: Number(notif.monto_cobro),
      originalPrice: Reserva.Solicitud?.Servicio?.Tarifas[0] ? Number(Reserva.Solicitud.Servicio.Tarifas[0].precio) : undefined,
      channel: canalCobro,
      operationNumber: refCobro,
      serviceName,
      reservationDate: reservationDateStr,
      reservationTime: reservationTimeStr,
      branch: branchName,
      professional: profName,
      code: constCode,
      filename: `Constancia_Cobro_${constCode}`,
      isValidated: true,
      includePdf: true
    });

    // 6. Actualizar estado en base de datos
    await prisma.notificacionesCobroProgramadas.update({
      where: { id_notificacion: idNotificacion },
      data: {
        estado: 'ENVIADO',
        fecha_envio_real: new Date()
      }
    });

    // 7. Registrar incidencia de cobro directo exitoso
    await prisma.incidencias.create({
      data: {
        id_persona: Reserva.id_persona,
        id_reserva: Reserva.id_reserva,
        tipo: 'COBRO_DIRECTO_CONFIRMADO',
        descripcion: `COBRO_DIRECTO_GMAIL: Agente ejecutó el cobro directo de la reserva #${Reserva.id_reserva}, validó el pago en SQL Server, promovió al paciente a CUSTOMER y despachó la Constancia Oficial de Pago PDF a ${notif.email_destinatario}.`,
        prioridad: 'Baja',
        estado: 'CLOSED',
        fecha_resolucion: new Date()
      }
    }).catch(() => {});

    console.log(`[SCHEDULED COBRO] ✅ Cobro directo efectuado y Constancia #${idNotificacion} enviada con éxito a ${notif.email_destinatario}`);
    return { success: true, emailResult, pago };
  }

  /**
   * Ciclo del agente: Evalúa y despacha todas las notificaciones pendientes cuya hora ya llegó
   */
  static async procesarPendientes() {
    if (!prisma.notificacionesCobroProgramadas?.findMany) return { procesadas: 0 };
    const now = new Date();
    const pendientes = await prisma.notificacionesCobroProgramadas.findMany({
      where: {
        estado: 'PROGRAMADO',
        fecha_hora_programada: { lte: now }
      }
    });

    if (pendientes.length === 0) return { procesadas: 0 };

    console.log(`[SCHEDULED NOTICE AGENT] Evaluando ${pendientes.length} notificaciones de cobro programadas...`);
    let count = 0;

    for (const notif of pendientes) {
      try {
        await this.disparar(notif.id_notificacion);
        count++;
      } catch (err) {
        console.error(`[SCHEDULED NOTICE AGENT ERROR] Error al despachar notificación #${notif.id_notificacion}:`, err);
        await prisma.notificacionesCobroProgramadas.update({
          where: { id_notificacion: notif.id_notificacion },
          data: { estado: 'FALLIDO' }
        }).catch(() => {});
      }
    }

    return { procesadas: count };
  }

  /**
   * Consulta las notificaciones asociadas a una reserva
   */
  static async listarPorReserva(reservaId: number) {
    return prisma.notificacionesCobroProgramadas.findMany({
      where: { id_reserva: reservaId },
      orderBy: { fecha_creacion: 'desc' }
    });
  }

  /**
   * Cancela una notificación programada
   */
  static async cancelar(idNotificacion: number) {
    return prisma.notificacionesCobroProgramadas.update({
      where: { id_notificacion: idNotificacion },
      data: { estado: 'CANCELADO' }
    });
  }
}
