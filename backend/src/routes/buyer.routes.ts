import { Router } from 'express';
import { createHash } from 'node:crypto';
import { Prisma, type Personas } from '@prisma/client';
import { prisma } from '../db';
import { MartSyncService } from '../services/martSyncService';
import { BuyerEvaluationService, computeEvaluationContextFingerprint } from '../services/buyerEvaluationService';
import { calculateBuyerIndicators, type BuyerTemporalEvidence } from '../services/buyerIndicators';

const router = Router();

const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

class BuyerInputError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

async function writeBuyer<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(action, serializable);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2034', 'P2002'].includes(error.code) || attempt === 3) throw error;
    }
  }
}

async function findBuyerIdentity(tx: Prisma.TransactionClient, dni: string | null, email: string | null, phone: string | null) {
  const conditions: Prisma.Sql[] = [];
  if (dni) conditions.push(Prisma.sql`dni=${dni}`);
  if (email) conditions.push(Prisma.sql`LOWER(LTRIM(RTRIM(email)))=${email}`);
  if (phone) conditions.push(Prisma.sql`RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(numero,' ',''),'-',''),'(',''),')',''),${phone.length})=${phone}`);
  if (!conditions.length) return null;
  const matches = await tx.$queryRaw<{ id_persona: number }[]>`
    SELECT TOP (2) id_persona FROM dbo.Personas WITH (UPDLOCK,HOLDLOCK)
    WHERE ${Prisma.join(conditions, ' OR ')} ORDER BY id_persona
  `;
  if (matches.length > 1) throw new BuyerInputError('Los datos de contacto coinciden con más de una persona.');
  return matches.length ? tx.personas.findUnique({ where: { id_persona: matches[0].id_persona } }) : null;
}

async function recordBuyerCapture(tx: Prisma.TransactionClient, person: Personas, input: {
  sourceId: number | null; serviceId: number | null; branchId: number | null; reason: string | null;
}) {
  await tx.$executeRaw`
    INSERT dbo.CaptacionesBuyer (id_persona,fecha_captacion,id_canal,id_fuente,id_campana,id_sede,
      id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
    SELECT p.id_persona,SYSDATETIME(),p.id_canal_origen,${input.sourceId},
      p.id_campana_origen,${input.branchId},${input.serviceId},${input.reason},
      p.estado_calidad,p.autoriza_contacto,p.fecha_autorizacion,'REGISTRO_DIRECTO'
    FROM dbo.Personas p WHERE p.id_persona=${person.id_persona}
      AND NOT EXISTS (SELECT 1 FROM dbo.CaptacionesBuyer WITH (UPDLOCK,HOLDLOCK) WHERE id_persona=p.id_persona)
  `;
}

async function captureBranch(tx: Prisma.TransactionClient, value: unknown) {
  if (value == null || value === '') return null;
  const branch = await tx.sedes.findFirst({ where: {
    activo: true,
    ...(/^\d+$/.test(String(value)) ? { id_sede: Number(value) } : { nombre: String(value) }),
  } });
  return branch?.id_sede ?? null;
}


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
    return item && item.activo !== false ? item.id_servicio : null;
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

export interface DeclaredServiceResolution {
  serviceId: string | undefined;
  serviceName: string | undefined;
  evaluatorServiceId: number | null;
  isUnavailable: boolean;
  source: 'PREFERENCIA' | 'CAPTACION' | 'SOLICITUD' | 'NINGUNO';
}

/**
 * Criterio compartido y determinista para resolver el servicio de interés declarado entre:
 * GET /buyer, GET /buyer/:id y POST /buyer/:id/evaluate.
 *
 * Jerarquía:
 * 1. Preferencia vigente, ordenada por id_preferencia desc y respetando fecha_fin.
 *    Si tiene id_servicio_interes y está inactivo, se señala como NO DISPONIBLE sin reemplazarla silenciosamente.
 * 2. Si no hay preferencia declarada, captación inicial (cb.id_servicio) validando que esté activo.
 * 3. Finalmente solicitud histórica (sol.id_servicio) únicamente como compatibilidad, validando que esté activo.
 */
