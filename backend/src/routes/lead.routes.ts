import { Router } from 'express';
import { prisma, withRetry } from '../db';
import { NegotiatorAgentService } from '../services/negotiatorAgentService';
import { CanvaService } from '../services/canvaService';

const router = Router();

// ── Catálogos para el formulario de alternativas ─────────────────────────────
router.get('/options/availability', async (req, res) => {
  try {
    const data = await withRetry(async () => {
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
      return { profesionales, sedes, servicios, disponibilidades };
    });

    res.json(data);
  } catch (error) {
    console.error('Error al obtener disponibilidad:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// ── Eliminar alternativa (options antes de :id para no colisionar) ────────────
router.put('/options/:id_opcion', async (req, res) => {
  const { id_opcion } = req.params;
  const { precio_ofrecido, condiciones } = req.body;
  try {
    const updated = await withRetry(() => prisma.opciones.update({
      where: { id_opcion: Number(id_opcion) },
      data: { precio_ofrecido: Number(precio_ofrecido) },
      include: { Disponibilidad: { include: { Profesional: true, Sede: true } } }
    }));
    res.json({ message: 'Alternativa actualizada exitosamente', data: updated });
  } catch (error) {
    console.error('Error al actualizar alternativa:', error);
    res.status(500).json({ error: 'Error al actualizar alternativa' });
  }
});

router.delete('/options/:id_opcion', async (req, res) => {
  const { id_opcion } = req.params;
  try {
    await withRetry(async () => {
      await prisma.reservas.deleteMany({ where: { id_opcion: Number(id_opcion) } });
      await prisma.opciones.delete({ where: { id_opcion: Number(id_opcion) } });
    });
    res.json({ message: 'Alternativa eliminada del tablero exitosamente' });
  } catch (error) {
    console.error('Error al eliminar alternativa:', error);
    res.status(500).json({ error: 'Error al eliminar alternativa' });
  }
});

// ── Detalle de un LEAD específico (con info completa del paciente) ────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id) || Number(id.replace(/\D/g, ''));
  if (isNaN(numId) || !numId) {
    return res.status(400).json({ error: 'ID de LEAD inválido' });
  }

  try {
    const lead = await withRetry(() => prisma.personas.findUnique({
      where: { id_persona: numId },
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
    }));

    if (!lead) return res.status(404).json({ error: 'LEAD no encontrado' });
    res.json(lead);
  } catch (error) {
    console.error('Error al obtener datos del LEAD:', error);
    res.status(500).json({ error: 'Error al obtener datos del LEAD' });
  }
});

// ── Reserva y conversión a PAYER ──────────────────────────────────────────────
router.post('/:id/reserve', async (req, res) => {
  const { id } = req.params;
  const { id_solicitud, id_opcion } = req.body;

  try {
    let etapaPayer = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'PAYER' } }));
    if (!etapaPayer) etapaPayer = await withRetry(() => prisma.etapas.create({ data: { nombre: 'PAYER', descripcion: 'Pago inicial validado' } }));

    const etapaLead = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'LEAD' } }));

    const result = await withRetry(() => prisma.$transaction(async (tx) => {
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
    }));

    res.status(201).json({ message: 'Reserva creada. Estado convertido a PAYER.', data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la reserva' });
  }
});

// ── Lista de LEADS ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const personas = await withRetry(() => prisma.personas.findMany({
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
    }));

    const leads = personas
      .filter(p => p.Etapa?.nombre === 'LEAD' || p.Etapa?.nombre === 'PAYER')
      .map(p => {
        const sol = p.Solicitudes.length > 0 ? p.Solicitudes[0] : null;
        const lastEvento = p.EventosEtapa.length > 0 ? p.EventosEtapa[0] : null;

        let state = 'IN_NEGOTIATION';
        let estado_negociacion = 'En negociación';
        let resultado_final: string | undefined = undefined;
        let motivo_cierre = sol?.motivo || undefined;
        let fecha_cierre = sol?.fecha_cierre ? sol.fecha_cierre.toISOString() : undefined;
        if (p.Etapa?.nombre === 'PAYER') state = 'PAYMENT_REQUESTED';

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

// ── Negociación Omnicanal & Generación de Flyer en Canva (Actividad 3) ───────
router.post('/:id/negotiate-and-dispatch', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const {
    serviceName,
    sedeName,
    offeredPrice,
    originalPrice,
    discountPct,
    expirationDate,
    conditions,
    sendEmail,
    canvaTemplateId
  } = req.body;

  try {
    const lead = await prisma.personas.findUnique({
      where: { id_persona: numId },
      include: { Preferencias: true }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    const leadName = `${lead.nombres} ${lead.apellidos}`.trim();
    const result = await NegotiatorAgentService.processAndDispatch({
      leadId: numId,
      leadName,
      leadEmail: lead.email || undefined,
      leadPhone: lead.numero || undefined,
      serviceName: serviceName || 'Consulta Dental Especializada',
      sedeName: sedeName || 'Sede Principal',
      offeredPrice: Number(offeredPrice) || 150,
      originalPrice: Number(originalPrice) || 180,
      discountPct: Number(discountPct) || 15,
      expirationDate: expirationDate || '48 Horas',
      conditions: conditions || 'Promoción con garantía clínica',
      canvaTemplateId: canvaTemplateId || 'EAHWLEXZ1lo',
      sendEmail: Boolean(sendEmail),
    });

    // Registrar interacción omnicanal en BD
    try {
      const canalWhatsApp = await prisma.canales.findFirst({ where: { nombre: 'WhatsApp' } });
      await prisma.interacciones.create({
        data: {
          id_persona: numId,
          id_canal: canalWhatsApp?.id_canal || 1,
          tipo: 'Envío de Propuesta Comercial con Flyer Canva',
          mensaje_entrante: 'Propuesta comercial generada',
          respuesta_sistema: result.whatsAppMessage,
        }
      });
    } catch (logErr) {
      console.warn('⚠️ No se pudo registrar la interacción en BD:', logErr);
    }

    res.json({
      message: 'Propuesta comercial y Flyer de Canva generados exitosamente.',
      data: result
    });
  } catch (error: any) {
    console.error('Error al despachar propuesta:', error);
    res.status(500).json({ error: error.message || 'Error al procesar propuesta comercial' });
  }
});

// ── Generar Flyer Directo Canva Autofill ─────────────────────────────────────
router.post('/canva/autofill', async (req, res) => {
  try {
    const params = req.body;
    const result = await CanvaService.generateFlyer(params);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error al generar flyer en Canva:', error);
    res.status(500).json({ error: error.message || 'Error en Canva Autofill' });
  }
});

export default router;
