import { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { prisma } from '../db';
import { getLeadStaffIdentity, leadStaffAuthEnabled, loginLeadStaff, logoutLeadStaff } from '../services/leadStaffAuth';

export const leadCommercialRouter = Router();
const router = leadCommercialRouter;
const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

class InputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function id(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      !/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 2147483647) {
    throw new InputError('Identificador inválido.');
  }
  return Number(value);
}

function optionalId(value: unknown) {
  return value == null ? null : id(value);
}

function requiredText(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new InputError('Texto requerido de hasta ' + max + ' caracteres.');
  }
  return value.trim();
}

function price(value: unknown) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,8}(\.\d{1,2})?$/.test(String(value))) {
    throw new InputError('Precio inválido.');
  }
  return new Prisma.Decimal(value);
}

function route(action: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await action(req, res);
    } catch (error) {
      if (error instanceof InputError) return res.status(error.status).json({ error: error.message });
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (['P2002', 'P2003', 'P2004', 'P2034'].includes(error.code)) {
          return res.status(409).json({ error: 'La operación entra en conflicto con los datos vigentes.' });
        }
      }
      console.error('LEAD comercial', error);
      return res.status(500).json({ error: 'No se pudo completar la operación LEAD.' });
    }
  };
}

async function opportunity(tx: Prisma.TransactionClient, value: unknown, editable: boolean) {
  const row = await tx.solicitudes.findUnique({ where: { id_solicitud: id(value) } });
  if (!row) throw new InputError('Oportunidad inexistente.', 404);
  // The Buyer conversion is authoritative when it supplies a linked stage event.
  const [entry] = await tx.$queryRaw<{ ingreso: Date }[]>`
    SELECT fecha_solicitud AS ingreso
    FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME())
    WHERE id_solicitud = ${row.id_solicitud}
  `;
  if (!entry) throw new InputError('La solicitud no tiene ingreso a LEAD documentado.', 409);
  if (editable && (row.archivada_lead_en ||
      ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? ''))) {
    throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
  }
  return { ...row, ingreso_lead_documentado: entry.ingreso };
}

router.post('/staff/session', loginLeadStaff);
router.delete('/staff/session', logoutLeadStaff);

async function staffOpportunity(tx: Prisma.TransactionClient, req: Request) {
  const user = await getLeadStaffIdentity(req, tx);
  if (!user) throw new InputError('Se requiere una sesión vigente del personal de LEAD.', 401);
  const row = await opportunity(tx, req.params.id, false);
  if (user.rol !== 'Administrador' && row.id_negociador !== user.id_usuario) {
    throw new InputError('La oportunidad no está asignada a este negociador.', 403);
  }
  return { row, user };
}

router.get('/opportunities/:id/staff-access', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const { row, user } = await prisma.$transaction(tx => staffOpportunity(tx, req), serializable);
  res.json({ usuario: user, id_solicitud: row.id_solicitud });
}));

router.patch('/opportunities/:id/follow-up', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const result = await prisma.$transaction(async tx => {
    const { row } = await staffOpportunity(tx, req);
    if (row.archivada_lead_en || ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) {
      throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
    }
    const local = req.body?.fecha_lima;
    const expected = req.body?.fecha_esperada_utc;
    if (expected !== null && (typeof expected !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expected))) {
      throw new InputError('Indica la fecha de seguimiento que estabas consultando.');
    }
    let next: Date | null = null;
    if (local !== null) {
      if (typeof local !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(local)) {
        throw new InputError('Indica una fecha y hora de Lima válidas o cancela el seguimiento.');
      }
      calendarDate(local.slice(0, 10), 'La fecha de seguimiento');
      next = new Date(local + ':00-05:00');
      if (!Number.isFinite(next.getTime()) || next.getUTCFullYear() > 9999) {
        throw new InputError('Fecha de seguimiento fuera de rango.');
      }
    }
    const current = row.fecha_proximo_seguimiento?.toISOString() ?? null;
    if (current === (next?.toISOString() ?? null)) {
      return { id_solicitud: row.id_solicitud, fecha_proximo_seguimiento: current };
    }
    if (current !== expected) throw new InputError('Otro operador cambió el seguimiento. Revisa la fecha actual.', 409);
    if (next && next.getTime() <= Date.now()) throw new InputError('El seguimiento debe ser posterior a la hora actual.');
    return tx.solicitudes.update({
      where: { id_solicitud: row.id_solicitud },
      data: { fecha_proximo_seguimiento: next },
      select: { id_solicitud: true, fecha_proximo_seguimiento: true },
    });
  }, serializable);
  res.json(result);
}));

