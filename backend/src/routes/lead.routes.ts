import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { canvaService } from '../services/canvaService';
import { negotiatorAgentService } from '../services/negotiatorAgentService';

const router = Router();
const prisma = new PrismaClient();

// ── Catálogos para el formulario de alternativas ─────────────────────────────
router.get('/options/availability', async (req, res) => {
  try {
    const profesionales = await prisma.profesionales.findMany({ where: { activo: true } });
    const sedes = await prisma.sedes.findMany({ where: { activo: true } });
    const servicios = await prisma.servicios.findMany({
      where: { activo: true },
      include: {
        Tarifas: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        }
      }
    });
    const disponibilidades = await prisma.disponibilidad.findMany({
      where: { estado: 'Disponible' },
      include: { Profesional: true, Sede: true },
      orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
    });

    res.json({ profesionales, sedes, servicios, disponibilidades });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// ── Eliminar alternativa (options antes de :id para no colisionar) ────────────
router.put('/options/:id_opcion', async (req, res) => {
  const { id_opcion } = req.params;
  const { precio_ofrecido, condiciones } = req.body;
  try {
    const updated = await prisma.opciones.update({
      where: { id_opcion: Number(id_opcion) },
      data: { precio_ofrecido: Number(precio_ofrecido) },
      include: { Disponibilidad: { include: { Profesional: true, Sede: true } } }
    });
    res.json({ message: 'Alternativa actualizada exitosamente', data: updated });
  } catch (error) {
    console.error('Error al actualizar alternativa:', error);
    res.status(500).json({ error: 'Error al actualizar alternativa' });
  }
});

router.delete('/options/:id_opcion', async (req, res) => {
  const { id_opcion } = req.params;
  try {
    await prisma.reservas.deleteMany({ where: { id_opcion: Number(id_opcion) } });
    await prisma.opciones.delete({ where: { id_opcion: Number(id_opcion) } });
    res.json({ message: 'Alternativa eliminada del tablero exitosamente' });
  } catch (error) {
    console.error('Error al eliminar alternativa:', error);
    res.status(500).json({ error: 'Error al eliminar alternativa' });
  }
});

// ── Detalle de un LEAD específico (con info completa del paciente) ────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await prisma.personas.findUnique({
      where: { id_persona: Number(id) },
      include: {
        Etapa: true,
        CanalOrigen: true,
        Preferencias: {
          include: {
            Canal: true,
            Horario: true,
            Modalidad: true,
            ServicioInteres: true,
          }
        },
        DatosAcademicos: true,
        DatosLaborales: true,
        SaludOdontologica: true,
        Interacciones: {
          include: { Canal: true, Fuente: true },
          orderBy: { fecha_hora: 'desc' },
          take: 5,
        },
        Solicitudes: {
          include: {
            Servicio: true,
            Opciones: {
              include: {
                Disponibilidad: {
                  include: { Profesional: true, Sede: true }
                }
              }
            }
          },
          orderBy: { fecha_solicitud: 'desc' },
        },
      }
    });

    if (!lead) return res.status(404).json({ error: 'LEAD no encontrado' });
    res.json(lead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos del LEAD' });
  }
});

