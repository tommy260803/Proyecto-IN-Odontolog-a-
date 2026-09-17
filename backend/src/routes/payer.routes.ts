import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

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

// Validar pago de una reserva en SQL Server
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
      include: { Opcion: true, Pagos: true }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    await prisma.reservas.update({
      where: { id_reserva: reserva.id_reserva },
      data: { estado: 'Confirmada', confirmacion_explicita: true, fecha_confirmacion: new Date() }
    });

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

    res.json({ message: 'Pago validado exitosamente en SQL Server', pago });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al validar pago en backend' });
  }
});

// Eliminar un PAYER individual (Reserva y pagos asociados en SQL Server)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);

  try {
    if (!isNaN(numId)) {
      // 1. Eliminar pagos vinculados a la reserva o persona
      await prisma.pagos.deleteMany({
        where: {
          OR: [
            { id_reserva: numId },
            { id_persona: numId }
          ]
        }
      });

      // 2. Eliminar la reserva
      await prisma.reservas.deleteMany({
        where: {
          OR: [
            { id_reserva: numId },
            { id_persona: numId }
          ]
        }
      });

      // 3. Regresar etapa de la persona a LEAD si existe
      const etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
      if (etapaLead) {
        await prisma.personas.updateMany({
          where: { id_persona: numId },
          data: { id_etapa_actual: etapaLead.id_etapa }
        }).catch(() => {});
      }
    }

    res.json({ message: 'Payer eliminado exitosamente en SQL Server' });
  } catch (error) {
    console.error('Error al eliminar Payer en backend:', error);
    res.status(500).json({ error: 'Error al eliminar payer en base de datos' });
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

export default router;