router.get('/opportunities', route(async (req, res) => {
  const personId = optionalId(req.query.id_persona);
  const service = optionalId(req.query.id_servicio);
  const negotiator = optionalId(req.query.id_negociador);
  const start = req.query.ingreso_desde == null ? null : calendarDate(req.query.ingreso_desde);
  const end = req.query.ingreso_hasta == null ? null : calendarDate(req.query.ingreso_hasta);
  if (start && end && start > end) throw new InputError('El inicio de ingreso no puede superar el fin.');
  const page = req.query.pagina == null ? 1 : id(req.query.pagina);
  const search = req.query.buscar == null ? '' : requiredText(req.query.buscar, 100);
  const state = req.query.estado ?? 'todas';
  if (!['todas', 'pendientes', 'aceptadas', 'cerradas', 'archivadas', 'sin_evidencia'].some(value => value === state)) {
    throw new InputError('Filtro de estado inválido.');
  }
  const followUp = req.query.seguimiento ?? 'todos';
  if (!['todos', 'vencido', 'hoy', 'futuro', 'sin_programar'].some(value => value === followUp)) {
    throw new InputError('Filtro de seguimiento inválido.');
  }
  const pageSize = 25;
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT s.id_solicitud, s.id_persona, p.nombres, p.apellidos, sv.nombre AS servicio,
      CASE WHEN u.id_usuario IS NOT NULL THEN CONCAT(u.nombres, ' ', u.apellidos) END AS negociador,
      CONVERT(char(10), c.fecha_solicitud, 23) AS dia_ingreso,
      s.resultado_comercial_lead, s.archivada_lead_en, s.fecha_primera_respuesta,
      s.fecha_proximo_seguimiento, actividad.ultima_interaccion, seguimiento.estado_seguimiento,
      prioridad.prioridad_operativa
    FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME()) c
    JOIN dbo.Solicitudes s ON s.id_solicitud = c.id_solicitud
    JOIN dbo.Personas p ON p.id_persona = s.id_persona
    LEFT JOIN dbo.Servicios sv ON sv.id_servicio = s.id_servicio
    LEFT JOIN dbo.Usuarios u ON u.id_usuario = s.id_negociador
    OUTER APPLY (
      SELECT MAX(i.fecha_hora) AS ultima_interaccion
      FROM dbo.Interacciones i WHERE i.id_solicitud = s.id_solicitud AND i.id_persona = s.id_persona
    ) actividad
    CROSS APPLY (SELECT SYSUTCDATETIME() AS ahora_utc) reloj
    CROSS APPLY (SELECT CASE
      WHEN s.archivada_lead_en IS NOT NULL OR s.resultado_comercial_lead IN ('ACEPTADA', 'CERRADA_SIN_ACUERDO') THEN NULL
      WHEN s.fecha_proximo_seguimiento IS NULL THEN 'sin_programar'
      WHEN s.fecha_proximo_seguimiento < reloj.ahora_utc THEN 'vencido'
      WHEN CONVERT(date, DATEADD(hour, -5, s.fecha_proximo_seguimiento))
        = CONVERT(date, DATEADD(hour, -5, reloj.ahora_utc)) THEN 'hoy'
      ELSE 'futuro'
    END AS estado_seguimiento) seguimiento
    CROSS APPLY (SELECT CASE
      WHEN seguimiento.estado_seguimiento = 'vencido' THEN 1
      WHEN seguimiento.estado_seguimiento = 'hoy' THEN 2
      WHEN s.archivada_lead_en IS NULL AND s.resultado_comercial_lead = 'PENDIENTE'
        AND s.fecha_primera_respuesta IS NULL THEN 3
      ELSE 4
    END AS prioridad_operativa) prioridad
    WHERE 1 = 1
      ${personId === null ? Prisma.empty : Prisma.sql`AND s.id_persona = ${personId}`}
      ${service === null ? Prisma.empty : Prisma.sql`AND s.id_servicio = ${service}`}
      ${negotiator === null ? Prisma.empty : Prisma.sql`AND s.id_negociador = ${negotiator}`}
      ${start === null ? Prisma.empty : Prisma.sql`AND CONVERT(date, c.fecha_solicitud) >= CONVERT(date, ${start}, 23)`}
      ${end === null ? Prisma.empty : Prisma.sql`AND CONVERT(date, c.fecha_solicitud) <= CONVERT(date, ${end}, 23)`}
      ${followUp === 'todos' ? Prisma.empty : Prisma.sql`AND seguimiento.estado_seguimiento = ${followUp}`}
      ${search ? Prisma.sql`AND (CHARINDEX(${search}, CONCAT(p.nombres, ' ', p.apellidos)) > 0
        OR CONVERT(varchar(11), s.id_solicitud) = ${search})` : Prisma.empty}
      ${state === 'archivadas' ? Prisma.sql`AND s.archivada_lead_en IS NOT NULL` : Prisma.empty}
      ${state === 'pendientes' ? Prisma.sql`AND s.archivada_lead_en IS NULL AND s.resultado_comercial_lead = 'PENDIENTE'` : Prisma.empty}
      ${state === 'aceptadas' ? Prisma.sql`AND s.archivada_lead_en IS NULL AND s.resultado_comercial_lead = 'ACEPTADA'` : Prisma.empty}
      ${state === 'cerradas' ? Prisma.sql`AND s.archivada_lead_en IS NULL AND s.resultado_comercial_lead = 'CERRADA_SIN_ACUERDO'` : Prisma.empty}
      ${state === 'sin_evidencia' ? Prisma.sql`AND s.archivada_lead_en IS NULL AND s.resultado_comercial_lead IS NULL` : Prisma.empty}
    ORDER BY prioridad.prioridad_operativa,
      CASE WHEN prioridad.prioridad_operativa IN (1, 2) THEN s.fecha_proximo_seguimiento END,
      CASE WHEN prioridad.prioridad_operativa = 3 THEN c.fecha_solicitud END,
      c.fecha_solicitud DESC, s.id_solicitud DESC
    OFFSET ${BigInt(page - 1) * BigInt(pageSize)} ROWS FETCH NEXT ${pageSize + 1} ROWS ONLY
  `);
  res.json({ oportunidades: rows.slice(0, pageSize), hay_siguiente: rows.length > pageSize });
}));

router.get('/opportunity-filters', route(async (_req, res) => {
  const [servicios, negociadores, canales] = await Promise.all([
    prisma.servicios.findMany({ select: { id_servicio: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.$queryRaw`
      SELECT u.id_usuario, CONCAT(u.nombres, ' ', u.apellidos) AS nombre
      FROM dbo.Usuarios u
      WHERE EXISTS (SELECT 1 FROM dbo.Solicitudes s WHERE s.id_negociador = u.id_usuario)
      ORDER BY nombre, u.id_usuario
    `,
    prisma.canales.findMany({ where: { activo: true }, select: { id_canal: true, nombre: true }, orderBy: { nombre: 'asc' } }),
  ]);
  res.json({ servicios, negociadores, canales });
}));

router.post('/opportunities', route(async (req, res) => {
  const body = req.body;
  const result = await prisma.$transaction(async tx => {
    const id_persona = id(body.id_persona);
    const person = await tx.personas.findFirst({ where: { id_persona, Etapa: { nombre: 'LEAD' } } });
    if (!person) throw new InputError('La persona debe ingresar a LEAD por el flujo de conversión.', 409);
    return tx.solicitudes.create({
      data: {
        id_persona, id_servicio: id(body.id_servicio), id_canal_origen: optionalId(body.id_canal_origen),
        id_negociador: optionalId(body.id_negociador), id_sede_interes_lead: optionalId(body.id_sede_interes_lead),
        fecha_ingreso_lead: new Date(), resultado_comercial_lead: 'PENDIENTE',
      },
    });
  }, serializable);
  res.status(201).json(result);
}));

router.get('/opportunities/:id', route(async (req, res) => {
  const data = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, false);
    const id_solicitud = row.id_solicitud;
    const [propuestas, alternativas, comunicaciones, preferencias] = await Promise.all([
      tx.$queryRaw`
        SELECT p.*, COALESCE(p.id_propuesta_raiz, p.id_propuesta) AS id_propuesta_logica,
          NULLIF(LTRIM(RTRIM(p.promocion_aplicada)), '') AS promocion_registrada,
          pr.nombre AS promocion_catalogo, m.motivo AS motivo_rechazo, m.categoria AS categoria_rechazo,
          s.nombre AS sede,
          CAST(ROW_NUMBER() OVER (
            PARTITION BY COALESCE(p.id_propuesta_raiz, p.id_propuesta)
            ORDER BY p.numero_version DESC, p.id_propuesta DESC
          ) AS int) AS orden_version
        FROM dbo.PropuestasEconomicasLead p
        LEFT JOIN dbo.PromocionesLead pr ON pr.id_promocion = p.id_promocion_lead
        LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo = p.id_motivo_rechazo_lead
          AND m.ambito = 'PROPUESTA' AND p.estado = 'Rechazada'
        LEFT JOIN dbo.Sedes s ON s.id_sede = p.id_sede_lead
        WHERE p.id_solicitud = ${id_solicitud}
        ORDER BY id_propuesta_logica, orden_version
      `,
      tx.opciones.findMany({ where: { id_solicitud }, include: { Disponibilidad: true, _count: { select: { Reservas: true } } } }),
      req.query.incluir_interacciones === 'false' ? [] : tx.interacciones.findMany({
        where: { id_solicitud, id_persona: row.id_persona },
        orderBy: [{ fecha_hora: 'asc' }, { id_interaccion: 'asc' }],
      }),
      tx.personaPreferencias.findMany({
        where: { id_persona: row.id_persona },
        include: { Horario: true, ServicioInteres: { select: { nombre: true } } },
        orderBy: [{ fecha_inicio: 'desc' }, { id_preferencia: 'desc' }],
      }),
    ]);
    const modificaciones = await tx.cambiosOpcionLead.findMany({
      where: { id_opcion: { in: alternativas.map(option => option.id_opcion) } },
      orderBy: { id_cambio: 'asc' },
    });
    const [cabecera] = await tx.$queryRaw<{ paciente: string; servicio: string | null; negociador: string | null }[]>`
      SELECT CONCAT(p.nombres, ' ', p.apellidos) AS paciente, sv.nombre AS servicio,
        CASE WHEN u.id_usuario IS NOT NULL THEN CONCAT(u.nombres, ' ', u.apellidos) END AS negociador
      FROM dbo.Solicitudes s
      JOIN dbo.Personas p ON p.id_persona = s.id_persona
      LEFT JOIN dbo.Servicios sv ON sv.id_servicio = s.id_servicio
      LEFT JOIN dbo.Usuarios u ON u.id_usuario = s.id_negociador
      WHERE s.id_solicitud = ${id_solicitud}
    `;
    const condiciones_ofrecidas = await tx.$queryRaw`
      SELECT o.id_opcion, CONVERT(varchar(20), h.id_historial) AS revision,
        inicial.accion AS origen, CONVERT(char(10), h.fecha_disponibilidad, 23) AS dia,
        CONVERT(char(5), h.hora_inicio, 108) AS inicio, CONVERT(char(5), h.hora_fin, 108) AS fin,
        COALESCE(s.nombre, CONCAT('Sede #', h.id_sede)) AS sede,
        CASE WHEN p.id_profesional IS NULL THEN CONCAT('Profesional #', h.id_profesional)
          ELSE CONCAT(p.nombres, ' ', p.apellidos) END AS profesional,
        CONVERT(varchar(32), h.precio_ofrecido) AS precio,
        CONVERT(char(10), h.pref_fecha_lead, 23) AS dia_preferido,
        h.pref_dia_semana_lead AS dia_semana_preferido,
        CONVERT(char(5), h.pref_hora_inicio_lead, 108) AS inicio_preferido,
        CONVERT(char(5), h.pref_hora_fin_lead, 108) AS fin_preferido,
        h.pref_turno_lead AS turno_preferido, h.ofr_turno_lead AS turno_ofrecido,
        m.motivo AS motivo_rechazo, m.categoria AS categoria_rechazo,
        CONVERT(char(10), inicial.fecha_disponibilidad, 23) AS dia_inicial,
        CONVERT(char(5), inicial.hora_inicio, 108) AS inicio_inicial,
        CONVERT(char(5), inicial.hora_fin, 108) AS fin_inicial,
        COALESCE(si.nombre, CONCAT('Sede #', inicial.id_sede)) AS sede_inicial,
        CASE WHEN pi.id_profesional IS NULL THEN CONCAT('Profesional #', inicial.id_profesional)
          ELSE CONCAT(pi.nombres, ' ', pi.apellidos) END AS profesional_inicial,
        CONVERT(varchar(32), inicial.precio_ofrecido) AS precio_inicial
      FROM dbo.Opciones o
      CROSS APPLY (
        SELECT TOP (1) h.* FROM dbo.HistorialOpcionesLead h
        WHERE h.id_opcion = o.id_opcion AND h.id_solicitud = o.id_solicitud
        ORDER BY h.fecha_observacion_utc DESC, h.id_historial DESC
      ) h
      CROSS APPLY (
        SELECT TOP (1) hi.* FROM dbo.HistorialOpcionesLead hi
        WHERE hi.id_opcion = o.id_opcion AND hi.id_solicitud = o.id_solicitud
        ORDER BY hi.fecha_observacion_utc, hi.id_historial
      ) inicial
      LEFT JOIN dbo.Sedes s ON s.id_sede = h.id_sede
      LEFT JOIN dbo.Profesionales p ON p.id_profesional = h.id_profesional
      LEFT JOIN dbo.Sedes si ON si.id_sede = inicial.id_sede
      LEFT JOIN dbo.Profesionales pi ON pi.id_profesional = inicial.id_profesional
      LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo = h.id_motivo_rechazo_lead
        AND m.ambito = 'ALTERNATIVA' AND h.estado_respuesta = 'Rechazada'
      WHERE o.id_solicitud = ${id_solicitud} AND h.accion <> 'DELETE'
    `;
    const tarifa_referencia = row.id_servicio == null ? [] : await tx.$queryRaw<{
      id_tarifa: number; precio: Prisma.Decimal; fecha_inicio: Date; fecha_fin: Date | null;
    }[]>`
      SELECT TOP (1) t.id_tarifa, t.precio, t.fecha_inicio, t.fecha_fin
      FROM dbo.Tarifas t
      JOIN dbo.Servicios s ON s.id_servicio = t.id_servicio AND s.activo = 1
      WHERE t.id_servicio = ${row.id_servicio} AND t.activo = 1
        AND t.fecha_inicio <= SYSDATETIME()
        AND (t.fecha_fin IS NULL OR t.fecha_fin > SYSDATETIME())
      ORDER BY t.fecha_inicio DESC, t.id_tarifa DESC
    `;
    const promociones_disponibles = row.id_servicio == null ? [] : await tx.$queryRaw`
      SELECT p.id_promocion, p.nombre, p.tipo_promocion
      FROM dbo.PromocionesLead p
      JOIN dbo.Servicios s ON s.id_servicio = ${row.id_servicio} AND s.activo = 1
      WHERE p.activo = 1 AND (p.id_servicio IS NULL OR p.id_servicio = s.id_servicio)
      ORDER BY p.nombre, p.id_promocion
    `;
    return {
      oportunidad: row, cabecera, propuestas, alternativas, comunicaciones, preferencias, modificaciones, condiciones_ofrecidas,
      tarifa_referencia: tarifa_referencia[0] ?? null, promociones_disponibles,
    };
  }, serializable);
  res.json(data);
}));

router.get('/opportunities/:id/activity', route(async (req, res) => {
  const page = req.query.pagina == null ? 1 : id(req.query.pagina);
  const pageSize = 25;
  const rows = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, false);
    return tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT i.id_interaccion, i.tipo, i.mensaje, i.es_respuesta_util,
        MAX(i.id_interaccion) OVER () AS ultima_interaccion_id,
        CONVERT(char(10), i.fecha_hora, 23) AS dia_registrado,
        CONVERT(char(8), i.fecha_hora, 108) AS hora_registrada,
        c.nombre AS canal,
        CASE WHEN u.id_usuario IS NOT NULL THEN CONCAT(u.nombres, ' ', u.apellidos) END AS actor
      FROM dbo.Interacciones i
      LEFT JOIN dbo.Canales c ON c.id_canal = i.id_canal
      LEFT JOIN dbo.Usuarios u ON u.id_usuario = i.id_usuario
      WHERE i.id_solicitud = ${row.id_solicitud} AND i.id_persona = ${row.id_persona}
      ORDER BY i.fecha_hora DESC, i.id_interaccion DESC
      OFFSET ${BigInt(page - 1) * BigInt(pageSize)} ROWS FETCH NEXT 26 ROWS ONLY
    `);
  }, serializable);
  res.json({ interacciones: rows.slice(0, pageSize), hay_siguiente: rows.length > pageSize });
}));

