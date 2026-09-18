import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * 0. Consultar medios de pago habilitados en la cuenta de Mercado Pago
 */
router.get('/payment-methods', async (req, res) => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-4001730668702458-091700-e25cb8b7b1adb93aed667a28cfa96a3a-3595881654';
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al consultar medios de pago' });
  }
});

/**
 * 1. Procesar Pago Directo con YAPE (Flujo Oficial Mercado Pago)
 * Paso 1: Generar YAPE_TOKEN con teléfono + OTP usando requestId UUID
 * Paso 2: Crear el pago en /v1/payments con payment_method_id: 'yape', installments: 1
 */
router.post('/process-yape', async (req, res) => {
  const { payerId, amount, phone, otpCode, email } = req.body;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-4001730668702458-091700-e25cb8b7b1adb93aed667a28cfa96a3a-3595881654';
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || 'APP_USR-21a7cc3a-0afb-4ac6-b41e-5d129a9022c5';

  const rawPhone = String(phone || '').replace(/\D/g, '');
  const rawOtp = String(otpCode || '').replace(/\D/g, '');
  const paymentAmount = Math.max(Number(amount) || 2, 2);

  // 1. Validar formato de teléfono y OTP
  if (!rawPhone || rawPhone.length !== 9 || !rawPhone.startsWith('9')) {
    return res.status(400).json({
      error: 'El número de celular de Yape debe tener 9 dígitos y empezar con 9 (ej. 987654321).'
    });
  }

  if (!rawOtp || rawOtp.length !== 6) {
    return res.status(400).json({
      error: 'El código de aprobación de Yape debe tener exactamente 6 dígitos.'
    });
  }

  try {
    const requestId = randomUUID();
    console.log(`[Yape] Solicitando token a Mercado Pago con requestId UUID: ${requestId}, celular: ${rawPhone}`);

    // Paso 1: Generar el token oficial en la API de Yape de Mercado Pago (requestId DEBE ser UUID)
    const tokenResponse = await fetch(`https://api.mercadopago.com/platforms/pci/yape/v1/payment?public_key=${publicKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: rawPhone,
        otp: rawOtp,
        requestId: requestId
      })
    });

    const tokenData = await tokenResponse.json();
    console.log('[Yape] Respuesta de tokenización Mercado Pago:', tokenData);

    if (!tokenResponse.ok || !tokenData || !tokenData.id) {
      const errorMsg = tokenData?.message ||
        (tokenData?.cause && tokenData.cause[0]?.description) ||
        'Código de aprobación de Yape inválido o expirado. Abre tu app Yape, pulsa en "Código de aprobación" y escribe los 6 dígitos generados.';

      return res.status(400).json({
        error: errorMsg,
        details: tokenData
      });
    }

    const yapeTokenId = tokenData.id;
    console.log('[Yape] Token oficial generado con éxito:', yapeTokenId);

    // Paso 2: Crear el cobro en /v1/payments usando el token obtenido
    const paymentData = {
      token: yapeTokenId,
      transaction_amount: paymentAmount,
      description: 'Reserva Odontológica NexoSalud - Yape',
      payment_method_id: 'yape',
      installments: 1,
      payer: {
        email: (email && email.includes('@')) ? email : 'paciente_yape@nexosalud.com',
      }
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': `yape-${payerId}-${Date.now()}`
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();
    console.log('[Yape] Respuesta de Mercado Pago /v1/payments:', data);

    if (response.ok && (data.status === 'approved' || data.status === 'in_process' || response.status === 201)) {
      return res.json({
        status: data.status || 'approved',
        id: data.id,
        status_detail: data.status_detail
      });
    }

    // Si el pago no fue aprobado por Mercado Pago
    const rejectionReason = data?.message ||
      (data?.cause && data.cause[0]?.description) ||
      (data?.status_detail === 'cc_rejected_insufficient_amount' ? 'Saldo insuficiente en tu cuenta Yape.' : 'El pago fue rechazado por la pasarela de Yape. Verifica tu saldo o genera un nuevo código OTP.');

    return res.status(400).json({
      error: rejectionReason,
      status: data.status,
      details: data
    });

  } catch (error: any) {
    console.error('Error interno procesando Yape:', error);
    return res.status(500).json({ error: error.message || 'Error de conexión con la pasarela de Yape' });
  }
});

/**
 * 2. Generar Preferencia de Checkout Pro
 */
router.post('/create-preference', async (req, res) => {
  const { payerId, title, amount, personName, email } = req.body;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN no configurado en backend/.env' });
  }

  try {
    const preferenceData: any = {
      items: [
        {
          id: String(payerId || '1'),
          title: title || 'Reserva de Servicio Odontológico',
          quantity: 1,
          currency_id: 'PEN',
          unit_price: Number(amount) || 2.00,
        },
      ],
      payer: {
        name: personName || 'Paciente NexoSalud',
        email: (email && email.includes('@')) ? email : 'paciente_prueba@test.com',
      },
      back_urls: {
        success: `http://localhost:5173/payer/${payerId}?status=approved`,
        failure: `http://localhost:5173/payer/${payerId}?status=failure`,
        pending: `http://localhost:5173/payer/${payerId}?status=pending`,
      },
      payment_methods: {
        excluded_payment_types: [],
        installments: 1
      }
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error desde la API de Mercado Pago:', data);
      return res.status(response.status).json({
        error: data.message || (data.cause && data.cause[0]?.description) || 'Error generando preferencia en Mercado Pago',
        details: data
      });
    }

    res.json({
      id: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
      isMock: false
    });
  } catch (error: any) {
    console.error('Error en servidor payment.routes:', error);
    res.status(500).json({ error: error.message || 'Error interno al procesar preferencia' });
  }
});

