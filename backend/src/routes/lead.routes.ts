import { Router } from 'express';
import { prisma, withRetry } from '../db';
import { NegotiatorAgentService } from '../services/negotiatorAgentService';

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
  const { precio_ofrecido, condiciones, id_sede, id_profesional, fecha } = req.body;
  try {
    const numIdOpcion = Number(id_opcion);
    if (isNaN(numIdOpcion)) return res.status(400).json({ error: 'ID de opción inválido' });

    const opcionExistente = await withRetry(() => prisma.opciones.findUnique({
      where: { id_opcion: numIdOpcion },
      include: { Disponibilidad: true }
    }));

    if (!opcionExistente) {
      return res.status(404).json({ error: 'Opción no encontrada' });
    }

    if (opcionExistente.id_disponibilidad) {
      const dispData: any = {};
      if (id_sede) dispData.id_sede = Number(id_sede);
      if (id_profesional) dispData.id_profesional = Number(id_profesional);
      if (fecha) dispData.fecha = new Date(fecha);

      if (Object.keys(dispData).length > 0) {
        await withRetry(() => prisma.disponibilidad.update({
          where: { id_disponibilidad: opcionExistente.id_disponibilidad },
          data: dispData
        }));
      }
    }

    const updated = await withRetry(() => prisma.opciones.update({
      where: { id_opcion: numIdOpcion },
      data: {
        precio_ofrecido: precio_ofrecido !== undefined ? Number(precio_ofrecido) : undefined,
      },
      include: { Disponibilidad: { include: { Profesional: true, Sede: true } } }
    }));

    res.json({ message: 'Alternativa actualizada exitosamente', data: updated });
  } catch (error: any) {
    console.error('Error al actualizar alternativa:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar alternativa' });
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

        const consultasCount = Math.max(p.Solicitudes.length, 1);

        return {
          id: p.id_persona.toString(),
          buyerId: p.id_persona.toString(),
          requestedServiceId: servicio,
          state,
          createdAt: p.fecha_registro,
          reservationId: reserva,
          buyer: { preferences: preferencias, consultasCount },
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

// ── Generar Flyer Publicitario con Canva Connect API ──────────────────────────
router.post('/:id/canva-flyer', async (req, res) => {
  const { id } = req.params;
  const {
    serviceName,
    sedeName,
    doctorName,
    offeredPrice,
    originalPrice,
    discountPct,
    expirationDate,
    fechaLimite,
    tituloFlyer,
    conditions,
    sendEmail,
    leadEmail,
    leadPhone,
  } = req.body;

  try {
    const lead = await withRetry(() =>
      prisma.personas.findUnique({
        where: { id_persona: Number(id) },
        include: {
          Solicitudes: {
            include: {
              Servicio: true,
            },
          },
        },
      })
    );

    const leadName = lead ? `${lead.nombres} ${lead.apellidos}` : 'Paciente';
    const finalEmail = leadEmail || lead?.email || undefined;
    const finalPhone = leadPhone || lead?.numero || undefined;

    const numOffered = Number(offeredPrice) || 150;
    const numOriginal = Number(originalPrice) || 180;
    let computedDiscount = Number(discountPct);
    if (isNaN(computedDiscount) || computedDiscount <= 0) {
      if (numOriginal > numOffered) {
        computedDiscount = Math.round(((numOriginal - numOffered) / numOriginal) * 100);
      } else {
        computedDiscount = 20;
      }
    }

    const result = await NegotiatorAgentService.processAndDispatch({
      leadId: Number(id),
      leadName,
      leadEmail: finalEmail,
      leadPhone: finalPhone,
      serviceName: serviceName || lead?.Solicitudes?.[0]?.Servicio?.nombre || 'Consulta Odontológica',
      sedeName: sedeName || 'Sede Miraflores - Av. Larco 123',
      offeredPrice: numOffered,
      originalPrice: numOriginal,
      discountPct: computedDiscount,
      expirationDate: expirationDate || 'Vigente por 7 días',
      fechaLimite: fechaLimite || expirationDate,
      tituloFlyer,
      conditions: conditions || 'Garantía clínica y reserva asegurada.',
      canvaTemplateId: process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID || 'EAHWLEXZ1lo',
      sendEmail: Boolean(sendEmail),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error al generar flyer en Canva:', error);
    res.status(500).json({ error: error.message || 'Error al procesar el flyer con Canva' });
  }
});

// ── Enviar Correo de Oferta en Modo Simulación (al correo personal/prueba) ─────
router.post(['/send-offer-email', '/:id/send-email'], async (req, res) => {
  const id = req.params.id || req.body.leadId;
  const {
    serviceName,
    sedeName,
    offeredPrice,
    originalPrice,
    discountPct,
    expirationDate,
    conditions,
    leadEmail,
    leadPhone,
    canvaFlyerUrl,
    canvaDesignUrl,
  } = req.body;

  try {
    const lead = id
      ? await withRetry(() =>
          prisma.personas.findUnique({
            where: { id_persona: Number(id) },
            include: {
              Solicitudes: {
                include: {
                  Servicio: true,
                },
              },
            },
          })
        )
      : null;

    const leadName = lead ? `${lead.nombres} ${lead.apellidos}` : 'Paciente';
    const finalEmail = leadEmail || lead?.email || undefined;
    const finalPhone = leadPhone || lead?.numero || undefined;

    const numOffered = Number(offeredPrice) || 150;
    const numOriginal = Number(originalPrice) || 180;
    let computedDiscount = Number(discountPct);
    if (isNaN(computedDiscount) || computedDiscount <= 0) {
      if (numOriginal > numOffered) {
        computedDiscount = Math.round(((numOriginal - numOffered) / numOriginal) * 100);
      } else {
        computedDiscount = 20;
      }
    }

    const result = await NegotiatorAgentService.sendSimulationOfferEmail({
      leadId: Number(id),
      leadName,
      leadEmail: finalEmail,
      leadPhone: finalPhone,
      serviceName: serviceName || lead?.Solicitudes?.[0]?.Servicio?.nombre || 'Consulta Odontológica',
      sedeName: sedeName || 'Sede Miraflores - Av. Larco 123',
      offeredPrice: numOffered,
      originalPrice: numOriginal,
      discountPct: computedDiscount,
      expirationDate: expirationDate || 'Vigente por 7 días',
      conditions: conditions || 'Garantía clínica y reserva asegurada.',
      canvaFlyerUrl: canvaFlyerUrl || undefined,
      canvaDesignUrl: canvaDesignUrl || undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error al enviar correo de simulación:', error);
    res.status(500).json({ error: error.message || 'Error al enviar correo' });
  }
});


// ── Obtener datos públicos de la oferta para pre-reserva online ──────────────
router.get('/public/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (isNaN(numId)) return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    const lead = await withRetry(() =>
      prisma.personas.findUnique({
        where: { id_persona: numId },
        include: {
          Solicitudes: {
            orderBy: { fecha_solicitud: 'desc' },
            take: 1,
            include: {
              Servicio: {
                include: { Tarifas: { where: { activo: true }, take: 1 } }
              },
              Opciones: {
                include: {
                  Disponibilidad: {
                    include: { Sede: true, Profesional: true }
                  }
                },
                orderBy: { id_opcion: 'desc' }
              }
            }
          },
          SaludOdontologica: {
            orderBy: { id_salud_odonto: 'desc' },
            take: 1
          },
          Preferencias: true
        }
      })
    );

    if (!lead) {
      return res.status(404).json({ error: 'No se encontró la propuesta comercial para este paciente.' });
    }

    const sol = lead.Solicitudes?.[0];
    const opciones = sol?.Opciones || [];
    const activeOpt = opciones.find(o => o.seleccionada) || (opciones.length > 0 ? opciones[0] : null);

    const sedesList = await withRetry(() => prisma.sedes.findMany({ where: { activo: true } }));

    const serviceName = sol?.Servicio?.nombre || 'Consulta Odontológica';
    const originalPrice = Number(sol?.Servicio?.Tarifas?.[0]?.precio || 180);
    const offeredPrice = activeOpt ? Number(activeOpt.precio_ofrecido) : 150;
    const discountPct = originalPrice > 0 && offeredPrice < originalPrice
      ? Math.round(((originalPrice - offeredPrice) / originalPrice) * 100)
      : 20;

    const rawFecha = activeOpt?.Disponibilidad?.fecha ? activeOpt.Disponibilidad.fecha.toISOString().split('T')[0] : '';
    const rawHora = activeOpt?.Disponibilidad?.hora_inicio ? activeOpt.Disponibilidad.hora_inicio.toISOString().split('T')[1].substring(0, 5) : '10:00';

    res.json({
      id_persona: lead.id_persona,
      patientName: `${lead.nombres} ${lead.apellidos}`.trim(),
      firstName: lead.nombres,
      lastName: lead.apellidos,
      dni: lead.dni || '',
      phone: lead.numero || '',
      email: lead.email || '',
      serviceName,
      serviceDescription: sol?.Servicio?.descripcion || 'Atención odontológica integral con evaluación clínica completa.',
      originalPrice,
      offeredPrice,
      discountPct,
      expirationDate: rawFecha,
      sede: activeOpt?.Disponibilidad?.Sede?.nombre || 'Sede Miraflores - Av. Larco 123',
      sedeId: activeOpt?.Disponibilidad?.Sede?.id_sede || sedesList[0]?.id_sede || 1,
      doctor: activeOpt?.Disponibilidad?.Profesional?.apellidos ? `Esp. ${activeOpt.Disponibilidad.Profesional.nombres} ${activeOpt.Disponibilidad.Profesional.apellidos}` : 'Especialistas Colegiados',
      id_solicitud: sol?.id_solicitud,
      id_opcion: activeOpt?.id_opcion,
      id_disponibilidad: activeOpt?.id_disponibilidad,
      horaSugerida: rawHora,
      nivelDolor: lead.SaludOdontologica?.[0]?.nivel_dolor || 'Ninguno',
      alergias: lead.SaludOdontologica?.[0]?.condicion_atencion_especial || '',
      sedes: sedesList,
    });
  } catch (error: any) {
    console.error('Error al obtener oferta pública:', error);
    res.status(500).json({ error: error.message || 'Error al obtener oferta pública' });
  }
});

// ── Procesar Pre-Reserva Oficial desde la conversación / formulario web ───────
router.post('/public/:id/pre-reserve', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (isNaN(numId)) return res.status(400).json({ error: 'ID de paciente inválido' });

  const {
    dni,
    nombres,
    apellidos,
    numero,
    email,
    esParaFamiliar,
    nombreFamiliar,
    parentesco,
    id_opcion,
    id_solicitud,
    id_sede,
    fecha,
    hora,
    nivelDolor,
    alergias,
    canal_pago,
    dudaOComentario,
  } = req.body;

  try {
    let etapaPayer = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'PAYER' } }));
    if (!etapaPayer) etapaPayer = await withRetry(() => prisma.etapas.create({ data: { nombre: 'PAYER', descripcion: 'Pre-reserva y pago coordinado' } }));

    const etapaLead = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'LEAD' } }));

    const result = await withRetry(() =>
      prisma.$transaction(async (tx) => {
        // 1. Actualizar Persona con DNI, teléfono y autorización legal
        const updatedPersona = await tx.personas.update({
          where: { id_persona: numId },
          data: {
            dni: dni ? String(dni).substring(0, 8) : undefined,
            nombres: nombres || undefined,
            apellidos: apellidos || undefined,
            numero: numero || undefined,
            email: email || undefined,
            autoriza_contacto: true,
            fecha_autorizacion: new Date(),
            id_etapa_actual: etapaPayer!.id_etapa,
            fecha_actualizacion: new Date(),
          },
        });

        // 2. Si la atención es para un familiar, actualizar el motivo en Solicitudes
        let solId = Number(id_solicitud);
        if (!solId) {
          const s = await tx.solicitudes.findFirst({ where: { id_persona: numId }, orderBy: { fecha_solicitud: 'desc' } });
          solId = s ? s.id_solicitud : 1;
        }

        const detalleAtencion = esParaFamiliar && nombreFamiliar
          ? `[Atención para ${parentesco || 'Familiar'}: ${nombreFamiliar}] ${dudaOComentario || ''}`.trim()
          : (dudaOComentario ? `[Comentario: ${dudaOComentario}]` : undefined);

        if (detalleAtencion) {
          await tx.solicitudes.update({
            where: { id_solicitud: solId },
            data: {
              motivo: detalleAtencion,
              estado: 'Convertida',
            },
          });
        } else {
          await tx.solicitudes.update({
            where: { id_solicitud: solId },
            data: { estado: 'Convertida' },
          });
        }

        // 3. Registrar o actualizar antecedentes médicos en PersonaSaludOdontologica
        const existingSalud = await tx.personaSaludOdontologica.findFirst({ where: { id_persona: numId } });
        if (existingSalud) {
          await tx.personaSaludOdontologica.update({
            where: { id_salud_odonto: existingSalud.id_salud_odonto },
            data: {
              nivel_dolor: nivelDolor || existingSalud.nivel_dolor,
              condicion_atencion_especial: alergias || existingSalud.condicion_atencion_especial,
            },
          });
        } else if (nivelDolor || alergias) {
          await tx.personaSaludOdontologica.create({
            data: {
              id_persona: numId,
              nivel_dolor: nivelDolor || 'Ninguno',
              condicion_atencion_especial: alergias || 'Ninguna',
            },
          });
        }

        // 4. Seleccionar la opción en Opciones
        let optId = Number(id_opcion);
        let opcionActiva: any = null;
        if (optId) {
          opcionActiva = await tx.opciones.update({
            where: { id_opcion: optId },
            data: { seleccionada: true },
            include: { Disponibilidad: { include: { Sede: true, Profesional: true } } },
          });
        } else {
          opcionActiva = await tx.opciones.findFirst({
            where: { id_solicitud: solId },
            include: { Disponibilidad: { include: { Sede: true, Profesional: true } } },
          });
          if (opcionActiva) {
            await tx.opciones.update({
              where: { id_opcion: opcionActiva.id_opcion },
              data: { seleccionada: true },
            });
          }
        }

        const finalOptId = opcionActiva?.id_opcion || 1;
        const finalImporte = opcionActiva?.precio_ofrecido || 150.00;

        // 5. Crear la Reserva con código y bloqueo de 48 horas
        const fechaBloqueo = new Date(Date.now() + 48 * 3600 * 1000);
        const reserva = await tx.reservas.create({
          data: {
            id_persona: numId,
            id_solicitud: solId,
            id_opcion: finalOptId,
            estado: 'Pre-reservada',
            fecha_reserva: new Date(),
            fecha_vencimiento_bloqueo: fechaBloqueo,
            confirmacion_explicita: true,
            fecha_confirmacion: new Date(),
          },
        });

        // 6. Generar Pago en estado Pendiente con la modalidad seleccionada
        const refPago = `PR-${reserva.id_reserva.toString().padStart(5, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const pago = await tx.pagos.create({
          data: {
            id_persona: numId,
            id_reserva: reserva.id_reserva,
            importe: finalImporte,
            canal_pago: canal_pago || 'Efectivo en clínica',
            referencia_pago: refPago,
            estado: 'Pendiente',
            observaciones: 'Pre-reserva online acordada con el Agente Negociador.',
          },
        });

        // 7. Evento de Etapa: LEAD -> PAYER
        await tx.eventosEtapa.create({
          data: {
            id_persona: numId,
            etapa_origen: etapaLead?.id_etapa || 2,
            etapa_destino: etapaPayer!.id_etapa,
            motivo: 'Pre-reserva online confirmada por el paciente',
            evidencia: `Código de Pre-Reserva: NEXO-${reserva.id_reserva.toString().padStart(5, '0')}`,
          },
        });

        // 8. Marcar disponibilidad como Ocupada si se seleccionó turno
        if (opcionActiva?.id_disponibilidad) {
          await tx.disponibilidad.update({
            where: { id_disponibilidad: opcionActiva.id_disponibilidad },
            data: { estado: 'Ocupado' },
          });
        }

        // 9. Registrar interacción en la bitácora
        await tx.interacciones.create({
          data: {
            id_persona: numId,
            tipo: 'Portal Web Pre-Reserva',
            mensaje: `Pre-reserva emitida por el paciente. Canal de pago: ${canal_pago || 'En clínica'}. Código: NEXO-${reserva.id_reserva.toString().padStart(5, '0')}`,
            resultado: 'Pre-reserva formalizada exitosamente',
            es_respuesta_util: true,
          },
        });

        return {
          reservaId: reserva.id_reserva,
          codigoReserva: `NEXO-${reserva.id_reserva.toString().padStart(5, '0')}`,
          persona: updatedPersona,
          pago,
          opcion: opcionActiva,
        };
      })
    );

    res.json({
      success: true,
      message: '¡Pre-reserva completada exitosamente!',
      data: result,
    });
  } catch (error: any) {
    console.error('Error al procesar pre-reserva pública:', error);
    res.status(500).json({ error: error.message || 'Error al procesar la pre-reserva' });
  }
});

export default router;

