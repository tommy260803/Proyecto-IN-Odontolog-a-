import { prisma } from '../db';

export interface RegisterBuyerDTO {
  firstName?: string;
  lastName?: string;
  nombres?: string;
  apellidos?: string;
  email?: string;
  phone?: string;
  numero?: string;
  telefono?: string;
  dni?: string;
  channel?: string | number;
  id_canal?: number;
  id_canal_origen?: number;
  attractionSource?: string | number;
  id_fuente?: number;
  id_campana?: number;
  id_campana_origen?: number;
  serviceOfInterestId?: string | number;
  id_servicio?: number;
  id_servicio_interes?: number;
  pref_sede_preferida?: string | number;
  id_sede_preferida?: number;
  id_sede?: number;
  concreteRequest?: string;
  mensaje_consulta?: string;
  contactAuthorization?: boolean;
  autoriza_contacto?: boolean;
  consentimiento_atencion?: boolean;
  consentimiento_promocional?: boolean;
  consentimiento_ia?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  device?: string;
  autoConvertIfQualified?: boolean;
  isNewPersonConfirmed?: boolean;
}

export interface ConvertOpportunityDTO {
  id_usuario?: number;
  motivo_conversion?: string;
  prioridad?: string;
  id_servicio?: number;
  id_sede?: number;
}

export interface StatusTransitionDTO {
  nuevo_estado: 'NUEVO' | 'INCOMPLETO' | 'EN_CALIFICACION' | 'AMBIGUO' | 'CALIFICADO' | 'CONVERTIDO_LEAD' | 'DESCARTADO';
  motivo?: string;
  id_usuario?: number;
}

/**
 * Normaliza un número telefónico a 9 dígitos estándar (Perú).
 */
export function normalizePhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const clean = String(rawPhone).replace(/\D/g, '');
  return clean.length >= 9 ? clean.slice(-9) : clean;
}

/**
 * Normaliza una dirección de correo electrónico.
 */
export function normalizeEmail(rawEmail?: string | null): string {
  if (!rawEmail) return '';
  return String(rawEmail).trim().toLowerCase();
}

