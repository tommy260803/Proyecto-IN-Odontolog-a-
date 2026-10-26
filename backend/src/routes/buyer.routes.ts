import { Router } from 'express';
import { prisma } from '../db';
import { BuyerService } from '../services/buyerService';
import { MarketingAgentService } from '../services/ai/MarketingAgentService';

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

// Endpoint para verificar duplicidad en tiempo real (Client & Admin)
router.get('/check-duplicate', async (req, res) => {
  try {
    const { phone, email, dni, excludeId } = req.query;

    const rawPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const cleanPhone = rawPhone.length >= 9 ? rawPhone.slice(-9) : (rawPhone.length >= 7 ? rawPhone : null);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanDni = dni ? String(dni).trim() : null;

    if (!cleanPhone && !cleanEmail && !cleanDni) {
      return res.json({ isDuplicate: false });
    }

    const orConditions: any[] = [];
    if (cleanPhone) {
      orConditions.push({ numero: { contains: cleanPhone } });
    }
    if (cleanEmail && cleanEmail.includes('@')) {
      orConditions.push({ email: cleanEmail });
    }
    if (cleanDni && cleanDni.length >= 8) {
      orConditions.push({ dni: cleanDni });
    }

    if (orConditions.length === 0) {
      return res.json({ isDuplicate: false });
    }

    const whereClause: any = { OR: orConditions };
    if (excludeId && !isNaN(Number(excludeId))) {
      whereClause.id_persona = { not: Number(excludeId) };
    }

    const matchedPersons = await prisma.personas.findMany({
      where: whereClause,
      include: {
        Etapa: true,
      },
      take: 5
    });

    if (matchedPersons && matchedPersons.length > 0) {
      const matches = matchedPersons.map(p => {
        const phoneMatch = Boolean(cleanPhone && p.numero && p.numero.replace(/\D/g, '').includes(cleanPhone));
        const emailMatch = Boolean(cleanEmail && p.email && p.email.toLowerCase() === cleanEmail);
        const dniMatch = Boolean(cleanDni && p.dni && p.dni === cleanDni);

        const matchedFields: string[] = [];
        if (phoneMatch) matchedFields.push('Teléfono');
        if (emailMatch) matchedFields.push('Correo');
        if (dniMatch) matchedFields.push('DNI');

        let matchedByType = 'phone';
        if (phoneMatch && emailMatch) matchedByType = 'both';
        else if (emailMatch) matchedByType = 'email';
        else if (dniMatch) matchedByType = 'dni';

        return {
          id: p.id_persona,
          firstName: p.nombres,
          lastName: p.apellidos,
          fullName: `${p.nombres} ${p.apellidos}`.trim(),
          phone: p.numero,
          email: p.email,
          documentNumber: p.dni,
          etapa: p.Etapa?.nombre || 'BUYER',
          estadoCalidad: p.estado_calidad || 'Valido',
          matchedByType, // 'phone' | 'email' | 'both' | 'dni'
          matchedFieldsText: matchedFields.join(' y ') || 'Contacto',
        };
      });

      const hasPhoneMatch = matches.some(m => m.matchedByType === 'phone' || m.matchedByType === 'both');
      const hasEmailMatch = matches.some(m => m.matchedByType === 'email' || m.matchedByType === 'both');

      let overallMatchedBy: 'phone' | 'email' | 'both' | 'dni' = 'phone';
      if (hasPhoneMatch && hasEmailMatch) overallMatchedBy = 'both';
      else if (hasEmailMatch) overallMatchedBy = 'email';
      else if (hasPhoneMatch) overallMatchedBy = 'phone';
      else overallMatchedBy = 'dni';

      return res.json({
        isDuplicate: true,
        matchedBy: overallMatchedBy,
        matchesCount: matches.length,
        person: matches[0],
        matches,
      });
    }

    return res.json({ isDuplicate: false, matches: [] });
  } catch (error) {
    console.error('Error in check-duplicate:', error);
    res.status(500).json({ error: 'Error al verificar duplicados' });
  }
});

// Endpoints especializados de OportunidadesCaptacion (Fase BUYER)
router.get('/opportunities', async (req, res) => {
  try {
    const result = await BuyerService.listOpportunities(req.query);
    res.json(result);
  } catch (error: any) {
    console.error('Error in GET /opportunities:', error);
    res.status(500).json({ error: error.message || 'Error al listar oportunidades' });
  }
});

router.get('/opportunities/:id', async (req, res) => {
  try {
    const numId = Number(req.params.id);
    if (isNaN(numId)) return res.status(400).json({ error: 'ID de oportunidad inválido' });
    const detail = await BuyerService.getOpportunityDetail(numId);
    res.json(detail);
  } catch (error: any) {
    console.error('Error in GET /opportunities/:id:', error);
    res.status(404).json({ error: error.message || 'Oportunidad no encontrada' });
  }
});

router.patch('/opportunities/:id/status', async (req, res) => {
  try {
    const numId = Number(req.params.id);
    if (isNaN(numId)) return res.status(400).json({ error: 'ID de oportunidad inválido' });
    const updated = await BuyerService.updateStatus(numId, req.body);
    res.json({ success: true, message: 'Estado de oportunidad actualizado', data: updated });
  } catch (error: any) {
    console.error('Error in PATCH /opportunities/:id/status:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar estado de oportunidad' });
  }
});