router.get('/opportunities/:id/payer-readiness', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, false);
    const checks: { codigo: string; etiqueta: string; estado: 'cumple' | 'bloqueado' | 'pendiente'; detalle: string }[] = [];
    function check(codigo: string, etiqueta: string, ok: boolean, pass: string, fail: string) {
      checks.push({ codigo, etiqueta, estado: ok ? 'cumple' : 'bloqueado', detalle: ok ? pass : fail });
    }
    const person = await tx.personas.findUnique({
      where: { id_persona: row.id_persona }, select: { Etapa: { select: { nombre: true } } },
    });
    check('etapa', 'Solicitud y etapa', !row.archivada_lead_en && person?.Etapa?.nombre === 'LEAD',
      'La solicitud tiene ingreso acreditado y la persona está en LEAD.',
      row.archivada_lead_en ? 'La solicitud está archivada.' : 'La etapa actual de la persona no permite confirmar un nuevo traspaso desde LEAD.');

    const agreement = row.resultado_comercial_lead === 'ACEPTADA' && row.fecha_decision_comercial_lead != null &&
      row.valor_acordado_lead != null && row.id_propuesta_aceptada_lead != null;
    check('acuerdo', 'Acuerdo económico', agreement,
      'Hay un acuerdo registrado con importe, fecha y versión vinculada.',
      'Falta un acuerdo comercial aceptado con importe, fecha y versión vinculada.');

    let proposal = null;
    if (agreement) {
      try {
        const current = await currentProposal(tx, row.id_propuesta_aceptada_lead!, row.id_solicitud);
        proposal = current.proposal;
      } catch (error) {
        if (!(error instanceof InputError) || ![404, 409].includes(error.status)) throw error;
      }
    }
    const validProposal = proposal != null && proposal.estado === 'Aceptada' && proposal.fecha_decision != null &&
      proposal.id_servicio === row.id_servicio && proposal.precio_cotizado.equals(row.valor_acordado_lead!);
    check('propuesta', 'Versión aceptada', validProposal,
      'La versión vigente está aceptada y coincide con el servicio y el importe del acuerdo.',
      'No se comprobó una versión vigente aceptada de esta solicitud que coincida con el acuerdo.');

    const selected = await tx.opciones.findMany({
      where: { id_solicitud: row.id_solicitud, seleccionada: true, archivada_lead_en: null },
      take: 2,
    });
    const option = selected.length === 1 ? selected[0] : null;
    const validOption = option != null && option.estado_respuesta === 'Aceptada' && option.fecha_respuesta != null;
    check('opcion', 'Alternativa seleccionada', validOption,
      'Hay una alternativa única, seleccionada y con respuesta aceptada registrada.',
      selected.length > 1 ? 'Hay más de una alternativa seleccionada. Hace falta resolver cuál corresponde al traspaso.' :
        'Falta una alternativa seleccionada con aceptación y fecha registradas.');

    const coherent = validOption && validProposal && option.id_propuesta_lead === proposal!.id_propuesta &&
      option.precio_ofrecido.equals(proposal!.precio_cotizado);
    check('condiciones', 'Condiciones del acuerdo', coherent,
      'La alternativa está vinculada a la versión aceptada y su importe coincide.',
      'No se comprobó el vínculo y la coincidencia de importe entre la alternativa y la versión aceptada.');

    const [slot] = !validOption || row.id_servicio == null ? [] : await tx.$queryRaw<{ elegible: number }[]>`
      SELECT 1 AS elegible
      FROM dbo.Disponibilidad d
      JOIN dbo.Sedes s ON s.id_sede = d.id_sede AND s.activo = 1
      JOIN dbo.Profesionales p ON p.id_profesional = d.id_profesional AND p.activo = 1
      JOIN dbo.ProfesionalServicio ps ON ps.id_profesional = p.id_profesional AND ps.id_servicio = ${row.id_servicio}
      JOIN dbo.Servicios sv ON sv.id_servicio = ps.id_servicio AND sv.activo = 1
      CROSS APPLY (
        SELECT TOP (1) h.* FROM dbo.HistorialOpcionesLead h
        WHERE h.id_opcion = ${option.id_opcion} AND h.id_solicitud = ${row.id_solicitud}
        ORDER BY h.fecha_observacion_utc DESC, h.id_historial DESC
      ) h
      CROSS APPLY (SELECT DATEADD(hour, -5, SYSUTCDATETIME()) AS ahora_lima) reloj
      WHERE d.id_disponibilidad = ${option.id_disponibilidad} AND d.estado = 'Disponible'
        AND h.accion <> 'DELETE' AND h.id_disponibilidad = d.id_disponibilidad
        AND h.id_sede = d.id_sede AND h.id_profesional = d.id_profesional
        AND h.fecha_disponibilidad = d.fecha AND h.hora_inicio = d.hora_inicio AND h.hora_fin = d.hora_fin
        AND (d.fecha > CONVERT(date, reloj.ahora_lima)
          OR (d.fecha = CONVERT(date, reloj.ahora_lima) AND d.hora_inicio > CONVERT(time, reloj.ahora_lima)))
        AND NOT EXISTS (
          SELECT 1 FROM dbo.Reservas r JOIN dbo.Opciones o ON o.id_opcion = r.id_opcion
          WHERE o.id_disponibilidad = d.id_disponibilidad AND r.estado NOT IN ('Cancelada', 'Vencida')
        )
    `;
    check('agenda', 'Disponibilidad vigente', slot != null,
      'El horario ofrecido coincide con la agenda actual y sigue disponible y elegible.',
      'No se comprobó un horario futuro, elegible, libre y coincidente con la oferta auditada.');

    checks.push({ codigo: 'autorizacion', etiqueta: 'Autorización previa de reserva', estado: 'pendiente',
      detalle: 'El esquema actual no permite verificar una autorización previa vinculada a esta solicitud y alternativa.' });

    const reservations = await tx.reservas.findMany({
      where: { OR: [{ id_solicitud: row.id_solicitud }, { Opcion: { id_solicitud: row.id_solicitud } }] },
      select: { id_reserva: true, id_persona: true, id_solicitud: true, Opcion: { select: { id_solicitud: true } } },
    });
    const [event] = await tx.$queryRaw<{ existente: number }[]>`
      SELECT TOP (1) 1 AS existente FROM dbo.EventosEtapa e
      JOIN dbo.Etapas t ON t.id_etapa = e.etapa_destino AND t.nombre = 'PAYER'
      WHERE e.id_solicitud = ${row.id_solicitud}
    `;
    const inconsistent = reservations.some(reservation => reservation.id_persona !== row.id_persona ||
      reservation.id_solicitud !== row.id_solicitud || reservation.Opcion.id_solicitud !== row.id_solicitud);
    check('traspaso_previo', 'Reserva o traspaso previo', reservations.length === 0 && !event,
      'No hay reserva ni evento PAYER vinculados a esta solicitud.',
      inconsistent ? 'Hay una reserva con referencias inconsistentes. Requiere revisión.' :
        'Ya existe una reserva o un evento PAYER para esta solicitud. Requiere revisar ese flujo antes de reintentar.');

    return { estado: checks.every(item => item.estado === 'cumple') ? 'preparado' : 'bloqueado', requisitos: checks };
  }, serializable);
  res.json(result);
}));