export function resolveDeclaredService(params: {
  preferencias?: Array<{
    id_preferencia?: number;
    id_servicio_interes?: number | null;
    fecha_fin?: Date | string | null;
    ServicioInteres?: {
      id_servicio: number;
      nombre: string;
      activo?: boolean;
    } | null;
  }> | null;
  captacionInicial?: {
    id_servicio?: number | null;
    nombre_servicio?: string | null;
    activo?: boolean | null;
  } | null;
  solicitudes?: Array<{
    id_solicitud?: number;
    id_servicio?: number | null;
    Servicio?: {
      id_servicio: number;
      nombre: string;
      activo?: boolean;
    } | null;
  }> | null;
  activeCatalog?: Array<{ id_servicio: number; nombre: string; activo?: boolean }>;
}): DeclaredServiceResolution {
  const now = new Date();

  // 1. Preferencia vigente seleccionada de forma determinista (id_preferencia desc)
  const sortedPrefs = [...(params.preferencias || [])].sort((a, b) => {
    return (b.id_preferencia || 0) - (a.id_preferencia || 0);
  });

  const vigentePref = sortedPrefs.find(pref => {
    if (!pref) return false;
    if (pref.fecha_fin) {
      const fin = new Date(pref.fecha_fin);
      if (!isNaN(fin.getTime()) && fin <= now) {
        return false; // Cerrada por fecha_fin
      }
    }
    return true; // Vigente
  });

  if (vigentePref && vigentePref.id_servicio_interes != null) {
    const sId = vigentePref.id_servicio_interes;
    const svc = vigentePref.ServicioInteres || params.activeCatalog?.find(s => s.id_servicio === sId);
    const isActive = svc ? svc.activo !== false : false;

    if (isActive && svc) {
      return {
        serviceId: String(svc.id_servicio),
        serviceName: svc.nombre,
        evaluatorServiceId: svc.id_servicio,
        isUnavailable: false,
        source: 'PREFERENCIA',
      };
    } else {
      // Preferencia explícita pero servicio inactivo o inexistente:
      // Señalar como no disponible, SIN reemplazarla silenciosamente por un servicio histórico.
      const rawName = svc?.nombre || 'Servicio';
      return {
        serviceId: undefined,
        serviceName: `${rawName} (No disponible)`,
        evaluatorServiceId: null,
        isUnavailable: true,
        source: 'PREFERENCIA',
      };
    }
  }

  // 2. Si no hay servicio declarado en preferencias, captación inicial
  if (params.captacionInicial && params.captacionInicial.id_servicio != null) {
    const cap = params.captacionInicial;
    const sId = cap.id_servicio;
    const catalogSvc = params.activeCatalog?.find(s => s.id_servicio === sId);
    const isActive = catalogSvc ? catalogSvc.activo !== false : cap.activo !== false;

    if (isActive) {
      return {
        serviceId: String(sId),
        serviceName: catalogSvc?.nombre || cap.nombre_servicio || 'Consulta General',
        evaluatorServiceId: sId ?? null,
        isUnavailable: false,
        source: 'CAPTACION',
      };
    }
  }

  // 3. Finalmente solicitud histórica, únicamente como compatibilidad
  if (params.solicitudes && params.solicitudes.length > 0) {
    const sortedSols = [...params.solicitudes].sort((a, b) => (b.id_solicitud || 0) - (a.id_solicitud || 0));
    for (const sol of sortedSols) {
      if (sol.id_servicio != null) {
        const sId = sol.id_servicio;
        const catalogSvc = params.activeCatalog?.find(s => s.id_servicio === sId);
        const isActive = sol.Servicio ? sol.Servicio.activo !== false : (catalogSvc ? catalogSvc.activo !== false : true);

        if (isActive) {
          return {
            serviceId: String(sId),
            serviceName: sol.Servicio?.nombre || catalogSvc?.nombre || 'Consulta General',
            evaluatorServiceId: sId ?? null,
            isUnavailable: false,
            source: 'SOLICITUD',
          };
        }
      }
    }
  }

  return {
    serviceId: undefined,
    serviceName: undefined,
    evaluatorServiceId: null,
    isUnavailable: false,
    source: 'NINGUNO',
  };
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

// Registrar BUYER: persiste contacto, captación, mensaje y trabajo pendiente atómicamente; evalúa con Gemini fuera de SQL
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
    id_interaccion_previa,
  } = req.body;

  try {
    const requestKey = (
      req.get('Idempotency-Key') ||
      req.body.idempotency_key ||
      req.body['idempotency-key'] ||
      ''
    ).trim().toLowerCase();

    if (requestKey && !/^[a-zA-Z0-9_-]{4,128}$/.test(requestKey)) {
      throw new BuyerInputError('La Idempotency-Key debe ser un identificador válido (alfanumérico, guiones, entre 4 y 128 caracteres).', 400);
    }

    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) etapaBuyer = await prisma.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Contacto inicial' } });

    let etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (!etapaLead) etapaLead = await prisma.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta' } });

    const rawNombres = (nombres || req.body.firstName || req.body.fullName || req.body.name || '').trim();
    const rawApellidos = (apellidos || req.body.lastName || '').trim();

    let resolvedNombres = rawNombres;
    let resolvedApellidos = rawApellidos;

    if (!resolvedApellidos && resolvedNombres.includes(' ')) {
      const parts = resolvedNombres.split(/\s+/);
      resolvedNombres = parts[0];
      resolvedApellidos = parts.slice(1).join(' ');
    }

    if (!resolvedNombres) resolvedNombres = 'Prospecto';
    if (!resolvedApellidos) resolvedApellidos = 'General';

    const rawDigits = numero ? String(numero).replace(/\D/g, '') : '';
    const cleanPhone = rawDigits.length >= 9 ? rawDigits.slice(-9) : (rawDigits.length >= 7 ? rawDigits : null);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;

    const rawInquiry = String(
      req.body.mensaje ||
      req.body.motivo_consulta ||
      req.body.necesidad_declarada ||
      req.body.duda_especifica ||
      req.body.concreteRequest ||
      'Solicitud de información desde formulario web'
    ).trim();

    // Hash determinista del contenido de la operación (Punto 4)
    const contentPayload = {
      nombres: resolvedNombres.toLowerCase(),
      apellidos: resolvedApellidos.toLowerCase(),
      numero: cleanPhone,
      email: cleanEmail,
      mensaje: rawInquiry.trim(),
      id_servicio: (id_servicio ? Number(id_servicio) : null) || null,
      id_sede: (req.body.id_sede ? Number(req.body.id_sede) : null) || null,
      id_interaccion_previa: id_interaccion_previa ? Number(id_interaccion_previa) : null,
      autoriza_contacto: Boolean(req.body.autoriza_contacto || req.body.consentimiento_atencion),
    };
    const contentHash = createHash('sha256').update(JSON.stringify(contentPayload)).digest('hex');

    // Verificación de Idempotency-Key como identidad persistente (Punto 4)
    if (requestKey) {
      const priorByKey = await prisma.decisionesIA.findFirst({
        where: {
          agente: 'BUYER',
          entrada: { contains: `"idempotencyKey":"${requestKey}"` },
        },
        orderBy: { id_decision: 'desc' },
      });

      if (priorByKey) {
        let storedHash: string | null = null;
        try {
          const parsed = JSON.parse(priorByKey.entrada || '{}');
          storedHash = parsed.contentHash || null;
        } catch {}

        // La misma clave con contenido distinto debe rechazarse (HTTP 409)
        if (storedHash && storedHash !== contentHash) {
          return res.status(409).json({
            success: false,
            error: 'Conflicto de idempotencia: la Idempotency-Key ya fue utilizada previamente con un contenido diferente.',
            code: 'IDEMPOTENCY_CONFLICT',
          });
        }

        // Misma clave con mismo contenido: recuperar la interacción y decisión persistida
        const priorInteraction = priorByKey.id_interaccion
          ? await prisma.interacciones.findUnique({ where: { id_interaccion: priorByKey.id_interaccion } })
          : null;

        const parsedDecision = JSON.parse(priorByKey.decision || '{}');
        const isCompleted = parsedDecision.estado === 'COMPLETADA' || priorByKey.decision?.includes('"estado":"COMPLETADA"');

        return res.status(200).json({
          success: true,
          replayed: true,
          data: {
            id_persona: priorByKey.id_persona,
            id_captacion: priorByKey.id_captacion,
            id_interaccion: priorByKey.id_interaccion,
            id_decision: priorByKey.id_decision,
            id_solicitud: parsedDecision.id_solicitud || priorInteraction?.id_solicitud || null,
            id_evento_etapa: parsedDecision.id_evento_etapa || null,
            estado_decision: parsedDecision.estado || (isCompleted ? 'COMPLETADA' : 'PENDIENTE'),
            accion: priorByKey.accion,
            aclaracion: priorByKey.resultado_revision || null,
          },
        });
      }
    }

    // Contexto de aclaración previa si se está continuando una conversación
    let previousContext: {
      mensajeAnterior?: string | null;
      aclaracionPrevia?: string | null;
      idInteraccionPrevia?: number | null;
      idDecisionPrevia?: number | null;
      turno?: number;
    } | null = null;

    if (id_interaccion_previa) {
      const prevInteraction = await prisma.interacciones.findUnique({
        where: { id_interaccion: Number(id_interaccion_previa) },
      });
      if (prevInteraction) {
        const prevDecision = await prisma.decisionesIA.findFirst({
          where: { id_interaccion: prevInteraction.id_interaccion },
          orderBy: { id_decision: 'desc' },
        });
        previousContext = {
          mensajeAnterior: prevInteraction.mensaje,
          aclaracionPrevia: prevDecision?.resultado_revision,
          idInteraccionPrevia: prevInteraction.id_interaccion,
          idDecisionPrevia: prevDecision?.id_decision,
          turno: 2,
        };
      }
    }

    // 1. Fase transaccional: guardar contacto, captación, mensaje y trabajo pendiente atómicamente
    const txResult = await writeBuyer(async tx => {
      if (requestKey) {
        // Reserva por clave, compartida entre procesos y liberada al terminar esta
        // transaccion. Gemini se ejecuta despues del commit, nunca bajo este lock.
        const resource = 'Buyer:Registro:' + createHash('sha256').update(requestKey).digest('hex');
        const [lock] = await tx.$queryRaw<{ lock_result: number }[]>`
          DECLARE @lockResult int;
          EXEC @lockResult = sys.sp_getapplock
            @Resource=${resource}, @LockMode=N'Exclusive',
            @LockOwner=N'Transaction', @LockTimeout=4000;
          SELECT @lockResult AS lock_result;
        `;
        if (!lock || lock.lock_result < 0) throw new BuyerInputError('El registro está en curso. Reintenta con la misma Idempotency-Key.', 503);

        // La comprobacion previa es solo una via rapida. Esta lectura bajo la
        // reserva es la autoridad antes de crear cualquier fila del formulario.
        const prior = await tx.decisionesIA.findFirst({
          where: { agente: 'BUYER', entrada: { contains: `"idempotencyKey":"${requestKey}"` } },
          orderBy: { id_decision: 'desc' },
        });
        if (prior) {
          const entrada = JSON.parse(prior.entrada || '{}');
          if (entrada.contentHash && entrada.contentHash !== contentHash) {
            return { idempotentConflict: true as const };
          }
          const decision = JSON.parse(prior.decision || '{}');
          const interaction = prior.id_interaccion
            ? await tx.interacciones.findUnique({ where: { id_interaccion: prior.id_interaccion } }) : null;
          return { idempotentReplay: {
            success: true, replayed: true,
            data: {
              id_persona: prior.id_persona, id_captacion: prior.id_captacion,
              id_interaccion: prior.id_interaccion, id_decision: prior.id_decision,
              id_solicitud: decision.id_solicitud || interaction?.id_solicitud || null,
              id_evento_etapa: decision.id_evento_etapa || null,
              estado_decision: decision.estado || 'PENDIENTE', accion: prior.accion,
              aclaracion: prior.resultado_revision || null,
            },
          } };
        }
      }
      // Detectar duplicado de persona por teléfono o correo
      let isDuplicate = false;
      let existingPerson = null;
      const isNewPersonConfirmed = Boolean(req.body.isNewPersonConfirmed);

      if (!isNewPersonConfirmed) {
        existingPerson = await findBuyerIdentity(tx, null, cleanEmail, cleanPhone);
        isDuplicate = Boolean(existingPerson);
      }

      // Validar que la interacción previa pertenezca a la misma persona (Punto 2)
      if (previousContext?.idInteraccionPrevia && existingPerson) {
        const prevInt = await tx.interacciones.findUnique({
          where: { id_interaccion: previousContext.idInteraccionPrevia },
          select: { id_persona: true },
        });
        if (prevInt && prevInt.id_persona !== existingPerson.id_persona) {
          console.warn(
            `[buyer.routes] Contexto descartado: interacción previa ${previousContext.idInteraccionPrevia} pertenece a persona ${prevInt.id_persona}, no a ${existingPerson.id_persona}`
          );
          previousContext = null;
        }
      }

      // Canal Web y Fuente Web
      let webCanal = await tx.canales.findFirst({
        where: { nombre: { in: ['Página Web', 'Página Web / Portal Online'] }, activo: true },
        orderBy: { id_canal: 'asc' },
      });
      if (!webCanal) webCanal = await tx.canales.create({
        data: { nombre: 'Página Web / Portal Online', activo: true },
      });

      let webFuente = await tx.fuentes.findFirst({
        where: { nombre: { in: ['Formulario Web', 'Formulario Web - Portal NexoSalud'] }, activo: true },
        orderBy: { id_fuente: 'asc' },
      });
      if (!webFuente) webFuente = await tx.fuentes.create({
        data: { nombre: 'Formulario Web - Portal NexoSalud', activo: true },
      });

      const validCanal = (id_canal ? await getValidCanalId(tx, id_canal) : null) ?? webCanal.id_canal;
      const validCanalOrigen = (id_canal_origen ? await getValidCanalId(tx, id_canal_origen) : null) ?? validCanal;
      const validFuente = (id_fuente ? await getValidFuenteId(tx, id_fuente) : null) ?? webFuente.id_fuente;
      const validCampana = id_campana_origen ? await getValidCampanaId(tx, id_campana_origen) : null;
      const validServicio = await getValidServicioId(tx, id_servicio);
      const validServicioInteres = (await getValidServicioId(tx, id_servicio_interes)) || validServicio;

      let persona;
      let totalConsultas = 1;

      if (isDuplicate && existingPerson) {
        // Contacto existente: Conservar su etapa actual y no duplicar persona
        const prevCount = await tx.interacciones.count({ where: { id_persona: existingPerson.id_persona } });
        totalConsultas = prevCount + 1;

        persona = await tx.personas.update({
          where: { id_persona: existingPerson.id_persona },
          data: {
            email: email ? String(email).trim() : existingPerson.email,
            fecha_actualizacion: new Date(),
            id_etapa_actual: existingPerson.id_etapa_actual, // Conserva estrictamente su etapa
            estado_calidad: 'Valido',
          }
        });
      } else {
        // Paciente nuevo: Permanece en BUYER mientras se evalúa su intención
        persona = await tx.personas.create({
          data: {
            nombres: resolvedNombres,
            apellidos: resolvedApellidos,
            email: email ? String(email).trim() : null,
            numero: numero ? String(numero).trim() : null,
            autoriza_contacto: autoriza_contacto || false,
            fecha_autorizacion: autoriza_contacto ? new Date() : null,
            id_campana_origen: validCampana,
            id_canal_origen: validCanalOrigen,
            tipo_persona: tipo_persona || 'Adulto General',
            estado_calidad: 'Valido',
            id_etapa_actual: etapaBuyer.id_etapa,
          }
        });
      }

      // Detalle del motivo
      const prefix = isNewPersonConfirmed ? '[Contacto Compartido] ' : '';
      const motivoConsulta = String(prefix + rawInquiry).slice(0, 195);

      let resolvedSede = sede_preferida || req.body.sede || null;
      if (!resolvedSede && req.body.id_sede) {
        const foundSede = await tx.sedes.findUnique({ where: { id_sede: Number(req.body.id_sede) } });
        if (foundSede) resolvedSede = foundSede.nombre;
      }

      // Para contactos existentes, conserva su primera captación; si no existe, registrar
      await recordBuyerCapture(tx, persona, {
        sourceId: validFuente, serviceId: validServicio ?? validServicioInteres,
        branchId: await captureBranch(tx, req.body.id_sede ?? resolvedSede), reason: motivoConsulta,
      });

      const [captacionRow] = await tx.$queryRaw<{ id_captacion: number }[]>`
        SELECT TOP (1) id_captacion FROM dbo.CaptacionesBuyer WITH (UPDLOCK,HOLDLOCK)
        WHERE id_persona=${persona.id_persona} ORDER BY id_captacion ASC
      `;

      if (!captacionRow) {
        throw new BuyerInputError('No se pudo verificar la captación inicial del prospecto.', 500);
      }

      // Registrar la Interacción con el mensaje ingresado
      const interaccion = await tx.interacciones.create({
        data: {
          id_persona: persona.id_persona,
          id_canal: validCanal,
          id_fuente: validFuente,
          tipo: isDuplicate ? `Consulta Web Recurrente (#${totalConsultas})` : 'Registro y Consulta Inicial (#1)',
          mensaje: String(rawInquiry),
          es_respuesta_util: false,
          resultado: 'Registrado - Pendiente de Evaluación',
        }
      });

      // Guardar el trabajo pendiente de evaluación en la MISMA transacción SQL (Punto 4)
      const pendingPayload = JSON.stringify({
        idempotencyKey: requestKey || null,
        contentHash,
        mensaje: rawInquiry,
        id_persona: persona.id_persona,
        id_captacion: captacionRow.id_captacion,
        id_interaccion: interaccion.id_interaccion,
        motivo_consulta: motivoConsulta,
        sede_preferida: resolvedSede,
        id_servicio_declarado: validServicio,
        contextoConversacional: previousContext || null,
        fecha_registro: new Date().toISOString(),
      });

      const decisionRecord = await tx.decisionesIA.create({
        data: {
          agente: 'BUYER',
          id_persona: persona.id_persona,
          id_captacion: captacionRow.id_captacion,
          id_interaccion: interaccion.id_interaccion,
          fecha_hora: new Date(),
          entrada: pendingPayload,
          regla_aplicada: 'gemini-3.5-flash-lite',
          decision: JSON.stringify({
            estado: 'PENDIENTE',
            intencion: null,
            id_servicio: null,
            intentosRealizados: 0,
            duracionTotalMs: 0,
          }),
          accion: 'REINTENTO_PENDIENTE',
          requiere_revision: true,
          resultado_revision: 'Evaluación pendiente de procesamiento encolada en transacción',
        }
      });

      // Preferencias del paciente (Upsert)
      if (resolvedSede || validCanal || validServicioInteres) {
        const existingPref = await tx.personaPreferencias.findFirst({ where: { id_persona: persona.id_persona } });
        if (existingPref) {
          await tx.personaPreferencias.update({
            where: { id_preferencia: existingPref.id_preferencia },
            data: {
              id_canal: validCanal || existingPref.id_canal,
              id_servicio_interes: validServicioInteres || existingPref.id_servicio_interes,
              sede_preferida: resolvedSede || existingPref.sede_preferida,
            }
          });
        } else {
          await tx.personaPreferencias.create({
            data: {
              id_persona: persona.id_persona,
              id_canal: validCanal,
              id_servicio_interes: validServicioInteres,
              sede_preferida: resolvedSede || null,
            }
          });
        }
      }

      return {
        persona,
        id_captacion: captacionRow.id_captacion,
        id_interaccion: interaccion.id_interaccion,
        id_decision: decisionRecord.id_decision,
        rawInquiry,
        validServicio,
        motivoConsulta,
        resolvedSede,
        isDuplicate,
        existingPerson,
        totalConsultas,
        isNewPersonWithSharedContact: isNewPersonConfirmed,
        replayed: false,
      };
    });

    if ('idempotentConflict' in txResult) return res.status(409).json({
      success: false, code: 'IDEMPOTENCY_CONFLICT',
      error: 'Conflicto de idempotencia: la Idempotency-Key ya fue utilizada previamente con un contenido diferente.',
    });
    if ('idempotentReplay' in txResult) return res.status(200).json(txResult.idempotentReplay);

    // 2. Ejecutar la llamada de clasificación a Gemini FUERA de la transacción SQL con protección concurrente
    const evaluation = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: txResult.persona.id_persona,
      id_captacion: txResult.id_captacion,
      id_interaccion: txResult.id_interaccion,
      mensaje: rawInquiry,
      id_servicio_declarado: (txResult as any).validServicio,
      motivo_consulta: (txResult as any).motivoConsulta,
      sede_preferida: (txResult as any).resolvedSede,
      contextoConversacional: previousContext || undefined,
    });

    // Sincronización analítica asíncrona (desactivada en QA)
    MartSyncService.syncBuyer().catch(err => console.warn('[AutoSync] Error:', err.message));

    const responsePayload = {
      id_persona: txResult.persona.id_persona,
      id_captacion: txResult.id_captacion,
      id_interaccion: txResult.id_interaccion,
      id_decision: evaluation.id_decision,
      etapa: evaluation.etapa_final,
      intencion: evaluation.intencion,
      id_servicio: evaluation.id_servicio,
      accion: evaluation.accion,
      estado_evaluacion: evaluation.estado,
      aclaracion: evaluation.aclaracion ?? null,
      id_solicitud: evaluation.id_solicitud ?? null,
      oportunidad: evaluation.id_solicitud
        ? { id_oportunidad: evaluation.id_solicitud, id_persona: txResult.persona.id_persona }
        : { id_oportunidad: txResult.id_captacion, id_persona: txResult.persona.id_persona },
      totalConsultas: txResult.totalConsultas,
      isDuplicate: txResult.isDuplicate,
      isRecurring: txResult.isDuplicate,
      entregaLeadEstado: evaluation.entregaLeadEstado ?? 'NO_APLICA',
      intentosRealizados: evaluation.intentosRealizados,
      duracionTotalMs: evaluation.duracionTotalMs,
    };

    if (evaluation.accion === 'CONVERSION_LEAD') {
      return res.status(201).json({
        success: true,
        isDuplicate: txResult.isDuplicate,
        isRecurring: txResult.isDuplicate,
        consultationCount: txResult.totalConsultas,
        message: 'Intención de reserva confirmada. Se inició la oportunidad en etapa LEAD y se notificó la entrada.',
        data: responsePayload,
      });
    }

    if (evaluation.accion === 'ACLARACION') {
      return res.status(200).json({
        success: true,
        isDuplicate: txResult.isDuplicate,
        isRecurring: txResult.isDuplicate,
        consultationCount: txResult.totalConsultas,
        message: 'Consulta registrada en BUYER. Se requiere aclaración sobre el tratamiento o servicio deseado.',
        data: responsePayload,
      });
    }

    if (evaluation.accion === 'CONSERVA_ETAPA_POSTERIOR') {
      return res.status(200).json({
        success: true,
        isDuplicate: txResult.isDuplicate,
        isRecurring: txResult.isDuplicate,
        consultationCount: txResult.totalConsultas,
        message: `El contacto ya se encuentra en etapa ${evaluation.etapa_final}. Se conserva su etapa actual y se vinculó por evidencia contextual.`,
        data: responsePayload,
      });
    }

    if (evaluation.accion === 'SOLICITUD_PENDIENTE_APERTURA') {
      return res.status(200).json({
        success: true,
        isDuplicate: txResult.isDuplicate,
        isRecurring: txResult.isDuplicate,
        consultationCount: txResult.totalConsultas,
        message: `El contacto ya se encuentra en etapa ${evaluation.etapa_final}. Nueva solicitud registrada y pendiente de apertura comercial por LEAD.`,
        data: responsePayload,
      });
    }

    if (evaluation.estado === 'PENDIENTE') {
      return res.status(202).json({
        success: true,
        isDuplicate: txResult.isDuplicate,
        isRecurring: txResult.isDuplicate,
        consultationCount: txResult.totalConsultas,
        message: 'Mensaje registrado. Evaluación semántica pendiente por indisponibilidad temporal del clasificador.',
        data: responsePayload,
      });
    }

    return res.status(200).json({
      success: true,
      isDuplicate: txResult.isDuplicate,
      isRecurring: txResult.isDuplicate,
      consultationCount: txResult.totalConsultas,
      message: 'Consulta informativa registrada. El paciente permanece en etapa BUYER.',
      data: responsePayload,
    });
  } catch (error: any) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
    console.error('Error al registrar BUYER:', error);
    res.status(500).json({ 
      error: error?.message || 'Error al registrar al BUYER',
      details: error?.message
    });
  }
});

