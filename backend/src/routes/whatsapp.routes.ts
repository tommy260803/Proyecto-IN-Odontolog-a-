import { Router } from 'express';
import { WhatsAppService } from '../services/whatsappService';
import { prisma } from '../db';

const router = Router();

/**
 * Consulta el estado de conectividad de la sesión de WhatsApp en el servicio OpenWA.
 */
router.get('/status', async (req, res) => {
  const sessionStatus = await WhatsAppService.getSessionStatus();
  const testNumber = process.env.TEST_RECEIVER_NUMBER || '51904388543';

  res.json({
    openwaUrl: process.env.OPENWA_API_URL || 'http://127.0.0.1:2785',
    sessionName: process.env.OPENWA_SESSION_NAME || 'nexosalud',
    sessionStatus,
    testReceiverNumber: testNumber,
    isDevRedirectActive: process.env.NODE_ENV !== 'production' || !process.env.FORCE_PROD_NUMBERS,
    dashboardUrl: 'http://localhost:2785'
  });
});

/**
 * Inicia la sesión de mensajería en el microservicio OpenWA.
 */
router.post('/start', async (req, res) => {
  const baseUrl = process.env.OPENWA_API_URL || 'http://127.0.0.1:2785';
  const apiKey = process.env.OPENWA_API_KEY || 'owa_k1_c2ddc9826fb622c16101ad7e5b841bb2232ea34a9d5fc1117bd98ba6f75d50e2';
  try {
    const sessionId = await WhatsAppService.ensureSession();
    const startRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey }
    });
    const data = await startRes.json().catch(() => ({}));
    res.json({ status: startRes.status, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Obtiene el código QR para emparejar la sesión de WhatsApp mediante la aplicación móvil.
 */
router.get('/qr', async (req, res) => {
  const qrData = await WhatsAppService.getSessionQr();
  
  if (req.query.format === 'html' && qrData.qr) {
    const imgSrc = qrData.qr.startsWith('data:') ? qrData.qr : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData.qr)}`;
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vincular WhatsApp NexoSalud</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: white; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; text-align: center; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          img { border-radius: 12px; margin: 20px 0; background: white; padding: 12px; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>📱 Vincular WhatsApp</h2>
          <p>Abre WhatsApp en tu teléfono > Dispositivos Vinculados > Vincular un dispositivo y escanea este código:</p>
          <img src="${imgSrc}" width="280" height="280" alt="Código QR WhatsApp" />
          <p>O ingresa al Dashboard en <a href="http://localhost:2785" style="color: #10b981;" target="_blank">http://localhost:2785</a></p>
        </div>
      </body>
      </html>
    `);
  }

  res.json(qrData);
});

/**
 * Registra el webhook de notificación de mensajes entrantes en la sesión de OpenWA.
 */
router.post('/register-webhook', async (req, res) => {
  const success = await WhatsAppService.registerWebhook();
  res.json({
    success,
    webhookUrl: process.env.OPENWA_WEBHOOK_URL || 'http://host.docker.internal:3001/api/whatsapp/webhook'
  });
});

/**
 * Envía un mensaje de texto saliente a un número de teléfono específico.
 */
router.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Se requiere teléfono y mensaje.' });
  }

  const result = await WhatsAppService.sendTextMessage(phone, message);
  res.json(result);
});

/**
 * Receptor de eventos webhook emitidos por OpenWA.
 * Procesa comandos de interacción rápida como solicitudes de prórroga de 24 horas.
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('[OPENWA WEBHOOK EVENT RECEIVED]', JSON.stringify(payload).slice(0, 250));

    const msg = payload.data?.message || payload.data || payload.message || payload;
    if (msg.fromMe) {
      return res.status(200).json({ ignored: true, reason: 'fromMe' });
    }

    const from = (msg.from || msg.sender?.id || msg.chatId || '').toString();
    const text = (msg.body || msg.text || msg.content || '').toString().trim().toUpperCase();

    res.status(200).json({ received: true });

    if (text.includes('PRORROGA') || text === '2') {
      console.log(`[WHATSAPP WEBHOOK] Solicitud de prórroga detectada desde: ${from}`);
      const extensionResult = await WhatsAppService.grant24HourExtension({ phone: from });

      if (extensionResult.success) {
        const confirmMsg = `
✅ *PRÓRROGA CONCEDIDA (24 HORAS)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *${extensionResult.pacienteNombre || 'Paciente'}*, su solicitud ha sido aprobada.

⏳ *Nuevo plazo de tolerancia:*
📅 ${extensionResult.nuevoVencimiento?.toLocaleString('es-PE')}

Su sillón odontológico se mantiene reservado. Puede completar su pago cuando guste en:
${process.env.FRONTEND_URL || 'http://localhost:5173'}/payer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
        await WhatsAppService.sendTextMessage(from, confirmMsg);
      } else {
        const errorMsg = `
⚠️ *AVISO DE PRÓRROGA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${extensionResult.message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
        await WhatsAppService.sendTextMessage(from, errorMsg);
      }
    }
  } catch (error: any) {
    console.error('[OPENWA WEBHOOK ERROR]', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Consulta la información completa de la reserva para la pantalla de prórroga interactiva.
 * No confirma ni aplica cambios automáticamente.
 */
