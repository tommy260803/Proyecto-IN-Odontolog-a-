import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const people = await prisma.personas.findMany({
      where: {
        Etapa: { nombre: { in: ['BUYER', 'LEAD', 'PAYER', 'CUSTOMER', 'TURNED'] } },
      },
      orderBy: { fecha_registro: 'desc' },
      select: {
        id_persona: true,
        nombres: true,
        apellidos: true,
        dni: true,
        email: true,
        numero: true,
        fecha_registro: true,
        Etapa: { select: { nombre: true } },
      },
    });

    const chunks: number[][] = [];
    for (let index = 0; index < people.length; index += 500) {
      chunks.push(people.slice(index, index + 500).map((person) => person.id_persona));
    }

    const relatedData = await Promise.all(chunks.map(async (ids) => {
      const [preferences, requests, reservations] = await Promise.all([
        prisma.personaPreferencias.findMany({
          where: {
            id_persona: { in: ids },
            OR: [{ fecha_fin: null }, { fecha_fin: { gt: new Date() } }],
          },
          orderBy: { id_preferencia: 'desc' },
          select: { id_persona: true, sede_preferida: true, ServicioInteres: { select: { nombre: true } } },
        }),
        prisma.solicitudes.findMany({
          where: { id_persona: { in: ids } },
          orderBy: { id_solicitud: 'desc' },
          select: { id_persona: true, Servicio: { select: { nombre: true } } },
        }),
        prisma.reservas.findMany({
          where: { id_persona: { in: ids } },
          orderBy: { id_reserva: 'desc' },
          select: {
            id_persona: true,
            id_reserva: true,
            fecha_reserva: true,
            Opcion: {
              select: {
                Disponibilidad: {
                  select: {
                    Profesional: { select: { nombres: true, apellidos: true } },
                    Sede: { select: { nombre: true } },
                  },
                },
              },
            },
          },
        }),
      ]);

      return { preferences, requests, reservations };
    }));

    const latestByPerson = <T extends { id_persona: number }>(items: T[]) => {
      const latest = new Map<number, T>();
      for (const item of items) {
        if (!latest.has(item.id_persona)) latest.set(item.id_persona, item);
      }
      return latest;
    };
    const preferences = latestByPerson(relatedData.flatMap((data) => data.preferences));
    const requests = latestByPerson(relatedData.flatMap((data) => data.requests));
    const reservations = latestByPerson(relatedData.flatMap((data) => data.reservations));

    res.json(people.map((person) => {
      const preference = preferences.get(person.id_persona);
      const request = requests.get(person.id_persona);
      const reservation = reservations.get(person.id_persona);
      const availability = reservation?.Opcion.Disponibilidad;
      const stage = person.Etapa.nombre as 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER' | 'TURNED';
      const serviceName =
        preference?.ServicioInteres?.nombre ||
        request?.Servicio?.nombre ||
        (stage === 'BUYER' ? 'Evaluación Odontológica' : 'Atención Clínica');

      return {
        id: `${stage[0]}-${person.id_persona}`,
        personId: String(person.id_persona),
        fullName: `${person.nombres} ${person.apellidos}`.trim(),
        firstName: person.nombres,
        lastName: person.apellidos,
        dni: person.dni || 'Sin DNI',
        phone: person.numero || 'Sin teléfono',
        email: person.email || 'No registrado',
        currentStage: stage,
        stageLabel: stage === 'BUYER'
          ? 'Prospecto (Buyer)'
          : stage === 'LEAD'
            ? 'En Negociación (Lead)'
            : stage === 'PAYER'
              ? 'Validación de Pago (Payer)'
              : stage === 'CUSTOMER'
                ? 'En Tratamiento (Customer)'
                : 'Fidelizado (Turned)',
        statusLabel: stage === 'BUYER' ? 'Nuevo' : stage === 'LEAD' ? 'En negociación' : 'Activo',
        serviceName,
        branchName: preference?.sede_preferida || availability?.Sede?.nombre || 'Sede California',
        professionalName: availability?.Profesional
          ? `${availability.Profesional.nombres} ${availability.Profesional.apellidos}`.trim()
          : stage === 'BUYER' ? 'Admisión Clínica' : 'Sin asignar',
        lastDate: (reservation?.fecha_reserva || person.fecha_registro).toISOString().split('T')[0],
        detailUrl: stage === 'BUYER'
          ? `/buyer/${person.id_persona}`
          : stage === 'LEAD'
            ? `/lead/${person.id_persona}`
            : stage === 'PAYER'
              ? `/payer/${reservation?.id_reserva || person.id_persona}`
              : stage === 'CUSTOMER'
                ? `/customer/${person.id_persona}`
                : `/turned/${person.id_persona}`,
        customerId: stage === 'CUSTOMER' || stage === 'TURNED' ? String(person.id_persona) : undefined,
      };
    }));
  } catch (error) {
    console.error('Error fetching patient directory:', error);
    res.status(500).json({ error: 'Error al obtener el directorio de pacientes' });
  }
});

export default router;
