import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Obtener catálogos para el formulario
router.get('/catalogs', async (req, res) => {
  try {
    const canales = await prisma.canales.findMany({ where: { activo: true } });
    const fuentes = await prisma.fuentes.findMany({ where: { activo: true } });
    const servicios = await prisma.servicios.findMany({ where: { activo: true } });
    const sedes = await prisma.sedes.findMany({ where: { activo: true } });
    res.json({ canales, fuentes, servicios, sedes });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener catálogos' });
  }
});

// Registrar BUYER e inmediatamente solicitar información (Convertir a LEAD)
router.post('/register', async (req, res) => {
  const {
    nombres,
    apellidos,
    email,
    numero,
    autoriza_contacto,
    id_canal,
    id_fuente,
    id_servicio,
    sede_preferida
  } = req.body;

  try {
    // 1. Encontrar o crear Etapas
    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) etapaBuyer = await prisma.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Contacto inicial' } });

    let etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (!etapaLead) etapaLead = await prisma.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta' } });

    // 2. Transacción para asegurar la creación completa
    const result = await prisma.$transaction(async (tx) => {
      // Crear persona como BUYER inicialmente (y la cambiamos a LEAD inmediatamente por la solicitud de info)
      // Nota: Aquí lo haremos directo a LEAD si ya están solicitando info, 
      // pero para respetar el flujo BUYER -> LEAD, la creamos y generamos un evento.
      
      const persona = await tx.personas.create({
        data: {
          nombres,
          apellidos,
          email,
          numero,
          autoriza_contacto: autoriza_contacto || false,
          fecha_autorizacion: autoriza_contacto ? new Date() : null,
          id_etapa_actual: etapaLead.id_etapa, // Lo pasamos a LEAD porque está haciendo la solicitud concreta
        }
      });

      // Crear interacción (origen)
      await tx.interacciones.create({
        data: {
          id_persona: persona.id_persona,
          id_canal: id_canal || null,
          id_fuente: id_fuente || null,
          tipo: 'Registro y Solicitud de Info',
          mensaje: 'El usuario llenó el formulario público de solicitud de información.'
        }
      });

      // Guardar preferencias si existen
      if (sede_preferida || id_canal) {
        await tx.personaPreferencias.create({
          data: {
            id_persona: persona.id_persona,
            id_canal: id_canal || null,
            sede_preferida: sede_preferida || null,
          }
        });
      }

      // Generar Solicitud
      const solicitud = await tx.solicitudes.create({
        data: {
          id_persona: persona.id_persona,
          id_servicio: id_servicio || null,
          motivo: 'Solicitud de información desde formulario web',
        }
      });

      // Generar evento de cambio de etapa (BUYER -> LEAD)
      await tx.eventosEtapa.create({
        data: {
          id_persona: persona.id_persona,
          etapa_origen: etapaBuyer.id_etapa,
          etapa_destino: etapaLead.id_etapa,
          motivo: 'Solicitud de información concreta',
        }
      });

      return { persona, solicitud };
    });

    res.status(201).json({ message: 'Solicitud registrada correctamente. Pasado a estado LEAD.', data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar al BUYER' });
  }
});

// Obtener la lista de BUYERS mapeada al formato que espera el frontend
router.get('/', async (req, res) => {
  try {
    const etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) return res.json([]);

    const personas = await prisma.personas.findMany({
      where: {
        // En un caso real, podríamos buscar todos los que alguna vez fueron BUYER o los que están en BUYER
        // Aquí traeremos a todos los que estén en BUYER o LEAD para poder mostrarlos en la tabla histórica
      },
      include: {
        Etapa: true,
        Interacciones: { include: { Canal: true } },
        Solicitudes: { include: { Servicio: true } }
      }
    });

    // Mapeamos a BuyerWithPerson
    const buyers = personas.map(p => {
      let state = 'NEW';
      if (p.Etapa.nombre === 'LEAD' || p.Etapa.nombre === 'PAYER') state = 'CONVERTED';

      const canal = p.Interacciones.length > 0 && p.Interacciones[0].Canal 
        ? p.Interacciones[0].Canal.nombre : 'Web';
        
      const fuente = p.Interacciones.length > 0 && p.Interacciones[0].Fuente 
        ? p.Interacciones[0].Fuente.nombre : 'Organico';
        
      const servicio = p.Solicitudes.length > 0 && p.Solicitudes[0].Servicio 
        ? p.Solicitudes[0].Servicio.nombre : undefined;

      const motivo = p.Solicitudes.length > 0 ? p.Solicitudes[0].motivo : undefined;

      return {
        id: p.id_persona.toString(),
        personId: p.id_persona.toString(),
        person: {
          firstName: p.nombres,
          lastName: p.apellidos,
          documentNumber: p.dni,
          phone: p.numero,
          email: p.email,
        },
        channel: canal,
        attractionSource: fuente,
        serviceOfInterestId: servicio,
        contactAuthorization: p.autoriza_contacto,
        concreteRequest: motivo,
        createdAt: p.fecha_registro,
        state,
      };
    });

    res.json(buyers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener buyers' });
  }
});

// Crear un BUYER (Dashboard)
router.post('/', async (req, res) => {
  const { firstName, lastName, email, phone, documentNumber, channel, attractionSource, serviceOfInterestId, contactAuthorization, concreteRequest } = req.body;
  try {
    const dniToSave = documentNumber ? documentNumber.trim() : null;
    if (dniToSave && dniToSave.length > 8) return res.status(400).json({ error: 'El DNI no puede superar los 8 caracteres.' });
    
    const phoneToSave = phone ? phone.trim() : null;
    if (phoneToSave && phoneToSave.length > 9) return res.status(400).json({ error: 'El teléfono no puede superar los 9 caracteres.' });

    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) etapaBuyer = await prisma.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Contacto inicial' } });

    const result = await prisma.$transaction(async (tx) => {
      const persona = await tx.personas.create({
        data: {
          nombres: firstName,
          apellidos: lastName,
          email: email || null,
          numero: phoneToSave,
          dni: dniToSave,
          autoriza_contacto: contactAuthorization || false,
          fecha_autorizacion: contactAuthorization ? new Date() : null,
          id_etapa_actual: etapaBuyer.id_etapa,
        }
      });

      if (concreteRequest || serviceOfInterestId) {
        await tx.solicitudes.create({
          data: {
            id_persona: persona.id_persona,
            id_servicio: Number(serviceOfInterestId) || null,
            motivo: concreteRequest || 'Solicitud de información general'
          }
        });
      }

      return persona;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear BUYER' });
  }
});

// Actualizar un BUYER
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { person, contactAuthorization, concreteRequest, ...data } = req.body;
  try {
    const updateData: any = {};
    if (person?.firstName) updateData.nombres = person.firstName;
    if (person?.lastName) updateData.apellidos = person.lastName;
    if (person?.email !== undefined) updateData.email = person.email || null;
    
    if (person?.phone !== undefined) {
      const phoneToSave = person.phone ? person.phone.trim() : null;
      if (phoneToSave && phoneToSave.length > 9) return res.status(400).json({ error: 'El teléfono no puede superar los 9 caracteres.' });
      updateData.numero = phoneToSave;
    }
    
    if (person?.documentNumber !== undefined) {
      const dniToSave = person.documentNumber ? person.documentNumber.trim() : null;
      if (dniToSave && dniToSave.length > 8) return res.status(400).json({ error: 'El DNI no puede superar los 8 caracteres.' });
      updateData.dni = dniToSave;
    }

    if (contactAuthorization !== undefined) {
      updateData.autoriza_contacto = contactAuthorization;
      if (contactAuthorization) updateData.fecha_autorizacion = new Date();
    }

    const result = await prisma.$transaction(async (tx) => {
      const persona = await tx.personas.update({
        where: { id_persona: Number(id) },
        data: updateData
      });

      if (concreteRequest !== undefined) {
        const solicitudExistente = await tx.solicitudes.findFirst({
          where: { id_persona: Number(id) }
        });
        
        if (solicitudExistente) {
          await tx.solicitudes.update({
            where: { id_solicitud: solicitudExistente.id_solicitud },
            data: { motivo: concreteRequest }
          });
        } else if (concreteRequest) {
          await tx.solicitudes.create({
            data: {
              id_persona: persona.id_persona,
              motivo: concreteRequest
            }
          });
        }
      }

      return persona;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar BUYER' });
  }
});

// Convertir BUYER a LEAD
router.post('/:id/convert', async (req, res) => {
  const { id } = req.params;
  try {
    let etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (!etapaLead) etapaLead = await prisma.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta' } });
    
    const personaActual = await prisma.personas.findUnique({ 
      where: { id_persona: Number(id) },
      include: { Solicitudes: true }
    });

    if (!personaActual) return res.status(404).json({ error: 'No encontrado' });

    if (!personaActual.autoriza_contacto) {
      return res.status(400).json({ error: 'Debe existir autorización de contacto.' });
    }

    if (personaActual.Solicitudes.length === 0 || !personaActual.Solicitudes[0].motivo) {
      return res.status(400).json({ error: 'Debe existir una solicitud concreta.' });
    }

    await prisma.$transaction([
      prisma.personas.update({
        where: { id_persona: Number(id) },
        data: { id_etapa_actual: etapaLead.id_etapa }
      }),
      prisma.eventosEtapa.create({
        data: {
          id_persona: Number(id),
          etapa_origen: personaActual.id_etapa_actual,
          etapa_destino: etapaLead.id_etapa,
          motivo: 'Conversión manual a LEAD',
        }
      })
    ]);

    res.json({ message: 'Convertido a LEAD' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al convertir a LEAD' });
  }
});

// Eliminar un BUYER
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  try {
    if (!isNaN(numId)) {
      await prisma.pagos.deleteMany({ where: { id_persona: numId } });
      await prisma.reservas.deleteMany({ where: { id_persona: numId } });
      const solicitudes = await prisma.solicitudes.findMany({ where: { id_persona: numId } });
      for (const sol of solicitudes) {
        await prisma.opciones.deleteMany({ where: { id_solicitud: sol.id_solicitud } });
      }
      await prisma.solicitudes.deleteMany({ where: { id_persona: numId } });
      await prisma.eventosEtapa.deleteMany({ where: { id_persona: numId } });
      await prisma.interacciones.deleteMany({ where: { id_persona: numId } });
      await prisma.personaPreferencias.deleteMany({ where: { id_persona: numId } });
      await prisma.personas.delete({ where: { id_persona: numId } });
    }
    res.json({ message: 'Buyer eliminado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar buyer' });
  }
});

export default router;
