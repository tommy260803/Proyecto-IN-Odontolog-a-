import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const router = Router();
const prisma = new PrismaClient();

// Limpiar todos los PAYERS / Reservas de prueba
router.post('/clear-all', async (req, res) => {
  try {
    await prisma.pagos.deleteMany({});
    await prisma.reservas.deleteMany({});
    await prisma.opciones.deleteMany({});
    res.json({ message: 'Todos los Payers han sido eliminados correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al limpiar payers' });
  }
});

router.delete('/clear-all', async (req, res) => {
  try {
    await prisma.pagos.deleteMany({});
    await prisma.reservas.deleteMany({});
    await prisma.opciones.deleteMany({});
    res.json({ message: 'Todos los Payers han sido eliminados correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al limpiar payers' });
  }
});

// Obtener todos los PAYERS mapeados
router.get('/', async (req, res) => {
  try {
    const reservas = await prisma.reservas.findMany({
      include: {
        Persona: true,
        Opcion: {
          include: {
            Disponibilidad: {
              include: { Sede: true, Profesional: true }
            }
          }
        },
        Pagos: true
      }
    });

    const payers = reservas.map(r => {
      const pago = r.Pagos.length > 0 ? r.Pagos[0] : null;
      let state = 'PENDING';
      if (pago) {
        state = pago.estado === 'Validado' ? 'VALIDATED' : pago.estado === 'Rechazado' ? 'REJECTED' : 'IN_REVIEW';
      }

      return {
        id: r.id_reserva.toString(),
        leadId: r.id_persona.toString(),
        reservationId: r.id_reserva.toString(),
        amountToPay: Number(r.Opcion?.precio_ofrecido || 1.00),
        currency: 'PEN',
        state,
        createdAt: r.fecha_reserva ? r.fecha_reserva.toISOString() : new Date().toISOString(),
        paymentId: pago ? pago.id_pago.toString() : undefined,
        person: {
          firstName: r.Persona.nombres,
          lastName: r.Persona.apellidos,
          email: r.Persona.email,
          phone: r.Persona.numero,
          documentNumber: r.Persona.dni
        },
        reservation: {
          id: r.id_reserva.toString(),
          date: r.Opcion?.Disponibilidad?.fecha ? r.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : '2026-09-17',
          time: r.Opcion?.Disponibilidad?.hora_inicio ? r.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : '15:00',
          branchId: r.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Norte',
          professionalId: `Dr. ${r.Opcion?.Disponibilidad?.Profesional?.apellidos || 'Perez'}`
        },
        incidents: []
      };
    });

    res.json(payers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener payers' });
  }
});

// Obtener un PAYER por ID (o ID de persona/reserva)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);

  try {
    let reserva = null;

    if (!isNaN(numId)) {
      reserva = await prisma.reservas.findFirst({
        where: {
          OR: [
            { id_reserva: numId },
            { id_persona: numId }
          ]
        },
        include: {
          Persona: true,
          Opcion: {
            include: {
              Disponibilidad: {
                include: { Sede: true, Profesional: true }
              }
            }
          },
          Pagos: true
        }
      });
    }

    if (!reserva) {
      reserva = await prisma.reservas.findFirst({
        orderBy: { id_reserva: 'desc' },
        include: {
          Persona: true,
          Opcion: {
            include: {
              Disponibilidad: {
                include: { Sede: true, Profesional: true }
              }
            }
          },
          Pagos: true
        }
      });
    }

    if (!reserva) {
      return res.status(404).json({ error: 'Payer no encontrado' });
    }

    const pago = reserva.Pagos.length > 0 ? reserva.Pagos[0] : null;
    let state = 'PENDING';
    if (pago) {
      state = pago.estado === 'Validado' ? 'VALIDATED' : pago.estado === 'Rechazado' ? 'REJECTED' : 'IN_REVIEW';
    }

    const payerDetails = {
      id: reserva.id_reserva.toString(),
      leadId: reserva.id_persona.toString(),
      reservationId: reserva.id_reserva.toString(),
      amountToPay: Number(reserva.Opcion?.precio_ofrecido || 1.00),
      currency: 'PEN',
      state,
      createdAt: reserva.fecha_reserva ? reserva.fecha_reserva.toISOString() : new Date().toISOString(),
      paymentId: pago ? pago.id_pago.toString() : undefined,
      payment: pago ? {
        id: pago.id_pago.toString(),
        payerId: reserva.id_reserva.toString(),
        amount: Number(pago.importe),
        currency: 'PEN',
        channel: pago.canal_pago || 'YAPE',
        operationNumber: pago.referencia_pago || 'REF-YAPE',
        operationDate: pago.fecha_registro.toISOString().split('T')[0],
        observations: pago.observaciones || 'Pago verificado'
      } : undefined,
      person: {
        firstName: reserva.Persona.nombres,
        lastName: reserva.Persona.apellidos,
        email: reserva.Persona.email,
        phone: reserva.Persona.numero,
        documentNumber: reserva.Persona.dni
      },
      reservation: {
        id: reserva.id_reserva.toString(),
        date: reserva.Opcion?.Disponibilidad?.fecha ? reserva.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : '2026-09-17',
        time: reserva.Opcion?.Disponibilidad?.hora_inicio ? reserva.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : '15:00',
        branchId: reserva.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Norte',
        professionalId: `Dr. ${reserva.Opcion?.Disponibilidad?.Profesional?.apellidos || 'Perez'}`
      },
      incidents: []
    };

    res.json(payerDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener detalle del payer' });
  }
});