/**
 * 3. Procesar Pago vía Checkout API (Payment Brick)
 * Recibe el token y datos generados directamente en el frontend y valida estrictamente con Mercado Pago
 */
router.post('/process-checkout-api', async (req, res) => {
  const { payerId, formData, amount, email } = req.body;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN no configurado en backend/.env' });
  }

  try {
    const rawAmount = formData?.transaction_amount ?? amount;
    const paymentAmount = Number(rawAmount) > 0 ? Number(rawAmount) : 2.00;

    const paymentBody: any = {
      ...formData,
      transaction_amount: paymentAmount,
      description: formData?.description || 'Reserva Odontológica NexoSalud',
      payer: {
        ...formData?.payer,
        email: (formData?.payer?.email && formData.payer.email.includes('@'))
          ? formData.payer.email
          : (email || 'paciente@nexosalud.com'),
      }
    };

    console.log('[Tarjeta] Enviando pago a Mercado Pago /v1/payments:', JSON.stringify(paymentBody, null, 2));

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': `checkout-api-${payerId}-${Date.now()}`
      },
      body: JSON.stringify(paymentBody)
    });

    const data = await response.json();
    console.log('[Tarjeta] Respuesta de Mercado Pago /v1/payments:', data);

    if (!response.ok) {
      const errorMsg = data.message ||
        (data.cause && data.cause[0]?.description) ||
        'Error al procesar el pago con la tarjeta. Verifica que los datos sean correctos (o usa una tarjeta de prueba de Mercado Pago válida).';

      return res.status(response.status).json({
        error: errorMsg,
        details: data
      });
    }

    if (data.status === 'rejected') {
      const rejectReason = data.status_detail === 'cc_rejected_bad_filled_other'
        ? 'Datos de la tarjeta incorrectos (número, fecha o código de seguridad).'
        : data.status_detail === 'cc_rejected_insufficient_amount'
        ? 'Fondos insuficientes en la tarjeta.'
        : data.status_detail === 'cc_rejected_other_reason'
        ? 'Tarjeta rechazada por la pasarela de pago.'
        : (data.message || 'El pago con tarjeta fue rechazado por el banco emisor.');

      return res.status(400).json({
        error: rejectReason,
        status: data.status,
        status_detail: data.status_detail,
        details: data
      });
    }

    res.json({
      status: data.status,
      id: data.id,
      status_detail: data.status_detail
    });
  } catch (error: any) {
    console.error('Error interno procesando Checkout API:', error);
    res.status(500).json({ error: error.message || 'Error interno en Checkout API' });
  }
});

export default router;
