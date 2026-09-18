import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ── Catálogos para el formulario de alternativas ─────────────────────────────
router.get('/options/availability', async (req, res) => {
  try {
    const profesionales = await prisma.profesionales.findMany({ where: { activo: true } });
    const sedes = await prisma.sedes.findMany({ where: { activo: true } });
    const servicios = await prisma.servicios.findMany({ where: { activo: true } });
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
      include: {
        Etapa: true,
        Preferencias: true,
        Solicitudes: { include: { Servicio: true, Reservas: true } }
      }
    });

    const leads = personas
      .filter(p => p.Etapa.nombre === 'LEAD' || p.Etapa.nombre === 'PAYER')
      .map(p => {
        let state = 'IN_NEGOTIATION';
        if (p.Etapa.nombre === 'PAYER') state = 'PAYMENT_REQUESTED';

        const servicio = p.Solicitudes.length > 0 && p.Solicitudes[0].Servicio
          ? p.Solicitudes[0].Servicio.nombre : 'General';

        const reserva = p.Solicitudes.length > 0 && p.Solicitudes[0].Reservas.length > 0
          ? p.Solicitudes[0].Reservas[0].id_reserva.toString() : undefined;

        const preferencias = p.Preferencias.length > 0 ? p.Preferencias[0].sede_preferida || '' : '';

        return {
          id: p.id_persona.toString(),
          buyerId: p.id_persona.toString(),
          requestedServiceId: servicio,
          state,
          createdAt: p.fecha_registro,
          reservationId: reserva,
          buyer: { preferences: preferencias },
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
  const { id_solicitud, id_disponibilidad, precio_ofrecido, condiciones } = req.body;
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

    const opcion = await prisma.opciones.create({
      data: {
        id_solicitud: solicitudId,
        id_disponibilidad: Number(id_disponibilidad),
        precio_ofrecido: Number(precio_ofrecido),
        seleccionada: false,
      },
      include: { Disponibilidad: { include: { Profesional: true, Sede: true } } }
    });

    res.json({ message: 'Alternativa registrada', data: opcion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al añadir alternativa' });
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
