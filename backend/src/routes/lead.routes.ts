import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { leadCommercialRouter } from './leadCommercial.routes';
import { prisma, withRetry } from '../db';
import { NegotiatorAgentService } from '../services/negotiatorAgentService';
import { getServicioCommercialInfo } from './config.routes';
import { leadTransferRouter } from './leadTransfer.routes';
import { leadStaffAuthMode } from '../services/leadStaffAuth';

const router = Router();
router.use('/commercial', leadCommercialRouter);
router.use(leadTransferRouter);

// Keep the patient-facing pre-reservation contract intact. Other legacy LEAD
// writes are closed only when the authenticated commercial workspace is enabled.
router.use((req, res, next) => {
  if (leadStaffAuthMode() !== 'enabled' || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      req.path.startsWith('/public/')) return next();
  return res.status(410).json({ error: 'Esta operación LEAD heredada está deshabilitada; utiliza el espacio comercial autenticado.' });
});

const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

class LeadConflict extends Error {}

function bookableSlot(serviceId?: number | null): Prisma.DisponibilidadWhereInput {
  const lima = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  const day = new Date(lima.slice(0, 10) + 'T00:00:00Z');
  return {
    estado: 'Disponible',
    Profesional: { activo: true, ProfesionalServicio: { some: {
      ...(serviceId == null ? {} : { id_servicio: serviceId }),
      Servicio: { activo: true },
    } } },
    Sede: { activo: true },
    Opciones: { none: { Reservas: { some: { estado: { notIn: ['Cancelada', 'Vencida'] } } } } },
    // SQL Server cannot compare a `time` column to Prisma's datetimeoffset parameter.
    // Filter by calendar day here, then compare today's clock in application code.
    fecha: { gte: day },
  };
}

function sqlDateKey(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function sqlTimeKey(value: Date | string): string {
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return raw.includes('T') ? raw.slice(11, 19) : raw.slice(0, 8);
}

function isUpcomingLimaSlot(slot: { fecha: Date | string; hora_inicio: Date | string }): boolean {
  const nowLima = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  const slotDay = sqlDateKey(slot.fecha);
  const todayLima = nowLima.slice(0, 10);
  return slotDay > todayLima || (slotDay === todayLima && sqlTimeKey(slot.hora_inicio) > nowLima.slice(11, 19));
}

function leadError(error: unknown, res: import('express').Response) {
  if (error instanceof LeadConflict) return res.status(409).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: 'No se pudo completar la operación LEAD' });
}


