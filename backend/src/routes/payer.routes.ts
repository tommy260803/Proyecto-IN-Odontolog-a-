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
        Persona: true,
        Opcion: { 
          include: { 
            Disponibilidad: {
              include: {
                Sede: true,
                Profesional: true
              }
            } 
          } 
        }, 
        Solicitud: {
          include: {
            Servicio: true
          }
        }, 
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

    // 5. Enviar automáticamente constancia oficial de pago por correo al paciente
    const patientEmail = reserva.Persona?.email || persona.email;
    if (patientEmail) {
      const patientFullName = `${reserva.Persona?.nombres || persona.nombres || ''} ${reserva.Persona?.apellidos || persona.apellidos || ''}`.trim();
      const serviceName = reserva.Solicitud?.Servicio?.nombre || 'Consulta Odontológica Especializada';
      const reservationDate = reserva.Opcion?.Disponibilidad?.fecha ? reserva.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const reservationTime = reserva.Opcion?.Disponibilidad?.hora_inicio ? reserva.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : '10:00';
      const branchName = reserva.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal';
      const profName = reserva.Opcion?.Disponibilidad?.Profesional ? `Dr. ${reserva.Opcion.Disponibilidad.Profesional.nombres || ''} ${reserva.Opcion.Disponibilidad.Profesional.apellidos || ''}`.trim() : 'Dr. Especialista';
      const amountVal = Number(pago.importe || reserva.Opcion?.precio_ofrecido || 1.00);

      sendPaymentNoticeOrConfirmation({
        toEmail: patientEmail,
        patientName: patientFullName,
        subject: `✅ Constancia Oficial de Pago y Confirmación de Cita - NexoSalud #${reserva.id_reserva}`,
        amount: amountVal,
        serviceName,
        reservationDate,
        reservationTime,
        branch: branchName,
        professional: profName,
        filename: `Constancia_Pago_${reserva.id_reserva}`,
        isValidated: true
      }).then(resEmail => {
        console.log(`[AUTO-EMAIL] Constancia de pago enviada automáticamente a ${patientEmail}:`, resEmail);
      }).catch(err => {
        console.error('[AUTO-EMAIL ERROR] No se pudo enviar la constancia automática por correo:', err);
      });
    }

    res.json({ 
      message: 'Pago validado exitosamente, paciente transferido a CUSTOMER y constancia enviada al correo', 
      pago,
      personaId: persona.id_persona,
      emailSentTo: patientEmail || null
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

// Función reutilizable para envío de Avisos de Cobro y Constancias de Pago
export async function sendPaymentNoticeOrConfirmation(params: {
  toEmail: string;
  patientName?: string;
  subject?: string;
  message?: string;
  amount?: number | string;
  serviceName?: string;
  reservationDate?: string;
  reservationTime?: string;
  branch?: string;
  professional?: string;
  filename?: string;
  pdfBase64?: string;
  isValidated?: boolean;
}) {
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
    filename,
    pdfBase64,
    isValidated
  } = params;

  if (!toEmail) {
    return { success: false, error: 'El correo electrónico es obligatorio.' };
  }

  const formattedAmount = Number(amount || 0).toFixed(2);
  const emailSubject = subject || (isValidated 
    ? `Constancia Oficial de Pago y Confirmación de Cita - Clínica NexoSalud`
    : `Aviso de Cobro y Proforma Oficial - Clínica NexoSalud`);
  
  const titleHeader = isValidated ? 'Constancia Oficial de Pago & Reserva' : 'Aviso de Cobranza & Proforma de Tratamiento';
  const defaultBody = isValidated
    ? `Nos complace confirmarle que su pago por un importe de S/ ${formattedAmount} ha sido validado exitosamente. Su cita odontológica se encuentra confirmada y programada en nuestra agenda.`
    : (message ? message.replace(/\n/g, '<br/>') : 'Le recordamos que mantiene un importe pendiente de regularización correspondiente a su atención odontológica programada.');

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, ${isValidated ? '#059669 0%, #10b981 100%' : '#0f766e 0%, #0d9488 100%'}); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 28px 24px; }
        .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .message-box { background-color: #f8fafc; border-left: 4px solid ${isValidated ? '#10b981' : '#0d9488'}; padding: 14px 18px; border-radius: 0 10px 10px 0; margin-bottom: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
        .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${isValidated ? '#059669' : '#0d9488'}; margin-top: 0; margin-bottom: 12px; letter-spacing: 0.5px; }
        .grid { display: table; width: 100%; }
        .grid-row { display: table-row; }
        .grid-col { display: table-cell; padding-bottom: 8px; font-size: 13px; }
        .col-label { color: #64748b; font-weight: 600; width: 40%; }
        .col-val { color: #0f172a; font-weight: 700; width: 60%; }
        .total-banner { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
        .total-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0f766e; }
        .total-amount { font-size: 28px; font-weight: 800; color: #0f766e; margin: 4px 0 0 0; font-family: monospace; }
        .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Clínica Odontológica NexoSalud</h1>
          <p>${titleHeader}</p>
        </div>
        <div class="content">
          <div class="greeting">Estimado(a) ${patientName || 'Paciente'},</div>
          
          <div class="message-box">
            ${defaultBody}
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
            <div class="total-label">${isValidated ? 'Monto Abonado y Conciliado' : 'Monto Total a Abonar'}</div>
            <div class="total-amount">S/ ${formattedAmount}</div>
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 20px; text-align: center;">
            <em>📎 ${isValidated ? 'Adjunto en este correo encontrará su Constancia Oficial de Pago.' : 'Adjunto en este correo encontrará el documento formal en PDF (Proforma de Aviso de Cobro).'}</em>
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
    cleanBase64 = cleanBase64.replace(/[\r\n\s]+/g, '');
  }

  const patientFileSlug = (patientName || 'Paciente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const pdfFileName = filename
    ? (filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
    : (isValidated ? `Constancia_Pago_${patientFileSlug}.pdf` : `Proforma_Cobro_${patientFileSlug}.pdf`);

  // 1. MÉTODO 100% GARANTIZADO EN RENDER (HTTPS Port 443): Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    console.log(`[EMAIL DISPATCHER] Despachando correo vía RESEND HTTPS API a: ${toEmail} (Adjunto: ${pdfFileName})`);
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

    return {
      success: true,
      provider: 'resend',
      message: `Documento enviado con éxito al correo ${toEmail}.`,
      toEmail,
      hasAttachment: !!cleanBase64
    };
  }

  // 2. MÉTODO 2: Brevo HTTPS API (Port 443)
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    console.log(`[EMAIL DISPATCHER] Despachando correo vía BREVO HTTPS API a: ${toEmail}`);
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

    return {
      success: true,
      provider: 'brevo',
      message: `Documento enviado con éxito al correo ${toEmail}.`,
      toEmail,
      hasAttachment: !!cleanBase64
    };
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

    const attachments: any[] = [];
    if (cleanBase64) {
      attachments.push({
        filename: pdfFileName,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    }

    await transporter.sendMail({
      from: `"Clínica NexoSalud" <${smtpUser}>`,
      to: toEmail,
      subject: emailSubject,
      html: htmlBody,
      attachments
    });

    return {
      success: true,
      provider: 'smtp',
      message: `Documento enviado con éxito al correo ${toEmail}.`,
      toEmail,
      hasAttachment: attachments.length > 0
    };
  }

  // 4. MODO SIMULACIÓN (si no hay credenciales configuradas)
  console.log(`[EMAIL DISPATCHER] Enviando correo simulado a: ${toEmail} | Asunto: ${emailSubject}`);
  return {
    success: true,
    simulated: true,
    message: `Documento enviado correctamente a ${toEmail}.`,
    toEmail,
    hasAttachment: !!cleanBase64
  };
}

// Endpoint para enviar aviso o constancia PDF por correo
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
    filename,
    pdfBase64,
    isValidated
  } = req.body;

  if (!toEmail) {
    return res.status(400).json({ error: 'El correo electrónico del paciente es obligatorio.' });
  }

  try {
    const result = await sendPaymentNoticeOrConfirmation({
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
      filename,
      pdfBase64,
      isValidated
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Error al enviar correo en backend:', error);
    res.status(500).json({ error: error.message || 'Error al procesar el envío del correo.' });
  }
});

export default router;