router.get('/opportunities/:id/availability', route(async (req, res) => {
  const day = calendarDate(req.query.fecha, 'La fecha de atención');
  const site = optionalId(req.query.id_sede);
  const professional = optionalId(req.query.id_profesional);
  const page = req.query.pagina == null ? 1 : id(req.query.pagina);
  const rows = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    if (row.id_servicio == null) throw new InputError('Registra un servicio antes de buscar horarios.');
    return tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT d.id_disponibilidad, d.id_sede, d.id_profesional, CONVERT(char(10), d.fecha, 23) AS dia,
        CONVERT(char(5), d.hora_inicio, 108) AS inicio, CONVERT(char(5), d.hora_fin, 108) AS fin,
        CONVERT(varchar(16), CAST(d.hora_inicio AS time(7))) AS inicio_exacto,
        CONVERT(varchar(16), CAST(d.hora_fin AS time(7))) AS fin_exacto,
        s.nombre AS sede, CONCAT(p.nombres, ' ', p.apellidos) AS profesional
      FROM dbo.Disponibilidad d
      JOIN dbo.Sedes s ON s.id_sede = d.id_sede AND s.activo = 1
      JOIN dbo.Profesionales p ON p.id_profesional = d.id_profesional AND p.activo = 1
      JOIN dbo.ProfesionalServicio ps ON ps.id_profesional = d.id_profesional AND ps.id_servicio = ${row.id_servicio}
      JOIN dbo.Servicios sv ON sv.id_servicio = ps.id_servicio AND sv.activo = 1
      CROSS APPLY (SELECT DATEADD(hour, -5, SYSUTCDATETIME()) AS ahora_lima) reloj
      WHERE d.estado = 'Disponible' AND d.fecha = CONVERT(date, ${day}, 23)
        AND (d.fecha > CONVERT(date, reloj.ahora_lima)
          OR (d.fecha = CONVERT(date, reloj.ahora_lima) AND d.hora_inicio > CONVERT(time, reloj.ahora_lima)))
        AND NOT EXISTS (SELECT 1 FROM dbo.Reservas r JOIN dbo.Opciones o ON o.id_opcion=r.id_opcion
          WHERE o.id_disponibilidad=d.id_disponibilidad AND r.estado NOT IN ('Cancelada','Vencida'))
        ${site === null ? Prisma.empty : Prisma.sql`AND d.id_sede = ${site}`}
        ${professional === null ? Prisma.empty : Prisma.sql`AND d.id_profesional = ${professional}`}
      ORDER BY d.hora_inicio, d.id_disponibilidad
      OFFSET ${BigInt(page - 1) * 25n} ROWS FETCH NEXT 26 ROWS ONLY
    `);
  }, serializable);
  res.json({ candidatas: rows.slice(0, 25), hay_siguiente: rows.length > 25 });
}));

function offerSlot(body: Request['body']) {
  const { inicio_exacto: inicio, fin_exacto: fin } = body ?? {};
  if (![inicio, fin].every(value => typeof value === 'string' &&
      /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{7}$/.test(value))) {
    throw new InputError('Indica el horario consultado en la agenda.');
  }
  return { slotId: id(body.id_disponibilidad), siteId: id(body.id_sede),
    professionalId: id(body.id_profesional), day: calendarDate(body.dia, 'La fecha de atención'), inicio, fin };
}

async function verifyOfferSlot(tx: Prisma.TransactionClient, serviceId: number | null, slotRef: ReturnType<typeof offerSlot>) {
  const { slotId, siteId, professionalId, day } = slotRef;
  if (serviceId == null) throw new InputError('La solicitud necesita un servicio.');
  const [slot] = await tx.$queryRaw<{ id_disponibilidad: number }[]>`
    SELECT d.id_disponibilidad FROM dbo.Disponibilidad d
    JOIN dbo.Sedes s ON s.id_sede = d.id_sede AND s.activo = 1
    JOIN dbo.Profesionales p ON p.id_profesional = d.id_profesional AND p.activo = 1
    JOIN dbo.ProfesionalServicio ps ON ps.id_profesional = p.id_profesional AND ps.id_servicio = ${serviceId}
    JOIN dbo.Servicios sv ON sv.id_servicio = ps.id_servicio AND sv.activo = 1
    CROSS APPLY (SELECT DATEADD(hour, -5, SYSUTCDATETIME()) AS ahora_lima) reloj
    WHERE d.id_disponibilidad = ${slotId} AND d.estado = 'Disponible'
      AND d.id_sede = ${siteId} AND d.id_profesional = ${professionalId}
      AND d.fecha = CONVERT(date, ${day}, 23)
      AND d.hora_inicio = CONVERT(time(7), ${slotRef.inicio})
      AND d.hora_fin = CONVERT(time(7), ${slotRef.fin})
      AND (d.fecha > CONVERT(date, reloj.ahora_lima)
        OR (d.fecha = CONVERT(date, reloj.ahora_lima) AND d.hora_inicio > CONVERT(time, reloj.ahora_lima)))
      AND NOT EXISTS (SELECT 1 FROM dbo.Reservas r JOIN dbo.Opciones o ON o.id_opcion=r.id_opcion
        WHERE o.id_disponibilidad=d.id_disponibilidad AND r.estado NOT IN ('Cancelada','Vencida'))
  `;
  if (!slot) throw new InputError('El horario cambió o dejó de estar disponible. Consulta la agenda nuevamente.', 409);
}

router.post('/opportunities/:id/alternatives', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const body = req.body;
  const slotRef = offerSlot(body);
  const { slotId, siteId, professionalId, day } = slotRef;
  const quotedPrice = price(body.precio_ofrecido);
  const shift = requiredText(body.turno_ofrecido, 30);
  const preferredShift = body.turno_preferido == null ? null : requiredText(body.turno_preferido, 30);
  const proposalId = optionalId(body.id_propuesta);
  const preferenceId = optionalId(body.id_preferencia);
  if (!Array.isArray(body.opciones_esperadas) || body.opciones_esperadas.length > 5000) {
    throw new InputError('Actualiza el detalle antes de registrar una oferta.');
  }
  const expected = new Set<number>(body.opciones_esperadas.map(id));
  if (expected.size !== body.opciones_esperadas.length) throw new InputError('La referencia de alternativas contiene duplicados.');
  const result = await prisma.$transaction(async tx => {
    const { row } = await staffOpportunity(tx, req);
    if (row.archivada_lead_en || ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) {
      throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
    }
    const options = await tx.opciones.findMany({ where: { id_solicitud: row.id_solicitud } });
    const extra = options.filter(option => !expected.has(option.id_opcion));
    const missing = options.length - extra.length !== expected.size;
    if (missing || extra.length) {
      const replay = extra.length === 1 ? extra[0] : null;
      if (!missing && replay && !replay.archivada_lead_en && replay.estado_respuesta === 'Pendiente' &&
          replay.id_disponibilidad === slotId && replay.precio_ofrecido.equals(quotedPrice) &&
          replay.id_propuesta_lead === proposalId && replay.id_preferencia_lead === preferenceId &&
          replay.ofr_turno_lead === shift && replay.pref_turno_lead === preferredShift) {
        const [original] = await tx.$queryRaw<{ coincide: number }[]>`
          SELECT 1 AS coincide FROM dbo.HistorialOpcionesLead h
          WHERE h.id_opcion = ${replay.id_opcion} AND h.accion = 'INSERT'
            AND h.id_disponibilidad = ${slotId} AND h.id_sede = ${siteId} AND h.id_profesional = ${professionalId}
            AND h.fecha_disponibilidad = CONVERT(date, ${day}, 23)
            AND h.hora_inicio = CONVERT(time(7), ${body.inicio_exacto})
            AND h.hora_fin = CONVERT(time(7), ${body.fin_exacto})
        `;
        if (original) return { alternativa: replay, reutilizada: true };
      }
      throw new InputError('Cambió el conjunto de alternativas. Revisa el detalle antes de confirmar.', 409);
    }
    await verifyOfferSlot(tx, row.id_servicio, slotRef);
    if (proposalId) {
      const { proposal } = await currentProposal(tx, proposalId, row.id_solicitud);
      if (proposal.estado === 'Rechazada' || !proposal.precio_cotizado.equals(quotedPrice)) {
        throw new InputError('La versión vigente y su importe deben corresponder a la oferta.', 409);
      }
    }
    const now = new Date();
    const preference = preferenceId == null ? null : await tx.personaPreferencias.findFirst({
      where: { id_preferencia: preferenceId, id_persona: row.id_persona, fecha_inicio: { lte: now },
        OR: [{ fecha_fin: null }, { fecha_fin: { gt: now } }] },
      include: { Horario: true },
    });
    if (preferenceId && !preference) throw new InputError('La preferencia no corresponde al paciente o ya finalizó.', 409);
    // Reportes LEAD usa lunes=1 a domingo=7. Conservar el valor almacenado sin inferirlo.
    const preferredDay = preference?.Horario?.dia_semana;
    if (preferredDay != null && (preferredDay < 1 || preferredDay > 7)) {
      throw new InputError('El día de la preferencia requiere revisión antes de ofrecerlo.', 409);
    }
    const alternativa = await tx.opciones.create({ data: {
      id_solicitud: row.id_solicitud, id_disponibilidad: slotId, precio_ofrecido: quotedPrice,
      estado_respuesta: 'Pendiente', seleccionada: false, id_propuesta_lead: proposalId,
      id_preferencia_lead: preferenceId, ofr_turno_lead: shift, pref_turno_lead: preferredShift,
      pref_dia_semana_lead: preferredDay, pref_hora_inicio_lead: preference?.Horario?.hora_inicio,
      pref_hora_fin_lead: preference?.Horario?.hora_fin,
    } });
    return { alternativa, reutilizada: false };
  }, serializable);
  res.status(result.reutilizada ? 200 : 201).json(result);
}));

router.patch('/opportunities/:id/alternatives/:option', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const body = req.body;
  const action = body?.accion;
  const revision = body?.revision;
  if (!['modificar', 'decidir', 'archivar'].includes(action) || typeof revision !== 'string' ||
      !/^[1-9]\d{0,18}$/.test(revision)) throw new InputError('Indica la acción y la revisión consultada.');
  const optionId = id(req.params.option);
  const result = await prisma.$transaction(async tx => {
    const { row } = await staffOpportunity(tx, req);
    if (row.archivada_lead_en || ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) {
      throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
    }
    const option = await tx.opciones.findFirst({
      where: { id_solicitud: row.id_solicitud, id_opcion: optionId },
      include: { _count: { select: { Reservas: true } } },
    });
    if (!option) throw new InputError('La alternativa no corresponde a esta solicitud.', 404);
    if (option.archivada_lead_en || option._count.Reservas > 0) {
      throw new InputError('La alternativa está archivada o tiene una reserva vinculada.', 409);
    }
    const [audit] = await tx.$queryRaw<{ revision: string }[]>`
      SELECT TOP (1) CONVERT(varchar(20), id_historial) AS revision
      FROM dbo.HistorialOpcionesLead WHERE id_opcion = ${optionId} AND id_solicitud = ${row.id_solicitud}
      ORDER BY fecha_observacion_utc DESC, id_historial DESC
    `;
    if (audit?.revision !== revision) throw new InputError('La alternativa cambió o carece de historial. Actualiza el detalle.', 409);
    const where = { id_opcion: optionId };
    if (action === 'archivar') {
      if (option.seleccionada || option.estado_respuesta === 'Aceptada') {
        throw new InputError('Una alternativa aceptada o seleccionada no se puede archivar.', 409);
      }
      return tx.opciones.update({ where, data: { archivada_lead_en: new Date() } });
    }
    if (option.estado_respuesta !== 'Pendiente' || option.seleccionada) {
      throw new InputError('La alternativa ya no está pendiente.', 409);
    }
    if (action === 'decidir') {
      const outcome = await decision(tx, body, 'ALTERNATIVA');
      return tx.opciones.update({ where, data: {
        estado_respuesta: outcome.state, fecha_respuesta: outcome.date,
        id_motivo_rechazo_lead: outcome.reason, seleccionada: outcome.state === 'Aceptada',
      } });
    }
    const slot = offerSlot(body);
    const shift = requiredText(body.turno_ofrecido, 30);
    const reason = requiredText(body.motivo_cambio, 300);
    await verifyOfferSlot(tx, row.id_servicio, slot);
    if (option.id_disponibilidad === slot.slotId && option.ofr_turno_lead === shift) {
      throw new InputError('No hay cambios en el horario o el turno.', 400);
    }
    const previous = await tx.cambiosOpcionLead.findFirst({ where, orderBy: { id_cambio: 'desc' } });
    const updated = await tx.opciones.update({ where, data: {
      id_disponibilidad: slot.slotId, ofr_turno_lead: shift,
    } });
    const auditChange = await tx.cambiosOpcionLead.updateMany({
      where: { ...where, id_cambio: { gt: previous?.id_cambio ?? 0 } },
      data: { motivo_cambio: reason },
    });
    if (auditChange.count !== 1) throw new InputError('No se pudo verificar el historial del cambio.', 409);
    return updated;
  }, serializable);
  res.json(result);
}));

router.post('/opportunities/:id/staff/interactions', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const body = req.body;
  const type = body?.tipo;
  if (!['Nota de contacto', 'Respuesta del paciente'].includes(type)) throw new InputError('Selecciona un tipo de interacción.');
  const channel = id(body.id_canal);
  const message = requiredText(body.mensaje, 4000);
  const expected = body.ultima_interaccion_esperada === null ? null : id(body.ultima_interaccion_esperada);
  const useful = body.es_respuesta_util === true;
  if (useful && type !== 'Respuesta del paciente') throw new InputError('Solo una respuesta del paciente puede marcarse como útil.');
  const result = await prisma.$transaction(async tx => {
    const { row, user } = await staffOpportunity(tx, req);
    if (row.archivada_lead_en || ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) {
      throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
    }
    const scope = { id_solicitud: row.id_solicitud, id_persona: row.id_persona };
    const [latest, previous] = await tx.interacciones.findMany({
      where: scope, orderBy: { id_interaccion: 'desc' }, take: 2,
    });
    if ((latest?.id_interaccion ?? null) !== expected) {
      if (latest && (previous?.id_interaccion ?? null) === expected && latest.id_usuario === user.id_usuario &&
          latest.id_canal === channel && latest.tipo === type && latest.mensaje === message && latest.es_respuesta_util === useful) {
        return { interaccion: latest, reutilizada: true };
      }
      throw new InputError('La bitácora cambió. Revisa la última interacción antes de guardar.', 409);
    }
    if (!await tx.canales.findFirst({ where: { id_canal: channel, activo: true }, select: { id_canal: true } })) {
      throw new InputError('Selecciona un canal activo.');
    }
    const interaccion = await tx.interacciones.create({ data: {
      ...scope, id_usuario: user.id_usuario, id_canal: channel, tipo: type, mensaje: message, es_respuesta_util: useful,
    } });
    if (useful && !row.fecha_primera_respuesta) {
      await tx.solicitudes.update({
        where: { id_solicitud: row.id_solicitud }, data: { fecha_primera_respuesta: interaccion.fecha_hora },
      });
    }
    return { interaccion, reutilizada: false };
  }, serializable);
  res.status(result.reutilizada ? 200 : 201).json(result);
}));

router.post('/opportunities/:id/interactions', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const useful = req.body.es_respuesta_util === true;
    const interaction = await tx.interacciones.create({
      data: {
        id_solicitud: row.id_solicitud, id_persona: row.id_persona, id_canal: id(req.body.id_canal),
        tipo: requiredText(req.body.tipo, 50), es_respuesta_util: useful,
        mensaje: req.body.mensaje == null ? null : requiredText(req.body.mensaje, 4000),
      },
    });
    if (useful && !row.fecha_primera_respuesta) {
      await tx.solicitudes.update({
        where: { id_solicitud: row.id_solicitud }, data: { fecha_primera_respuesta: interaction.fecha_hora },
      });
    }
    return interaction;
  }, serializable);
  res.status(201).json(result);
}));

router.get('/catalogs', route(async (_req, res) => {
  const [promociones, motivos] = await Promise.all([
    prisma.promocionesLead.findMany({ where: { activo: true } }),
    prisma.motivosRechazoLead.findMany({ where: { activo: true } }),
  ]);
  res.json({ promociones, motivos });
}));

router.get('/report-catalogs', route(async (_req, res) => {
  const [servicios, sedes, canales, fuentes, negociadores, promociones, motivos, audit, horarios] = await Promise.all([
    prisma.servicios.findMany({ select: { id_servicio: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.sedes.findMany({ select: { id_sede: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.canales.findMany({ select: { id_canal: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.fuentes.findMany({ select: { id_fuente: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.$queryRaw`SELECT DISTINCT u.id_usuario, CONCAT(u.nombres,' ',u.apellidos) AS nombre
      FROM dbo.Usuarios u JOIN dbo.HistorialSolicitudesLead h ON h.id_negociador=u.id_usuario
      ORDER BY nombre`,
    prisma.promocionesLead.findMany({ select: { id_promocion: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.motivosRechazoLead.findMany({ select: { id_motivo_rechazo: true, motivo: true, ambito: true }, orderBy: { motivo: 'asc' } }),
    prisma.$queryRaw<{ auditoria_desde_utc: Date }[]>`SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2'`,
    prisma.$queryRaw`SELECT DISTINCT h.id_profesional, CONCAT(p.nombres,' ',p.apellidos) AS profesional,
      h.pref_turno_lead, h.ofr_turno_lead FROM dbo.HistorialOpcionesLead h
      JOIN dbo.Profesionales p ON p.id_profesional=h.id_profesional`,
  ]);
  res.json({ servicios, sedes, canales, fuentes, negociadores, promociones, motivos, horarios,
    auditoria_desde_utc: audit[0]?.auditoria_desde_utc ?? null });
}));

