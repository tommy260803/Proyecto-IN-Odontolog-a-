import { prisma } from '../db';

export interface SendWhatsAppParams {
  toPhone: string;
  patientName: string;
  message?: string;
  orderCode?: string;
  reservaId?: number;
  amount?: number;
  serviceName?: string;
  dueDateStr?: string;
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

    const messageText = `
🏥 *CLÍNICA ODONTOLÓGICA NEXOSALUD*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *${params.patientName}*,

Le recordamos que su sillón odontológico reservado para el tratamiento de *${params.serviceName || 'Tratamiento Especializado'}* se encuentra próximo a vencer.

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

    return result;
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

    // Extender el vencimiento de bloqueo por 24 horas adicionales
    const baseDate = reserva.fecha_vencimiento_bloqueo || new Date();
    const nuevoVencimiento = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

    await prisma.reservas.update({
      where: { id_reserva: reserva.id_reserva },
      data: {
        fecha_vencimiento_bloqueo: nuevoVencimiento,
        ultima_alerta_dunning: 'Prórroga Concedida (+24h)'
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
          descripcion: `Prórroga de 24h otorgada con éxito. Nuevo vencimiento: ${nuevoVencimiento.toISOString()}`,
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
}