router.post('/opportunities/:id/convert', async (req, res) => {
  try {
    const numId = Number(req.params.id);
    if (isNaN(numId)) return res.status(400).json({ error: 'ID de oportunidad inválido' });
    const result = await BuyerService.convertToLead(numId, req.body);
    res.json({ success: true, message: 'Oportunidad convertida a LEAD exitosamente', data: result });
  } catch (error: any) {
    console.error('Error in POST /opportunities/:id/convert:', error);
    res.status(400).json({ error: error.message || 'Error al convertir a LEAD' });
  }
});

// Endpoint del Agente de Marketing IA para análisis ad-hoc
router.post('/agent/analyze', async (req, res) => {
  try {
    const analysis = await MarketingAgentService.analyzeLead(req.body);
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error('Error in POST /agent/analyze:', error);
    res.status(500).json({ error: error.message || 'Error al ejecutar análisis de IA' });
  }
});

// Endpoint del Agente de Marketing IA para analizar una oportunidad existente
router.post('/opportunities/:id/analyze', async (req, res) => {
  try {
    const numId = Number(req.params.id);
    if (isNaN(numId)) return res.status(400).json({ error: 'ID de oportunidad inválido' });
    const op = await BuyerService.getOpportunityDetail(numId);
    const analysis = await MarketingAgentService.analyzeLead({
      id_oportunidad: op.id_oportunidad,
      id_persona: op.id_persona,
      nombres: op.Persona.nombres,
      apellidos: op.Persona.apellidos,
      telefono: op.Persona.numero || undefined,
      email: op.Persona.email || undefined,
      consulta: op.necesidad_declarada || 'Consulta odontológica',
      canal: op.Canal?.nombre,
      fuente: op.Fuente?.nombre,
      campana: op.Campana?.nombre,
      id_usuario: req.body.id_usuario
    });
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error('Error in POST /opportunities/:id/analyze:', error);
    res.status(500).json({ error: error.message || 'Error al analizar oportunidad con IA' });
  }
});