router.post('/promotions', route(async (req, res) => {
  const result = await prisma.promocionesLead.create({ data: {
    nombre: requiredText(req.body.nombre, 150), tipo_promocion: requiredText(req.body.tipo_promocion, 80),
    id_servicio: optionalId(req.body.id_servicio),
  } });
  res.status(201).json(result);
}));

router.post('/rejection-reasons', route(async (req, res) => {
  const { ambito, categoria } = req.body;
  if (!(ambito === 'PROPUESTA' && ['ECONOMICO', 'OTROS'].includes(categoria)) &&
      !(ambito === 'ALTERNATIVA' && ['INCOMPATIBILIDAD', 'OTROS'].includes(categoria))) {
    throw new InputError('El ámbito y la categoría no son compatibles.');
  }
  const result = await prisma.motivosRechazoLead.create({ data: {
    codigo: requiredText(req.body.codigo, 60), motivo: requiredText(req.body.motivo, 160), ambito, categoria,
  } });
  res.status(201).json(result);
}));

async function currentProposal(tx: Prisma.TransactionClient, proposalId: number, requestId: number) {
  const proposal = await tx.propuestasEconomicasLead.findFirst({
    where: { id_propuesta: proposalId, id_solicitud: requestId },
  });
  if (!proposal) throw new InputError('La propuesta no corresponde a la oportunidad.', 404);
  const root = proposal.id_propuesta_raiz ?? proposal.id_propuesta;
  const latest = await tx.propuestasEconomicasLead.findFirst({
    where: { OR: [{ id_propuesta: root }, { id_propuesta_raiz: root }] },
    orderBy: { numero_version: 'desc' },
  });
  if (latest?.id_propuesta !== proposalId) throw new InputError('Usa la versión vigente de la propuesta.', 409);
  return { proposal, root };
}