// Recuperar evaluaciones semánticas pendientes de forma persistente
router.post('/evaluations/recover', async (_req, res) => {
  try {
    const summary = await BuyerEvaluationService.recoverPendingEvaluations();
    res.json({ success: true, ...summary });
  } catch (err: any) {
    console.error('Error recuperando evaluaciones pendientes:', err);
    res.status(500).json({ error: 'Error al recuperar evaluaciones pendientes', details: err?.message });
  }
});

// Reintentar la evaluación semántica de un mensaje por su id_interaccion
router.post('/evaluations/:id/retry', async (req, res) => {
  const interactionId = Number(req.params.id);
  if (!Number.isInteger(interactionId) || interactionId < 1) {
    return res.status(400).json({ error: 'ID de interacción inválido.' });
  }
  try {
    const outcome = await BuyerEvaluationService.retryEvaluationByInteraction(interactionId);
    res.json({ success: true, data: outcome });
  } catch (err: any) {
    console.error(`Error reintentando evaluación ${interactionId}:`, err);
    res.status(500).json({ error: 'Error al reintentar evaluación', details: err?.message });
  }
});

// Obtener la lista de BUYERS mapeada al formato que espera el frontend
router.get('/', async (req, res) => {
  try {
    const hasPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '25'), 10) || 25));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const selectedStates = typeof req.query.states === 'string'
      ? req.query.states.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    const selectedChannels = typeof req.query.channels === 'string'
      ? req.query.channels.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : '';
    const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : '';

    const etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) return res.json([]);

    const where: any = {
      OR: [
        { id_campana_origen: { not: null } },
        { id_canal_origen: { not: null } },
        { Etapa: { nombre: { in: ['BUYER', 'LEAD', 'PAYER', 'CUSTOMER', 'TURNED'] } } }
      ]
    };

    if (search) {
      where.AND = [{
        OR: [
          { nombres: { contains: search } },
          { apellidos: { contains: search } },
          { dni: { contains: search } },
          { email: { contains: search } },
          { numero: { contains: search } },
          { CanalOrigen: { nombre: { contains: search } } },
          { CampanaOrigen: { nombre: { contains: search } } },
          { Solicitudes: { some: { Servicio: { nombre: { contains: search } } } } },
        ]
      }];
    }

    if (fromDate || toDate) {
      where.fecha_registro = {};
      if (fromDate) where.fecha_registro.gte = new Date(`${fromDate}T00:00:00`);
      if (toDate) where.fecha_registro.lte = new Date(`${toDate}T23:59:59.999`);
    }

    if (selectedChannels.length > 0) {
      const channelIds = await prisma.canales.findMany({
        where: { nombre: { in: selectedChannels } },
        select: { id_canal: true },
      });
      where.id_canal_origen = { in: channelIds.map((channel) => channel.id_canal) };
    }
    // Los indicadores reutilizan los filtros de búsqueda, fecha y canal, pero
    // aplican la deduplicación en memoria para no construir un IN/NOT IN masivo.
    const indicatorWhere = { ...where };
    // B1 usa cohorte de captacion; B2/B3 de registro. Aplicar la fecha en el
    // calculo correspondiente, sin cambiar la paginacion/filtro del listado.
    delete indicatorWhere.fecha_registro;

    // Detectar duplicados entre todos los BUYER antes de paginar. Si se hace
    // sobre la página actual, el filtro y el estado mostrado dependen del
    // tamaño de página y pueden clasificarse de forma distinta.
    const duplicateBuyerIds = new Set<number>();
    const duplicateCandidates = await prisma.personas.findMany({
      where: { Etapa: { nombre: 'BUYER' } },
      select: {
        id_persona: true,
        numero: true,
        dni: true,
        email: true,
        estado_calidad: true,
      },
    });
    const duplicatePhoneCounts = new Map<string, number>();
    const duplicateDniCounts = new Map<string, number>();
    const duplicateEmailCounts = new Map<string, number>();
    for (const candidate of duplicateCandidates) {
      const phone = (candidate.numero || '').replace(/\D/g, '').slice(-9);
      if (phone.length >= 8) duplicatePhoneCounts.set(phone, (duplicatePhoneCounts.get(phone) || 0) + 1);
      const dni = candidate.dni?.trim();
      if (dni) duplicateDniCounts.set(dni, (duplicateDniCounts.get(dni) || 0) + 1);
      const email = candidate.email?.trim().toLowerCase();
      if (email && email.includes('@')) duplicateEmailCounts.set(email, (duplicateEmailCounts.get(email) || 0) + 1);
    }
    for (const candidate of duplicateCandidates) {
      const phone = (candidate.numero || '').replace(/\D/g, '').slice(-9);
      const dni = candidate.dni?.trim();
      const email = candidate.email?.trim().toLowerCase();
      if (
        candidate.estado_calidad === 'Duplicado' ||
        (phone.length >= 8 && (duplicatePhoneCounts.get(phone) || 0) > 1) ||
        (Boolean(dni) && (duplicateDniCounts.get(dni as string) || 0) > 1) ||
        (Boolean(email) && (duplicateEmailCounts.get(email as string) || 0) > 1)
      ) {
        duplicateBuyerIds.add(candidate.id_persona);
      }
    }
    const duplicateIdsForFilter = Array.from(duplicateBuyerIds).slice(0, 1800);
    if (duplicateBuyerIds.size > duplicateIdsForFilter.length) {
      console.warn('[buyer.routes] Se limitaron los IDs de duplicados usados en el filtro para respetar el límite de parámetros de SQL Server.');
    }

    if (selectedStates.length > 0) {
      const stateFilters: any[] = [];
      if (selectedStates.some((state) => ['NEW', 'CONTACTED'].includes(state))) {
        const newFilter: any = {
          Etapa: { nombre: 'BUYER' },
          NOT: { estado_calidad: 'Duplicado' },
        };
        if (duplicateIdsForFilter.length > 0) {
          newFilter.id_persona = { notIn: duplicateIdsForFilter };
        }
        stateFilters.push(newFilter);
      }
      if (selectedStates.includes('CONVERTED')) {
        stateFilters.push({ Etapa: { nombre: { in: ['LEAD', 'PAYER', 'CUSTOMER', 'TURNED'] } } });
      }
      if (selectedStates.includes('DISCARDED')) {
        stateFilters.push({ estado_calidad: 'Rechazado' });
      }
      if (selectedStates.includes('DUPLICATED')) {
        const duplicateFilter: any[] = [{ estado_calidad: 'Duplicado' }];
        if (duplicateIdsForFilter.length > 0) {
          duplicateFilter.push({ id_persona: { in: duplicateIdsForFilter } });
        }
        stateFilters.push({ OR: duplicateFilter });
      }
      where.AND = [...(where.AND || []), { OR: stateFilters.length > 0 ? stateFilters : [{ id_persona: -1 }] }];
    }

    const indicatorQueryPersons = hasPagination
      ? await prisma.personas.findMany({
          where: indicatorWhere,
          select: {
            id_persona: true,
            nombres: true,
            apellidos: true,
            numero: true,
            email: true,
            dni: true,
            autoriza_contacto: true,
            estado_calidad: true,
            fecha_registro: true,
            id_campana_origen: true,
            Etapa: { select: { nombre: true } },
          },
        })
      : [];

    const indicatorPersons = selectedStates.length === 0
      ? indicatorQueryPersons
      : indicatorQueryPersons.filter((person) => {
          const isConverted = ['LEAD', 'PAYER', 'CUSTOMER', 'TURNED'].includes(person.Etapa?.nombre || '');
          const isDuplicate = duplicateBuyerIds.has(person.id_persona) || person.estado_calidad === 'Duplicado';
          const matchesState = (state: string) => {
            if (['NEW', 'CONTACTED'].includes(state)) return person.Etapa?.nombre === 'BUYER' && !isDuplicate;
            if (state === 'CONVERTED') return isConverted;
            if (state === 'DISCARDED') return person.estado_calidad === 'Rechazado';
            if (state === 'DUPLICATED') return isDuplicate;
            return false;
          };
          return selectedStates.some(matchesState);
        });
    const temporalEvidence = hasPagination ? await prisma.$queryRaw<BuyerTemporalEvidence[]>`
      SELECT p.id_persona, c.fecha_captacion, e.fecha_conversion
      FROM dbo.Personas p
      OUTER APPLY (SELECT MIN(c.fecha_captacion) fecha_captacion FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona) c
      OUTER APPLY (SELECT MIN(ev.fecha_hora) fecha_conversion FROM dbo.EventosEtapa ev
        JOIN dbo.Etapas eo ON eo.id_etapa=ev.etapa_origen
        JOIN dbo.Etapas ed ON ed.id_etapa=ev.etapa_destino
        WHERE ev.id_persona=p.id_persona AND eo.nombre='BUYER' AND ed.nombre='LEAD') e
    ` : [];
    const indicators = calculateBuyerIndicators(indicatorPersons, duplicateBuyerIds, temporalEvidence, fromDate, toDate);

    const queryOptions: any = {
      where,
      orderBy: { fecha_registro: 'desc' },
      include: {
        Etapa: true,
        CanalOrigen: true,
        CampanaOrigen: { include: { GastosCampana: { select: { importe: true } } } },
        EventosEtapa: { include: { EtapaDestino: true }, orderBy: { fecha_hora: 'asc' }, ...(hasPagination ? { take: 20 } : {}) },
        Interacciones: { include: { Canal: true, Fuente: true }, orderBy: { fecha_hora: 'desc' }, ...(hasPagination ? { take: 20 } : {}) },
        Solicitudes: { include: { Servicio: true }, orderBy: { id_solicitud: 'desc' }, ...(hasPagination ? { take: 20 } : {}) },
        Preferencias: { include: { Canal: true, ServicioInteres: true }, orderBy: { id_preferencia: 'desc' } },
        DatosAcademicos: hasPagination ? { take: 1 } : true,
        DatosLaborales: hasPagination ? { take: 1 } : true,
        SaludOdontologica: hasPagination ? { take: 1 } : true,
        DecisionesIA: { where: { agente: 'BUYER' }, orderBy: { id_decision: 'desc' }, take: 1 },
      },
    };

    if (hasPagination) {
      queryOptions.skip = (page - 1) * pageSize;
      queryOptions.take = pageSize;
    }

    const [personas, total] = hasPagination
      ? await Promise.all([
          prisma.personas.findMany(queryOptions),
          prisma.personas.count({ where }),
        ])
      : [await prisma.personas.findMany(queryOptions), 0];
    const buyerPersons: any[] = personas;

    // Cargar captaciones iniciales en lote para evitar N+1 queries en el listado
    const personIds = buyerPersons.map(p => p.id_persona);
    const captacionesByPerson = new Map<number, { id_servicio: number | null; nombre_servicio?: string; activo?: boolean }>();
    if (personIds.length > 0) {
      try {
        const captacionesRows = await (prisma as any).$queryRaw<{
          id_persona: number;
          id_servicio: number | null;
          nombre_servicio?: string;
          activo?: boolean;
        }[]>`
          SELECT cb.id_persona, cb.id_servicio, s.nombre AS nombre_servicio, s.activo
          FROM dbo.CaptacionesBuyer cb
          LEFT JOIN dbo.Servicios s ON s.id_servicio = cb.id_servicio
          WHERE cb.id_persona IN (${Prisma.join(personIds)})
          ORDER BY cb.id_captacion ASC
        `;
        for (const row of captacionesRows) {
          if (!captacionesByPerson.has(row.id_persona)) {
            captacionesByPerson.set(row.id_persona, {
              id_servicio: row.id_servicio,
              nombre_servicio: row.nombre_servicio,
              activo: row.activo,
            });
          }
        }
      } catch (err) {
        console.warn('[buyer.routes] Error al cargar captaciones en lote para listado:', err);
      }
    }

    // Un contacto que ya avanzó a otra etapa no es un duplicado de BUYER:
    // representa la misma ficha dentro del ciclo comercial.
    const phoneCounts = new Map<string, number>();
    const dniCounts = new Map<string, number>();
    const emailCounts = new Map<string, number>();
    for (const p of buyerPersons) {
      if (p.Etapa?.nombre !== 'BUYER') continue;
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
    const buyers = buyerPersons.map(p => {
      const ph = (p.numero || '').replace(/\D/g, '').slice(-9);
      const em = p.email ? p.email.trim().toLowerCase() : '';
      const hasDuplicate = 
        (ph.length >= 8 && (phoneCounts.get(ph) || 0) > 1) ||
        (p.dni && (dniCounts.get(p.dni.trim()) || 0) > 1) ||
        (em && (emailCounts.get(em) || 0) > 1);

      const isDuplicate = p.estado_calidad === 'Duplicado' ||
        duplicateBuyerIds.has(p.id_persona) ||
        (hasDuplicate && p.Etapa?.nombre === 'BUYER');

      let state = 'NEW';
      if (p.estado_calidad === 'Rechazado') {
        state = 'DISCARDED';
      } else if (p.Etapa?.nombre === 'LEAD' || p.Etapa?.nombre === 'PAYER' || p.Etapa?.nombre === 'CUSTOMER' || p.Etapa?.nombre === 'TURNED') {
        state = 'CONVERTED';
      } else if (p.estado_calidad === 'Duplicado' || (isDuplicate && p.Etapa?.nombre === 'BUYER')) {
        state = 'DUPLICATED';
      }

      // Buscar fecha real de conversión a LEAD desde EventosEtapa
      const eventoConversion = p.EventosEtapa.find((e: any) => e.EtapaDestino?.nombre === 'LEAD' || e.EtapaDestino?.nombre === 'PAYER' || e.EtapaDestino?.nombre === 'CUSTOMER');
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

      const lastInteraction = p.Interacciones.length > 0 ? p.Interacciones[0] : null;
      const motivo =
        lastInteraction?.mensaje?.trim() ||
        (p.Solicitudes.length > 0 ? p.Solicitudes[0].motivo?.trim() : undefined) ||
        undefined;

      // Preferencia vigente determinista (id_preferencia desc, respetando fecha_fin)
      const sortedPrefs = [...(p.Preferencias || [])].sort((a: any, b: any) => (b.id_preferencia || 0) - (a.id_preferencia || 0));
      const now = new Date();
      const vigentePref = sortedPrefs.find((pref: any) => {
        if (!pref) return false;
        if (pref.fecha_fin) {
          const fin = new Date(pref.fecha_fin);
          if (!isNaN(fin.getTime()) && fin <= now) return false;
        }
        return true;
      }) || null;
      const prefs = vigentePref;

      // Resolución compartida y determinista del servicio declarado
      const declaredResolution = resolveDeclaredService({
        preferencias: p.Preferencias,
        captacionInicial: captacionesByPerson.get(p.id_persona) || null,
        solicitudes: p.Solicitudes,
      });
      const servicioId = declaredResolution.serviceId;
      const servicioName = declaredResolution.serviceName;
      const aca = p.DatosAcademicos.length > 0 ? p.DatosAcademicos[0] : null;
      const lab = p.DatosLaborales.length > 0 ? p.DatosLaborales[0] : null;
      const sal = p.SaludOdontologica.length > 0 ? p.SaludOdontologica[0] : null;

      const campaignId = p.id_campana_origen?.toString();
      const campaignName = p.CampanaOrigen?.nombre;
      const campaignCost = p.CampanaOrigen?.GastosCampana?.reduce((sum: number, g: any) => sum + Number(g.importe), 0);

      const consultasCount = p.Interacciones.length || p.Solicitudes.length || 1;
      const solicitudesHistory = p.Solicitudes.map((s: any) => ({
        id: s.id_solicitud.toString(),
        servicio: s.Servicio?.nombre || 'Consulta General',
        motivo: s.motivo || 'Sin detalle',
        fecha: s.fecha_solicitud ? s.fecha_solicitud.toISOString() : undefined,
      }));
      const interaccionesHistory = p.Interacciones.map((i: any) => ({
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
        activeInteractionId: lastInteraction?.id_interaccion || null,
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

        latestEvaluation: (() => {
          const latestDec = p.DecisionesIA && p.DecisionesIA.length > 0 ? p.DecisionesIA[0] : null;
          if (!latestDec) return null;
          let parsedDec: any = {};
          try {
            parsedDec = JSON.parse(latestDec.decision || '{}');
          } catch {}
          const activeInteractionId = lastInteraction?.id_interaccion || null;
          const esMensajeVigente = Boolean(
            activeInteractionId && latestDec.id_interaccion === activeInteractionId
          );
          const evaluatedInteraction = p.Interacciones.find((i: any) => i.id_interaccion === latestDec.id_interaccion);
          const mensajeEvaluado = evaluatedInteraction?.mensaje || parsedDec.mensaje_evaluado || null;

          const currentContextFingerprint = computeEvaluationContextFingerprint({
            mensaje: motivo || '',
            id_servicio_declarado: declaredResolution.evaluatorServiceId,
            pref_id_horario: vigentePref?.id_horario ?? null,
            sede_preferida: vigentePref?.sede_preferida ?? null,
          });

          let evalFingerprint = parsedDec.contextFingerprint;
          if (!evalFingerprint && latestDec.entrada) {
            try {
              const parsedEntrada = JSON.parse(latestDec.entrada);
              evalFingerprint = parsedEntrada.contextFingerprint || computeEvaluationContextFingerprint({
                mensaje: parsedEntrada.mensaje || mensajeEvaluado || '',
                id_servicio_declarado: parsedEntrada.id_servicio_declarado,
                pref_id_horario: parsedEntrada.pref_id_horario,
                sede_preferida: parsedEntrada.sede_preferida,
              });
            } catch {}
          }

          const esContextoVigente = esMensajeVigente && Boolean(
            evalFingerprint && evalFingerprint === currentContextFingerprint
          );

          return {
            id_decision: latestDec.id_decision,
            id_interaccion: latestDec.id_interaccion,
            id_interaccion_vigente: activeInteractionId,
            es_mensaje_vigente: esMensajeVigente,
            es_contexto_vigente: esContextoVigente,
            context_fingerprint: evalFingerprint || null,
            current_context_fingerprint: currentContextFingerprint,
            estado: !esContextoVigente && esMensajeVigente
              ? 'DESACTUALIZADA'
              : (parsedDec.estado || (latestDec.accion === 'REINTENTO_PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA')),
            intencion: parsedDec.intencion || null,
            id_servicio: parsedDec.id_servicio || null,
            servicio_nombre:
              (parsedDec.id_servicio &&
                p.Solicitudes?.find((s: any) => s.id_servicio === parsedDec.id_servicio)?.Servicio?.nombre) ||
              null,
            accion: latestDec.accion,
            explicacion: latestDec.resultado_revision || parsedDec.explicacion || parsedDec.motivo || '',
            fecha_hora: latestDec.fecha_hora.toISOString(),
            mensaje_evaluado: mensajeEvaluado,
            mensaje_vigente: motivo || null,
            discrepancia_horario: parsedDec.discrepancia_horario || null,
            intentosRealizados: parsedDec.intentosRealizados || parsedDec.intentos_realizados || 1,
            duracionTotalMs: parsedDec.duracionTotalMs || parsedDec.duracion_total_ms || 0,
            error: parsedDec.error || null,
          };
        })(),
      };
    });

    if (hasPagination) {
      return res.json({
        items: buyers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
        indicators,
      });
    }

    res.json(buyers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener buyers' });
  }
});

// Obtener el expediente completo de un BUYER por ID con su última evaluación persistida
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (isNaN(numId)) {
    return res.status(400).json({ error: 'ID de prospecto inválido' });
  }

  try {
    const p = await prisma.personas.findUnique({
      where: { id_persona: numId },
      include: {
        Etapa: true,
        CanalOrigen: true,
        CampanaOrigen: { include: { GastosCampana: { select: { importe: true } } } },
        EventosEtapa: { include: { EtapaDestino: true }, orderBy: { fecha_hora: 'asc' } },
        Interacciones: { include: { Canal: true, Fuente: true }, orderBy: { fecha_hora: 'desc' } },
        Solicitudes: { include: { Servicio: true }, orderBy: { id_solicitud: 'desc' } },
        Preferencias: { include: { Canal: true, ServicioInteres: true }, orderBy: { id_preferencia: 'desc' } },
        DatosAcademicos: true,
        DatosLaborales: true,
        SaludOdontologica: true,
        DecisionesIA: { where: { agente: 'BUYER' }, orderBy: { id_decision: 'desc' }, take: 10 },
      },
    });

    if (!p) {
      return res.status(404).json({ error: 'No se encontró la ficha del prospecto solicitado.' });
    }

    const canalName =
      p.CanalOrigen?.nombre ||
      (p.Interacciones.length > 0 && p.Interacciones[0].Canal?.nombre) ||
      (p.Preferencias.length > 0 && p.Preferencias[0].Canal?.nombre) ||
      'Página Web / Portal Online';
    const canalId =
      p.id_canal_origen?.toString() ||
      (p.Interacciones.length > 0 && p.Interacciones[0].id_canal?.toString()) ||
      '';

    const fuenteName =
      (p.Interacciones.length > 0 && p.Interacciones[0].Fuente?.nombre) ||
      'Formulario Web - Portal NexoSalud';
    const fuenteId =
      (p.Interacciones.length > 0 && p.Interacciones[0].id_fuente?.toString()) ||
      '';

    const lastInteraction = p.Interacciones.length > 0 ? p.Interacciones[0] : null;
    const activeMessage =
      lastInteraction?.mensaje?.trim() ||
      (p.Solicitudes.length > 0 ? p.Solicitudes[0].motivo?.trim() : undefined) ||
      undefined;

    // Preferencia vigente determinista (id_preferencia desc, respetando fecha_fin)
    const sortedPrefs = [...(p.Preferencias || [])].sort((a: any, b: any) => (b.id_preferencia || 0) - (a.id_preferencia || 0));
    const now = new Date();
    const vigentePref = sortedPrefs.find((pref: any) => {
      if (!pref) return false;
      if (pref.fecha_fin) {
        const fin = new Date(pref.fecha_fin);
        if (!isNaN(fin.getTime()) && fin <= now) return false;
      }
      return true;
    }) || null;
    const prefs = vigentePref;

    let captacionInicial: { id_servicio: number | null; nombre_servicio?: string; activo?: boolean } | null = null;
    try {
      const [captacionRow] = await (prisma as any).$queryRaw<{ id_servicio: number | null; nombre_servicio?: string; activo?: boolean }[]>`
        SELECT cb.id_servicio, s.nombre AS nombre_servicio, s.activo
        FROM dbo.CaptacionesBuyer cb
        LEFT JOIN dbo.Servicios s ON s.id_servicio = cb.id_servicio
        WHERE cb.id_persona = ${numId}
        ORDER BY cb.id_captacion ASC
      `;
      if (captacionRow) {
        captacionInicial = {
          id_servicio: captacionRow.id_servicio ?? null,
          nombre_servicio: captacionRow.nombre_servicio,
          activo: captacionRow.activo,
        };
      }
    } catch {}

    const declaredResolution = resolveDeclaredService({
      preferencias: p.Preferencias,
      captacionInicial,
      solicitudes: p.Solicitudes,
    });
    const servicioId = declaredResolution.serviceId;
    const servicioName = declaredResolution.serviceName;
    const aca = p.DatosAcademicos.length > 0 ? p.DatosAcademicos[0] : null;
    const lab = p.DatosLaborales.length > 0 ? p.DatosLaborales[0] : null;
    const sal = p.SaludOdontologica.length > 0 ? p.SaludOdontologica[0] : null;

    let state = 'NEW';
    if (p.estado_calidad === 'Rechazado') {
      state = 'DISCARDED';
    } else if (['LEAD', 'PAYER', 'CUSTOMER', 'TURNED'].includes(p.Etapa?.nombre || '')) {
      state = 'CONVERTED';
    } else if (p.estado_calidad === 'Duplicado') {
      state = 'DUPLICATED';
    }

    const eventoConversion = p.EventosEtapa.find((e: any) =>
      ['LEAD', 'PAYER', 'CUSTOMER', 'TURNED'].includes(e.EtapaDestino?.nombre || '')
    );
    const convertedAt = eventoConversion
      ? eventoConversion.fecha_hora.toISOString()
      : state === 'CONVERTED'
      ? (p.fecha_actualizacion || p.fecha_autorizacion || p.fecha_registro).toISOString()
      : undefined;

    const latestDec = p.DecisionesIA && p.DecisionesIA.length > 0 ? p.DecisionesIA[0] : null;
    let latestEvaluation: any = null;
    if (latestDec) {
      let parsedDec: any = {};
      try {
        parsedDec = JSON.parse(latestDec.decision || '{}');
      } catch {}

      const activeInteractionId = lastInteraction?.id_interaccion || null;
      const esMensajeVigente = Boolean(
        activeInteractionId && latestDec.id_interaccion === activeInteractionId
      );
      const evaluatedInteraction = p.Interacciones.find((i: any) => i.id_interaccion === latestDec.id_interaccion);
      const mensajeEvaluado = evaluatedInteraction?.mensaje || parsedDec.mensaje_evaluado || null;

      const currentContextFingerprint = computeEvaluationContextFingerprint({
        mensaje: activeMessage || '',
        id_servicio_declarado: declaredResolution.evaluatorServiceId,
        pref_id_horario: vigentePref?.id_horario ?? null,
        sede_preferida: vigentePref?.sede_preferida ?? null,
      });

      let evalFingerprint = parsedDec.contextFingerprint;
      if (!evalFingerprint && latestDec.entrada) {
        try {
          const parsedEntrada = JSON.parse(latestDec.entrada);
          evalFingerprint = parsedEntrada.contextFingerprint || computeEvaluationContextFingerprint({
            mensaje: parsedEntrada.mensaje || mensajeEvaluado || '',
            id_servicio_declarado: parsedEntrada.id_servicio_declarado,
            pref_id_horario: parsedEntrada.pref_id_horario,
            sede_preferida: parsedEntrada.sede_preferida,
          });
        } catch {}
      }

      const esContextoVigente = esMensajeVigente && Boolean(
        evalFingerprint && evalFingerprint === currentContextFingerprint
      );

      latestEvaluation = {
        id_decision: latestDec.id_decision,
        id_interaccion: latestDec.id_interaccion,
        id_interaccion_vigente: activeInteractionId,
        es_mensaje_vigente: esMensajeVigente,
        es_contexto_vigente: esContextoVigente,
        context_fingerprint: evalFingerprint || null,
        current_context_fingerprint: currentContextFingerprint,
        estado: !esContextoVigente && esMensajeVigente
          ? 'DESACTUALIZADA'
          : (parsedDec.estado || (latestDec.accion === 'REINTENTO_PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA')),
        intencion: parsedDec.intencion || null,
        id_servicio: parsedDec.id_servicio || null,
        servicio_nombre:
          (parsedDec.id_servicio &&
            (p.Solicitudes?.find((s: any) => s.id_servicio === parsedDec.id_servicio)?.Servicio?.nombre ||
              servicioName)) ||
          null,
        accion: latestDec.accion,
        explicacion: latestDec.resultado_revision || parsedDec.explicacion || parsedDec.motivo || '',
        fecha_hora: latestDec.fecha_hora.toISOString(),
        mensaje_evaluado: mensajeEvaluado,
        mensaje_vigente: activeMessage || null,
        discrepancia_horario: parsedDec.discrepancia_horario || null,
        intentosRealizados: parsedDec.intentosRealizados || parsedDec.intentos_realizados || 1,
        duracionTotalMs: parsedDec.duracionTotalMs || parsedDec.duracion_total_ms || 0,
        error: parsedDec.error || null,
      };
    }

    const buyer = {
      id: p.id_persona.toString(),
      personId: p.id_persona.toString(),
      activeInteractionId: lastInteraction?.id_interaccion || null,
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
      campaignId: p.id_campana_origen?.toString(),
      campaignName: p.CampanaOrigen?.nombre,
      serviceOfInterest: servicioName,
      serviceOfInterestId: servicioId,
      contactAuthorization: p.autoriza_contacto,
      qualityStatus: p.estado_calidad || 'Valido',
      concreteRequest: activeMessage,
      createdAt: p.fecha_registro.toISOString(),
      convertedAt,
      state,
      consultasCount: p.Interacciones.length || p.Solicitudes.length || 1,
      solicitudesHistory: p.Solicitudes.map((s: any) => ({
        id: s.id_solicitud.toString(),
        servicio: s.Servicio?.nombre || 'Consulta General',
        motivo: s.motivo || 'Sin detalle',
        fecha: s.fecha_solicitud ? s.fecha_solicitud.toISOString() : undefined,
      })),
      interaccionesHistory: p.Interacciones.map((i: any) => ({
        id: i.id_interaccion.toString(),
        tipo: i.tipo,
        mensaje: i.mensaje || '',
        canal: i.Canal?.nombre,
        fuente: i.Fuente?.nombre,
        fecha: i.fecha_hora.toISOString(),
      })),
      pref_id_canal: prefs?.id_canal?.toString() || '',
      pref_id_horario: prefs?.id_horario?.toString() || '',
      pref_id_modalidad: prefs?.id_modalidad?.toString() || '',
      pref_sede_preferida: prefs?.sede_preferida || '',
      pref_profesional_preferido: prefs?.profesional_preferido || '',
      latestEvaluation,
    };

    return res.json(buyer);
  } catch (error) {
    console.error('Error al obtener buyer por id:', error);
    return res.status(500).json({ error: 'Error al obtener ficha de buyer' });
  }
});