// ── Reserva y conversión a PAYER ──────────────────────────────────────────────
router.post('/:id/reserve', async (req, res) => {
  const { id } = req.params;
  const { id_solicitud, id_opcion } = req.body;

  try {
    let etapaPayer = await prisma.etapas.findFirst({ where: { nombre: 'PAYER' } });
    if (!etapaPayer) etapaPayer = await prisma.etapas.create({ data: { nombre: 'PAYER', descripcion: 'Pago inicial validado' } });

    const etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });

    const result = await prisma.$transaction(async (tx) => {
      const opcion = await tx.opciones.update({
        where: { id_opcion: Number(id_opcion) },
        data: { seleccionada: true }
      });

      const reserva = await tx.reservas.create({
        data: {
          id_persona: Number(id),
          id_solicitud: Number(id_solicitud),
          id_opcion: opcion.id_opcion,
          estado: 'Pendiente',
        }
      });

      await tx.personas.update({
        where: { id_persona: Number(id) },
        data: { id_etapa_actual: etapaPayer!.id_etapa }
      });

      await tx.eventosEtapa.create({
        data: {
          id_persona: Number(id),
          etapa_origen: etapaLead?.id_etapa,
          etapa_destino: etapaPayer!.id_etapa,
          motivo: 'Reserva confirmada en negociación'
        }
      });

      await tx.disponibilidad.update({
        where: { id_disponibilidad: opcion.id_disponibilidad },
        data: { estado: 'Ocupado' }
      });

      return { reserva, opcion };
    });

    res.status(201).json({ message: 'Reserva creada. Estado convertido a PAYER.', data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la reserva' });
  }
});

// ── Lista de LEADS ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const personas = await prisma.personas.findMany({
      orderBy: { fecha_registro: 'desc' },
      include: {
        Etapa: true,
        Preferencias: true,
        Solicitudes: { 
          include: { 
            Servicio: true, 
            Reservas: { include: { Pagos: true } },
            Opciones: true 
          } 
        },
        EventosEtapa: {
          orderBy: { fecha_hora: 'desc' },
          take: 1
        }
      }
    });

    const leads = personas
      .filter(p => p.Etapa.nombre === 'LEAD' || p.Etapa.nombre === 'PAYER')
      .map(p => {
        const sol = p.Solicitudes.length > 0 ? p.Solicitudes[0] : null;
        const lastEvento = p.EventosEtapa.length > 0 ? p.EventosEtapa[0] : null;

        let state = 'IN_NEGOTIATION';
        let estado_negociacion = 'En negociación';
        let resultado_final: string | undefined = undefined;
        let motivo_cierre = sol?.motivo || undefined;
        let fecha_cierre = sol?.fecha_cierre ? sol.fecha_cierre.toISOString() : undefined;

        if (p.Etapa.nombre === 'PAYER' || sol?.estado === 'Convertida') {
          state = 'PAYMENT_REQUESTED';
          estado_negociacion = 'Cerrada';
          resultado_final = 'Convertido';
        } else if (
          sol?.estado === 'Abandonada' ||
          sol?.estado === 'Perdida' ||
          sol?.estado === 'Cancelada' ||
          p.estado_calidad === 'Descartado' ||
          p.estado_calidad === 'Rechazado'
        ) {
          state = 'LOST';
          estado_negociacion = 'Cerrada';
          resultado_final = 'Abandonado';
          motivo_cierre = lastEvento?.motivo || sol?.motivo || 'Negociación abandonada por el prospecto';
        } else if (sol?.Opciones && sol.Opciones.some(o => o.seleccionada)) {
          state = 'ALTERNATIVE_SELECTED';
        }

        const servicio = sol && sol.Servicio ? sol.Servicio.nombre : 'General';
        const reserva = sol && sol.Reservas.length > 0 ? sol.Reservas[0].id_reserva.toString() : undefined;
        const preferencias = p.Preferencias.length > 0 ? p.Preferencias[0].sede_preferida || '' : '';

        return {
          id: p.id_persona.toString(),
          buyerId: p.id_persona.toString(),
          requestedServiceId: servicio,
          state,
          createdAt: p.fecha_registro,
          reservationId: reserva,
          buyer: { preferences: preferencias },
          id_negociacion: sol?.id_solicitud || p.id_persona,
          estado_negociacion,
          resultado_final,
          fecha_cierre,
          motivo_cierre,
          fecha_hora_solicitud: sol?.fecha_solicitud ? sol.fecha_solicitud.toISOString() : p.fecha_registro.toISOString(),
          fecha_hora_primera_respuesta_util: sol?.fecha_primera_respuesta ? sol.fecha_primera_respuesta.toISOString() : undefined,
          firstResponseDate: sol?.fecha_primera_respuesta ? sol.fecha_primera_respuesta.toISOString() : undefined,
          person: {
            firstName: p.nombres,
            lastName: p.apellidos,
            documentNumber: p.dni,
            phone: p.numero,
            email: p.email,
          }
        };
      });

    res.json(leads);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// ── Marcar LEAD como Abandonado / Perdido ──────────────────────────────────