router.post('/opportunities/:id/staff/proposals', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const body = req.body;
  if (body?.presentada !== true) throw new InputError('Confirma que la cotización fue presentada al paciente.');
  const quotedPrice = price(body.precio_cotizado);
  const previousId = optionalId(body.id_version_anterior);
  const promotionId = optionalId(body.id_promocion_lead);
  if (!Array.isArray(body.versiones_esperadas) || body.versiones_esperadas.length > 5000) {
    throw new InputError('Actualiza el detalle antes de registrar la cotización.');
  }
  const expected = new Set<number>(body.versiones_esperadas.map(id));
  if (expected.size !== body.versiones_esperadas.length || (previousId != null && !expected.has(previousId))) {
    throw new InputError('La referencia de versiones no corresponde a la cotización consultada.');
  }
  const result = await prisma.$transaction(async tx => {
    const { row } = await staffOpportunity(tx, req);
    if (row.archivada_lead_en || ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) {
      throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
    }
    if (row.id_servicio == null || !await tx.servicios.findFirst({
      where: { id_servicio: row.id_servicio, activo: true }, select: { id_servicio: true },
    })) throw new InputError('La oportunidad debe tener un tratamiento activo.');
    const versions = await tx.propuestasEconomicasLead.findMany({ where: { id_solicitud: row.id_solicitud } });
    const previous = previousId == null ? null : versions.find(version => version.id_propuesta === previousId);
    if (previousId != null && !previous) throw new InputError('La propuesta no corresponde a la oportunidad.', 404);
    const root = previous ? previous.id_propuesta_raiz ?? previous.id_propuesta : null;
    const number = (previous?.numero_version ?? 0) + 1;
    const extra = versions.filter(version => !expected.has(version.id_propuesta));
    const missing = versions.length - extra.length !== expected.size;
    if (missing || extra.length) {
      const replay = extra.length === 1 ? extra[0] : null;
      if (!missing && replay && replay.estado === 'Pendiente' && replay.id_servicio === row.id_servicio &&
          replay.id_propuesta_raiz === root && replay.numero_version === number &&
          replay.id_promocion_lead === promotionId && replay.id_sede_lead === (previous?.id_sede_lead ?? null) &&
          replay.precio_cotizado.equals(quotedPrice)) return { propuesta: replay, reutilizada: true };
      throw new InputError('Cambiaron las versiones de la solicitud. Actualiza el detalle antes de confirmar.', 409);
    }
    if (previous) {
      const { proposal } = await currentProposal(tx, previous.id_propuesta, row.id_solicitud);
      if (proposal.estado === 'Aceptada') throw new InputError('La versión vigente ya está aceptada.', 409);
    }
    const promotion = promotionId == null ? null : await tx.promocionesLead.findFirst({
      where: { id_promocion: promotionId, activo: true, OR: [{ id_servicio: null }, { id_servicio: row.id_servicio }] },
      select: { nombre: true },
    });
    if (promotionId != null && !promotion) throw new InputError('Promoción inactiva o incompatible con el tratamiento.');
    const propuesta = await tx.propuestasEconomicasLead.create({ data: {
      id_solicitud: row.id_solicitud, id_servicio: row.id_servicio,
      id_propuesta_raiz: root, numero_version: number, precio_cotizado: quotedPrice,
      id_promocion_lead: promotionId, promocion_aplicada: promotion?.nombre ?? null,
      id_sede_lead: previous?.id_sede_lead ?? null,
    } });
    return { propuesta, reutilizada: false };
  }, serializable);
  res.status(result.reutilizada ? 200 : 201).json(result);
}));