// Evaluar el mensaje vigente de un BUYER con Gemini en el backend y persistir el resultado
router.post('/:id/evaluate', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (isNaN(numId)) {
    return res.status(400).json({ error: 'ID de prospecto inválido' });
  }

  try {
    const person = await prisma.personas.findUnique({
      where: { id_persona: numId },
      include: {
        Etapa: true,
        Interacciones: { orderBy: { fecha_hora: 'desc' }, take: 1 },
        Preferencias: { include: { ServicioInteres: true }, orderBy: { id_preferencia: 'desc' } },
        Solicitudes: { include: { Servicio: true }, orderBy: { id_solicitud: 'desc' } },
      },
    });

    if (!person) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    const newMessage = req.body?.message?.trim() || req.body?.concreteRequest?.trim();
    const lastInteraction = person.Interacciones[0] || null;

    let targetInteractionId: number;
    let messageToEvaluate: string;

    // Si se pasa un mensaje explícito que difiere del último mensaje persistido,
    // conservar el historial creando una nueva interacción en lugar de sobrescribir silenciosamente
    if (newMessage && (!lastInteraction || lastInteraction.mensaje !== newMessage)) {
      const createdInt = await prisma.interacciones.create({
        data: {
          id_persona: numId,
          tipo: 'Mensaje Actualizado / Reevaluación',
          mensaje: newMessage,
          id_canal: person.id_canal_origen || lastInteraction?.id_canal || null,
          fecha_hora: new Date(),
        },
      });
      targetInteractionId = createdInt.id_interaccion;
      messageToEvaluate = newMessage;
    } else if (lastInteraction) {
      targetInteractionId = lastInteraction.id_interaccion;
      messageToEvaluate = lastInteraction.mensaje || 'Solicitud de información general';
    } else {
      const createdInt = await prisma.interacciones.create({
        data: {
          id_persona: numId,
          tipo: 'Consulta Inicial',
          mensaje: newMessage || 'Solicitud de información general',
          fecha_hora: new Date(),
        },
      });
      targetInteractionId = createdInt.id_interaccion;
      messageToEvaluate = createdInt.mensaje || 'Solicitud de información general';
    }

    const [captacionRow] = await (prisma as any).$queryRaw<{
      id_captacion: number;
      id_servicio?: number | null;
      nombre_servicio?: string;
      activo?: boolean;
    }[]>`
      SELECT TOP (1) cb.id_captacion, cb.id_servicio, s.nombre AS nombre_servicio, s.activo
      FROM dbo.CaptacionesBuyer cb
      LEFT JOIN dbo.Servicios s ON s.id_servicio = cb.id_servicio
      WHERE cb.id_persona=${numId} ORDER BY cb.id_captacion ASC
    `;
    let captacionId = captacionRow?.id_captacion;
    let captacionInicial = captacionRow
      ? {
          id_servicio: captacionRow.id_servicio ?? null,
          nombre_servicio: captacionRow.nombre_servicio,
          activo: captacionRow.activo,
        }
      : null;

    if (!captacionId) {
      await (prisma as any).$executeRaw`
        INSERT INTO dbo.CaptacionesBuyer (id_persona, fecha_captacion, estado_calidad)
        VALUES (${numId}, SYSDATETIME(), 'Valido')
      `;
      const [newCaptacionRow] = await (prisma as any).$queryRaw<{
        id_captacion: number;
        id_servicio?: number | null;
        nombre_servicio?: string;
        activo?: boolean;
      }[]>`
        SELECT TOP (1) cb.id_captacion, cb.id_servicio, s.nombre AS nombre_servicio, s.activo
        FROM dbo.CaptacionesBuyer cb
        LEFT JOIN dbo.Servicios s ON s.id_servicio = cb.id_servicio
        WHERE cb.id_persona=${numId} ORDER BY cb.id_captacion DESC
      `;
      captacionId = newCaptacionRow?.id_captacion || numId;
      if (newCaptacionRow) {
        captacionInicial = {
          id_servicio: newCaptacionRow.id_servicio ?? null,
          nombre_servicio: newCaptacionRow.nombre_servicio,
          activo: newCaptacionRow.activo,
        };
      }
    }

    const declaredResolution = resolveDeclaredService({
      preferencias: person.Preferencias,
      captacionInicial,
      solicitudes: person.Solicitudes,
    });
    const declaredServiceId = declaredResolution.evaluatorServiceId;

    const sortedPrefs = [...(person.Preferencias || [])].sort((a: any, b: any) => (b.id_preferencia || 0) - (a.id_preferencia || 0));
    const now = new Date();
    const vigentePref = sortedPrefs.find((pref: any) => {
      if (!pref) return false;
      if (pref.fecha_fin) {
        const fin = new Date(pref.fecha_fin);
        if (!isNaN(fin.getTime()) && fin <= now) return false;
      }
      return true;
    }) || null;
    const prefHorario = vigentePref?.id_horario || null;

    const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
      id_persona: numId,
      id_captacion: captacionId,
      id_interaccion: targetInteractionId,
      mensaje: messageToEvaluate,
      id_servicio_declarado: declaredServiceId,
      pref_id_horario: prefHorario,
      sede_preferida: vigentePref?.sede_preferida || null,
    });

    return res.json({
      success: true,
      data: outcome,
      latestEvaluation: {
        id_decision: outcome.id_decision || null,
        id_interaccion: outcome.id_interaccion,
        id_interaccion_vigente: outcome.id_interaccion,
        es_mensaje_vigente: true,
        es_contexto_vigente: true,
        context_fingerprint: outcome.contextFingerprint || null,
        current_context_fingerprint: outcome.contextFingerprint || null,
        estado: outcome.estado,
        intencion: outcome.intencion,
        id_servicio: outcome.id_servicio,
        servicio_nombre: declaredResolution.serviceName || null,
        accion: outcome.accion,
        explicacion: outcome.aclaracion || outcome.error || 'Evaluación persistida correctamente.',
        fecha_hora: new Date().toISOString(),
        mensaje_evaluado: messageToEvaluate,
        mensaje_vigente: messageToEvaluate,
        discrepancia_horario: outcome.discrepancia_horario || null,
      },
    });
  } catch (err: any) {
    console.error('Error al evaluar buyer:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Error al evaluar mensaje con Gemini',
    });
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
    let resolvedFirstName = (firstName || req.body.nombres || req.body.fullName || req.body.name || '').trim();
    let resolvedLastName = (lastName || req.body.apellidos || '').trim();

    if (!resolvedLastName && resolvedFirstName.includes(' ')) {
      const parts = resolvedFirstName.split(/\s+/);
      resolvedFirstName = parts[0];
      resolvedLastName = parts.slice(1).join(' ');
    }

    if (!resolvedFirstName) resolvedFirstName = 'Prospecto';
    if (!resolvedLastName) resolvedLastName = 'General';

    const rawDni = documentNumber || req.body.dni || '';
    const dniToSave = rawDni ? String(rawDni).trim() : null;
    if (dniToSave && dniToSave.length > 8) return res.status(400).json({ error: 'El DNI no puede superar los 8 caracteres.' });

    const rawPhone = phone || req.body.numero || '';
    const phoneToSave = rawPhone ? String(rawPhone).trim() : null;
    if (phoneToSave && phoneToSave.length > 20) return res.status(400).json({ error: 'El teléfono no puede superar los 20 caracteres.' });

    const rawEmail = email || req.body.correo || null;
    const emailToSave = rawEmail ? String(rawEmail).trim().toLowerCase() : null;

    const authContact = contactAuthorization !== undefined 
      ? Boolean(contactAuthorization) 
      : (req.body.autoriza_contacto !== undefined ? Boolean(req.body.autoriza_contacto) : false);

    const rawCanalOrigen = id_canal_origen || channel || req.body.id_canal;
    const rawFuenteOrigen = attractionSource || req.body.id_fuente;
    const rawServicio = serviceOfInterestId || req.body.id_servicio || req.body.id_servicio_interes;
    const rawRequest = concreteRequest || req.body.duda_especifica || req.body.motivo;

    const result = await writeBuyer(async tx => {
      const etapaBuyer = await tx.etapas.findUniqueOrThrow({ where: { nombre: 'BUYER' } });
      const digits = phoneToSave?.replace(/\D/g, '') ?? '';
      const phone = digits.length >= 9 ? digits.slice(-9) : digits.length >= 7 ? digits : null;

      const validCampana = await getValidCampanaId(tx, id_campana_origen);
      const validCanalOrigen = await getValidCanalId(tx, rawCanalOrigen);
      const validChannel = await getValidCanalId(tx, channel || req.body.id_canal);
      const validAttractionSource = await getValidFuenteId(tx, rawFuenteOrigen);
      const validService = await getValidServicioId(tx, rawServicio);
      const validPrefCanal = await getValidCanalId(tx, pref_id_canal);
      const validPrefHorario = await getValidHorarioId(tx, pref_id_horario);
      const validPrefModalidad = await getValidModalidadId(tx, pref_id_modalidad);

      const finalCalidad = estado_calidad || (emailToSave || phone ? 'Valido' : 'Incompleto');
      const captureReason = typeof rawRequest === 'string' ? rawRequest.trim().slice(0, 500) || null : null;
      const fullMessage =
        (typeof rawRequest === 'string' && rawRequest.trim()) ||
        'Consulta inicial de información';

      const existing = await findBuyerIdentity(tx, dniToSave, emailToSave, phone);
      if (existing) {
        if (dniToSave && existing.dni && existing.dni.trim() !== dniToSave) {
          throw new BuyerInputError('El contacto corresponde a una identidad distinta.');
        }
        let [capture] = await tx.$queryRaw<{ id_captacion: number }[]>`
          SELECT id_captacion FROM dbo.CaptacionesBuyer WHERE id_persona=${existing.id_persona}
        `;
        if (!capture) {
          await recordBuyerCapture(tx, existing, {
            sourceId: validAttractionSource,
            serviceId: validService,
            branchId: await captureBranch(tx, req.body.id_sede ?? pref_sede_preferida),
            reason: captureReason,
          });
          const [newCapture] = await tx.$queryRaw<{ id_captacion: number }[]>`
            SELECT id_captacion FROM dbo.CaptacionesBuyer WHERE id_persona=${existing.id_persona}
          `;
          capture = newCapture;
        }

        // 3. Consulta nueva de contacto existente:
        // Registra la nueva consulta en Interacciones, conserva su etapa y reutiliza persona/captación.
        // No crees una solicitud ni una persona adicional por esa nueva consulta.
        // 4. Mensaje completo: texto original completo sin recortar a 500 caracteres
        const existingFullMessage =
          (typeof rawRequest === 'string' && rawRequest.trim()) ||
          'Nueva consulta de contacto existente';

        await tx.interacciones.create({
          data: {
            id_persona: existing.id_persona,
            id_canal: validChannel || validCanalOrigen || existing.id_canal_origen || null,
            id_fuente: validAttractionSource || null,
            tipo: 'Nueva Consulta',
            mensaje: existingFullMessage,
            fecha_hora: new Date(),
          },
        });

        // Actualizar preferencias si se enviaron (incluyendo servicio de interés actual)
        if (
          validPrefCanal ||
          validPrefHorario ||
          validPrefModalidad ||
          validService ||
          pref_sede_preferida ||
          pref_profesional_preferido
        ) {
          const existingPref = await tx.personaPreferencias.findFirst({
            where: { id_persona: existing.id_persona },
            orderBy: { id_preferencia: 'desc' },
          });

          const prefDataToSave: any = {};
          if (validPrefCanal) prefDataToSave.id_canal = validPrefCanal;
          if (validPrefHorario) prefDataToSave.id_horario = validPrefHorario;
          if (validPrefModalidad) prefDataToSave.id_modalidad = validPrefModalidad;
          if (validService) prefDataToSave.id_servicio_interes = validService;
          if (pref_sede_preferida) prefDataToSave.sede_preferida = pref_sede_preferida;
          if (pref_profesional_preferido) prefDataToSave.profesional_preferido = pref_profesional_preferido;

          if (existingPref) {
            await tx.personaPreferencias.update({
              where: { id_preferencia: existingPref.id_preferencia },
              data: prefDataToSave,
            });
          } else {
            await tx.personaPreferencias.create({
              data: {
                id_persona: existing.id_persona,
                ...prefDataToSave,
              },
            });
          }
        }

        return { ...existing, id: existing.id_persona, isDuplicate: true };
      }

      const persona = await tx.personas.create({
        data: {
          nombres: resolvedFirstName,
          apellidos: resolvedLastName,
          email: emailToSave,
          numero: digits || null,
          dni: dniToSave,
          autoriza_contacto: authContact,
          fecha_autorizacion: authContact ? new Date() : null,
          id_campana_origen: validCampana,
          id_canal_origen: validCanalOrigen,
          tipo_persona: tipo_persona || 'Adulto General',
          estado_calidad: finalCalidad,
          id_etapa_actual: etapaBuyer.id_etapa,
        }
      });

      // Guardar SIEMPRE la consulta original en dbo.Interacciones con su persona y canal/fuente
      // Mensaje completo: texto original completo sin recortar a 500 caracteres
      await tx.interacciones.create({
        data: {
          id_persona: persona.id_persona,
          id_canal: validChannel || validCanalOrigen || null,
          id_fuente: validAttractionSource || null,
          tipo: 'Consulta Inicial',
          mensaje: fullMessage,
          fecha_hora: new Date(),
        },
      });

      // IMPORTANTE: Una consulta informativa o ambigua NO debe crear una oportunidad en Solicitudes.
      // La creación de Solicitudes queda estrictamente reservada para la conversión (usp_ConvertirBuyerALead).

      // Gustos y Preferencias (incluyendo servicio de interés actual)
      if (
        validPrefCanal ||
        validPrefHorario ||
        validPrefModalidad ||
        validService ||
        pref_sede_preferida ||
        pref_profesional_preferido
      ) {
        await tx.personaPreferencias.create({
          data: {
            id_persona: persona.id_persona,
            id_canal: validPrefCanal,
            id_horario: validPrefHorario,
            id_modalidad: validPrefModalidad,
            id_servicio_interes: validService,
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

      await recordBuyerCapture(tx, persona, {
        sourceId: validAttractionSource, serviceId: validService,
        branchId: await captureBranch(tx, req.body.id_sede ?? pref_sede_preferida), reason: captureReason,
      });
      return { ...persona, id: persona.id_persona, isDuplicate: false };
    });

    if (!result.isDuplicate) MartSyncService.syncBuyer().catch(err => console.warn('[AutoSync] Error:', err.message));
    res.status(result.isDuplicate ? 200 : 201).json(result);
  } catch (error: any) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
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

      const validService = await getValidServicioId(
        tx,
        serviceOfInterestId !== undefined
          ? serviceOfInterestId
          : req.body.id_servicio !== undefined
          ? req.body.id_servicio
          : req.body.id_servicio_interes
      );
      const validChannel = await getValidCanalId(tx, channel);
      const validAttractionSource = await getValidFuenteId(tx, attractionSource);
      const validPrefCanal = await getValidCanalId(tx, pref_id_canal);
      const validPrefHorario = await getValidHorarioId(tx, pref_id_horario);
      const validPrefModalidad = await getValidModalidadId(tx, pref_id_modalidad);

      // Conservar historial de interacciones si el mensaje cambió realmente;
      // NUNCA crear ni modificar solicitudes comerciales históricas de la persona al editar el mensaje
      if (concreteRequest !== undefined && typeof concreteRequest === 'string') {
        const trimmedRequest = concreteRequest.trim();
        if (trimmedRequest) {
          const lastInteraction = await tx.interacciones.findFirst({
            where: { id_persona: Number(id) },
            orderBy: { fecha_hora: 'desc' },
          });

          if (!lastInteraction || lastInteraction.mensaje !== trimmedRequest) {
            await tx.interacciones.create({
              data: {
                id_persona: Number(id),
                id_canal: validChannel || lastInteraction?.id_canal || null,
                id_fuente: validAttractionSource || lastInteraction?.id_fuente || null,
                tipo: 'Mensaje Modificado / Edición',
                mensaje: trimmedRequest,
                fecha_hora: new Date(),
              },
            });
          }
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

      // Preservar captación inicial: NO sobrescribir CaptacionesBuyer.id_servicio al editar.
      // Guardar el interés actual en PersonaPreferencias sin borrar las demás preferencias cuando el campo no fue enviado.
      const hasPrefUpdates =
        serviceOfInterestId !== undefined ||
        req.body.id_servicio !== undefined ||
        req.body.id_servicio_interes !== undefined ||
        pref_id_canal !== undefined ||
        pref_id_horario !== undefined ||
        pref_id_modalidad !== undefined ||
        pref_sede_preferida !== undefined ||
        pref_profesional_preferido !== undefined;

      if (hasPrefUpdates) {
        const existingPref = await tx.personaPreferencias.findFirst({
          where: { id_persona: Number(id) },
          orderBy: { id_preferencia: 'desc' },
        });

        const prefDataToSave: any = {};
        if (
          serviceOfInterestId !== undefined ||
          req.body.id_servicio !== undefined ||
          req.body.id_servicio_interes !== undefined
        ) {
          prefDataToSave.id_servicio_interes = validService;
        }
        if (pref_id_canal !== undefined) prefDataToSave.id_canal = validPrefCanal;
        if (pref_id_horario !== undefined) prefDataToSave.id_horario = validPrefHorario;
        if (pref_id_modalidad !== undefined) prefDataToSave.id_modalidad = validPrefModalidad;
        if (pref_sede_preferida !== undefined) prefDataToSave.sede_preferida = pref_sede_preferida || null;
        if (pref_profesional_preferido !== undefined) prefDataToSave.profesional_preferido = pref_profesional_preferido || null;

        if (existingPref) {
          await tx.personaPreferencias.update({
            where: { id_preferencia: existingPref.id_preferencia },
            data: prefDataToSave,
          });
        } else {
          await tx.personaPreferencias.create({
            data: {
              id_persona: Number(id),
              ...prefDataToSave,
            },
          });
        }
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
router.post('/:id/convert', async (req, res) => {
  const personId = Number(req.params.id);
  if (!Number.isSafeInteger(personId) || personId < 1 || personId > 2147483647) {
    return res.status(400).json({ error: 'ID de persona inválido.' });
  }

  try {
    const [capture] = await prisma.$queryRaw<{ id_captacion: number; id_servicio: number | null; motivo_consulta: string | null }[]>`
      SELECT id_captacion,id_servicio,motivo_consulta FROM dbo.CaptacionesBuyer WHERE id_persona=${personId}
    `;
    if (!capture) throw new BuyerInputError('La persona requiere una captación documentada antes de convertirla.');
    const [prior] = await prisma.$queryRaw<{ id_solicitud: number | null }[]>`
      SELECT TOP (1) e.id_solicitud FROM dbo.EventosEtapa e
      JOIN dbo.Etapas o ON o.id_etapa=e.etapa_origen AND o.nombre='BUYER'
      JOIN dbo.Etapas d ON d.id_etapa=e.etapa_destino AND d.nombre='LEAD'
      WHERE e.id_captacion=${capture.id_captacion} ORDER BY e.id_evento_etapa
    `;
    if (prior?.id_solicitud) {
      return res.json({ message: 'Paciente transferido a LEAD', id_solicitud: prior.id_solicitud, ya_convertido: true });
    }
    const service = Number(req.body?.id_servicio ?? req.body?.serviceOfInterestId ?? capture.id_servicio);
    const reason = String(req.body?.motivo ?? req.body?.concreteRequest ?? capture.motivo_consulta?.slice(0, 200) ?? '').trim();
    if (!Number.isInteger(service) || service < 1 || service > 2147483647 || !reason || reason.length > 200) {
      return res.status(400).json({ error: 'Indica un tratamiento válido y un motivo concreto de hasta 200 caracteres.' });
    }
    const [result] = await prisma.$queryRaw<{ id_solicitud: number | null; ya_convertido: number }[]>`
      EXEC dbo.usp_ConvertirBuyerALead @id_captacion=${capture.id_captacion}, @id_servicio=${service}, @motivo=${reason}
    `;
    if (!result?.id_solicitud) throw new BuyerInputError('La conversión histórica no tiene una solicitud vinculada.');
    res.json({ message: 'Paciente transferido a LEAD', id_solicitud: result.id_solicitud, ya_convertido: Boolean(result.ya_convertido) });
  } catch (error) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010' &&
        /^5100[1-8]$/.test(String(error.meta?.code))) {
      return res.status(409).json({ error: String(error.meta?.message ?? 'La captación no cumple las reglas de conversión.') });
    }
    console.error(error);
    res.status(500).json({ error: 'No se pudo convertir a LEAD.' });
  }
});

// Eliminar un BUYER
router.delete('/:id', async (req, res) => {
  const personId = Number(req.params.id);
  if (!Number.isInteger(personId) || personId < 1 || personId > 2147483647) {
    return res.status(400).json({ error: 'ID de persona inválido.' });
  }
  try {
    await writeBuyer(async tx => {
      const person = await tx.personas.findUnique({ where: { id_persona: personId }, include: { Etapa: true } });
      if (!person) throw new BuyerInputError('Persona inexistente.', 404);
      const [capture] = await tx.$queryRaw<{ id_captacion: number }[]>`
        SELECT id_captacion FROM dbo.CaptacionesBuyer WITH (UPDLOCK,HOLDLOCK) WHERE id_persona=${personId}
      `;
      const requests = await tx.solicitudes.findMany({ where: { id_persona: personId } });
      if (person.Etapa.nombre !== 'BUYER' || capture ||
          requests.some(request => request.fecha_ingreso_lead || request.resultado_comercial_lead) ||
          await tx.reservas.count({ where: { id_persona: personId } })) {
        throw new BuyerInputError('La persona tiene trazabilidad comercial o reservas y no admite borrado físico.');
      }
      for (const request of requests) {
        await tx.opciones.deleteMany({ where: { id_solicitud: request.id_solicitud } });
      }
      await tx.interacciones.deleteMany({ where: { id_persona: personId } });
      await tx.eventosEtapa.deleteMany({ where: { id_persona: personId } });
      await tx.solicitudes.deleteMany({ where: { id_persona: personId } });
      await tx.personaPreferencias.deleteMany({ where: { id_persona: personId } });
      await tx.personas.delete({ where: { id_persona: personId } });
    });
    res.json({ message: 'Buyer eliminado exitosamente' });
  } catch (error) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'No se pudo eliminar el BUYER.' });
  }
});

export { router as buyerRouter };
export default router;