export class BuyerService {
  /**
   * Registra una oportunidad omnicanal en fase BUYER sin saltarse a LEAD.
   */
  static async registerOpportunity(data: RegisterBuyerDTO) {
    const nombres = (data.nombres || data.firstName || '').trim();
    const apellidos = (data.apellidos || data.lastName || '').trim();
    const rawPhone = data.telefono || data.numero || data.phone || '';
    const phoneNorm = normalizePhone(rawPhone);
    const emailNorm = normalizeEmail(data.email);
    const dni = data.dni ? String(data.dni).trim() : null;
    const consulta = (data.mensaje_consulta || data.concreteRequest || '').trim();

    // Verificación de consentimientos bajo Ley N° 29733
    // consentimiento_atencion es obligatorio para tramitar la consulta solicitada
    const consentimientoAtencion = data.consentimiento_atencion !== undefined 
      ? Boolean(data.consentimiento_atencion) 
      : Boolean(data.contactAuthorization ?? data.autoriza_contacto ?? true);
    
    const consentimientoPromocional = Boolean(data.consentimiento_promocional ?? data.autoriza_contacto ?? false);
    const consentimientoIa = data.consentimiento_ia !== undefined ? Boolean(data.consentimiento_ia) : true;

    if (!consentimientoAtencion) {
      throw new Error('Debe otorgar el consentimiento de atención para procesar su solicitud de información odontológica.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Catálogos base
      let etapaBuyer = await tx.etapas.findFirst({ where: { nombre: 'BUYER' } });
      if (!etapaBuyer) {
        etapaBuyer = await tx.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Fase de captación inicial' } });
      }

      let etapaLead = await tx.etapas.findFirst({ where: { nombre: 'LEAD' } });
      if (!etapaLead) {
        etapaLead = await tx.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta calificada' } });
      }

      // 2. Canales y fuentes predeterminados si no vienen o no existen en la BD
      let canalId = Number(data.id_canal || data.id_canal_origen || data.channel);
      let canalObj = !isNaN(canalId) && canalId > 0
        ? await tx.canales.findUnique({ where: { id_canal: canalId } })
        : null;
      if (!canalObj) {
        canalObj = await tx.canales.findFirst({ where: { activo: true } });
      }
      canalId = canalObj ? canalObj.id_canal : 1;

      let fuenteId = Number(data.id_fuente || data.attractionSource);
      let fuenteObj = !isNaN(fuenteId) && fuenteId > 0
        ? await tx.fuentes.findUnique({ where: { id_fuente: fuenteId } })
        : null;
      if (!fuenteObj) {
        fuenteObj = await tx.fuentes.findFirst({ where: { activo: true } });
      }
      fuenteId = fuenteObj ? fuenteObj.id_fuente : 1;

      let campanaId = Number(data.id_campana || data.id_campana_origen);
      if (!isNaN(campanaId) && campanaId > 0) {
        const campanaObj = await tx.campanas.findUnique({ where: { id_campana: campanaId } });
        if (!campanaObj) campanaId = null as any;
      } else {
        campanaId = null as any;
      }

      let servicioId = Number(data.id_servicio || data.id_servicio_interes || data.serviceOfInterestId);
      if (!isNaN(servicioId) && servicioId > 0) {
        const servicioObj = await tx.servicios.findUnique({ where: { id_servicio: servicioId } });
        if (!servicioObj) servicioId = null as any;
      } else {
        servicioId = null as any;
      }

      let sedeId = Number(data.id_sede_preferida || data.pref_sede_preferida || data.id_sede);
      let sedeObj = !isNaN(sedeId) && sedeId > 0
        ? await tx.sedes.findUnique({ where: { id_sede: sedeId } })
        : null;
      if (!sedeObj) {
        sedeObj = await tx.sedes.findFirst({ where: { activo: true } });
      }
      sedeId = sedeObj ? sedeObj.id_sede : 1;

      // 3. Identificación de Persona existente (por teléfono normalizado, email o DNI)
      let persona = null;
      let esRecurrente = false;

      if (!data.isNewPersonConfirmed) {
        if (dni) {
          persona = await tx.personas.findFirst({ where: { dni } });
        }
        if (!persona && phoneNorm && phoneNorm.length === 9) {
          persona = await tx.personas.findFirst({
            where: {
              OR: [
                { telefono_normalizado: phoneNorm },
                { numero: { contains: phoneNorm } }
              ]
            }
          });
        }
        if (!persona && emailNorm && emailNorm.includes('@')) {
          persona = await tx.personas.findFirst({
            where: {
              OR: [
                { email_normalizado: emailNorm },
                { email: emailNorm }
              ]
            }
          });
        }
      }

      if (persona) {
        esRecurrente = true;
        // Actualizar datos de contacto y consentimiento de atención
        await tx.personas.update({
          where: { id_persona: persona.id_persona },
          data: {
            telefono_normalizado: phoneNorm || persona.telefono_normalizado,
            email_normalizado: emailNorm || persona.email_normalizado,
            consentimiento_atencion: consentimientoAtencion,
            consentimiento_promocional: consentimientoPromocional || persona.consentimiento_promocional,
            consentimiento_ia: consentimientoIa,
            fecha_actualizacion: new Date()
          }
        });
      } else {
        // Crear nueva Persona en Etapa BUYER (Etapa 1)
        persona = await tx.personas.create({
          data: {
            nombres,
            apellidos,
            dni,
            email: emailNorm || null,
            numero: phoneNorm || rawPhone,
            telefono_normalizado: phoneNorm || null,
            email_normalizado: emailNorm || null,
            consentimiento_atencion: consentimientoAtencion,
            consentimiento_promocional: consentimientoPromocional,
            consentimiento_ia: consentimientoIa,
            autoriza_contacto: consentimientoPromocional,
            fecha_autorizacion: consentimientoPromocional ? new Date() : null,
            id_campana_origen: campanaId,
            id_canal_origen: canalId,
            id_etapa_actual: etapaBuyer.id_etapa, // ¡Permanece en BUYER!
            estado_calidad: 'Valido',
            fecha_registro: new Date()
          }
        });

        // Registrar evento de inicio en BUYER
        await tx.eventosEtapa.create({
          data: {
            id_persona: persona.id_persona,
            etapa_origen: null,
            etapa_destino: etapaBuyer.id_etapa,
            motivo: 'Ingreso inicial a la fase BUYER vía captación omnicanal',
            evidencia: `Canal: ${canalId}, Fuente: ${fuenteId}`
          }
        });
      }

      // 4. Determinar estado inicial de la oportunidad
      let estadoInicial: 'NUEVO' | 'INCOMPLETO' | 'CALIFICADO' = 'NUEVO';
      if (phoneNorm.length < 9 || nombres.length < 2) {
        estadoInicial = 'INCOMPLETO';
      } else if (servicioId && consulta.length >= 10) {
        estadoInicial = 'CALIFICADO';
      }

      // 5. Crear la Oportunidad de Captación
      const oportunidad = await tx.oportunidadesCaptacion.create({
        data: {
          id_persona: persona.id_persona,
          id_canal: canalId,
          id_fuente: fuenteId,
          id_campana: campanaId,
          id_servicio_interes: servicioId,
          id_sede_preferida: sedeId,
          estado_oportunidad: estadoInicial,
          necesidad_declarada: consulta || 'Consulta odontológica inicial',
          canal_especifico: data.utm_source || 'Formulario Web',
          utm_source: data.utm_source || null,
          utm_medium: data.utm_medium || null,
          utm_campaign: data.utm_campaign || null,
          device: data.device || 'Desktop',
          score_calificacion: estadoInicial === 'CALIFICADO' ? 80 : 50,
          fecha_registro: new Date()
        }
      });

      // 6. Registrar la interacción
      await tx.interacciones.create({
        data: {
          id_persona: persona.id_persona,
          id_oportunidad: oportunidad.id_oportunidad,
          id_canal: canalId,
          id_fuente: fuenteId,
          tipo: 'Consulta Inicial',
          mensaje: consulta || 'Registro de datos de contacto en formulario',
          es_respuesta_util: false,
          fecha_hora: new Date()
        }
      });

      // 7. Evaluar y generar ImpulseAlerts deterministas iniciales
      const alertasCreadas = [];
      if (estadoInicial === 'INCOMPLETO') {
        const alertIncompleto = await tx.impulseAlerts.create({
          data: {
            codigo_alerta: 'BUYER-01-INCOMPLETO',
            tipo: 'CALIDAD',
            id_oportunidad: oportunidad.id_oportunidad,
            id_persona: persona.id_persona,
            prioridad: 'ALTA',
            descripcion: 'Registro con datos de contacto incompletos o número de teléfono no válido.',
            evidencia: `Teléfono ingresado: "${rawPhone}", Nombres: "${nombres}"`,
            accion_sugerida: 'Contactar por correo electrónico o solicitar número válido de 9 dígitos.',
            estado: 'ACTIVA'
          }
        });
        alertasCreadas.push(alertIncompleto);
      }

      if (esRecurrente) {
        const alertDuplicado = await tx.impulseAlerts.create({
          data: {
            codigo_alerta: 'BUYER-02-DUPLICADO',
            tipo: 'DUPLICADO',
            id_oportunidad: oportunidad.id_oportunidad,
            id_persona: persona.id_persona,
            prioridad: 'MEDIA',
            descripcion: 'Paciente existente reingresando con nueva oportunidad de captación.',
            evidencia: `Persona ID: ${persona.id_persona}, Oportunidad ID: ${oportunidad.id_oportunidad}`,
            accion_sugerida: 'Revisar historial clínico previo y coordinar atención personalizada.',
            estado: 'ACTIVA'
          }
        });
        alertasCreadas.push(alertDuplicado);
      }

      if (consulta.length < 8) {
        const alertAmbigua = await tx.impulseAlerts.create({
          data: {
            codigo_alerta: 'BUYER-04-INTENCION_AMBIGUA',
            tipo: 'COMERCIAL',
            id_oportunidad: oportunidad.id_oportunidad,
            id_persona: persona.id_persona,
            prioridad: 'MEDIA',
            descripcion: 'La consulta no especifica claramente el servicio ni la necesidad odontológica.',
            evidencia: `Consulta registrada: "${consulta}"`,
            accion_sugerida: 'Realizar repregunta por WhatsApp o llamada para triaje inicial.',
            estado: 'ACTIVA'
          }
        });
        alertasCreadas.push(alertAmbigua);
      }

      return {
        persona,
        oportunidad,
        alertas: alertasCreadas,
        esRecurrente
      };
    });
  }