router.post('/opportunities/:id/proposals', route(async (req, res) => {
  const body = req.body;
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    if (row.id_servicio == null) throw new InputError('La oportunidad debe tener un tratamiento.');
    const prior = body.id_version_anterior == null ? null :
      await currentProposal(tx, id(body.id_version_anterior), row.id_solicitud);
    const promotion = optionalId(body.id_promocion_lead);
    if (promotion && !await tx.promocionesLead.findFirst({
      where: { id_promocion: promotion, activo: true, OR: [{ id_servicio: null }, { id_servicio: row.id_servicio }] },
    })) throw new InputError('Promoción inactiva o incompatible con el tratamiento.');
    return tx.propuestasEconomicasLead.create({ data: {
      id_solicitud: row.id_solicitud, id_servicio: row.id_servicio,
      id_propuesta_raiz: prior?.root ?? null, numero_version: (prior?.proposal.numero_version ?? 0) + 1,
      precio_cotizado: price(body.precio_cotizado), id_promocion_lead: promotion,
      id_sede_lead: optionalId(body.id_sede_lead),
    } });
  }, serializable);
  res.status(201).json(result);
}));

async function decision(tx: Prisma.TransactionClient, body: Request['body'], scope: string) {
  if (!['Aceptada', 'Rechazada'].includes(body.estado)) throw new InputError('Resultado de decisión inválido.');
  const reason = optionalId(body.id_motivo_rechazo_lead);
  if (body.estado === 'Rechazada') {
    if (!reason || !await tx.motivosRechazoLead.findFirst({
      where: { id_motivo_rechazo: reason, ambito: scope, activo: true },
    })) throw new InputError('Selecciona un motivo de rechazo vigente del ámbito correspondiente.');
  } else if (reason) throw new InputError('Un resultado aceptado no admite un motivo de rechazo.');
  return { state: body.estado as string, reason, date: new Date() };
}

router.post('/opportunities/:id/staff/proposals/:proposal/decision', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const result = await prisma.$transaction(async tx => {
    const { row } = await staffOpportunity(tx, req);
    if (row.archivada_lead_en || ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) {
      throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
    }
    if (req.body?.decision_explicita !== true) throw new InputError('Confirma la decisión comunicada por el paciente.');
    const { proposal } = await currentProposal(tx, id(req.params.proposal), row.id_solicitud);
    const reason = optionalId(req.body.id_motivo_rechazo_lead);
    if (proposal.estado !== 'Pendiente') {
      if (proposal.fecha_decision && proposal.estado === req.body.estado && proposal.id_motivo_rechazo_lead === reason) {
        return { propuesta: proposal, reutilizada: true };
      }
      throw new InputError('La versión ya tiene una decisión registrada.', 409);
    }
    const outcome = await decision(tx, req.body, 'PROPUESTA');
    const updated = await tx.propuestasEconomicasLead.update({
      where: { id_propuesta: proposal.id_propuesta },
      data: { estado: outcome.state, fecha_decision: outcome.date, id_motivo_rechazo_lead: outcome.reason },
    });
    return { propuesta: updated, reutilizada: false };
  }, serializable);
  res.json(result);
}));

router.post('/opportunities/:id/proposals/:proposal/decision', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const { proposal } = await currentProposal(tx, id(req.params.proposal), row.id_solicitud);
    if (proposal.estado !== 'Pendiente') throw new InputError('La versión ya tiene una decisión.', 409);
    const outcome = await decision(tx, req.body, 'PROPUESTA');
    return tx.propuestasEconomicasLead.update({
      where: { id_propuesta: proposal.id_propuesta },
      data: { estado: outcome.state, fecha_decision: outcome.date, id_motivo_rechazo_lead: outcome.reason },
    });
  }, serializable);
  res.json(result);
}));

