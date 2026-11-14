import { prisma } from '../db';
import { DunningConfigService } from './dunningConfigService';

export interface SendWhatsAppParams {
  toPhone: string;
  patientName: string;
  message?: string;
  orderCode?: string;
  reservaId?: number;
  amount?: number;
  serviceName?: string;
  dueDateStr?: string;
  appointmentTimeStr?: string;
  appointmentDateStr?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  provider: 'openwa' | 'simulation';
  recipient: string;
  originalPatientNumber: string;
  isRedirected: boolean;
  messageId?: string;
  message?: string;
}

export class WhatsAppService {
  private static getOpenWaUrl(): string {
    return process.env.OPENWA_API_URL || 'http://127.0.0.1:2785';
  }

  private static getApiKey(): string {
    return process.env.OPENWA_API_KEY || 'owa_k1_c2ddc9826fb622c16101ad7e5b841bb2232ea34a9d5fc1117bd98ba6f75d50e2';
  }

  private static getSessionName(): string {
    return process.env.OPENWA_SESSION_NAME || 'nexosalud';
  }

  /**
   * Limpia y formatea el número a formato internacional estándar (Perú: 51XXXXXXXXX)
   */
  public static formatPhoneNumber(phone: string): string {
    const clean = (phone || '').replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 9 && clean.startsWith('9')) {
      return `51${clean}`;
    }
    return clean;
  }

  /**
   * Obtiene el número destino efectivo respetando TEST_RECEIVER_NUMBER en desarrollo
   */
  public static getEffectiveRecipient(patientPhone: string): { targetNumber: string; isRedirected: boolean } {
    const isDev = process.env.NODE_ENV !== 'production' || process.env.FORCE_DEV_REDIRECT === 'true' || !process.env.FORCE_PROD_NUMBERS;
    const testNumber = process.env.TEST_RECEIVER_NUMBER || '51987654321';
    
    const formattedPatient = this.formatPhoneNumber(patientPhone);
    const formattedTest = this.formatPhoneNumber(testNumber);

    const targetNumber = isDev ? formattedTest : (formattedPatient || formattedTest);
    const isRedirected = isDev && targetNumber !== formattedPatient;

    return { targetNumber, isRedirected };
  }

  /**
   * Asegura que la sesión de WhatsApp exista en OpenWA
   */
  public static async ensureSession(): Promise<string> {
    const baseUrl = this.getOpenWaUrl();
    const apiKey = this.getApiKey();
    const sessionName = this.getSessionName();

    try {
      const listRes = await fetch(`${baseUrl}/api/sessions`, {
        headers: { 'x-api-key': apiKey }
      });
      if (listRes.ok) {
        const sessions: any = await listRes.json();
        const found = sessions.find((s: any) => s.name === sessionName);
        if (found) {
          return found.id || found.name;
        }

        // Crear sesión si no existe
        const createRes = await fetch(`${baseUrl}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({ name: sessionName })
        });
        if (createRes.ok) {
          const created: any = await createRes.json();
          return created.id || created.name;
        }
      }
    } catch (e: any) {
      console.warn('⚠️ [OPENWA] Error verificando sesión:', e.message);
    }
    return sessionName;
  }

  /**
   * Obtiene el estado actual de la sesión en el contenedor OpenWA
   */
  public static async getSessionStatus(): Promise<any> {
    const baseUrl = this.getOpenWaUrl();
    const apiKey = this.getApiKey();
    const sessionName = this.getSessionName();

    try {
      const sessionId = await this.ensureSession();
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
        headers: { 'x-api-key': apiKey }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e: any) {
      return { status: 'offline', error: e.message };
    }
    return { status: 'unknown' };
  }

  /**
   * Obtiene el código QR de vinculación en base64 o texto
   */
  public static async getSessionQr(): Promise<{ qr?: string; status?: string; message?: string }> {
    const baseUrl = this.getOpenWaUrl();
    const apiKey = this.getApiKey();

    try {
      const sessionId = await this.ensureSession();
      // Iniciar sesión si aún no está iniciada
      await fetch(`${baseUrl}/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey }
      }).catch(() => null);

      // Consultar QR
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/qr`, {
        headers: { 'x-api-key': apiKey }
      });

      if (res.ok) {
        const data: any = await res.json();
        return { qr: data.qr || data.data || data, status: 'scan_qr' };
      }
    } catch (e: any) {
      return { message: e.message };
    }
    return { message: 'El QR no está disponible o la sesión ya está conectada.' };
  }

  /**
   * Registra el webhook hacia el backend de NexoSalud en OpenWA
   */
  public static async registerWebhook(): Promise<boolean> {
    const baseUrl = this.getOpenWaUrl();
    const apiKey = this.getApiKey();
    const webhookUrl = process.env.OPENWA_WEBHOOK_URL || 'http://host.docker.internal:3001/api/whatsapp/webhook';

    try {
      const sessionId = await this.ensureSession();
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: ['message.received', 'session.status']
        })
      });

      return res.ok || res.status === 409;
    } catch (_) {
      return false;
    }
  }

  /**
   * Envía un mensaje de texto por WhatsApp a través del contenedor externo OpenWA
   */
  public static async sendTextMessage(phone: string, text: string): Promise<WhatsAppSendResult> {
    const { targetNumber, isRedirected } = this.getEffectiveRecipient(phone);
    const formattedPatient = this.formatPhoneNumber(phone);
    const openwaUrl = this.getOpenWaUrl();
    const apiKey = this.getApiKey();
    const isEnabled = process.env.WHATSAPP_ENABLED !== 'false';

    const chatId = `${targetNumber}@c.us`;

    if (isRedirected) {
      console.log(`[WHATSAPP DISPATCHER - DEV MODE] Redirigiendo mensaje de paciente (${formattedPatient}) hacia TEST_RECEIVER_NUMBER (${targetNumber})`);
    }

    // Envío por API a la instancia de OpenWA
    if (isEnabled && openwaUrl) {
      try {
        const sessionId = await this.ensureSession();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);

        // Intento primario con endpoint de mensajería moderno
        const res = await fetch(`${openwaUrl}/api/sessions/${sessionId}/messages/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({
            chatId,
            text
          }),
          signal: controller.signal
        }).catch(async () => {
          // Fallback para versiones con endpoint legacy (/sendText)
          return await fetch(`${openwaUrl}/sendText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api_key': apiKey,
              'x-api-key': apiKey
            },
            body: JSON.stringify({
              args: { to: chatId, content: text }
            })
          });
        });

        clearTimeout(timeout);

        if (res && res.ok) {
          const data: any = await res.json().catch(() => ({}));
          console.log(`✅ [OPENWA CONTAINER :2785] Mensaje despachado a ${targetNumber}:`, data?.id || 'OK');
          return {
            success: true,
            provider: 'openwa',
            recipient: targetNumber,
            originalPatientNumber: formattedPatient,
            isRedirected,
            messageId: data?.id || data?.messageId || `wa_${Date.now()}`,
            message: 'Mensaje de WhatsApp enviado correctamente.'
          };
        } else if (res) {
          const errBody = await res.text().catch(() => '');
          console.warn(`⚠️ [OPENWA CONTAINER RESPUESTA ${res.status}]:`, errBody.slice(0, 150));
        }
      } catch (err: any) {
        console.warn('⚠️ [OPENWA CONTAINER NO RESPONDE]:', err.message);
      }
    }

    // Modo simulación cuando la instancia no está disponible o requiere vinculación QR
    console.log(`[WHATSAPP DISPATCHER] (Modo Simulación) Mensaje procesado para: ${targetNumber} (Original: ${formattedPatient})`);
    return {
      success: true,
      provider: 'simulation',
      recipient: targetNumber,
      originalPatientNumber: formattedPatient,
      isRedirected,
      messageId: `sim_wa_${Date.now()}`,
      message: 'Mensaje procesado en modo simulación (Sesión WhatsApp pendiente de escaneo QR).'
    };
  }

  /**
   * Genera el mensaje interactivo para Dunning T-24h con opciones de Pago y Prórroga de 24h
   */
  public static async sendDunningUrgencyWhatsApp(params: SendWhatsAppParams): Promise<WhatsAppSendResult> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const paymentUrl = `${frontendUrl}/pasarela-pago/${params.orderCode || ''}`;
    const prorrogaWebUrl = `${frontendUrl}/prorroga-express/${params.reservaId || 0}`;

    const formattedAmount = Number(params.amount || 0).toFixed(2);

    let appointmentTime = params.appointmentTimeStr;
    let appointmentDate = params.appointmentDateStr || params.dueDateStr;

    if ((!appointmentTime || !appointmentDate) && params.reservaId) {
      try {
        const r = await prisma.reservas.findUnique({
          where: { id_reserva: params.reservaId },
          include: { Opcion: { include: { Disponibilidad: true } } }
        });
        if (r?.Opcion?.Disponibilidad?.hora_inicio && !appointmentTime) {
          appointmentTime = r.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16);
        }
        if (r?.Opcion?.Disponibilidad?.fecha && !appointmentDate) {
          appointmentDate = r.Opcion.Disponibilidad.fecha.toISOString().split('T')[0];
        }
      } catch (e) {
        // Ignorar si falla consulta auxiliar
      }
    }

    const timeDisplay = appointmentTime ? `${appointmentTime} hrs` : 'Horario programado';
    const dateDisplay = appointmentDate || 'Fecha acordada';

    const messageText = `
🏥 *CLÍNICA ODONTOLÓGICA NEXOSALUD*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *${params.patientName}*,

Le recordamos que su sillón odontológico reservado para el tratamiento de *${params.serviceName || 'Tratamiento Especializado'}* se encuentra próximo a vencer.

🗓️ *Fecha de cita:* ${dateDisplay}
🕒 *Hora de cita:* ${timeDisplay}
💰 *Monto a regularizar:* S/ ${formattedAmount}
⏰ *Plazo de tolerancia:* Hasta hoy a las 23:59 hrs.

Para asegurar su atención médica y evitar la liberación de su cupo a pacientes en lista de espera:

1️⃣ *Completar Pago en Línea (Yape / Transferencia):*
👉 ${paymentUrl}

2️⃣ *Solicitar Prórroga de 24 horas:*
Responda a este mensaje con la palabra *PRORROGA* o ingrese a este enlace oficial:
👉 ${prorrogaWebUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_NexoSalud Odontología Integral - Atención al Paciente_
    `.trim();

    const result = await this.sendTextMessage(params.toPhone, messageText);

    // Registrar en auditoría de la tabla Interacciones
    if (params.reservaId) {
      try {
        const reserva = await prisma.reservas.findUnique({
          where: { id_reserva: params.reservaId },
          select: { id_persona: true, id_solicitud: true }
        });

        if (reserva) {
          await prisma.interacciones.create({
            data: {
              id_persona: reserva.id_persona,
              id_solicitud: reserva.id_solicitud,
              tipo: 'DUNNING_WHATSAPP_T24',
              mensaje: messageText,
              resultado: result.provider === 'openwa' ? 'Enviado por OpenWA Docker' : 'Simulación de Envío WhatsApp'
            }
          });
        }
      } catch (err) {
        console.warn('⚠️ No se pudo registrar interacción de WhatsApp:', err);
      }
    }

    return {
      ...result,
      messageText
    } as any;
  }

  /**
   * Procesa la solicitud interactiva de prórroga de 24 horas (desde WhatsApp o Web)
   */
  public static async grant24HourExtension(identifier: { reservaId?: number; phone?: string }): Promise<{
    success: boolean;
    message: string;
    nuevoVencimiento?: Date;
    pacienteNombre?: string;
  }> {
    let reserva: any = null;

    if (identifier.reservaId) {
      reserva = await prisma.reservas.findUnique({
        where: { id_reserva: identifier.reservaId },
        include: {
          Persona: true,
          Incidencias: true,
          Opcion: { include: { Disponibilidad: true } }
        }
      });
    } else if (identifier.phone) {
      const cleanPhone = this.formatPhoneNumber(identifier.phone);
      const testPhone = this.formatPhoneNumber(process.env.TEST_RECEIVER_NUMBER || '51987654321');
      const isDev = process.env.NODE_ENV !== 'production' || process.env.FORCE_DEV_REDIRECT === 'true';

      // En desarrollo, si quien escribe es el número de prueba, buscar la reserva pendiente más reciente
      if (isDev && cleanPhone === testPhone) {
        reserva = await prisma.reservas.findFirst({
          where: { estado: { in: ['Pendiente', 'Pre-reservada'] } },
          include: {
            Persona: true,
            Incidencias: true,
            Opcion: { include: { Disponibilidad: true } }
          },
          orderBy: { id_reserva: 'desc' }
        });
      } else {
        const persona = await prisma.personas.findFirst({
          where: {
            OR: [
              { numero: cleanPhone },
              { numero: cleanPhone.replace(/^51/, '') },
              { numero: `+${cleanPhone}` }
            ]
          }
        });

        if (persona) {
          reserva = await prisma.reservas.findFirst({
            where: { id_persona: persona.id_persona, estado: { in: ['Pendiente', 'Pre-reservada'] } },
            include: {
              Persona: true,
              Incidencias: true,
              Opcion: { include: { Disponibilidad: true } }
            },
            orderBy: { id_reserva: 'desc' }
          });
        }
      }
    }

    if (!reserva) {
      return {
        success: false,
        message: 'No se encontró ninguna reserva pendiente sujeta a prórroga.'
      };
    }

    // Regla de Negocio: Máximo 1 prórroga por reserva para evitar abusos
    const yaTieneProrroga = reserva.Incidencias.some((inc: any) => inc.tipo === 'PRORROGA_24H_SOLICITADA');
    if (yaTieneProrroga) {
      return {
        success: false,
        message: 'Ya se concedió previamente una prórroga de 24 horas para esta reserva. Debe regularizar su abono para confirmar su cita.'
      };
    }

    // Extender el vencimiento de bloqueo por las horas configuradas en la BD
    const rules = await DunningConfigService.getRules();
    const extHours = rules.prorroga_express_horas || 24;
    const baseDate = reserva.fecha_vencimiento_bloqueo || new Date();
    const nuevoVencimiento = new Date(baseDate.getTime() + extHours * 60 * 60 * 1000);

    await prisma.reservas.update({
      where: { id_reserva: reserva.id_reserva },
      data: {
        fecha_vencimiento_bloqueo: nuevoVencimiento,
        ultima_alerta_dunning: `Prórroga Concedida (+${extHours}h)`
      }
    });

    // Registrar incidencia de auditoría
    try {
      await prisma.incidencias.create({
        data: {
          id_persona: reserva.id_persona,
          id_reserva: reserva.id_reserva,
          tipo: 'PRORROGA_24H_SOLICITADA',
          motivo_tipificado: 'Prórroga de Pago Solicitada vía WhatsApp',
          descripcion: `Prórroga de ${extHours}h otorgada con éxito. Nuevo vencimiento: ${nuevoVencimiento.toISOString()}`,
          estado: 'Cerrada'
        }
      });

      await prisma.interacciones.create({
        data: {
          id_persona: reserva.id_persona,
          id_solicitud: reserva.id_solicitud,
          tipo: 'PRORROGA_CONCEDIDA',
          mensaje: `Paciente solicitó prórroga. Se extendió el bloqueo hasta ${nuevoVencimiento.toISOString()}`,
          resultado: 'Aprobada automáticamente'
        }
      });
    } catch (e) {
      console.warn('⚠️ Error registrando incidencia de prórroga:', e);
    }

    return {
      success: true,
      message: 'Prórroga de 24 horas concedida exitosamente.',
      nuevoVencimiento,
      pacienteNombre: `${reserva.Persona.nombres} ${reserva.Persona.apellidos}`
    };
  }

  /**
   * Obtiene la información completa de la reserva para la pantalla de prórroga interactiva,
   * sin aplicar ninguna modificación en la base de datos.
   */
  static async getProrrogaInfo(identifier: { reservaId?: number; phone?: string }) {
    let reserva: any = null;

    if (identifier.reservaId) {
      reserva = await prisma.reservas.findUnique({
        where: { id_reserva: Number(identifier.reservaId) },
        include: {
          Persona: true,
          Solicitud: { include: { Servicio: true } },
          Opcion: {
            include: {
              Disponibilidad: {
                include: { Sede: true, Profesional: true }
              }
            }
          },
          Incidencias: true,
          Pagos: true,
        }
      });
    } else if (identifier.phone) {
      const cleanPhone = this.formatPhoneNumber(identifier.phone);
      const testPhone = this.formatPhoneNumber(process.env.TEST_RECEIVER_NUMBER || '51987654321');
      const isDev = process.env.NODE_ENV !== 'production' || process.env.FORCE_DEV_REDIRECT === 'true';

      if (isDev && cleanPhone === testPhone) {
        reserva = await prisma.reservas.findFirst({
          where: { estado: { in: ['Pendiente', 'Pre-reservada'] } },
          include: {
            Persona: true,
            Solicitud: { include: { Servicio: true } },
            Opcion: { include: { Disponibilidad: { include: { Sede: true, Profesional: true } } } },
            Incidencias: true,
            Pagos: true,
          },
          orderBy: { id_reserva: 'desc' }
        });
      } else {
        const persona = await prisma.personas.findFirst({
          where: {
            OR: [
              { numero: cleanPhone },
              { numero: cleanPhone.replace(/^51/, '') },
              { numero: `+${cleanPhone}` }
            ]
          }
        });

        if (persona) {
          reserva = await prisma.reservas.findFirst({
            where: { id_persona: persona.id_persona, estado: { in: ['Pendiente', 'Pre-reservada'] } },
            include: {
              Persona: true,
              Solicitud: { include: { Servicio: true } },
              Opcion: { include: { Disponibilidad: { include: { Sede: true, Profesional: true } } } },
              Incidencias: true,
              Pagos: true,
            },
            orderBy: { id_reserva: 'desc' }
          });
        }
      }
    }

    if (!reserva) {
      return {
        success: false,
        message: 'No se encontró la reserva solicitada o no está disponible para prórroga.'
      };
    }

    const rules = await DunningConfigService.getRules();
    const yaTieneProrroga = reserva.Incidencias.some(
      (inc: any) => inc.tipo === 'PRORROGA_24H_SOLICITADA' || inc.tipo === 'PRORROGA_CONCEDIDA'
    );

    const disp = reserva.Opcion?.Disponibilidad;
    let fechaCitaStr = '';
    if (disp?.fecha) {
      fechaCitaStr = disp.fecha instanceof Date ? disp.fecha.toISOString().slice(0, 10) : String(disp.fecha).slice(0, 10);
    }

    let horaCitaStr = '09:00 - 13:00 (Mañana)';
    if (disp?.hora_inicio) {
      const hInicio = disp.hora_inicio instanceof Date ? disp.hora_inicio.toISOString().slice(11, 16) : '09:00';
      const hFin = disp?.hora_fin instanceof Date ? disp.hora_fin.toISOString().slice(11, 16) : '13:00';
      horaCitaStr = `${hInicio} - ${hFin}`;
    }

    // Fecha prometida de pago: vencimiento de bloqueo o medianoche del día previo a la cita
    let fechaPrometidaPago: Date;
    if (reserva.fecha_vencimiento_bloqueo) {
      fechaPrometidaPago = new Date(reserva.fecha_vencimiento_bloqueo);
    } else if (disp?.fecha) {
      const d = new Date(disp.fecha);
      d.setHours(23, 59, 59, 999);
      d.setDate(d.getDate() - 1);
      fechaPrometidaPago = d;
    } else {
      fechaPrometidaPago = new Date();
    }

    const orderCode = reserva.Pagos?.[0]?.referencia_pago
      || `ORD-${String(reserva.id_reserva).padStart(5, '0')}-${new Date().getFullYear()}`;

    return {
      success: true,
      reserva: {
        id_reserva: reserva.id_reserva,
        codigoReserva: orderCode,
        pacienteNombre: `${reserva.Persona.nombres} ${reserva.Persona.apellidos}`,
        telefono: reserva.Persona.numero,
        email: reserva.Persona.email,
        servicioNombre: reserva.Solicitud?.Servicio?.nombre || 'Evaluación General Odontológica',
        monto: Number(reserva.Opcion?.precio_ofrecido || reserva.Pagos?.[0]?.importe || 150),
        sedeNombre: disp?.Sede?.nombre || 'Sede Central',
        sedeDireccion: disp?.Sede?.direccion || 'Av. Larco 820, Trujillo',
        profesionalNombre: disp?.Profesional ? `${disp.Profesional.nombres} ${disp.Profesional.apellidos}` : 'Especialista Odontológico',
        fechaCitaActual: fechaCitaStr,
        horaCitaActual: horaCitaStr,
        fechaPrometidaPago: fechaPrometidaPago.toISOString(),
        estado: reserva.estado,
        yaTieneProrroga,
      },
      rules: {
        prorroga_express_horas: rules.prorroga_express_horas || 24,
        maxDiasProrroga: 3,
        whatsapp_activo: rules.whatsapp_activo,
      }
    };
  }

  /**
   * Confirma la prórroga autogestionada por el paciente:
   * Reagenda la fecha de la cita en Disponibilidad, amplía el vencimiento en Reservas
   * y registra la incidencia y auditoría en SQL Server.
   */
  static async confirmProrrogaAndReschedule(params: {
    reservaId: number;
    nuevaFechaCita: string;
    nuevoTurno?: string;
    motivo?: string;
  }) {
    const reservaId = Number(params.reservaId);
    if (!reservaId || isNaN(reservaId)) {
      return { success: false, message: 'ID de reserva inválido.' };
    }

    if (!params.nuevaFechaCita || !/^\d{4}-\d{2}-\d{2}$/.test(params.nuevaFechaCita)) {
      return { success: false, message: 'Fecha de cita inválida. Formato esperado YYYY-MM-DD.' };
    }

    const reserva = await prisma.reservas.findUnique({
      where: { id_reserva: reservaId },
      include: {
        Persona: true,
        Solicitud: { include: { Servicio: true } },
        Opcion: {
          include: {
            Disponibilidad: {
              include: { Sede: true, Profesional: true }
            }
          }
        },
        Incidencias: true,
        Pagos: true,
      }
    });

    if (!reserva) {
      return { success: false, message: 'Reserva no encontrada en el sistema.' };
    }

    if (!['Pendiente', 'Pre-reservada', 'PENDIENTE', 'IN_REVIEW', 'En_Revision'].includes(reserva.estado)) {
      return { success: false, message: `La reserva está en estado '${reserva.estado}' y no requiere prórroga.` };
    }

    // Regla Anti-Abuso: Máximo 1 prórroga por reserva
    const yaTieneProrroga = reserva.Incidencias.some(
      (inc: any) => inc.tipo === 'PRORROGA_24H_SOLICITADA' || inc.tipo === 'PRORROGA_CONCEDIDA'
    );
    if (yaTieneProrroga) {
      return {
        success: false,
        message: 'Ya se concedió previamente una prórroga para esta reserva. Debe regularizar su abono para asegurar su sillón odontológico.'
      };
    }

    // Validación de Límites de Fecha: Máximo 3 días desde la fecha prometida de pago
    const targetDate = new Date(`${params.nuevaFechaCita}T12:00:00.000Z`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fecha base prometida
    const baseDueDate = reserva.fecha_vencimiento_bloqueo
      ? new Date(reserva.fecha_vencimiento_bloqueo)
      : (reserva.Opcion?.Disponibilidad?.fecha ? new Date(reserva.Opcion.Disponibilidad.fecha) : new Date());

    const maxAllowedDate = new Date(baseDueDate);
    maxAllowedDate.setDate(maxAllowedDate.getDate() + 3);
    maxAllowedDate.setHours(23, 59, 59, 999);

    // Dar margen si la fecha prometida era en el pasado
    const minAllowedMax = new Date(today);
    minAllowedMax.setDate(minAllowedMax.getDate() + 3);
    minAllowedMax.setHours(23, 59, 59, 999);
    const finalMaxDate = maxAllowedDate > minAllowedMax ? maxAllowedDate : minAllowedMax;

    if (targetDate < today) {
      return { success: false, message: 'La nueva fecha de cita no puede ser anterior al día de hoy.' };
    }

    if (targetDate > finalMaxDate) {
      return {
        success: false,
        message: `La fecha seleccionada supera el límite máximo permitido de 3 días (${finalMaxDate.toISOString().slice(0, 10)}).`
      };
    }

    // Extraer horas de turno
    let hInicio = '09:00';
    let hFin = '13:00';
    const turnoStr = params.nuevoTurno || '09:00 - 13:00 (Mañana)';

    if (turnoStr.includes('Tarde') || turnoStr.includes('14:00')) {
      hInicio = '14:00';
      hFin = '18:00';
    } else if (turnoStr.includes('Noche') || turnoStr.includes('18:00')) {
      hInicio = '18:00';
      hFin = '21:00';
    } else {
      const match = /^([01]\d|2[0-3]):([0-5]\d) - ([01]\d|2[0-3]):([0-5]\d)/.exec(turnoStr);
      if (match) {
        hInicio = `${match[1]}:${match[2]}`;
        hFin = `${match[3]}:${match[4]}`;
      }
    }

    const inicioTurno = new Date(`1970-01-01T${hInicio}:00.000Z`);
    const finTurno = new Date(`1970-01-01T${hFin}:00.000Z`);

    // Calcular nuevo vencimiento de pago:
    // La noche previa a la nueva cita (23:59:59) o mínimo horas de prórroga desde ahora
    const rules = await DunningConfigService.getRules();
    const extHours = rules.prorroga_express_horas || 24;
    const nightBeforeAppointment = new Date(`${params.nuevaFechaCita}T23:59:59.000Z`);
    nightBeforeAppointment.setDate(nightBeforeAppointment.getDate() - 1);

    const minFromNow = new Date(Date.now() + extHours * 60 * 60 * 1000);
    const nuevoVencimiento = nightBeforeAppointment > minFromNow ? nightBeforeAppointment : minFromNow;

    const fechaCitaAnterior = reserva.Opcion?.Disponibilidad?.fecha
      ? new Date(reserva.Opcion.Disponibilidad.fecha).toISOString().slice(0, 10)
      : 'No asignada';

    // Ejecución transaccional en Base de Datos SQL Server respetando triggers de auditoría
    await prisma.$transaction(async (tx) => {
      const currentSlot = reserva.Opcion?.Disponibilidad;
      const currentProfId = currentSlot?.id_profesional || 1;
      const currentSedeId = currentSlot?.id_sede || 1;

      // 1. Liberar el slot de disponibilidad anterior si existía
      if (currentSlot?.id_disponibilidad) {
        try {
          await tx.disponibilidad.update({
            where: { id_disponibilidad: currentSlot.id_disponibilidad },
            data: { estado: 'Disponible' },
          });
        } catch (slotErr) {
          console.warn('⚠️ No se pudo liberar slot anterior:', slotErr);
        }
      }

      // 2. Crear nueva Disponibilidad con la fecha y turno elegidos por el paciente
      const newSlot = await tx.disponibilidad.create({
        data: {
          id_profesional: currentProfId,
          id_sede: currentSedeId,
          fecha: targetDate,
          hora_inicio: inicioTurno,
          hora_fin: finTurno,
          estado: 'Reservado',
        },
      });

      // 3. Crear nueva Opcion asociada a la solicitud y al nuevo slot
      const newOpcion = await tx.opciones.create({
        data: {
          id_solicitud: reserva.id_solicitud,
          id_disponibilidad: newSlot.id_disponibilidad,
          precio_ofrecido: reserva.Opcion?.precio_ofrecido || 150,
          seleccionada: true,
          fecha_ofrecida: new Date(),
          estado_respuesta: 'Aceptada',
          fecha_respuesta: new Date(),
        },
      });

      // 4. Actualizar Reserva con la nueva opción, nuevo límite de pago y marca de dunning
      await tx.reservas.update({
        where: { id_reserva: reserva.id_reserva },
        data: {
          id_opcion: newOpcion.id_opcion,
          fecha_vencimiento_bloqueo: nuevoVencimiento,
          ultima_alerta_dunning: `Prórroga Confirmada (Cita: ${params.nuevaFechaCita} ${hInicio})`,
        },
      });

      // 5. Registrar Incidencia de Auditoría
      await tx.incidencias.create({
        data: {
          id_persona: reserva.id_persona,
          id_reserva: reserva.id_reserva,
          tipo: 'PRORROGA_24H_SOLICITADA',
          motivo_tipificado: 'Prórroga Autogestionada y Reagendamiento de Cita',
          descripcion: `Prórroga confirmada por paciente. Cita reprogramada del ${fechaCitaAnterior} al ${params.nuevaFechaCita} (${turnoStr}). Nuevo límite de pago: ${nuevoVencimiento.toISOString()}`,
          estado: 'Cerrada',
        },
      });

      // 6. Registrar Interacción
      await tx.interacciones.create({
        data: {
          id_persona: reserva.id_persona,
          id_solicitud: reserva.id_solicitud,
          tipo: 'PRORROGA_CONCEDIDA',
          mensaje: `Paciente confirmó prórroga en portal web. Cita reagendada para el ${params.nuevaFechaCita} turno ${turnoStr}. Vencimiento extendido a ${nuevoVencimiento.toISOString()}`,
          resultado: 'Reagendada y Concedida',
        },
      });
    });

    const pacienteNombre = `${reserva.Persona.nombres} ${reserva.Persona.apellidos}`;

    // 5. Enviar confirmación interactiva por WhatsApp si el canal está activo
    if (rules.whatsapp_activo && reserva.Persona?.numero) {
      try {
        const orderCode = reserva.Pagos?.[0]?.referencia_pago
          || `ORD-${String(reserva.id_reserva).padStart(5, '0')}-${new Date().getFullYear()}`;
        const payUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pasarela-pago/${orderCode}`;
        const waMsg = `
✅ *PRÓRROGA Y CITA CONFIRMADA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *${pacienteNombre}*, su prórroga ha sido procesada exitosamente.

📅 *Nueva Fecha de Cita:* ${params.nuevaFechaCita}
⏰ *Turno:* ${turnoStr}
📍 *Sede:* ${reserva.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede NexoSalud'}
⏳ *Nuevo límite de abono:* ${nuevoVencimiento.toLocaleString('es-PE')}

Su sillón odontológico ha quedado asegurado. Puede completar su pago cuando guste en:
👉 ${payUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
        await this.sendTextMessage(reserva.Persona.numero, waMsg);
      } catch (waErr) {
        console.warn('⚠️ No se pudo enviar WhatsApp de confirmación de prórroga:', waErr);
      }
    }

    return {
      success: true,
      message: 'Prórroga concedida y cita reagendada exitosamente.',
      nuevaFechaCita: params.nuevaFechaCita,
      nuevoTurno: turnoStr,
      nuevoVencimiento,
      pacienteNombre,
    };
  }
}