// Validar pago de una reserva en SQL Server y transferir automáticamente a CUSTOMER
router.post('/:id/validate', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);

  try {
    const reserva = await prisma.reservas.findFirst({
      where: {
        OR: [
          { id_reserva: isNaN(numId) ? -1 : numId },
          { id_persona: isNaN(numId) ? -1 : numId }
        ]
      },
      include: { 
        Opcion: { include: { Disponibilidad: true } }, 
        Solicitud: true, 
        Pagos: true 
      }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // 1. Confirmar Reserva
    await prisma.reservas.update({
      where: { id_reserva: reserva.id_reserva },
      data: { estado: 'Confirmada', confirmacion_explicita: true, fecha_confirmacion: new Date() }
    });

    // 2. Validar o Crear Pago
    let pago = reserva.Pagos.length > 0 ? reserva.Pagos[0] : null;
    if (pago) {
      pago = await prisma.pagos.update({
        where: { id_pago: pago.id_pago },
        data: { estado: 'Validado', fecha_validacion: new Date() }
      });
    } else {
      pago = await prisma.pagos.create({
        data: {
          id_persona: reserva.id_persona,
          id_reserva: reserva.id_reserva,
          importe: reserva.Opcion?.precio_ofrecido || 1.00,
          canal_pago: 'YAPE',
          referencia_pago: `YAPE-${Date.now()}`,
          estado: 'Validado',
          fecha_validacion: new Date()
        }
      });
    }

    // 3. Promover automáticamente la persona a etapa CUSTOMER
    let etapaCustomer = await prisma.etapas.findFirst({ where: { nombre: 'CUSTOMER' } });
    if (!etapaCustomer) {
      etapaCustomer = await prisma.etapas.create({ data: { nombre: 'CUSTOMER', descripcion: 'Atención' } });
    }

    const persona = await prisma.personas.update({
      where: { id_persona: reserva.id_persona },
      data: { id_etapa_actual: etapaCustomer.id_etapa }
    });

    // 4. Crear registro en la tabla Atenciones para la historia clínica si no existe
    const existingAtencion = await prisma.atenciones.findFirst({ where: { id_reserva: reserva.id_reserva } });
    if (!existingAtencion) {
      const defaultProf = await prisma.profesionales.findFirst();
      const defaultSede = await prisma.sedes.findFirst();

      await prisma.atenciones.create({
        data: {
          id_persona: persona.id_persona,
          id_reserva: reserva.id_reserva,
          id_servicio: reserva.Solicitud?.id_servicio || 1,
          id_profesional: reserva.Opcion?.Disponibilidad?.id_profesional || defaultProf?.id_profesional || 1,
          id_sede: reserva.Opcion?.Disponibilidad?.id_sede || defaultSede?.id_sede || 1,
          fecha_atencion: reserva.Opcion?.Disponibilidad?.fecha || new Date(),
          estado_servicio: 'Programado',
          asistencia: 'Pendiente'
        }
      });
    }

    res.json({ 
      message: 'Pago validado exitosamente y paciente transferido a CUSTOMER', 
      pago,
      personaId: persona.id_persona
    });
  } catch (error) {
    console.error('Error al validar pago en backend:', error);
    res.status(500).json({ error: 'Error al validar pago en backend' });
  }
});