router.post('/:id/abandon', async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  const numId = Number(id);
  try {
    if (isNaN(numId)) return res.status(400).json({ error: 'ID inválido' });

    // 1. Actualizar solicitud si existe
    const sol = await prisma.solicitudes.findFirst({
      where: { id_persona: numId },
      orderBy: { fecha_solicitud: 'desc' }
    });
    if (sol) {
      await prisma.solicitudes.update({
        where: { id_solicitud: sol.id_solicitud },
        data: {
          estado: 'Abandonada',
          fecha_cierre: new Date(),
          motivo: motivo || 'Negociación abandonada por el prospecto'
        }
      });
    }

    // 2. Actualizar estado de calidad en Persona
    await prisma.personas.update({
      where: { id_persona: numId },
      data: { estado_calidad: 'Descartado' }
    });

    // 3. Registrar Evento de Etapa en EventosEtapa
    const etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    await prisma.eventosEtapa.create({
      data: {
        id_persona: numId,
        etapa_origen: etapaLead?.id_etapa,
        etapa_destino: etapaLead?.id_etapa || 2,
        motivo: motivo ? `Abandonado: ${motivo}` : 'Negociación finalizada: Resultado Abandonado',
        evidencia: 'Cierre manual en mesa de negociación'
      }
    });

    res.json({ message: 'Lead marcado como abandonado con éxito' });
  } catch (error) {
    console.error('Error al abandonar lead:', error);
    res.status(500).json({ error: 'Error al procesar abandono de lead' });
  }
});

// ── Actualizar un LEAD ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    res.json({ message: 'Lead actualizado', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar LEAD' });
  }
});

// ── Añadir alternativa a la mesa de negociación ────────────────────────────
router.post('/:id/alternative', async (req, res) => {
  const { id } = req.params;
  const { id_solicitud, id_disponibilidad, precio_ofrecido, condiciones, fecha, hora_inicio, hora_fin, id_profesional, id_sede } = req.body;
  try {
    // Si no viene id_solicitud, buscar o crear una
    let solicitudId = Number(id_solicitud);
    if (!solicitudId) {
      const existingSol = await prisma.solicitudes.findFirst({ where: { id_persona: Number(id) } });
      if (existingSol) {
        solicitudId = existingSol.id_solicitud;
      } else {
        const newSol = await prisma.solicitudes.create({ data: { id_persona: Number(id), motivo: 'Negociación en mesa' } });
        solicitudId = newSol.id_solicitud;
      }
    }

    let dispId = Number(id_disponibilidad);

    // Si es un horario personalizado y no tiene id_disponibilidad previo, crearlo en la tabla Disponibilidad
    if ((!dispId || isNaN(dispId)) && fecha) {
      const defaultProf = await prisma.profesionales.findFirst({ where: { activo: true } });
      const defaultSede = await prisma.sedes.findFirst({ where: { activo: true } });

      const startH = hora_inicio || '09:00';
      const endH = hora_fin || '10:00';

      const newDisp = await prisma.disponibilidad.create({
        data: {
          id_profesional: Number(id_profesional) || defaultProf?.id_profesional || 1,
          id_sede: Number(id_sede) || defaultSede?.id_sede || 1,
          fecha: new Date(fecha),
          hora_inicio: new Date(`1970-01-01T${startH}:00`),
          hora_fin: new Date(`1970-01-01T${endH}:00`),
          estado: 'Disponible'
        }
      });
      dispId = newDisp.id_disponibilidad;
    }

    if (!dispId || isNaN(dispId)) {
      return res.status(400).json({ error: 'Debes seleccionar una fecha y horario disponible.' });
    }

    const opcion = await prisma.opciones.create({
      data: {
        id_solicitud: solicitudId,
        id_disponibilidad: dispId,
        precio_ofrecido: Number(precio_ofrecido) || 150.00,
        seleccionada: false,
      },
      include: { Disponibilidad: { include: { Profesional: true, Sede: true } } }
    });

    res.json({ message: 'Alternativa registrada en el tablero', data: opcion });
  } catch (error: any) {
    console.error('Error al añadir alternativa:', error);
    res.status(500).json({ error: error.message || 'Error al añadir alternativa' });
  }
});