  /**
   * Conversión formal de Oportunidad BUYER a Solicitud LEAD.
   */
  static async convertToLead(idOportunidadOrPersona: number, dto: ConvertOpportunityDTO = {}) {
    return await prisma.$transaction(async (tx) => {
      // 1. Buscar la oportunidad
      let oportunidad = await tx.oportunidadesCaptacion.findUnique({
        where: { id_oportunidad: idOportunidadOrPersona },
        include: { Persona: true, Solicitud: true }
      });

      // Si no encontró por id_oportunidad, buscar la última oportunidad activa de la persona
      if (!oportunidad) {
        oportunidad = await tx.oportunidadesCaptacion.findFirst({
          where: { id_persona: idOportunidadOrPersona },
          orderBy: { id_oportunidad: 'desc' },
          include: { Persona: true, Solicitud: true }
        });
      }

      if (!oportunidad) {
        // Fallback: si no existe registro en OportunidadesCaptacion, buscar la persona
        const personaDirecta = await tx.personas.findUnique({
          where: { id_persona: idOportunidadOrPersona }
        });
        if (!personaDirecta) {
          throw new Error(`No se encontró oportunidad ni persona con identificador ${idOportunidadOrPersona}`);
        }

        // Crear la oportunidad al vuelo para asegurar consistencia
        oportunidad = await tx.oportunidadesCaptacion.create({
          data: {
            id_persona: personaDirecta.id_persona,
            id_canal: personaDirecta.id_canal_origen,
            id_campana: personaDirecta.id_campana_origen,
            estado_oportunidad: 'CALIFICADO',
            necesidad_declarada: 'Conversión directa autorizada',
            fecha_registro: personaDirecta.fecha_registro
          },
          include: { Persona: true, Solicitud: true }
        });
      }

      if (oportunidad.estado_oportunidad === 'CONVERTIDO_LEAD') {
        return {
          alreadyConverted: true,
          id_oportunidad: oportunidad.id_oportunidad,
          id_solicitud: oportunidad.id_solicitud,
          id_persona: oportunidad.id_persona,
          message: 'La oportunidad ya fue convertida previamente a LEAD.'
        };
      }

      const persona = oportunidad.Persona;
      if (!persona.consentimiento_atencion) {
        throw new Error('No se cuenta con autorización de contacto para atender a este paciente (Ley N° 29733).');
      }

      let etapaLead = await tx.etapas.findFirst({ where: { nombre: 'LEAD' } });
      if (!etapaLead) {
        etapaLead = await tx.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta' } });
      }

      const servicioFinal = dto.id_servicio || oportunidad.id_servicio_interes;

      // 2. Crear Solicitud LEAD formal
      const solicitud = await tx.solicitudes.create({
        data: {
          id_persona: persona.id_persona,
          id_servicio: servicioFinal,
          motivo: dto.motivo_conversion || oportunidad.necesidad_declarada || 'Apertura de negociación formal desde captación BUYER',
          tipo_consulta: 'Presencial',
          prioridad: dto.prioridad || 'Media',
          estado: 'Abierta',
          fecha_solicitud: new Date()
        }
      });

      // 3. Actualizar la Oportunidad comercial a CONVERTIDO_LEAD
      const now = new Date();
      await tx.oportunidadesCaptacion.update({
        where: { id_oportunidad: oportunidad.id_oportunidad },
        data: {
          estado_oportunidad: 'CONVERTIDO_LEAD',
          id_solicitud: solicitud.id_solicitud,
          fecha_conversion: now,
          fecha_cierre: now
        }
      });

      // 4. Actualizar la Etapa de la Persona a LEAD (sin forzar autoriza_contacto)
      await tx.personas.update({
        where: { id_persona: persona.id_persona },
        data: {
          id_etapa_actual: etapaLead.id_etapa,
          fecha_actualizacion: now
        }
      });

      // 5. Registrar el Evento de Transición en EventosEtapa
      await tx.eventosEtapa.create({
        data: {
          id_persona: persona.id_persona,
          etapa_origen: persona.id_etapa_actual,
          etapa_destino: etapaLead.id_etapa,
          id_usuario: dto.id_usuario || null,
          motivo: dto.motivo_conversion || 'Conversión formal desde fase BUYER a Solicitud LEAD',
          evidencia: `Oportunidad #${oportunidad.id_oportunidad} -> Solicitud #${solicitud.id_solicitud}`
        }
      });

      // 6. Resolver automáticamente alertas pendientes de intención ambigua
      await tx.impulseAlerts.updateMany({
        where: {
          id_oportunidad: oportunidad.id_oportunidad,
          estado: 'ACTIVA',
          codigo_alerta: { in: ['BUYER-01-INCOMPLETO', 'BUYER-04-INTENCION_AMBIGUA'] }
        },
        data: {
          estado: 'RESUELTA',
          fecha_resolucion: now,
          id_usuario_resolutor: dto.id_usuario || null,
          motivo_resolucion: 'Resuelta automáticamente por conversión formal a LEAD'
        }
      });

      return {
        success: true,
        id_oportunidad: oportunidad.id_oportunidad,
        id_solicitud: solicitud.id_solicitud,
        id_persona: persona.id_persona,
        etapa_nueva: 'LEAD',
        fecha_conversion: now
      };
    });
  }

