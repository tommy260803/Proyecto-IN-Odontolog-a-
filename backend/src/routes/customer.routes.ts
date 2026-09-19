import { Router } from 'express';
import { Prisma, PrismaClient, type Atenciones, type Reservas } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const customerInclude = Prisma.validator<Prisma.PersonasInclude>()({
  Etapa: true,
  Reservas: {
    orderBy: { id_reserva: 'desc' as const },
    take: 1,
    include: {
      Solicitud: { include: { Servicio: true } },
      Opcion: { include: { Disponibilidad: { include: { Profesional: true, Sede: true } } } },
    },
  },
  Atenciones: { orderBy: { id_atencion: 'desc' as const }, take: 1 },
  Incidencias: { orderBy: { fecha_registro: 'desc' as const } },
});

type CustomerPerson = Prisma.PersonasGetPayload<{ include: typeof customerInclude }>;

function parseLegacyObservations(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return { observations: value };
  }
}

function clinicalState(attention?: Atenciones | null, reservation?: Reservas | null) {
  if (attention?.estado_servicio === 'Cancelado' || reservation?.estado === 'Cancelada') return 'CANCELED';
  if (attention?.asistencia === 'No asiste') return 'NO_SHOW';
  if (attention?.estado_servicio === 'Finalizado') return 'ATTENDED';
  if (attention?.estado_servicio === 'En curso') return 'IN_ATTENTION';
  if (attention?.asistencia === 'Confirmada') return 'ATTENDANCE_CONFIRMED';
  return 'SCHEDULED';
}

function serializeCustomer(person: CustomerPerson) {
  const reservation = person.Reservas[0] || null;
  const attention = person.Atenciones[0] || null;
  const availability = reservation?.Opcion?.Disponibilidad;
  const legacy = parseLegacyObservations(attention?.observaciones);
  const currentPhase = person.Etapa?.nombre === 'TURNED' ? 'TURNED' : 'CUSTOMER';

  return {
    id: person.id_persona.toString(),
    payerId: reservation?.id_reserva?.toString() || person.id_persona.toString(),
    reservationId: reservation?.id_reserva?.toString() || '',
    state: clinicalState(attention, reservation),
    currentPhase,
    isTurned: currentPhase === 'TURNED',
    createdAt: person.fecha_registro.toISOString(),
    attentionId: attention?.id_atencion?.toString(),
    person: {
      id: person.id_persona.toString(), firstName: person.nombres, lastName: person.apellidos,
      documentNumber: person.dni, email: person.email, phone: person.numero,
    },
    lead: { requestedServiceId: reservation?.Solicitud?.Servicio?.nombre || '' },
    reservation: reservation ? {
      id: reservation.id_reserva.toString(), leadId: person.id_persona.toString(),
      date: availability?.fecha?.toISOString() || reservation.fecha_reserva.toISOString(),
      time: availability?.hora_inicio?.toISOString().slice(11, 16) || '',
      professionalId: availability?.Profesional
        ? `${availability.Profesional.nombres} ${availability.Profesional.apellidos}`.trim() : 'Sin asignar',
      branchId: availability?.Sede?.nombre || 'Sin sede',
      status: reservation.estado === 'Cancelada' ? 'CANCELED' : reservation.estado === 'Confirmada' ? 'CONFIRMED' : 'PENDING',
    } : null,
    attention: attention ? {
      id: attention.id_atencion.toString(), customerId: person.id_persona.toString(),
      reasonForConsultation: attention.motivo_consulta || legacy.reasonForConsultation || '',
      relevantBackground: attention.antecedentes || legacy.relevantBackground || '',
      allergies: attention.alergias || legacy.allergies || '',
      evaluation: attention.evaluacion || legacy.evaluation || '',
      observations: legacy.observations || '',
      procedure: attention.procedimiento || legacy.procedure || attention.resultado || '',
      instructions: attention.indicaciones_finales || '',
      startTime: attention.fecha_inicio?.toISOString() || legacy.startTime,
      endTime: attention.fecha_fin?.toISOString() || legacy.endTime,
    } : undefined,
    incidents: person.Incidencias.map(incident => ({
      id: incident.id_incidencia.toString(), customerId: person.id_persona.toString(),
      reason: incident.descripcion, status: incident.estado === 'Resuelta' ? 'RESOLVED' : 'OPEN',
      createdAt: incident.fecha_registro.toISOString(),
    })),
  };
}

