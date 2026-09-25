import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

// Helper functions to safely resolve foreign keys
async function getValidCanalId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.canales.findUnique({ where: { id_canal: Number(id) } });
    return item ? item.id_canal : null;
  } catch {
    return null;
  }
}

async function getValidFuenteId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.fuentes.findUnique({ where: { id_fuente: Number(id) } });
    return item ? item.id_fuente : null;
  } catch {
    return null;
  }
}

async function getValidServicioId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.servicios.findUnique({ where: { id_servicio: Number(id) } });
    return item ? item.id_servicio : null;
  } catch {
    return null;
  }
}

async function getValidCampanaId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.campanas.findUnique({ where: { id_campana: Number(id) } });
    return item ? item.id_campana : null;
  } catch {
    return null;
  }
}

async function getValidHorarioId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.horarios.findUnique({ where: { id_horario: Number(id) } });
    return item ? item.id_horario : null;
  } catch {
    return null;
  }
}

async function getValidModalidadId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.modalidades.findUnique({ where: { id_modalidad: Number(id) } });
    if (item) return item.id_modalidad;
    const first = await tx.modalidades.findFirst();
    return first ? first.id_modalidad : null;
  } catch {
    return null;
  }
}

// Obtener catálogos para el formulario
router.get('/catalogs', async (req, res) => {
  try {
    const canales = await prisma.canales.findMany({ where: { activo: true } });
    const fuentes = await prisma.fuentes.findMany({ where: { activo: true } });
    const servicios = await prisma.servicios.findMany({ where: { activo: true } });
    const sedes = await prisma.sedes.findMany({ where: { activo: true } });
    
    // Asegurar modalidades si están vacías
    let modalidades = await prisma.modalidades.findMany();
    if (modalidades.length === 0) {
      try {
        await prisma.modalidades.createMany({
          data: [
            { nombre: 'Presencial' },
            { nombre: 'Virtual' },
            { nombre: 'Teleconsulta' },
            { nombre: 'Domiciliaria' }
          ]
        });
        modalidades = await prisma.modalidades.findMany();
      } catch (e) {
        console.warn('Could not auto-seed modalidades:', e);
      }
    }

    const horarios = await prisma.horarios.findMany();
    res.json({ canales, fuentes, servicios, sedes, modalidades, horarios });
  } catch (error) {
    console.error('Error al obtener catálogos:', error);
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
    sede_preferida,
    id_campana_origen,
    id_canal_origen,
    tipo_persona,
    estado_calidad,
    id_servicio_interes,
  } = req.body;

  try {
    // 1. Encontrar o crear Etapas
    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) etapaBuyer = await prisma.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Contacto inicial' } });

    let etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (!etapaLead) etapaLead = await prisma.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta' } });

    // 2. Transacción para asegurar la creación completa con FK sanitizadas
    const result = await prisma.$transaction(async (tx) => {
      // Asegurar o buscar canal de Página Web
      let webCanal = await tx.canales.findFirst({
        where: {
          OR: [
            { nombre: { contains: 'Web' } },
            { nombre: { contains: 'Portal' } },
            { nombre: { contains: 'Online' } }
          ]
        }
      });
      if (!webCanal) {
        webCanal = await tx.canales.create({
          data: { nombre: 'Página Web / Portal Online', activo: true }
        });
      }

      // Asegurar o buscar fuente de Formulario Web
      let webFuente = await tx.fuentes.findFirst({
        where: {
          OR: [
            { nombre: { contains: 'Web' } },
            { nombre: { contains: 'Formulario' } },
            { nombre: { contains: 'Digital' } },
            { nombre: { contains: 'Meta' } }
          ]
        }
      });
      if (!webFuente) {
        webFuente = await tx.fuentes.create({
          data: { nombre: 'Formulario Web - Portal NexoSalud', activo: true }
        });
      }

      const validCanal = (id_canal ? await getValidCanalId(tx, id_canal) : null) || webCanal.id_canal;
      const validCanalOrigen = (id_canal_origen ? await getValidCanalId(tx, id_canal_origen) : null) || webCanal.id_canal;
      const validFuente = (id_fuente ? await getValidFuenteId(tx, id_fuente) : null) || webFuente.id_fuente;
      const validCampana = id_campana_origen ? await getValidCampanaId(tx, id_campana_origen) : null;
      const validServicio = await getValidServicioId(tx, id_servicio);
      const validServicioInteres = (await getValidServicioId(tx, id_servicio_interes)) || validServicio;

      const persona = await tx.personas.create({
        data: {
          nombres,
          apellidos,
          email,
          numero,
          autoriza_contacto: autoriza_contacto || false,
          fecha_autorizacion: autoriza_contacto ? new Date() : null,
          id_campana_origen: validCampana,
          id_canal_origen: validCanalOrigen,
          tipo_persona: tipo_persona || 'Adulto General',
          estado_calidad: estado_calidad || 'Valido',
          id_etapa_actual: etapaLead.id_etapa,
        }
      });

      // Crear interacción (origen)
      await tx.interacciones.create({
        data: {
          id_persona: persona.id_persona,
          id_canal: validCanal,
          id_fuente: validFuente,
          tipo: 'Registro y Solicitud de Info',
          mensaje: 'El usuario llenó el formulario público de solicitud de información.'
        }
      });

      // Guardar preferencias si existen
      if (sede_preferida || validCanal || validServicioInteres) {
        await tx.personaPreferencias.create({
          data: {
            id_persona: persona.id_persona,
            id_canal: validCanal,
            id_servicio_interes: validServicioInteres,
            sede_preferida: sede_preferida || null,
          }
        });
      }

      // Generar Solicitud
      const solicitud = await tx.solicitudes.create({
        data: {
          id_persona: persona.id_persona,
          id_servicio: validServicio,
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
        OR: [
          { id_campana_origen: { not: null } },
          { id_canal_origen: { not: null } },
          { Etapa: { nombre: { in: ['BUYER', 'LEAD'] } } }
        ]
      },
      orderBy: { fecha_registro: 'desc' },
      include: {
        Etapa: true,
        CanalOrigen: true,
        CampanaOrigen: { include: { GastosCampana: true } },
        EventosEtapa: { include: { EtapaDestino: true }, orderBy: { fecha_hora: 'asc' } },
        Interacciones: { include: { Canal: true, Fuente: true }, orderBy: { fecha_hora: 'asc' } },
        Solicitudes: { include: { Servicio: true } },
        Preferencias: { include: { Canal: true } },
        DatosAcademicos: true,
        DatosLaborales: true,
        SaludOdontologica: true,
      }
    });

    // Mapeamos a BuyerWithPerson
    const buyers = personas.map(p => {
      let state = 'NEW';
      if (p.estado_calidad === 'Rechazado') state = 'DISCARDED';
      else if (p.Etapa.nombre === 'LEAD' || p.Etapa.nombre === 'PAYER' || p.Etapa.nombre === 'CUSTOMER' || p.Etapa.nombre === 'TURNED') state = 'CONVERTED';

      // Buscar fecha real de conversión a LEAD desde EventosEtapa
      const eventoConversion = p.EventosEtapa.find(e => e.EtapaDestino?.nombre === 'LEAD' || e.EtapaDestino?.nombre === 'PAYER' || e.EtapaDestino?.nombre === 'CUSTOMER');
      const convertedAt = eventoConversion 
        ? eventoConversion.fecha_hora.toISOString() 
        : (state === 'CONVERTED' ? (p.fecha_actualizacion || p.fecha_autorizacion || p.fecha_registro).toISOString() : undefined);

      const canalName = p.CanalOrigen?.nombre || 
        (p.Interacciones.length > 0 && p.Interacciones[0].Canal?.nombre) || 
        (p.Preferencias.length > 0 && p.Preferencias[0].Canal?.nombre) || 
        'Página Web / Portal Online';
      const canalId = p.id_canal_origen?.toString() || 
        (p.Interacciones.length > 0 && p.Interacciones[0].id_canal?.toString()) || 
        '';

      const fuenteName = (p.Interacciones.length > 0 && p.Interacciones[0].Fuente?.nombre) || 
        'Formulario Web - Portal NexoSalud';
      const fuenteId = (p.Interacciones.length > 0 && p.Interacciones[0].id_fuente?.toString()) || 
        '';

      const servicioName = p.Solicitudes.length > 0 && p.Solicitudes[0].Servicio
        ? p.Solicitudes[0].Servicio.nombre : undefined;
      const servicioId = p.Solicitudes.length > 0 && p.Solicitudes[0].id_servicio
        ? p.Solicitudes[0].id_servicio.toString() : undefined;

      const motivo = p.Solicitudes.length > 0 ? p.Solicitudes[0].motivo : undefined;

      const prefs = p.Preferencias.length > 0 ? p.Preferencias[0] : null;
      const aca = p.DatosAcademicos.length > 0 ? p.DatosAcademicos[0] : null;
      const lab = p.DatosLaborales.length > 0 ? p.DatosLaborales[0] : null;
      const sal = p.SaludOdontologica.length > 0 ? p.SaludOdontologica[0] : null;

      const campaignId = p.id_campana_origen?.toString();
      const campaignName = p.CampanaOrigen?.nombre;
      const campaignCost = p.CampanaOrigen?.GastosCampana?.reduce((sum, g) => sum + Number(g.importe), 0);

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
        channel: canalName,
        channelId: canalId,
        attractionSource: fuenteName,
        attractionSourceId: fuenteId,
        campaignId,
        campaignName,
        campaignCost,
        serviceOfInterest: servicioName,
        serviceOfInterestId: servicioId,
        contactAuthorization: p.autoriza_contacto,
        qualityStatus: p.estado_calidad || 'Valido',
        concreteRequest: motivo,
        createdAt: p.fecha_registro.toISOString(),
        convertedAt,
        state,

        // Nuevos campos
        pref_id_canal: prefs?.id_canal?.toString() || '',
        pref_id_horario: prefs?.id_horario?.toString() || '',
        pref_id_modalidad: prefs?.id_modalidad?.toString() || '',
        pref_sede_preferida: prefs?.sede_preferida || '',
        pref_profesional_preferido: prefs?.profesional_preferido || '',

        estudianteAplica: aca?.aplica || false,
        universidad: aca?.universidad || '',
        carrera: aca?.carrera || '',
        ciclo: aca?.ciclo || '',

        laboralAplica: lab?.aplica || false,
        ocupacion: lab?.ocupacion || '',
        empresa: lab?.empresa || '',
        modalidadLaboral: lab?.modalidad || '',
        disponibilidadLaboral: lab?.disponibilidad || '',

        ultima_visita_odontologica: sal?.ultima_visita_odontologica || '',
        motivo_consulta_odonto: sal?.motivo_consulta || '',
        tratamiento_previo: sal?.tratamiento_previo || '',
        nivel_dolor: sal?.nivel_dolor || '',
        presenta_sensibilidad: sal?.presenta_sensibilidad || '',
        sangrado_o_inflamacion: sal?.sangrado_o_inflamacion || '',
        usa_aparato_o_protesis: sal?.usa_aparato_o_protesis || '',
        condicion_atencion_especial: sal?.condicion_atencion_especial || '',
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
  const { 
    firstName, lastName, email, phone, documentNumber, channel, attractionSource, serviceOfInterestId, contactAuthorization, concreteRequest, id_campana_origen, id_canal_origen, tipo_persona, estado_calidad,
    pref_id_canal, pref_id_horario, pref_id_modalidad, pref_sede_preferida, pref_profesional_preferido,
    estudianteAplica, universidad, carrera, ciclo,
    laboralAplica, ocupacion, empresa, modalidadLaboral, disponibilidadLaboral,
    ultima_visita_odontologica, motivo_consulta_odonto, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial
  } = req.body;
  try {
    const dniToSave = documentNumber ? documentNumber.trim() : null;
    if (dniToSave && dniToSave.length > 8) return res.status(400).json({ error: 'El DNI no puede superar los 8 caracteres.' });

    const phoneToSave = phone ? phone.trim() : null;
    if (phoneToSave && phoneToSave.length > 20) return res.status(400).json({ error: 'El teléfono no puede superar los 20 caracteres.' });

    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) etapaBuyer = await prisma.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Contacto inicial' } });

    const result = await prisma.$transaction(async (tx) => {
      const validCampana = await getValidCampanaId(tx, id_campana_origen);
      const validCanalOrigen = await getValidCanalId(tx, id_canal_origen);
      const validChannel = await getValidCanalId(tx, channel);
      const validAttractionSource = await getValidFuenteId(tx, attractionSource);
      const validService = await getValidServicioId(tx, serviceOfInterestId);
      const validPrefCanal = await getValidCanalId(tx, pref_id_canal);
      const validPrefHorario = await getValidHorarioId(tx, pref_id_horario);
      const validPrefModalidad = await getValidModalidadId(tx, pref_id_modalidad);

      const persona = await tx.personas.create({
        data: {
          nombres: firstName,
          apellidos: lastName,
          email: email || null,
          numero: phoneToSave,
          dni: dniToSave,
          autoriza_contacto: contactAuthorization || false,
          fecha_autorizacion: contactAuthorization ? new Date() : null,
          id_campana_origen: validCampana,
          id_canal_origen: validCanalOrigen,
          tipo_persona: tipo_persona || 'Adulto General',
          estado_calidad: estado_calidad || 'Valido',
          id_etapa_actual: etapaBuyer.id_etapa,
        }
      });

      if (validChannel || validAttractionSource) {
        await tx.interacciones.create({
          data: {
            id_persona: persona.id_persona,
            id_canal: validChannel,
            id_fuente: validAttractionSource,
            tipo: 'Registro Inicial',
            mensaje: 'Creación de BUYER desde Dashboard'
          }
        });
      }

      if (concreteRequest || validService) {
        await tx.solicitudes.create({
          data: {
            id_persona: persona.id_persona,
            id_servicio: validService,
            motivo: concreteRequest || 'Solicitud de información general'
          }
        });
      }

      // Gustos y Preferencias
      if (validPrefCanal || validPrefHorario || validPrefModalidad || pref_sede_preferida || pref_profesional_preferido) {
        await tx.personaPreferencias.create({
          data: {
            id_persona: persona.id_persona,
            id_canal: validPrefCanal,
            id_horario: validPrefHorario,
            id_modalidad: validPrefModalidad,
            sede_preferida: pref_sede_preferida || null,
            profesional_preferido: pref_profesional_preferido || null,
          }
        });
      }

      // Datos Estudiante
      if (estudianteAplica) {
        await tx.datosAcademicos.create({
          data: {
            id_persona: persona.id_persona,
            aplica: true,
            universidad: universidad || null,
            carrera: carrera || null,
            ciclo: ciclo || null,
          }
        });
      }

      // Datos Laborales
      if (laboralAplica) {
        await tx.datosLaborales.create({
          data: {
            id_persona: persona.id_persona,
            aplica: true,
            ocupacion: ocupacion || null,
            empresa: empresa || null,
            modalidad: modalidadLaboral || null,
            disponibilidad: disponibilidadLaboral || null,
          }
        });
      }

      // Salud Odontológica
      if (ultima_visita_odontologica || motivo_consulta_odonto || tratamiento_previo || nivel_dolor || presenta_sensibilidad || sangrado_o_inflamacion || usa_aparato_o_protesis || condicion_atencion_especial) {
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: persona.id_persona,
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: motivo_consulta_odonto || null,
            tratamiento_previo: tratamiento_previo || null,
            nivel_dolor: nivel_dolor || null,
            presenta_sensibilidad: presenta_sensibilidad || null,
            sangrado_o_inflamacion: sangrado_o_inflamacion || null,
            usa_aparato_o_protesis: usa_aparato_o_protesis || null,
            condicion_atencion_especial: condicion_atencion_especial || null,
          }
        });
      }

      return persona;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Error al crear BUYER' });
  }
});

// Actualizar un BUYER
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    person, contactAuthorization, concreteRequest,
    channel, attractionSource, serviceOfInterestId,
    pref_id_canal, pref_id_horario, pref_id_modalidad, pref_sede_preferida, pref_profesional_preferido,
    estudianteAplica, universidad, carrera, ciclo,
    laboralAplica, ocupacion, empresa, modalidadLaboral, disponibilidadLaboral,
    ultima_visita_odontologica, motivo_consulta_odonto, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial,
    ...data 
  } = req.body;
  try {
    const updateData: any = {};
    if (person?.firstName) updateData.nombres = person.firstName;
    if (person?.lastName) updateData.apellidos = person.lastName;
    if (person?.email !== undefined) updateData.email = person.email || null;

    if (person?.phone !== undefined) {
      const phoneToSave = person.phone ? person.phone.trim() : null;
      if (phoneToSave && phoneToSave.length > 20) return res.status(400).json({ error: 'El teléfono no puede superar los 20 caracteres.' });
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

      const validService = await getValidServicioId(tx, serviceOfInterestId);
      const validChannel = await getValidCanalId(tx, channel);
      const validAttractionSource = await getValidFuenteId(tx, attractionSource);
      const validPrefCanal = await getValidCanalId(tx, pref_id_canal);
      const validPrefHorario = await getValidHorarioId(tx, pref_id_horario);
      const validPrefModalidad = await getValidModalidadId(tx, pref_id_modalidad);

      if (concreteRequest !== undefined || serviceOfInterestId !== undefined) {
        const solicitudExistente = await tx.solicitudes.findFirst({
          where: { id_persona: Number(id) }
        });

        if (solicitudExistente) {
          const dataToUpdate: any = {};
          if (concreteRequest !== undefined) dataToUpdate.motivo = concreteRequest;
          if (serviceOfInterestId !== undefined) dataToUpdate.id_servicio = validService;

          await tx.solicitudes.update({
            where: { id_solicitud: solicitudExistente.id_solicitud },
            data: dataToUpdate
          });
        } else if (concreteRequest || validService) {
          await tx.solicitudes.create({
            data: {
              id_persona: persona.id_persona,
              motivo: concreteRequest || 'Solicitud de información general',
              id_servicio: validService
            }
          });
        }
      }

      if (validChannel !== null || validAttractionSource !== null || channel || attractionSource) {
        const interaccionExistente = await tx.interacciones.findFirst({
          where: { id_persona: Number(id) },
          orderBy: { fecha_hora: 'asc' }
        });
        
        if (interaccionExistente) {
          await tx.interacciones.update({
            where: { id_interaccion: interaccionExistente.id_interaccion },
            data: {
              id_canal: validChannel,
              id_fuente: validAttractionSource,
            }
          });
        } else if (validChannel || validAttractionSource) {
          await tx.interacciones.create({
            data: {
              id_persona: Number(id),
              id_canal: validChannel,
              id_fuente: validAttractionSource,
              tipo: 'Actualización',
              mensaje: 'Actualizado desde Dashboard'
            }
          });
        }
      }

      // Reemplazar Gustos y Preferencias
      await tx.personaPreferencias.deleteMany({ where: { id_persona: Number(id) } });
      if (validPrefCanal || validPrefHorario || validPrefModalidad || pref_sede_preferida || pref_profesional_preferido) {
        await tx.personaPreferencias.create({
          data: {
            id_persona: Number(id),
            id_canal: validPrefCanal,
            id_horario: validPrefHorario,
            id_modalidad: validPrefModalidad,
            sede_preferida: pref_sede_preferida || null,
            profesional_preferido: pref_profesional_preferido || null,
          }
        });
      }

      // Reemplazar Datos Estudiante
      await tx.datosAcademicos.deleteMany({ where: { id_persona: Number(id) } });
      if (estudianteAplica) {
        await tx.datosAcademicos.create({
          data: {
            id_persona: Number(id),
            aplica: true,
            universidad: universidad || null,
            carrera: carrera || null,
            ciclo: ciclo || null,
          }
        });
      }

      // Reemplazar Datos Laborales
      await tx.datosLaborales.deleteMany({ where: { id_persona: Number(id) } });
      if (laboralAplica) {
        await tx.datosLaborales.create({
          data: {
            id_persona: Number(id),
            aplica: true,
            ocupacion: ocupacion || null,
            empresa: empresa || null,
            modalidad: modalidadLaboral || null,
            disponibilidad: disponibilidadLaboral || null,
          }
        });
      }

      // Reemplazar Salud Odontológica
      await tx.personaSaludOdontologica.deleteMany({ where: { id_persona: Number(id) } });
      if (ultima_visita_odontologica || motivo_consulta_odonto || tratamiento_previo || nivel_dolor || presenta_sensibilidad || sangrado_o_inflamacion || usa_aparato_o_protesis || condicion_atencion_especial) {
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: Number(id),
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: motivo_consulta_odonto || null,
            tratamiento_previo: tratamiento_previo || null,
            nivel_dolor: nivel_dolor || null,
            presenta_sensibilidad: presenta_sensibilidad || null,
            sangrado_o_inflamacion: sangrado_o_inflamacion || null,
            usa_aparato_o_protesis: usa_aparato_o_protesis || null,
            condicion_atencion_especial: condicion_atencion_especial || null,
          }
        });
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
  const numId = Number(id);
  if (isNaN(numId)) return res.status(400).json({ error: 'ID de buyer inválido' });

  try {
    let etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (!etapaLead) etapaLead = await prisma.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta' } });

    const personaActual = await prisma.personas.findUnique({
      where: { id_persona: numId },
      include: { Solicitudes: true }
    });

    if (!personaActual) return res.status(404).json({ error: 'Paciente no encontrado' });

    await prisma.$transaction(async (tx) => {
      // 1. Asegurar autorización y actualizar etapa a LEAD
      await tx.personas.update({
        where: { id_persona: numId },
        data: {
          id_etapa_actual: etapaLead.id_etapa,
          autoriza_contacto: true,
          fecha_autorizacion: personaActual.fecha_autorizacion || new Date(),
          fecha_actualizacion: new Date(),
        }
      });

      // 2. Asegurar que exista al menos una solicitud con motivo
      if (!personaActual.Solicitudes || personaActual.Solicitudes.length === 0) {
        await tx.solicitudes.create({
          data: {
            id_persona: numId,
            motivo: 'Solicitud de evaluación odontológica para paso a LEAD',
            estado: 'Abierta',
            fecha_solicitud: new Date(),
          }
        });
      } else if (!personaActual.Solicitudes[0].motivo || personaActual.Solicitudes[0].motivo.trim() === '') {
        await tx.solicitudes.update({
          where: { id_solicitud: personaActual.Solicitudes[0].id_solicitud },
          data: {
            motivo: 'Solicitud de evaluación odontológica para paso a LEAD',
          }
        });
      }

      // 3. Registrar el evento en el historial de transiciones
      await tx.eventosEtapa.create({
        data: {
          id_persona: numId,
          etapa_origen: personaActual.id_etapa_actual,
          etapa_destino: etapaLead.id_etapa,
          motivo: 'Conversión de BUYER a LEAD (Apertura de Mesa de Negociación)',
        }
      });
    });

    res.json({ message: 'Paciente transferido a LEAD exitosamente' });
  } catch (error: any) {
    console.error('Error al convertir a LEAD:', error);
    res.status(500).json({ error: error.message || 'Error al convertir a LEAD' });
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