  /**
   * Transición controlada en la máquina de estados de OportunidadesCaptacion.
   */
  static async updateStatus(idOportunidad: number, dto: StatusTransitionDTO) {
    const oportunidad = await prisma.oportunidadesCaptacion.findUnique({
      where: { id_oportunidad: idOportunidad }
    });

    if (!oportunidad) {
      throw new Error(`Oportunidad #${idOportunidad} no encontrada.`);
    }

    if (oportunidad.estado_oportunidad === 'CONVERTIDO_LEAD') {
      throw new Error('No se puede alterar el estado de una oportunidad ya convertida a LEAD.');
    }

    if (dto.nuevo_estado === 'DESCARTADO' && (!dto.motivo || dto.motivo.trim() === '')) {
      throw new Error('Debe proporcionar un motivo obligatorio para descartar la oportunidad.');
    }

    const updateData: any = {
      estado_oportunidad: dto.nuevo_estado,
      motivo_descarte: dto.nuevo_estado === 'DESCARTADO' ? dto.motivo : oportunidad.motivo_descarte
    };

    if (dto.nuevo_estado === 'CALIFICADO') {
      updateData.fecha_calificacion = new Date();
      updateData.score_calificacion = 90;
    } else if (dto.nuevo_estado === 'DESCARTADO') {
      updateData.fecha_cierre = new Date();
      updateData.score_calificacion = 10;
    }

    return await prisma.oportunidadesCaptacion.update({
      where: { id_oportunidad: idOportunidad },
      data: updateData
    });
  }

