const fs = require('fs');
let code = fs.readFileSync('backend/src/routes/customer.routes.ts', 'utf8');
code = code.replace('export default router;', '');
code += `
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await prisma.personas.findUnique({
      where: { id_persona: Number(id) },
      include: {
        Etapa: true,
        Solicitudes: { include: { Servicio: true, Opciones: { include: { Disponibilidad: { include: { Profesional: true, Sede: true } } } } } },
        Reservas: true,
        Pagos: true,
        Atenciones: true,
        Incidencias: true
      }
    });

    if (!p) return res.status(404).json({ error: 'Customer not found' });

    const solicitud = p.Solicitudes[p.Solicitudes.length - 1];
    const reserva = p.Reservas[p.Reservas.length - 1];
    const atencion = p.Atenciones[p.Atenciones.length - 1];
    const opcion = solicitud?.Opciones.find(o => o.seleccionada);
    
    let state = 'ATTENDED';
    if (atencion) {
      if (atencion.estado_servicio === 'Programado') state = 'ATTENTION_PENDING';
      if (atencion.estado_servicio === 'En curso') state = 'IN_ATTENTION';
      if (atencion.estado_servicio === 'Finalizado') state = 'ATTENDED';
      if (atencion.asistencia === 'No asiste') state = 'NO_SHOW';
    } else {
      state = 'ATTENTION_PENDING';
    }

    res.json({
      id: p.id_persona.toString(),
      payerId: p.id_persona.toString(),
      reservationId: reserva?.id_reserva?.toString() || '',
      state,
      createdAt: p.fecha_registro.toISOString(),
      attentionId: atencion?.id_atencion?.toString() || '',
      person: {
        id: p.id_persona.toString(),
        firstName: p.nombres,
        lastName: p.apellidos,
        documentNumber: p.dni,
        email: p.email,
        phone: p.numero
      },
      lead: {
        requestedServiceId: solicitud?.Servicio?.nombre || ''
      },
      reservation: reserva ? {
        id: reserva.id_reserva.toString(),
        date: opcion?.Disponibilidad?.fecha.toISOString() || reserva.fecha_reserva.toISOString(),
        time: opcion?.Disponibilidad?.hora_inicio ? new Date(opcion.Disponibilidad.hora_inicio).toISOString().split('T')[1].substring(0, 5) : '',
        professionalId: opcion?.Disponibilidad?.Profesional?.apellidos || 'Sin asignar',
        branchId: opcion?.Disponibilidad?.Sede?.nombre || 'Sin sede'
      } : null,
      attention: atencion ? {
        id: atencion.id_atencion.toString(),
        customerId: p.id_persona.toString(),
        reasonForConsultation: atencion.observaciones || '',
        startTime: atencion.fecha_atencion.toISOString(),
        endTime: atencion.fecha_atencion.toISOString()
      } : null,
      incidents: p.Incidencias || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/:id/state', async (req, res) => {
  const { id } = req.params;
  const { state } = req.body;
  try {
    const atencion = await prisma.atenciones.findFirst({
      where: { id_persona: Number(id) },
      orderBy: { id_atencion: 'desc' }
    });
    if (atencion) {
      let nuevoEstado = atencion.estado_servicio;
      let asistencia = atencion.asistencia;
      if (state === 'NO_SHOW') asistencia = 'No asiste';
      if (state === 'IN_ATTENTION') nuevoEstado = 'En curso';
      if (state === 'ATTENDED') nuevoEstado = 'Finalizado';
      
      await prisma.atenciones.update({
        where: { id_atencion: atencion.id_atencion },
        data: { estado_servicio: nuevoEstado, asistencia }
      });
    }
    res.json({ message: 'State updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

router.post('/:id/start-attention', async (req, res) => {
  const { id } = req.params;
  try {
    const atencion = await prisma.atenciones.findFirst({
      where: { id_persona: Number(id) },
      orderBy: { id_atencion: 'desc' }
    });
    if (atencion) {
      await prisma.atenciones.update({
        where: { id_atencion: atencion.id_atencion },
        data: { estado_servicio: 'En curso', asistencia: 'Asiste' }
      });
    }
    res.json({ message: 'Atencion iniciada' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/:id/finish-attention', async (req, res) => {
  const { id } = req.params;
  try {
    const atencion = await prisma.atenciones.findFirst({
      where: { id_persona: Number(id) },
      orderBy: { id_atencion: 'desc' }
    });
    if (atencion) {
      await prisma.atenciones.update({
        where: { id_atencion: atencion.id_atencion },
        data: { estado_servicio: 'Finalizado' }
      });
    }
    res.json({ message: 'Atencion finalizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/:id/attention-details', async (req, res) => {
  const { id } = req.params;
  const { reasonForConsultation } = req.body;
  try {
    const atencion = await prisma.atenciones.findFirst({
      where: { id_persona: Number(id) },
      orderBy: { id_atencion: 'desc' }
    });
    if (atencion) {
      await prisma.atenciones.update({
        where: { id_atencion: atencion.id_atencion },
        data: { observaciones: reasonForConsultation }
      });
    }
    res.json({ message: 'Detalles guardados' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/:id/convert-turned', async (req, res) => {
  const { id } = req.params;
  try {
    let etapaTurned = await prisma.etapas.findFirst({ where: { nombre: 'TURNED' } });
    if (!etapaTurned) etapaTurned = await prisma.etapas.create({ data: { nombre: 'TURNED', descripcion: 'Fidelizacion' } });
    
    await prisma.personas.update({
      where: { id_persona: Number(id) },
      data: { id_etapa_actual: etapaTurned.id_etapa }
    });
    res.json({ message: 'Convertido a TURNED' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
`;
fs.writeFileSync('backend/src/routes/customer.routes.ts', code);