async function findCustomerPerson(id: number) {
  return prisma.personas.findFirst({
    where: { id_persona: id, Etapa: { nombre: { in: ['CUSTOMER', 'TURNED'] } } },
    include: customerInclude,
  });
}

router.get('/', async (_req, res) => {
  try {
    const people = await prisma.personas.findMany({
      where: { Etapa: { nombre: { in: ['CUSTOMER', 'TURNED'] } } }, include: customerInclude,
      orderBy: { fecha_registro: 'desc' },
    });
    res.json(people.filter(person => person.Reservas.length > 0).map(serializeCustomer));
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Error al obtener customers' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    res.json(serializeCustomer(person));
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Error al obtener customer' });
  }
});

router.put('/:id/state', async (req, res) => {
  const requestedState = String(req.body?.state || '');
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    if (person.Etapa.nombre !== 'CUSTOMER') return res.status(409).json({ error: 'El paciente ya se encuentra en TURNED' });
    const attention = person.Atenciones[0];
    const reservation = person.Reservas[0];
    if (!attention || !reservation) return res.status(404).json({ error: 'No existe una atención asociada' });
    const currentState = clinicalState(attention, reservation);

    if (requestedState === 'ATTENDANCE_CONFIRMED' && currentState === 'SCHEDULED') {
      await prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { asistencia: 'Confirmada' } });
    } else if (requestedState === 'NO_SHOW' && ['SCHEDULED', 'ATTENDANCE_CONFIRMED'].includes(currentState)) {
      await prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { asistencia: 'No asiste' } });
    } else if (requestedState === 'CANCELED' && ['SCHEDULED', 'ATTENDANCE_CONFIRMED'].includes(currentState)) {
      await prisma.$transaction([
        prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { estado_servicio: 'Cancelado' } }),
        prisma.reservas.update({ where: { id_reserva: reservation.id_reserva }, data: { estado: 'Cancelada' } }),
      ]);
    } else {
      return res.status(409).json({ error: `Transición no permitida desde ${currentState} hacia ${requestedState}` });
    }
    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    console.error('Error changing customer state:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

router.post('/:id/start-attention', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    if (person.Etapa.nombre !== 'CUSTOMER') return res.status(409).json({ error: 'El paciente ya se encuentra en TURNED' });
    const attention = person.Atenciones[0];
    const reservation = person.Reservas[0];
    if (!attention || !reservation) return res.status(404).json({ error: 'No existe una atención asociada' });
    if (clinicalState(attention, reservation) !== 'ATTENDANCE_CONFIRMED') return res.status(409).json({ error: 'Primero debe confirmarse la asistencia' });
    await prisma.atenciones.update({
      where: { id_atencion: attention.id_atencion },
      data: { estado_servicio: 'En curso', asistencia: 'Asiste', fecha_inicio: new Date() },
    });
    res.json({ message: 'Atención iniciada' });
  } catch (error) {
    console.error('Error starting attention:', error);
    res.status(500).json({ error: 'Error al iniciar atención' });
  }
});

router.post('/:id/finish-attention', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    const attention = person.Atenciones[0];
    const reservation = person.Reservas[0];
    if (!attention || !reservation) return res.status(404).json({ error: 'No existe una atención asociada' });
    if (clinicalState(attention, reservation) !== 'IN_ATTENTION') return res.status(409).json({ error: 'La atención debe estar en curso para finalizarla' });
    await prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { estado_servicio: 'Finalizado', fecha_fin: new Date() } });
    res.json({ message: 'Atención finalizada' });
  } catch (error) {
    console.error('Error finishing attention:', error);
    res.status(500).json({ error: 'Error al finalizar atención' });
  }
});