// Eliminar un PAYER individual (Reserva, atenciones, incidencias y pagos asociados en SQL Server)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);

  try {
    if (isNaN(numId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // 1. Buscar la reserva objetivo
    const reserva = await prisma.reservas.findFirst({
      where: {
        OR: [
          { id_reserva: numId },
          { id_persona: numId }
        ]
      },
      include: {
        Pagos: true,
        Atenciones: true,
        Incidencias: true
      }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Registro de cobro no encontrado' });
    }

    const reservaId = reserva.id_reserva;
    const personaId = reserva.id_persona;
    const atencionIds = reserva.Atenciones.map(a => a.id_atencion);
    const pagoIds = reserva.Pagos.map(p => p.id_pago);

    await prisma.$transaction(async (tx) => {
      // a. Eliminar Seguimientos asociados a las atenciones
      if (atencionIds.length > 0) {
        await tx.seguimientos.deleteMany({
          where: { id_atencion: { in: atencionIds } }
        });
      }

      // b. Eliminar Incidencias asociadas a reservas, pagos o atenciones
      await tx.incidencias.deleteMany({
        where: {
          OR: [
            { id_reserva: reservaId },
            ...(pagoIds.length > 0 ? [{ id_pago: { in: pagoIds } }] : []),
            ...(atencionIds.length > 0 ? [{ id_atencion: { in: atencionIds } }] : [])
          ]
        }
      });

      // c. Eliminar Atenciones
      if (atencionIds.length > 0) {
        await tx.atenciones.deleteMany({
          where: { id_atencion: { in: atencionIds } }
        });
      }

      // d. Eliminar Pagos
      await tx.pagos.deleteMany({
        where: { id_reserva: reservaId }
      });

      // e. Eliminar la Reserva
      await tx.reservas.deleteMany({
        where: { id_reserva: reservaId }
      });

      // f. Revertir etapa de la persona a LEAD si no tiene otras reservas
      const otherReservas = await tx.reservas.count({ where: { id_persona: personaId } });
      if (otherReservas === 0) {
        const etapaLead = await tx.etapas.findFirst({ where: { nombre: 'LEAD' } });
        if (etapaLead) {
          await tx.personas.update({
            where: { id_persona: personaId },
            data: { id_etapa_actual: etapaLead.id_etapa }
          });
        }
      }
    });

    res.json({ message: 'Payer y registros asociados eliminados exitosamente en SQL Server' });
  } catch (error: any) {
    console.error('Error al eliminar Payer en backend:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar payer en base de datos' });
  }
});