router.post('/opportunities/:id/staff/outcome', route(async (req, res) => {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const body = req.body;
  const outcome = body?.resultado;
  if (body?.confirmado !== true || !['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(outcome)) {
    throw new InputError('Confirma el resultado comercial antes de guardarlo.');
  }
  const proposalId = outcome === 'ACEPTADA' ? id(body.id_propuesta) : null;
  const reason = outcome === 'CERRADA_SIN_ACUERDO' ? requiredText(body.motivo, 400) : null;
  const result = await prisma.$transaction(async tx => {
    const { row } = await staffOpportunity(tx, req);
    if (row.archivada_lead_en) throw new InputError('La oportunidad está archivada.', 409);
    if (['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) {
      if (row.resultado_comercial_lead === outcome && row.fecha_decision_comercial_lead &&
          row.id_propuesta_aceptada_lead === proposalId && row.motivo_cierre_lead === reason) {
        return { oportunidad: row, reutilizada: true };
      }
      throw new InputError('La solicitud ya tiene un resultado comercial registrado.', 409);
    }
    const now = new Date();
    let data: Prisma.SolicitudesUncheckedUpdateInput;
    if (proposalId != null) {
      const { proposal } = await currentProposal(tx, proposalId, row.id_solicitud);
      if (proposal.estado !== 'Aceptada' || !proposal.fecha_decision || proposal.id_servicio !== row.id_servicio) {
        throw new InputError('Selecciona una versión vigente aceptada del tratamiento de esta solicitud.', 409);
      }
      data = { resultado_comercial_lead: 'ACEPTADA', fecha_decision_comercial_lead: now,
        id_propuesta_aceptada_lead: proposal.id_propuesta, valor_acordado_lead: proposal.precio_cotizado, motivo_cierre_lead: null };
    } else {
      const reservation = await tx.reservas.findFirst({
        where: { OR: [{ id_solicitud: row.id_solicitud }, { Opcion: { id_solicitud: row.id_solicitud } }] },
        select: { id_reserva: true },
      });
      if (reservation) throw new InputError('Hay una reserva vinculada. Revisa ese flujo antes de cerrar la solicitud.', 409);
      data = { resultado_comercial_lead: 'CERRADA_SIN_ACUERDO', fecha_decision_comercial_lead: now,
        motivo_cierre_lead: reason, estado: 'Abandonada', fecha_cierre: now };
    }
    const oportunidad = await tx.solicitudes.update({ where: { id_solicitud: row.id_solicitud }, data });
    return { oportunidad, reutilizada: false };
  }, serializable);
  res.json(result);
}));

router.post('/opportunities/:id/outcome', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const now = new Date();
    const data: Prisma.SolicitudesUncheckedUpdateInput = { fecha_decision_comercial_lead: now };
    if (req.body.resultado === 'ACEPTADA' && req.body.aceptacion_expresa === true) {
      const { proposal } = await currentProposal(tx, id(req.body.id_propuesta), row.id_solicitud);
      if (proposal.estado !== 'Aceptada') throw new InputError('La propuesta vigente debe estar aceptada.');
      data.resultado_comercial_lead = 'ACEPTADA';
      data.id_propuesta_aceptada_lead = proposal.id_propuesta;
      data.valor_acordado_lead = proposal.precio_cotizado;
      data.motivo_cierre_lead = null;
    } else if (req.body.resultado === 'CERRADA_SIN_ACUERDO') {
      data.resultado_comercial_lead = 'CERRADA_SIN_ACUERDO';
      data.motivo_cierre_lead = requiredText(req.body.motivo, 400);
      data.estado = 'Abandonada';
      data.fecha_cierre = now;
    } else throw new InputError('Registra un cierre válido o confirma la aceptación comercial expresa.');
    return tx.solicitudes.update({ where: { id_solicitud: row.id_solicitud }, data });
  }, serializable);
  res.json(result);
}));

router.post('/opportunities/:id/alternatives/:option/decision', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const option = await tx.opciones.findFirst({
      where: {
        id_opcion: id(req.params.option), id_solicitud: row.id_solicitud, archivada_lead_en: null,
        Reservas: { none: {} }, OR: [{ estado_respuesta: null }, { estado_respuesta: 'Pendiente' }],
      },
    });
    if (!option) throw new InputError('La alternativa no admite una decisión.', 409);
    const outcome = await decision(tx, req.body, 'ALTERNATIVA');
    return tx.opciones.update({
      where: { id_opcion: option.id_opcion },
      data: {
        estado_respuesta: outcome.state, fecha_respuesta: outcome.date,
        seleccionada: outcome.state === 'Aceptada', id_motivo_rechazo_lead: outcome.reason,
      },
    });
  }, serializable);
  res.json(result);
}));

function calendarDate(value: unknown, label = 'La fecha del período') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError(label + ' debe usar YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InputError(label + ' no es válida.');
  }
  return value;
}

router.get('/reports/:report', route(async (req, res) => {
  const q = req.query;
  const start = calendarDate(q.inicio);
  const end = calendarDate(q.fin_exclusivo);
  const cutoff = q.corte_utc == null ? new Date() : new Date(requiredText(q.corte_utc, 32));
  if (start >= end || !Number.isFinite(cutoff.getTime()) || cutoff.getTime() > Date.now() ||
      (q.corte_utc != null && !String(q.corte_utc).endsWith('Z'))) {
    throw new InputError('Período o corte UTC inválido.');
  }
  const service = optionalId(q.id_servicio);
  const branch = optionalId(q.id_sede);
  const reason = optionalId(q.id_motivo);
  const scope = Prisma.sql`@periodo_inicio=${start}, @periodo_fin_exclusivo=${end},
    @corte_utc=${cutoff}, @id_servicio=${service}, @id_sede=${branch}`;
  const [audit] = await prisma.$queryRaw<{ auditoria_desde_utc: Date }[]>`
    SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2'
  `;
  if (!audit || cutoff < audit.auditoria_desde_utc) throw new InputError('El corte antecede al inicio de la auditoría.');
  let payload: unknown;
  const report = req.params.report;
  if (report === 'R1') {
    payload = await prisma.$queryRaw(Prisma.sql`EXEC dbo.usp_Lead_ReporteR1 ${scope},
      @id_canal=${optionalId(q.id_canal)}, @id_fuente=${optionalId(q.id_fuente)},
      @id_negociador=${optionalId(q.id_negociador)}, @desglosar_canal=${q.desglosar_canal === 'true'}`);
  } else if (report === 'R2' || report === 'R3') {
    const command = report === 'R2'
      ? Prisma.sql`EXEC dbo.usp_Lead_ReporteR2 ${scope}, @id_motivo=${reason},
          @id_promocion=${optionalId(q.id_promocion)}, @precio_min=${q.precio_min == null ? null : price(q.precio_min)},
          @precio_max=${q.precio_max == null ? null : price(q.precio_max)},
          @con_promocion=${q.con_promocion == null ? null : q.con_promocion === 'true'}`
      : Prisma.sql`EXEC dbo.usp_Lead_ReporteR3 ${scope}, @id_motivo=${reason},
          @id_profesional=${optionalId(q.id_profesional)}, @pref_dia=${optionalId(q.pref_dia)},
          @ofr_dia=${optionalId(q.ofr_dia)}, @pref_turno=${q.pref_turno == null ? null : requiredText(q.pref_turno, 30)},
          @ofr_turno=${q.ofr_turno == null ? null : requiredText(q.ofr_turno, 30)}`;
    const [detalle, resumen] = await prisma.$transaction([
      prisma.$queryRaw(Prisma.sql`${command}, @seccion='detalle'`),
      prisma.$queryRaw(Prisma.sql`${command}, @seccion='resumen'`),
    ], serializable);
    payload = { detalle, resumen };
  } else {
    throw new InputError('Reporte LEAD inexistente.', 404);
  }
  res.set('X-Lead-Cutoff-Utc', cutoff.toISOString());
  res.append('Access-Control-Expose-Headers', 'X-Lead-Cutoff-Utc');
  res.type('json').send(JSON.stringify(payload, (_, value) => typeof value === 'bigint' ? value.toString() : value));
}));