  /**
   * Listado paginado de oportunidades con filtros analíticos.
   */
  static async listOpportunities(filters: {
    estado?: string;
    canal?: number;
    fuente?: number;
    sede?: number;
    busqueda?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.estado) {
      where.estado_oportunidad = filters.estado;
    }
    if (filters.canal) {
      where.id_canal = Number(filters.canal);
    }
    if (filters.fuente) {
      where.id_fuente = Number(filters.fuente);
    }
    if (filters.sede) {
      where.id_sede_preferida = Number(filters.sede);
    }
    if (filters.busqueda && filters.busqueda.trim() !== '') {
      const q = filters.busqueda.trim();
      where.OR = [
        { Persona: { nombres: { contains: q } } },
        { Persona: { apellidos: { contains: q } } },
        { Persona: { email: { contains: q } } },
        { Persona: { numero: { contains: q } } },
        { Persona: { dni: { contains: q } } },
        { necesidad_declarada: { contains: q } }
      ];
    }

    const [total, items] = await Promise.all([
      prisma.oportunidadesCaptacion.count({ where }),
      prisma.oportunidadesCaptacion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id_oportunidad: 'desc' },
        include: {
          Persona: true,
          Canal: true,
          Fuente: true,
          Campana: true,
          ServicioInteres: true,
          SedePreferida: true,
          Solicitud: true,
          ImpulseAlerts: {
            where: { estado: 'ACTIVA' },
            orderBy: { fecha_generacion: 'desc' }
          },
          DecisionesIA: {
            orderBy: { id_decision: 'desc' },
            take: 1
          }
        }
      })
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items
    };
  }

  /**
   * Obtiene el detalle consolidado 360° de una oportunidad.
   */
  static async getOpportunityDetail(idOportunidad: number) {
    const item = await prisma.oportunidadesCaptacion.findUnique({
      where: { id_oportunidad: idOportunidad },
      include: {
        Persona: {
          include: {
            Etapa: true,
            Preferencias: { include: { Canal: true, ServicioInteres: true } },
            EventosEtapa: { include: { EtapaOrigen: true, EtapaDestino: true }, orderBy: { fecha_hora: 'asc' } }
          }
        },
        Canal: true,
        Fuente: true,
        Campana: { include: { GastosCampana: true } },
        ServicioInteres: true,
        SedePreferida: true,
        Solicitud: {
          include: { Servicio: true, Opciones: true, Reservas: true }
        },
        Interacciones: {
          include: { Canal: true, Fuente: true },
          orderBy: { fecha_hora: 'desc' }
        },
        DecisionesIA: {
          orderBy: { id_decision: 'desc' }
        },
        ImpulseAlerts: {
          orderBy: { fecha_generacion: 'desc' }
        }
      }
    });

    if (!item) {
      throw new Error(`Oportunidad #${idOportunidad} no encontrada.`);
    }

    return item;
  }

  /**
   * Detección de duplicados sin falsos positivos.
   */
  static async checkDuplicates(params: { telefono?: string; email?: string; dni?: string }) {
    const phoneNorm = normalizePhone(params.telefono);
    const emailNorm = normalizeEmail(params.email);
    const dni = params.dni ? String(params.dni).trim() : '';

    const conditions: any[] = [];
    if (dni && dni.length === 8) {
      conditions.push({ dni });
    }
    if (phoneNorm && phoneNorm.length === 9) {
      conditions.push({ telefono_normalizado: phoneNorm });
      conditions.push({ numero: { contains: phoneNorm } });
    }
    if (emailNorm && emailNorm.includes('@')) {
      conditions.push({ email_normalizado: emailNorm });
      conditions.push({ email: emailNorm });
    }

    if (conditions.length === 0) {
      return { hasDuplicate: false, candidates: [] };
    }

    const candidates = await prisma.personas.findMany({
      where: { OR: conditions },
      include: {
        Etapa: true,
        Oportunidades: {
          orderBy: { id_oportunidad: 'desc' },
          take: 3
        },
        Solicitudes: {
          orderBy: { id_solicitud: 'desc' },
          take: 3
        }
      }
    });

    return {
      hasDuplicate: candidates.length > 0,
      candidatesCount: candidates.length,
      candidates: candidates.map(c => ({
        id_persona: c.id_persona,
        nombres: c.nombres,
        apellidos: c.apellidos,
        etapa_actual: c.Etapa?.nombre,
        numero: c.numero,
        email: c.email,
        total_oportunidades: c.Oportunidades.length,
        ultima_oportunidad_estado: c.Oportunidades[0]?.estado_oportunidad,
        total_solicitudes: c.Solicitudes.length
      }))
    };
  }
}