// ── Agente Negociador + Canva Connect API + Nodemailer ──────────────────────
router.post('/negotiate-and-dispatch', async (req, res) => {
  const {
    leadId,
    patientName,
    patientEmail,
    patientPhone,
    serviceName,
    branchName,
    preferredSchedule,
    category,
    customDiscountPercent,
    customValidityHours
  } = req.body;

  let targetEmail = patientEmail;
  let targetName = patientName;
  let targetPhone = patientPhone;
  let targetService = serviceName;
  let targetBranch = branchName;
  let targetSchedule = preferredSchedule;

  // Si se envió un leadId, buscar y enriquecer con los datos de la base de datos
  if (leadId) {
    try {
      const lead = await prisma.personas.findUnique({
        where: { id_persona: Number(leadId) },
        include: {
          Solicitudes: {
            include: { Servicio: true },
            orderBy: { fecha_solicitud: 'desc' },
            take: 1
          },
          Preferencias: {
            include: { Horario: true, Modalidad: true },
            take: 1
          }
        }
      });

      if (lead) {
        targetName = targetName || `${lead.nombres} ${lead.apellidos || ''}`.trim();
        targetEmail = targetEmail || lead.email || '';
        targetPhone = targetPhone || lead.numero || '';
        if (lead.Solicitudes?.[0]?.Servicio?.nombre) {
          targetService = targetService || lead.Solicitudes[0].Servicio.nombre;
        }
        if (lead.zona) {
          targetBranch = targetBranch || `Sede ${lead.zona}`;
        }
      }
    } catch (e) {
      console.warn('[negotiate-and-dispatch] No se pudo cargar lead de la BD:', e);
    }
  }

  if (!targetEmail) {
    return res.status(400).json({ error: 'El correo electrónico del paciente es obligatorio para el despacho de la oferta.' });
  }

  try {
    console.log(`[negotiate-and-dispatch] Ejecutando Agente Negociador para ${targetName} (${targetEmail})...`);

    // 1. Agente Negociador Inteligente: Formula estrategia comercial y redacción
    const strategy = negotiatorAgentService.generateStrategy({
      leadId: leadId ? Number(leadId) : undefined,
      patientName: targetName || 'Paciente',
      patientEmail: targetEmail,
      patientPhone: targetPhone,
      serviceName: targetService || 'Consulta Odontológica Especializada',
      branchName: targetBranch || 'Sede Principal NexoSalud',
      preferredSchedule: targetSchedule || 'Horario Flexible',
      category,
      customDiscountPercent: customDiscountPercent ? Number(customDiscountPercent) : undefined,
      customValidityHours: customValidityHours ? Number(customValidityHours) : undefined,
    });

    // 2. Canva Connect API: Genera la imagen promocional oficial
    console.log('[negotiate-and-dispatch] Generando imagen con Canva Connect API...');
    const canvaResult = await canvaService.generateOfferImage(strategy.canvaData);

    // 3. Nodemailer: Despacho del correo electrónico con plantilla HTML y PNG incrustado
    console.log(`[negotiate-and-dispatch] Enviando correo con Nodemailer a ${targetEmail}...`);
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').trim();
    const isGmail = smtpHost.includes('gmail.com');
    const cleanPass = isGmail ? smtpPass.replace(/\s+/g, '') : smtpPass;

    if (!smtpUser || !cleanPass) {
      console.warn('[negotiate-and-dispatch] SMTP no configurado completamente.');
      return res.json({
        success: true,
        mockSent: true,
        message: 'Estrategia de IA e imagen de Canva generadas exitosamente (Servidor SMTP simulado).',
        strategy,
        canva: {
          imageUrl: canvaResult.imageUrl,
          isFallback: canvaResult.isFallback
        }
      });
    }

    const transporter = nodemailer.createTransport({
      ...(isGmail ? { service: 'gmail' } : { host: smtpHost, port: smtpPort, secure: smtpPort === 465 }),
      auth: {
        user: smtpUser,
        pass: cleanPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 12000,
      tls: { rejectUnauthorized: false }
    });

    const attachments: any[] = [];
    if (canvaResult.imageBuffer) {
      attachments.push({
        filename: 'propuesta_nexosalud.png',
        content: canvaResult.imageBuffer,
        cid: 'canvaOfferImage',
      });
    }

    const mailOptions = {
      from: `"NexoSalud Odontología" <${smtpUser}>`,
      to: targetEmail,
      subject: strategy.emailSubject,
      html: strategy.emailHtml,
      attachments,
    };

    const mailInfo = await transporter.sendMail(mailOptions);
    console.log('[negotiate-and-dispatch] ¡Correo enviado con éxito! MessageId:', mailInfo.messageId);

    // 4. Registrar interacción en la BD si existe el leadId
    if (leadId) {
      try {
        await prisma.interacciones.create({
          data: {
            id_persona: Number(leadId),
            id_canal: 1, // Email / Web
            id_fuente: 1,
            tipo: 'OFERTA_CANVA_EMAIL',
            contenido: `Oferta comercial automática enviada por IA & Canva: ${strategy.serviceName} a S/ ${strategy.offeredPrice.toFixed(2)} (${strategy.benefitDescription}). Asunto: "${strategy.emailSubject}"`,
            respuesta_obtenida: 'Correo entregado exitosamente'
          }
        });
      } catch (logErr) {
        console.warn('[negotiate-and-dispatch] No se pudo registrar log de interacción:', logErr);
      }
    }

    res.json({
      success: true,
      messageId: mailInfo.messageId,
      message: `¡Oferta comercial personalizada y banner gráfico de Canva enviados exitosamente a ${targetEmail}!`,
      strategy,
      canva: {
        imageUrl: canvaResult.imageUrl,
        isFallback: canvaResult.isFallback
      }
    });
  } catch (error: any) {
    console.error('[negotiate-and-dispatch] Error:', error);
    res.status(500).json({ error: error.message || 'Error al procesar la negociación y despacho de oferta.' });
  }
});

// ── Eliminar un LEAD ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  try {
    if (!isNaN(numId)) {
      await prisma.pagos.deleteMany({ where: { id_persona: numId } });
      await prisma.atenciones.deleteMany({ where: { id_persona: numId } });
      await prisma.reservas.deleteMany({ where: { id_persona: numId } });
      const solicitudes = await prisma.solicitudes.findMany({ where: { id_persona: numId } });
      for (const sol of solicitudes) {
        await prisma.opciones.deleteMany({ where: { id_solicitud: sol.id_solicitud } });
      }
      await prisma.solicitudes.deleteMany({ where: { id_persona: numId } });
      await prisma.eventosEtapa.deleteMany({ where: { id_persona: numId } });
      await prisma.interacciones.deleteMany({ where: { id_persona: numId } });
      await prisma.personaPreferencias.deleteMany({ where: { id_persona: numId } });
      await prisma.datosAcademicos.deleteMany({ where: { id_persona: numId } });
      await prisma.datosLaborales.deleteMany({ where: { id_persona: numId } });
      await prisma.personas.delete({ where: { id_persona: numId } });
    }
    res.json({ message: 'Lead eliminado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

export default router;