router.put('/:id/attention-details', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    if (person.Etapa.nombre !== 'CUSTOMER') return res.status(409).json({ error: 'La atención de un paciente TURNED es de solo lectura' });
    let attention = person.Atenciones[0];
    const data = req.body || {};
    
    if (!attention) {
      const reservation = person.Reservas[0];
      const defaultProf = await prisma.profesionales.findFirst();
      const defaultSede = await prisma.sedes.findFirst();
      attention = await prisma.atenciones.create({
        data: {
          id_persona: person.id_persona,
          id_reserva: reservation?.id_reserva,
          id_servicio: reservation?.Solicitud?.id_servicio || 1,
          id_profesional: reservation?.Opcion?.Disponibilidad?.id_profesional || defaultProf?.id_profesional || 1,
          id_sede: reservation?.Opcion?.Disponibilidad?.id_sede || defaultSede?.id_sede || 1,
          fecha_atencion: reservation?.Opcion?.Disponibilidad?.fecha || new Date(),
          estado_servicio: 'En curso',
          asistencia: 'Confirmada',
          motivo_consulta: data.reasonForConsultation || null,
          antecedentes: data.relevantBackground || null,
          alergias: data.allergies || null,
          evaluacion: data.evaluation || null,
          procedimiento: data.procedure || null,
          observaciones: data.observations || null,
          indicaciones_finales: data.instructions || null,
        }
      });
    } else {
      await prisma.atenciones.update({
        where: { id_atencion: attention.id_atencion },
        data: {
          motivo_consulta: data.reasonForConsultation || null,
          antecedentes: data.relevantBackground || null,
          alergias: data.allergies || null,
          evaluacion: data.evaluation || null,
          procedimiento: data.procedure || null,
          observaciones: data.observations || null,
          indicaciones_finales: data.instructions || null,
        },
      });
    }
    res.json({ message: 'Detalles guardados' });
  } catch (error) {
    console.error('Error saving attention:', error);
    res.status(500).json({ error: 'Error al registrar detalles' });
  }
});

router.post('/:id/incident', async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 10) return res.status(400).json({ error: 'El motivo debe tener al menos 10 caracteres' });
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    const incident = await prisma.incidencias.create({
      data: { id_persona: person.id_persona, descripcion: reason, tipo: 'CUSTOMER', estado: 'Abierta' },
    });
    res.status(201).json({
      id: incident.id_incidencia.toString(), customerId: person.id_persona.toString(), reason,
      status: 'OPEN', createdAt: incident.fecha_registro.toISOString(),
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Error al registrar incidencia' });
  }
});

router.post('/:id/convert-turned', async (req, res) => {
  try {
    const personId = Number(req.params.id);
    const [customerStage, turnedStage] = await Promise.all([
      prisma.etapas.findUnique({ where: { nombre: 'CUSTOMER' } }),
      prisma.etapas.upsert({ where: { nombre: 'TURNED' }, update: {}, create: { nombre: 'TURNED', descripcion: 'Fidelización' } }),
    ]);
    if (!customerStage) return res.status(500).json({ error: 'La etapa CUSTOMER no está configurada' });

    const result = await prisma.$transaction(async tx => {
      const person = await tx.personas.findUnique({
        where: { id_persona: personId },
        include: { Etapa: true, Atenciones: { orderBy: { id_atencion: 'desc' }, take: 1 } },
      });
      if (!person) return { status: 404, error: 'Customer no encontrado' };
      if (person.id_etapa_actual === turnedStage.id_etapa) return { status: 200, alreadyConverted: true };
      if (person.id_etapa_actual !== customerStage.id_etapa) return { status: 409, error: 'La persona no se encuentra en etapa CUSTOMER' };
      const attention = person.Atenciones[0];
      const legacy = parseLegacyObservations(attention?.observaciones);
      const procedure = attention?.procedimiento || legacy.procedure || attention?.resultado;
      if (!attention || attention.estado_servicio !== 'Finalizado') return { status: 409, error: 'La atención debe estar finalizada' };
      if (!String(procedure || '').trim()) return { status: 409, error: 'Debe registrar el procedimiento realizado' };
      if (!String(attention.indicaciones_finales || '').trim()) return { status: 409, error: 'Debe registrar las indicaciones finales' };

      await tx.personas.update({ where: { id_persona: personId }, data: { id_etapa_actual: turnedStage.id_etapa, fecha_actualizacion: new Date() } });
      await tx.eventosEtapa.create({
        data: { id_persona: personId, etapa_origen: customerStage.id_etapa, etapa_destino: turnedStage.id_etapa, motivo: 'Atención finalizada' },
      });
      return { status: 200, alreadyConverted: false };
    });

    if ('error' in result) return res.status(result.status).json({ error: result.error });
    res.json({ message: result.alreadyConverted ? 'El paciente ya estaba en TURNED' : 'Convertido a TURNED', currentPhase: 'TURNED' });
  } catch (error) {
    console.error('Error converting customer to TURNED:', error);
    res.status(500).json({ error: 'Error al convertir a TURNED' });
  }
});

export default router;
