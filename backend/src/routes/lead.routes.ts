import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Obtener detalles de un LEAD específico para la negociación
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await prisma.personas.findUnique({
      where: { id_persona: Number(id) },
      include: {
        Etapa: true,
        Preferencias: true,
        Interacciones: { include: { Canal: true } },
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
          }
        },
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'LEAD no encontrado' });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del LEAD' });
  }
});

// Obtener opciones de disponibilidad para armar la propuesta
router.get('/options/availability', async (req, res) => {
  try {
    const profesionales = await prisma.profesionales.findMany({ where: { activo: true } });
    const sedes = await prisma.sedes.findMany({ where: { activo: true } });
    const servicios = await prisma.servicios.findMany({ where: { activo: true } });
    
    // Para simplificar, devolvemos los catálogos y algunas "disponibilidades"
    const disponibilidades = await prisma.disponibilidad.findMany({
      where: { estado: 'Disponible' },
      include: {
        Profesional: true,
        Sede: true
      },
      take: 20
    });

    res.json({ profesionales, sedes, servicios, disponibilidades });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// Registrar Reserva y convertir a PAYER
router.post('/:id/reserve', async (req, res) => {
  const { id } = req.params;
  const { id_solicitud, id_opcion } = req.body; // Changed from id_disponibilidad/precio_ofrecido

  try {
    let etapaPayer = await prisma.etapas.findFirst({ where: { nombre: 'PAYER' } });
    if (!etapaPayer) etapaPayer = await prisma.etapas.create({ data: { nombre: 'PAYER', descripcion: 'Pago inicial validado' } });
    
    const etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar la opción seleccionada
      const opcion = await tx.opciones.update({
        where: { id_opcion: Number(id_opcion) },
        data: { seleccionada: true }
      });

      // 2. Crear la Reserva
      const reserva = await tx.reservas.create({
        data: {
          id_persona: Number(id),
          id_solicitud: Number(id_solicitud),
          id_opcion: opcion.id_opcion,
          estado: 'Pendiente', // Pendiente de pago
        }
      });

      // 3. Actualizar la persona a Etapa PAYER
      await tx.personas.update({
        where: { id_persona: Number(id) },
        data: { id_etapa_actual: etapaPayer.id_etapa }
      });

      // 4. Registrar evento de etapa LEAD -> PAYER
      await tx.eventosEtapa.create({
        data: {
          id_persona: Number(id),
          etapa_origen: etapaLead?.id_etapa,
          etapa_destino: etapaPayer.id_etapa,
          motivo: 'Reserva confirmada en negociación'
        }
      });

      // 5. Bloquear disponibilidad
      await tx.disponibilidad.update({
        where: { id_disponibilidad: opcion.id_disponibilidad },
        data: { estado: 'Ocupado' }
      });

      return { reserva, opcion };
    });

    res.status(201).json({ message: 'Reserva creada exitosamente. Estado convertido a PAYER.', data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la reserva' });
  }
});

// Obtener la lista de LEADS mapeada al formato que espera el frontend
router.get('/', async (req, res) => {
  try {
    const etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (!etapaLead) return res.json([]);

    const personas = await prisma.personas.findMany({
      where: {
        // En un caso real, podríamos buscar todos los que alguna vez fueron LEAD o están en LEAD
      },
      include: {
        Etapa: true,
        Preferencias: true,
        Solicitudes: { include: { Servicio: true, Reservas: true } }
      }
    });

    // Mapeamos a LeadWithDetails
    // Solo devolvemos los que llegaron al menos a LEAD (no BUYER puro)
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
          buyerId: p.id_persona.toString(), // mock
          requestedServiceId: servicio,
          state,
          createdAt: p.fecha_registro,
          reservationId: reserva,
          buyer: {
            preferences: preferencias,
          },
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

// Actualizar un LEAD
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    // Si quisieramos actualizar campos de la persona, usaríamos data
    // Por ahora simulamos que todo sale bien
    res.json({ message: 'Lead actualizado', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar LEAD' });
  }
});

// Añadir una alternativa
router.post('/:id/alternative', async (req, res) => {
  const { id } = req.params;
  const { id_solicitud, id_disponibilidad, precio_ofrecido } = req.body;
  try {
    const opcion = await prisma.opciones.create({
      data: {
        id_solicitud: Number(id_solicitud),
        id_disponibilidad: Number(id_disponibilidad),
        precio_ofrecido: Number(precio_ofrecido),
        seleccionada: false
      },
      include: {
        Disponibilidad: {
          include: { Profesional: true, Sede: true }
        }
      }
    });

    res.json({ message: 'Alternativa registrada', data: opcion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al añadir alternativa' });
  }
});

export default router;