// Limpiar todos los Payers (Reservas y Pagos en SQL Server)
router.post('/clear-all', async (req, res) => {
  try {
    await prisma.pagos.deleteMany({});
    await prisma.reservas.deleteMany({});
    const etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (etapaLead) {
      await prisma.personas.updateMany({
        where: { id_etapa_actual: { not: 1 } },
        data: { id_etapa_actual: etapaLead.id_etapa }
      });
    }
    res.json({ message: 'Todos los Payers han sido eliminados de SQL Server' });
  } catch (error) {
    console.error('Error limpiando payers:', error);
    res.status(500).json({ error: 'Error al limpiar payers' });
  }
});

router.post('/:id/convert-customer', async (req, res) => {
  const { id } = req.params;
  try {
    let etapaCustomer = await prisma.etapas.findFirst({ where: { nombre: 'CUSTOMER' } });
    if (!etapaCustomer) etapaCustomer = await prisma.etapas.create({ data: { nombre: 'CUSTOMER', descripcion: 'Atencion' } });
    
    const reserva = await prisma.reservas.findUnique({
      where: { id_reserva: Number(id) },
      include: { Opcion: { include: { Disponibilidad: true } }, Solicitud: true, Pagos: true }
    });
    
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (!reserva.Pagos.some(pago => pago.estado === 'Validado')) {
      return res.status(409).json({ error: 'El pago debe estar validado antes de pasar a CUSTOMER' });
    }

    const persona = await prisma.personas.update({
      where: { id_persona: reserva.id_persona },
      data: { id_etapa_actual: etapaCustomer.id_etapa }
    });
    
    const existingAtencion = await prisma.atenciones.findFirst({ where: { id_reserva: reserva.id_reserva } });
    if (!existingAtencion) {
      // Obtener un profesional y sede por defecto si no están definidos
      const defaultProf = await prisma.profesionales.findFirst();
      const defaultSede = await prisma.sedes.findFirst();

      await prisma.atenciones.create({
        data: {
          id_persona: persona.id_persona,
          id_reserva: reserva.id_reserva,
          id_servicio: reserva.Solicitud?.id_servicio || 1,
          id_profesional: reserva.Opcion?.Disponibilidad?.id_profesional || defaultProf?.id_profesional || 1,
          id_sede: reserva.Opcion?.Disponibilidad?.id_sede || defaultSede?.id_sede || 1,
          fecha_atencion: reserva.Opcion?.Disponibilidad?.fecha || new Date(),
          estado_servicio: 'Programado',
          asistencia: 'Pendiente'
        }
      });
    }

    res.json({ message: 'Convertido a CUSTOMER' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al convertir a CUSTOMER' });
  }
});

// Enviar Aviso de Cobro / Proforma por Correo con PDF Adjunto
router.post('/send-notice-email', async (req, res) => {
  const {
    toEmail,
    patientName,
    subject,
    message,
    amount,
    serviceName,
    reservationDate,
    reservationTime,
    branch,
    professional,
    pdfBase64
  } = req.body;

  if (!toEmail) {
    return res.status(400).json({ error: 'El correo electrónico del paciente es obligatorio.' });
  }

  try {
    const formattedAmount = Number(amount || 0).toFixed(2);
    const emailSubject = subject || `Aviso de Cobro y Proforma Oficial - Clínica NexoSalud`;
    
    // Plantilla HTML profesional de NexoSalud
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 28px 24px; }
          .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .message-box { background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 14px 18px; border-radius: 0 10px 10px 0; margin-bottom: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
          .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
          .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0d9488; margin-top: 0; margin-bottom: 12px; letter-spacing: 0.5px; }
          .grid { display: table; width: 100%; }
          .grid-row { display: table-row; }
          .grid-col { display: table-cell; padding-bottom: 8px; font-size: 13px; }
          .col-label { color: #64748b; font-weight: 600; width: 40%; }
          .col-val { color: #0f172a; font-weight: 700; width: 60%; }
          .total-banner { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
          .total-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0f766e; }
          .total-amount { font-size: 28px; font-weight: 800; color: #0f766e; margin: 4px 0 0 0; font-family: monospace; }
          .payment-methods { background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px; font-size: 12px; color: #475569; }
          .badge { display: inline-block; background-color: #742284; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
          .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Clínica Odontológica NexoSalud</h1>
            <p>Aviso de Cobranza & Proforma de Tratamiento</p>
          </div>
          <div class="content">
            <div class="greeting">Estimado(a) ${patientName || 'Paciente'},</div>
            
            <div class="message-box">
              ${message ? message.replace(/\n/g, '<br/>') : 'Le recordamos que mantiene un importe pendiente de regularización correspondiente a su atención odontológica programada.'}
            </div>

            <div class="card">
              <div class="card-title">Detalle de la Cita Médica</div>
              <div class="grid">
                <div class="grid-row"><div class="grid-col col-label">Servicio / Tratamiento:</div><div class="grid-col col-val">${serviceName || 'Tratamiento Odontológico Especializado'}</div></div>
                <div class="grid-row"><div class="grid-col col-label">Fecha Programada:</div><div class="grid-col col-val">${reservationDate || 'Próximo turno'} a las ${reservationTime || '15:00'} hrs</div></div>
                <div class="grid-row"><div class="grid-col col-label">Sede de Atención:</div><div class="grid-col col-val">${branch || 'Sede Principal'}</div></div>
                <div class="grid-row"><div class="grid-col col-label">Especialista Asignado:</div><div class="grid-col col-val">${professional || 'Especialista de Turno'}</div></div>
              </div>
            </div>

            <div class="total-banner">
              <div class="total-label">Monto Total a Abonar</div>
              <div class="total-amount">S/ ${formattedAmount}</div>
            </div>

            <div class="payment-methods">
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px;">Canales de Pago Habilitados:</div>
              <p style="margin: 4px 0;"><span class="badge">YAPE</span> Número Directo: <strong>970 292 710</strong> (A nombre de Clínica NexoSalud)</p>
              <p style="margin: 4px 0;"><strong>Transferencia Bancaria BCP:</strong> Cta: 191-88392019-0-45 | CCI: 002-191-008839201904-52</p>
              <p style="margin: 4px 0;"><strong>Pasarela Web:</strong> Puede abonar directamente con Tarjeta o Yape desde nuestro portal.</p>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 20px; text-align: center;">
              <em>📎 Adjunto en este correo encontrará el documento formal en PDF (Proforma de Aviso de Cobro).</em>
            </p>
          </div>
          <div class="footer">
            <p>Clínica Odontológica NexoSalud S.A.C. | RUC: 20608930192</p>
            <p>Este es un correo automático generado por el Sistema de Recaudación Inteligente de NexoSalud.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Limpiar rigurosamente cualquier prefijo de Data URI (ej. "data:application/pdf;filename=generated.pdf;base64,...")
    let cleanBase64 = '';
    if (pdfBase64 && typeof pdfBase64 === 'string') {
      if (pdfBase64.includes('base64,')) {
        cleanBase64 = pdfBase64.split('base64,')[1].trim();
      } else {
        cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '').trim();
      }
      // Remover saltos de línea o espacios accidentales
      cleanBase64 = cleanBase64.replace(/[\r\n\s]+/g, '');
    }

    const patientFileSlug = (patientName || 'Paciente').replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfFileName = req.body.filename
      ? (req.body.filename.endsWith('.pdf') ? req.body.filename : `${req.body.filename}.pdf`)
      : `Documento_${patientFileSlug}.pdf`;

    const attachments: any[] = [];
    if (cleanBase64) {
      attachments.push({
        filename: pdfFileName,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    }

    // 1. MÉTODO 100% GARANTIZADO EN RENDER (HTTPS Port 443): Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      console.log(`[EMAIL DISPATCHER] Despachando PDF vía RESEND HTTPS API a: ${toEmail} (Archivo: ${pdfFileName}, Bytes: ${cleanBase64.length})`);
      const resendPayload: any = {
        from: process.env.RESEND_FROM || 'Clínica NexoSalud <onboarding@resend.dev>',
        to: [toEmail],
        subject: emailSubject,
        html: htmlBody,
      };

      if (cleanBase64) {
        resendPayload.attachments = [
          {
            filename: pdfFileName,
            content: cleanBase64
          }
        ];
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resendPayload)
      });

      const resendData: any = await resendRes.json();
      if (!resendRes.ok) {
        console.error('[RESEND API ERROR]', resendData);
        throw new Error(resendData.message || 'Error al enviar correo mediante Resend API.');
      }

      return res.json({
        success: true,
        provider: 'resend',
        message: `Aviso de cobro con proforma PDF enviado con éxito al correo ${toEmail}.`,
        toEmail,
        hasAttachment: !!cleanBase64
      });
    }

    // 2. MÉTODO 2: Brevo HTTPS API (Port 443)
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (brevoApiKey) {
      console.log(`[EMAIL DISPATCHER] Despachando proforma PDF vía BREVO HTTPS API a: ${toEmail}`);
      const brevoPayload: any = {
        sender: { name: 'Clínica NexoSalud', email: process.env.BREVO_SENDER_EMAIL || 'notificaciones@nexosalud.com' },
        to: [{ email: toEmail, name: patientName || 'Paciente' }],
        subject: emailSubject,
        htmlContent: htmlBody,
      };

      if (cleanBase64) {
        brevoPayload.attachment = [
          {
            name: pdfFileName,
            content: cleanBase64
          }
        ];
      }

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(brevoPayload)
      });

      const brevoData: any = await brevoRes.json();
      if (!brevoRes.ok) {
        console.error('[BREVO API ERROR]', brevoData);
        throw new Error(brevoData.message || 'Error al enviar correo mediante Brevo API.');
      }

      return res.json({
        success: true,
        provider: 'brevo',
        message: `Aviso de cobro con proforma PDF enviado con éxito al correo ${toEmail}.`,
        toEmail,
        hasAttachment: !!cleanBase64
      });
    }

    // 3. MÉTODO 3: SMTP Directo (Nodemailer / Gmail)
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (smtpUser && smtpPass) {
      const cleanPass = smtpPass.replace(/\s+/g, '');
      const isGmail = smtpHost.toLowerCase().includes('gmail');

      const transporter = nodemailer.createTransport({
        ...(isGmail ? { service: 'gmail' } : { host: smtpHost, port: smtpPort, secure: smtpPort === 465 }),
        auth: {
          user: smtpUser,
          pass: cleanPass
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"Clínica NexoSalud Recaudación" <${smtpUser}>`,
        to: toEmail,
        subject: emailSubject,
        html: htmlBody,
        attachments
      });

      return res.json({
        success: true,
        provider: 'smtp',
        message: `Aviso de cobro con proforma PDF enviado con éxito al correo ${toEmail}.`,
        toEmail,
        hasAttachment: attachments.length > 0
      });
    } else {
      // 4. MODO SIMULACIÓN (si no hay credenciales configuradas)
      console.log(`[EMAIL DISPATCHER] Enviando proforma PDF simulada a: ${toEmail}`);
      console.log(`[EMAIL DISPATCHER] Asunto: ${emailSubject}`);
      console.log(`[EMAIL DISPATCHER] Adjunto PDF: ${attachments.length > 0 ? 'Sí (PDF generado)' : 'No'}`);

      return res.json({
        success: true,
        simulated: true,
        message: `Aviso de cobro con proforma PDF enviado correctamente a ${toEmail}.`,
        toEmail,
        hasAttachment: attachments.length > 0
      });
    }
  } catch (error: any) {
    console.error('Error al enviar correo con proforma PDF:', error);
    res.status(500).json({ error: error.message || 'Error al procesar el envío del correo.' });
  }
});

export default router;