// @db.Date conserva el día del calendario; el mediodía UTC evita cambios de día
// cuando la fecha se convierte posteriormente entre zonas horarias.
function parseCalendarDate(fecha: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('La fecha debe tener el formato YYYY-MM-DD');
  }
  const date = new Date(`${fecha}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fecha) {
    throw new Error('Fecha inválida');
  }
  return date;
}

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
      const disponibilidades = (await prisma.disponibilidad.findMany({
        where: bookableSlot(),
        include: { Profesional: { include: { ProfesionalServicio: { select: { id_servicio: true } } } }, Sede: true },
        orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }, { id_disponibilidad: 'asc' }],
      })).filter(isUpcomingLimaSlot);
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
  const id_opcion = Number(req.params.id_opcion);
  const { precio_ofrecido, id_sede, id_profesional, fecha, ofr_turno_lead, motivo_cambio } = req.body;
  try {
    const updated = await prisma.$transaction(async tx => {
      const option = await tx.opciones.findUnique({
        where: { id_opcion }, include: { Disponibilidad: true, Reservas: true, Solicitud: true },
      });
      if (!option || option.archivada_lead_en || option.Solicitud.archivada_lead_en ||
          option.Reservas.length || (option.estado_respuesta && option.estado_respuesta !== 'Pendiente')) {
        throw new LeadConflict('La alternativa no se puede modificar en negociación.');
      }
      const current = option.Disponibilidad;
      const slot = await tx.disponibilidad.findFirst({
        where: {
          ...bookableSlot(option.Solicitud.id_servicio),
          id_sede: id_sede ? Number(id_sede) : current.id_sede,
          id_profesional: id_profesional ? Number(id_profesional) : current.id_profesional,
          fecha: fecha ? parseCalendarDate(fecha) : current.fecha,
          hora_inicio: current.hora_inicio, hora_fin: current.hora_fin, estado: 'Disponible',
        },
      });
      if (!slot || slot.estado !== 'Disponible' || !isUpcomingLimaSlot(slot)) {
        throw new LeadConflict('Selecciona un horario disponible.');
      }
      const price = precio_ofrecido === undefined ? option.precio_ofrecido : new Prisma.Decimal(precio_ofrecido);
      if (!price.isFinite() || price.lt(0) || price.gte(100000000) || price.decimalPlaces() > 2) {
        throw new LeadConflict('El precio debe tener hasta dos decimales y estar entre 0 y 99999999.99.');
      }
      if (option.id_propuesta_lead && !price.eq(option.precio_ofrecido)) {
        throw new LeadConflict('Crea una nueva versión de la propuesta antes de cambiar el precio.');
      }
      const prior = await tx.cambiosOpcionLead.findFirst({ where: { id_opcion }, orderBy: { id_cambio: 'desc' } });
      const result = await tx.opciones.update({
        where: { id_opcion },
        data: { id_disponibilidad: slot.id_disponibilidad, precio_ofrecido: price, ofr_turno_lead },
        include: { Disponibilidad: { include: { Profesional: true, Sede: true } } },
      });
      if (typeof motivo_cambio === 'string' && motivo_cambio.trim()) {
        await tx.cambiosOpcionLead.updateMany({
          where: { id_opcion, id_cambio: { gt: prior?.id_cambio ?? 0 } },
          data: { motivo_cambio: motivo_cambio.trim().slice(0, 300) },
        });
      }
      return result;
    }, serializable);
    res.json({ message: 'Alternativa actualizada', data: updated });
  } catch (error) {
    return leadError(error, res);
  }
});

router.delete('/options/:id_opcion', async (req, res) => {
  try {
    const id_opcion = Number(req.params.id_opcion);
    const result = await prisma.opciones.updateMany({
      where: { id_opcion, archivada_lead_en: null, seleccionada: false, Reservas: { none: {} } },
      data: { archivada_lead_en: new Date() },
    });
    if (!result.count) throw new LeadConflict('La alternativa ya está archivada, está seleccionada o tiene una reserva.');
    res.json({ message: 'Alternativa archivada' });
  } catch (error) {
    return leadError(error, res);
  }
});

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
          where: { archivada_lead_en: null },
          include: {
            Servicio: true,
            Opciones: {
              where: { archivada_lead_en: null },
              include: {
                Disponibilidad: {
                  include: { Profesional: true, Sede: true }
                },
                Propuesta: true,
              }
            }
          },
          orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
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
// ── Lista de LEADS ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const personas = await withRetry(() => prisma.personas.findMany({
      orderBy: { fecha_registro: 'desc' },
      include: {
        Etapa: true,
        Preferencias: true,
        Solicitudes: {
          where: { archivada_lead_en: null },
          orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
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
      .filter(p => (p.Etapa?.nombre === 'LEAD' && p.Solicitudes.length > 0) || p.Etapa?.nombre === 'PAYER')
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
  try {
    const reason = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
    if (!reason || reason.length > 400) return res.status(400).json({ error: 'Indica el motivo real del cierre (máximo 400 caracteres).' });
    const id_persona = Number(req.params.id);
    const id_solicitud = req.body.id_solicitud === undefined ? undefined : Number(req.body.id_solicitud);
    const now = new Date();
    await prisma.$transaction(async tx => {
      const request = await tx.solicitudes.findFirst({
        where: { id_solicitud, id_persona, archivada_lead_en: null, Persona: { Etapa: { nombre: 'LEAD' } } },
        orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
      });
      if (!request || (request.resultado_comercial_lead && request.resultado_comercial_lead !== 'PENDIENTE')) {
        throw new LeadConflict('No hay una negociación abierta para cerrar.');
      }
      await tx.solicitudes.update({
        where: { id_solicitud: request.id_solicitud },
        data: {
          estado: 'Abandonada', fecha_cierre: now, fecha_decision_comercial_lead: now,
          resultado_comercial_lead: 'CERRADA_SIN_ACUERDO', motivo_cierre_lead: reason,
        },
      });
    }, serializable);
    res.json({ message: 'Negociación cerrada sin acuerdo' });
  } catch (error) {
    return leadError(error, res);
  }
});

// ── Actualizar un LEAD y su Perfil de Negociación ───────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id) || Number(id.replace(/\D/g, ''));
  if (isNaN(numId) || !numId) {
    return res.status(400).json({ error: 'ID de LEAD inválido' });
  }

  const {
    person,
    nombres, apellidos, email, numero, phone, dni, documentNumber,
    pref_sede_preferida, sede_preferida, pref_id_horario, id_horario, pref_id_modalidad, id_modalidad, pref_profesional_preferido, profesional_preferido,
    estudianteAplica, aplica_estudiante, universidad, carrera, ciclo,
    laboralAplica, aplica_laboral, ocupacion, empresa, modalidadLaboral, modalidad_laboral, disponibilidadLaboral, disponibilidad_laboral,
    ultima_visita_odontologica, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial, motivo_consulta,
    serviceOfInterestId, id_servicio, concreteRequest, motivo
  } = req.body;

  try {
    const updatePersonData: any = {};
    const finalNombres = nombres || person?.firstName;
    const finalApellidos = apellidos || person?.lastName;
    const finalEmail = email !== undefined ? email : person?.email;
    const finalNumero = numero || phone || person?.phone;
    const finalDni = dni || documentNumber || person?.documentNumber;

    if (finalNombres) updatePersonData.nombres = String(finalNombres).trim();
    if (finalApellidos) updatePersonData.apellidos = String(finalApellidos).trim();
    if (finalEmail !== undefined) updatePersonData.email = finalEmail ? String(finalEmail).trim() : null;
    if (finalNumero !== undefined) updatePersonData.numero = finalNumero ? String(finalNumero).trim() : null;
    if (finalDni !== undefined) updatePersonData.dni = finalDni ? String(finalDni).trim() : null;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updatePersonData).length > 0) {
        await tx.personas.update({
          where: { id_persona: numId },
          data: updatePersonData
        });
      }

      // 1. Preferencias de Atención
      const finalSede = pref_sede_preferida || sede_preferida;
      const finalHorarioId = Number(pref_id_horario || id_horario) || null;
      const finalModalidadId = Number(pref_id_modalidad || id_modalidad) || null;
      const finalProfesional = pref_profesional_preferido || profesional_preferido;

      if (finalSede || finalHorarioId || finalModalidadId || finalProfesional) {
        await tx.personaPreferencias.deleteMany({ where: { id_persona: numId } });
        await tx.personaPreferencias.create({
          data: {
            id_persona: numId,
            sede_preferida: finalSede ? String(finalSede).trim() : null,
            id_horario: finalHorarioId,
            id_modalidad: finalModalidadId,
            profesional_preferido: finalProfesional ? String(finalProfesional).trim() : null,
          }
        });
      }

      // 2. Salud Odontológica
      if (
        ultima_visita_odontologica !== undefined ||
        motivo_consulta !== undefined ||
        tratamiento_previo !== undefined ||
        nivel_dolor !== undefined ||
        presenta_sensibilidad !== undefined ||
        sangrado_o_inflamacion !== undefined ||
        usa_aparato_o_protesis !== undefined ||
        condicion_atencion_especial !== undefined
      ) {
        await tx.personaSaludOdontologica.deleteMany({ where: { id_persona: numId } });
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: numId,
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: motivo_consulta || motivo || null,
            tratamiento_previo: tratamiento_previo || null,
            nivel_dolor: nivel_dolor || 'Ninguno',
            presenta_sensibilidad: presenta_sensibilidad || 'No',
            sangrado_o_inflamacion: sangrado_o_inflamacion || 'Ninguno',
            usa_aparato_o_protesis: usa_aparato_o_protesis || 'Ninguno',
            condicion_atencion_especial: condicion_atencion_especial || 'Ninguna',
          }
        });
      }

      // 3. Datos Académicos (Convenio Estudiantil)
      if (estudianteAplica !== undefined || aplica_estudiante !== undefined || universidad !== undefined || carrera !== undefined) {
        const shouldApply = estudianteAplica ?? aplica_estudiante ?? Boolean(universidad || carrera);
        await tx.datosAcademicos.deleteMany({ where: { id_persona: numId } });
        if (shouldApply && (universidad || carrera)) {
          await tx.datosAcademicos.create({
            data: {
              id_persona: numId,
              aplica: true,
              universidad: universidad ? String(universidad).trim() : null,
              carrera: carrera ? String(carrera).trim() : null,
              ciclo: ciclo ? String(ciclo).trim() : null,
            }
          });
        }
      }

      // 4. Datos Laborales
      if (laboralAplica !== undefined || aplica_laboral !== undefined || ocupacion !== undefined || empresa !== undefined) {
        const shouldApply = laboralAplica ?? aplica_laboral ?? Boolean(ocupacion || empresa);
        await tx.datosLaborales.deleteMany({ where: { id_persona: numId } });
        if (shouldApply && (ocupacion || empresa)) {
          await tx.datosLaborales.create({
            data: {
              id_persona: numId,
              aplica: true,
              ocupacion: ocupacion ? String(ocupacion).trim() : null,
              empresa: empresa ? String(empresa).trim() : null,
              modalidad: (modalidadLaboral || modalidad_laboral) ? String(modalidadLaboral || modalidad_laboral).trim() : null,
              disponibilidad: (disponibilidadLaboral || disponibilidad_laboral) ? String(disponibilidadLaboral || disponibilidad_laboral).trim() : null,
            }
          });
        }
      }

      // 5. Solicitud
      const finalMotivo = concreteRequest || motivo;
      const finalServicioId = Number(serviceOfInterestId || id_servicio) || null;
      if (finalMotivo !== undefined || finalServicioId) {
        const sol = await tx.solicitudes.findFirst({ where: { id_persona: numId }, orderBy: { id_solicitud: 'desc' } });
        if (sol) {
          await tx.solicitudes.update({
            where: { id_solicitud: sol.id_solicitud },
            data: {
              motivo: finalMotivo !== undefined ? String(finalMotivo).trim() : sol.motivo,
              ...(finalServicioId ? { id_servicio: finalServicioId } : {})
            }
          });
        } else if (finalMotivo || finalServicioId) {
          await tx.solicitudes.create({
            data: {
              id_persona: numId,
              motivo: finalMotivo || 'Evaluación odontológica',
              id_servicio: finalServicioId || 1
            }
          });
        }
      }
    });

    const updatedLead = await prisma.personas.findUnique({
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
                where: { archivada_lead_en: null },
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

    res.json({ message: 'Lead actualizado con éxito', data: updatedLead });
  } catch (error: any) {
    console.error('Error al actualizar LEAD:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar LEAD' });
  }
});

// ── Añadir alternativa a la mesa de negociación ────────────────────────────
router.post('/:id/alternative', async (req, res) => {
  const id_persona = Number(req.params.id);
  const { id_solicitud, id_servicio, id_disponibilidad, precio_ofrecido, id_propuesta_lead,
    fecha_vigencia_hasta_utc_lead, promocion_aplicada, crear_version_propuesta,
    confirmar_cambio_servicio, id_servicio_anterior,
    id_preferencia_lead, pref_fecha_lead, pref_dia_semana_lead, pref_turno_lead,
    pref_hora_inicio_lead, pref_hora_fin_lead, ofr_turno_lead } = req.body;
  try {
    if ((typeof precio_ofrecido !== 'string' && typeof precio_ofrecido !== 'number') ||
        String(precio_ofrecido).trim() === '' || !Number.isFinite(Number(precio_ofrecido))) {
      throw new LeadConflict('Indica un precio válido.');
    }
    const price = new Prisma.Decimal(String(precio_ofrecido).trim());
    if (!price.isFinite() || price.lt(0) || price.gte(100000000) || price.decimalPlaces() > 2) {
      throw new LeadConflict('Indica un precio válido.');
    }
    const expiry = typeof fecha_vigencia_hasta_utc_lead === 'string'
      ? new Date(fecha_vigencia_hasta_utc_lead) : null;
    if (!expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      throw new LeadConflict('La vigencia de la propuesta debe ser una fecha futura válida.');
    }
    const time = (value?: string) => {
      if (value == null) return null;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new LeadConflict('Hora inválida.');
      return new Date('1970-01-01T' + value + ':00Z');
    };
    const result = await prisma.$transaction(async tx => {
      const request = await tx.solicitudes.findFirst({
        where: {
          id_persona, id_solicitud: id_solicitud == null ? undefined : Number(id_solicitud),
          archivada_lead_en: null, Persona: { Etapa: { nombre: 'LEAD' } },
        },
        orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
      });
      if (!request || request.resultado_comercial_lead === 'CERRADA_SIN_ACUERDO') {
        throw new LeadConflict('No hay una oportunidad abierta para esta persona.');
      }
      const serviceId = Number(id_servicio);
      if (!Number.isSafeInteger(serviceId) || serviceId < 1) {
        throw new LeadConflict('Selecciona un servicio ofertado válido.');
      }
      const slot = await tx.disponibilidad.findFirst({
        where: {
          ...bookableSlot(serviceId), id_disponibilidad: Number(id_disponibilidad),
        },
      });
      if (!slot || !isUpcomingLimaSlot(slot)) {
        throw new LeadConflict('El horario ya no está disponible para el servicio seleccionado. Elige otro.');
      }
      if (serviceId !== request.id_servicio) {
        if (confirmar_cambio_servicio !== true || id_servicio_anterior !== request.id_servicio) {
          throw new LeadConflict('Confirma el cambio de tratamiento de la solicitud. Si ya lo confirmaste, vuelve a abrir la negociación para actualizar los datos.');
        }
        const hasProposal = await tx.propuestasEconomicasLead.findFirst({
          where: { id_solicitud: request.id_solicitud }, select: { id_propuesta: true },
        });
        const hasOption = await tx.opciones.findFirst({
          where: { id_solicitud: request.id_solicitud }, select: { id_opcion: true },
        });
        const hasReservation = await tx.reservas.findFirst({
          where: { id_solicitud: request.id_solicitud }, select: { id_reserva: true },
        });
        if (id_propuesta_lead != null || request.resultado_comercial_lead === 'ACEPTADA' ||
            request.id_propuesta_aceptada_lead != null || hasProposal || hasOption || hasReservation) {
          throw new LeadConflict('La solicitud ya tiene historial comercial. Para ofrecer otro tratamiento, usa una solicitud nueva.');
        }
        await tx.solicitudes.updateMany({
          where: { id_solicitud: request.id_solicitud },
          data: { id_servicio: serviceId },
        });
      }
      const preference = id_preferencia_lead == null ? null : await tx.personaPreferencias.findFirst({
        where: { id_persona, id_preferencia: Number(id_preferencia_lead) }, include: { Horario: true },
      });
      if (id_preferencia_lead != null && !preference) throw new LeadConflict('La preferencia no corresponde al paciente.');
      const promotion = typeof promocion_aplicada === 'string'
        ? promocion_aplicada.trim().slice(0, 150) || null
        : null;
      let proposal;
      if (id_propuesta_lead == null) {
        proposal = await tx.propuestasEconomicasLead.create({
          data: {
            id_solicitud: request.id_solicitud, id_servicio: serviceId,
            precio_cotizado: price, promocion_aplicada: promotion,
            fecha_vigencia_hasta_utc_lead: expiry,
          },
        });
      } else {
        const previous = await tx.propuestasEconomicasLead.findFirst({
          where: { id_propuesta: Number(id_propuesta_lead), id_solicitud: request.id_solicitud },
        });
        if (!previous) throw new LeadConflict('La propuesta no corresponde a esta oportunidad.');
        if (previous.id_servicio !== serviceId) {
          throw new LeadConflict('La propuesta anterior corresponde a otro tratamiento.');
        }
        const root = previous.id_propuesta_raiz ?? previous.id_propuesta;
        const latest = await tx.propuestasEconomicasLead.findFirst({
          where: { OR: [{ id_propuesta: root }, { id_propuesta_raiz: root }] },
          orderBy: { numero_version: 'desc' },
        });
        if (latest?.id_propuesta !== previous.id_propuesta) {
          throw new LeadConflict('Actualiza la propuesta antes de agregar otra alternativa.');
        }
        if (crear_version_propuesta === true) {
          if (previous.estado === 'Aceptada') throw new LeadConflict('Una propuesta aceptada no admite nuevas versiones.');
          proposal = await tx.propuestasEconomicasLead.create({
            data: {
              id_solicitud: request.id_solicitud, id_servicio: serviceId,
              id_propuesta_raiz: root, numero_version: previous.numero_version + 1,
              precio_cotizado: price, promocion_aplicada: promotion,
              fecha_vigencia_hasta_utc_lead: expiry,
            },
          });
        } else {
          if (!previous.precio_cotizado.equals(price) || previous.promocion_aplicada !== promotion ||
              previous.fecha_vigencia_hasta_utc_lead?.getTime() !== expiry.getTime()) {
            throw new LeadConflict('Cambió el precio o la vigencia. Registra una nueva versión de la propuesta.');
          }
          proposal = previous;
        }
      }
      return tx.opciones.create({
        data: {
          id_solicitud: request.id_solicitud, id_disponibilidad: slot.id_disponibilidad,
          precio_ofrecido: price, estado_respuesta: 'Pendiente',
          id_propuesta_lead: proposal.id_propuesta, id_preferencia_lead: preference?.id_preferencia,
          pref_fecha_lead: pref_fecha_lead ? parseCalendarDate(pref_fecha_lead) : null,
          pref_dia_semana_lead: pref_dia_semana_lead ?? preference?.Horario?.dia_semana,
          pref_turno_lead, ofr_turno_lead,
          pref_hora_inicio_lead: time(pref_hora_inicio_lead) ?? preference?.Horario?.hora_inicio,
          pref_hora_fin_lead: time(pref_hora_fin_lead) ?? preference?.Horario?.hora_fin,
        },
        include: {
          Disponibilidad: { include: { Profesional: true, Sede: true } },
          Propuesta: true,
        },
      });
    }, serializable);
    res.status(201).json({ message: 'Alternativa registrada en el tablero', data: result });
  } catch (error) {
    return leadError(error, res);
  }
});

// ── Eliminar un LEAD ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id_persona = Number(req.params.id);
    await prisma.$transaction(async tx => {
      const person = await tx.personas.findUnique({ where: { id_persona }, include: { Etapa: true } });
      if (person?.Etapa?.nombre !== 'LEAD') throw new LeadConflict('Solo se puede archivar una negociación en LEAD.');
      const opportunity = await tx.solicitudes.findFirst({
        where: { id_persona, archivada_lead_en: null },
        orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }], include: { Reservas: true },
      });
      if (!opportunity || opportunity.Reservas.length) throw new LeadConflict('La negociación tiene una reserva o ya está archivada.');
      await tx.solicitudes.update({
        where: { id_solicitud: opportunity.id_solicitud }, data: { archivada_lead_en: new Date() },
      });
    }, serializable);
    res.json({ message: 'Negociación archivada' });
  } catch (error) {
    return leadError(error, res);
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
    diasFaltantes,
    horarioTexto,
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

    let resolvedSede = (sedeName || '').trim();
    if (!resolvedSede || (!resolvedSede.includes('-') && !resolvedSede.includes(','))) {
      const matchSede = await prisma.sedes.findFirst({
        where: {
          OR: [
            { nombre: { contains: resolvedSede || 'California' } },
            { id_sede: isNaN(Number(resolvedSede)) ? -1 : Number(resolvedSede) }
          ],
          activo: true
        }
      });
      if (matchSede) {
        resolvedSede = `${matchSede.nombre} - ${matchSede.direccion}`;
      } else {
        resolvedSede = 'Sede California - Av. Larco 820, Urb. California, Trujillo';
      }
    }

    const result = await NegotiatorAgentService.processAndDispatch({
      leadId: Number(id),
      leadName,
      leadEmail: finalEmail,
      leadPhone: finalPhone,
      serviceName: serviceName || lead?.Solicitudes?.[0]?.Servicio?.nombre || 'Consulta Odontológica',
      sedeName: resolvedSede,
      offeredPrice: numOffered,
      originalPrice: numOriginal,
      discountPct: computedDiscount,
      expirationDate: expirationDate || 'Vigente por 7 días',
      fechaLimite: fechaLimite || expirationDate,
      diasFaltantes,
      horarioTexto,
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


export default router;