// Registrar BUYER en la fase BUYER (sin salto forzado a LEAD)
router.post('/register', async (req, res) => {
  try {
    const result = await BuyerService.registerOpportunity(req.body);
    res.status(201).json({
      success: true,
      isDuplicate: result.esRecurrente,
      isRecurring: result.esRecurrente,
      consultationCount: result.esRecurrente ? 2 : 1,
      message: result.esRecurrente
        ? 'Nueva oportunidad registrada para paciente existente.'
        : 'Oportunidad registrada exitosamente en fase BUYER.',
      data: {
        id_persona: result.persona.id_persona,
        id_oportunidad: result.oportunidad.id_oportunidad,
        persona: result.persona,
        oportunidad: result.oportunidad,
        alertas: result.alertas
      }
    });
  } catch (error: any) {
    console.error('Error al registrar BUYER:', error);
    res.status(400).json({
      error: error?.message || 'Error al registrar oportunidad en fase BUYER',
      details: error?.message
    });
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
        Interacciones: { include: { Canal: true, Fuente: true }, orderBy: { fecha_hora: 'desc' } },
        Solicitudes: { include: { Servicio: true }, orderBy: { id_solicitud: 'desc' } },
        Preferencias: { include: { Canal: true } },
        DatosAcademicos: true,
        DatosLaborales: true,
        SaludOdontologica: true,
      }
    });

    // Precalcular frecuencias para identificar duplicados por teléfono (últimos 9 dígitos), DNI o correo
    const phoneCounts = new Map<string, number>();
    const dniCounts = new Map<string, number>();
    const emailCounts = new Map<string, number>();
    for (const p of personas) {
      const ph = (p.numero || '').replace(/\D/g, '').slice(-9);
      if (ph.length >= 8) {
        phoneCounts.set(ph, (phoneCounts.get(ph) || 0) + 1);
      }
      if (p.dni && p.dni.trim()) {
        const dn = p.dni.trim();
        dniCounts.set(dn, (dniCounts.get(dn) || 0) + 1);
      }
      if (p.email && p.email.trim() && p.email.includes('@')) {
        const em = p.email.trim().toLowerCase();
        emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
      }
    }

    // Mapeamos a BuyerWithPerson
    const buyers = personas.map(p => {
      const ph = (p.numero || '').replace(/\D/g, '').slice(-9);
      const em = p.email ? p.email.trim().toLowerCase() : '';
      const hasDuplicate = 
        (ph.length >= 8 && (phoneCounts.get(ph) || 0) > 1) ||
        (p.dni && (dniCounts.get(p.dni.trim()) || 0) > 1) ||
        (em && (emailCounts.get(em) || 0) > 1);

      const isDuplicate = hasDuplicate || p.estado_calidad === 'Duplicado';

      let state = 'NEW';
      if (p.estado_calidad === 'Rechazado') {
        state = 'DISCARDED';
      } else if (p.Etapa?.nombre === 'LEAD' || p.Etapa?.nombre === 'PAYER' || p.Etapa?.nombre === 'CUSTOMER' || p.Etapa?.nombre === 'TURNED') {
        state = 'CONVERTED';
      } else if (p.estado_calidad === 'Duplicado' || (isDuplicate && p.Etapa?.nombre === 'BUYER')) {
        state = 'DUPLICATED';
      }

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

      const consultasCount = p.Solicitudes.length || 1;
      const solicitudesHistory = p.Solicitudes.map(s => ({
        id: s.id_solicitud.toString(),
        servicio: s.Servicio?.nombre || 'Consulta General',
        motivo: s.motivo || 'Sin detalle',
        fecha: s.fecha_solicitud ? s.fecha_solicitud.toISOString() : undefined,
      }));
      const interaccionesHistory = p.Interacciones.map(i => ({
        id: i.id_interaccion.toString(),
        tipo: i.tipo,
        mensaje: i.mensaje || '',
        canal: i.Canal?.nombre,
        fuente: i.Fuente?.nombre,
        fecha: i.fecha_hora.toISOString(),
      }));

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
        qualityStatus: isDuplicate ? 'Duplicado' : (p.estado_calidad || 'Valido'),
        concreteRequest: motivo,
        createdAt: p.fecha_registro.toISOString(),
        convertedAt,
        state,
        consultasCount,
        solicitudesHistory,
        interaccionesHistory,

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
    ultima_visita_odontologica, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial
  } = req.body;
  try {
    const dniToSave = documentNumber ? documentNumber.trim() : null;
    if (dniToSave && dniToSave.length > 8) return res.status(400).json({ error: 'El DNI no puede superar los 8 caracteres.' });

    const phoneToSave = phone ? phone.trim() : null;
    if (phoneToSave && phoneToSave.length > 20) return res.status(400).json({ error: 'El teléfono no puede superar los 20 caracteres.' });

    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) etapaBuyer = await prisma.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Contacto inicial' } });

    const result = await prisma.$transaction(async (tx) => {
      // Verificar si ya existe por teléfono o DNI
      let isDuplicate = false;
      const rawDigits = phoneToSave ? phoneToSave.replace(/\D/g, '') : '';
      const last9 = rawDigits.length >= 9 ? rawDigits.slice(-9) : (rawDigits.length >= 7 ? rawDigits : null);

      const dupChecks: any[] = [];
      if (last9) dupChecks.push({ numero: { contains: last9 } });
      if (dniToSave) dupChecks.push({ dni: dniToSave });
      if (email && email.trim()) dupChecks.push({ email: email.trim() });

      if (dupChecks.length > 0) {
        const existing = await tx.personas.findFirst({
          where: { OR: dupChecks }
        });
        if (existing) {
          isDuplicate = true;
        }
      }

      const validCampana = await getValidCampanaId(tx, id_campana_origen);
      const validCanalOrigen = await getValidCanalId(tx, id_canal_origen);
      const validChannel = await getValidCanalId(tx, channel);
      const validAttractionSource = await getValidFuenteId(tx, attractionSource);
      const validService = await getValidServicioId(tx, serviceOfInterestId);
      const validPrefCanal = await getValidCanalId(tx, pref_id_canal);
      const validPrefHorario = await getValidHorarioId(tx, pref_id_horario);
      const validPrefModalidad = await getValidModalidadId(tx, pref_id_modalidad);

      const finalCalidad = estado_calidad || (isDuplicate ? 'Duplicado' : 'Valido');

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
          estado_calidad: finalCalidad,
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
      if (ultima_visita_odontologica || tratamiento_previo || nivel_dolor || presenta_sensibilidad || sangrado_o_inflamacion || usa_aparato_o_protesis || condicion_atencion_especial) {
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: persona.id_persona,
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: null,
            tratamiento_previo: tratamiento_previo || null,
            nivel_dolor: nivel_dolor || null,
            presenta_sensibilidad: presenta_sensibilidad || null,
            sangrado_o_inflamacion: sangrado_o_inflamacion || null,
            usa_aparato_o_protesis: usa_aparato_o_protesis || null,
            condicion_atencion_especial: condicion_atencion_especial || null,
          }
        });
      }

      return { ...persona, isDuplicate };
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
    ultima_visita_odontologica, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial,
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
      if (ultima_visita_odontologica || tratamiento_previo || nivel_dolor || presenta_sensibilidad || sangrado_o_inflamacion || usa_aparato_o_protesis || condicion_atencion_especial) {
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: Number(id),
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: null,
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
// Convertir BUYER a LEAD mediante BuyerService
router.post('/:id/convert', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (isNaN(numId)) return res.status(400).json({ error: 'ID de buyer inválido' });

  try {
    const result = await BuyerService.convertToLead(numId, req.body);
    res.json({
      success: true,
      message: 'Paciente transferido a LEAD exitosamente',
      data: result
    });
  } catch (error: any) {
    console.error('Error al convertir a LEAD:', error);
    res.status(400).json({ error: error.message || 'Error al convertir a LEAD' });
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