router.get('/prorroga-info/:reservaId', async (req, res) => {
  const reservaId = Number(req.params.reservaId);
  if (!reservaId || isNaN(reservaId)) {
    return res.status(400).json({ error: 'ID de reserva inválido.' });
  }

  const result = await WhatsAppService.getProrrogaInfo({ reservaId });
  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

/**
 * Confirma la prórroga seleccionada por el usuario y actualiza la fecha de la cita en BD.
 */
router.post('/confirmar-prorroga', async (req, res) => {
  const { reservaId, nuevaFechaCita, nuevoTurno, motivo } = req.body || {};
  if (!reservaId || !nuevaFechaCita) {
    return res.status(400).json({ error: 'Debe proveer reservaId y nuevaFechaCita.' });
  }

  const result = await WhatsAppService.confirmProrrogaAndReschedule({
    reservaId: Number(reservaId),
    nuevaFechaCita,
    nuevoTurno,
    motivo,
  });

  if (!result.success) {
    return res.status(409).json(result);
  }

  res.json(result);
});

/**
 * Extiende en 24 horas el vencimiento de una pre-reserva mediante API.
 */
router.post('/request-extension', async (req, res) => {
  const { reservaId, phone } = req.body;
  if (!reservaId && !phone) {
    return res.status(400).json({ error: 'Debe proveer reservaId o phone.' });
  }

  const result = await WhatsAppService.grant24HourExtension({
    reservaId: reservaId ? Number(reservaId) : undefined,
    phone
  });

  if (!result.success) {
    return res.status(409).json(result);
  }

  res.json(result);
});

/**
 * Endpoint de prueba de notificación de vencimiento (T-24h) y flujo de prórroga interactivo.
 */
router.post('/test-dunning', async (req, res) => {
  try {
    const { reservaId, resetProrroga = true } = req.body || {};

    let reserva: any = null;
    if (reservaId) {
      reserva = await prisma.reservas.findUnique({
        where: { id_reserva: Number(reservaId) },
        include: {
          Persona: true,
          Solicitud: { include: { Servicio: true } },
          Opcion: { include: { Disponibilidad: true } }
        }
      });
    } else {
      reserva = await prisma.reservas.findFirst({
        where: { estado: { in: ['Pendiente', 'Pre-reservada'] } },
        include: {
          Persona: true,
          Solicitud: { include: { Servicio: true } },
          Opcion: { include: { Disponibilidad: true } }
        },
        orderBy: { id_reserva: 'desc' }
      });
    }

    if (!reserva) {
      return res.status(404).json({ error: 'No se encontró ninguna reserva pendiente para la prueba.' });
    }

    if (resetProrroga) {
      await prisma.incidencias.deleteMany({
        where: {
          id_reserva: reserva.id_reserva,
          tipo: 'PRORROGA_24H_SOLICITADA'
        }
      });
    }

    const patientName = `${reserva.Persona.nombres} ${reserva.Persona.apellidos}`;
    const serviceName = reserva.Solicitud?.Servicio?.nombre || 'Consulta Odontológica';
    const amount = Number(reserva.Opcion?.precio_ofrecido || 150.00);
    const orderCode = `ORD-${String(reserva.id_reserva).padStart(5, '0')}-${new Date().getFullYear()}`;
    const apptTime = reserva.Opcion?.Disponibilidad?.hora_inicio
      ? reserva.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16)
      : '10:00';
    const apptDate = reserva.Opcion?.Disponibilidad?.fecha
      ? reserva.Opcion.Disponibilidad.fecha.toISOString().split('T')[0]
      : new Date().toISOString().slice(0, 10);

    const sendResult = await WhatsAppService.sendDunningUrgencyWhatsApp({
      toPhone: reserva.Persona.numero || process.env.TEST_RECEIVER_NUMBER || '51904388543',
      patientName,
      serviceName,
      amount,
      orderCode,
      reservaId: reserva.id_reserva,
      dueDateStr: apptDate,
      appointmentDateStr: apptDate,
      appointmentTimeStr: apptTime
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.json({
      success: true,
      testMode: 'Instant Dunning T-24h (Sin espera)',
      reservaId: reserva.id_reserva,
      paciente: patientName,
      sendResult,
      mensajeEnviado: (sendResult as any).messageText,
      prorrogaWebUrl: `${frontendUrl}/prorroga-express/${reserva.id_reserva}`,
      instruccionPrueba: 'Puedes probar la prórroga respondiendo "PRORROGA" desde WhatsApp o abriendo el enlace prorrogaWebUrl en el navegador.'
    });
  } catch (error: any) {
    console.error('Error en /test-dunning:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Simula una respuesta entrante de WhatsApp para pruebas de integración automatizadas.
 */
router.post('/simulate-reply', async (req, res) => {
  try {
    const { text = 'PRORROGA', phone } = req.body || {};
    const testNumber = phone || process.env.TEST_RECEIVER_NUMBER || '51904388543';

    const extensionResult = await WhatsAppService.grant24HourExtension({ phone: testNumber });

    res.json({
      simulatedText: text,
      fromNumber: testNumber,
      extensionResult,
      instruction: extensionResult.success
        ? 'Prórroga aplicada exitosamente. La regla anti-abuso bloqueará un segundo intento.'
        : 'La solicitud no procedió (probablemente ya tenía prórroga o no hay reserva pendiente).'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
