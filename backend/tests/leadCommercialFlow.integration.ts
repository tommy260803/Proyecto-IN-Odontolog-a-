import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { prisma } from '../src/db';
import buyer from '../src/routes/buyer.routes';
import { leadCommercialRouter } from '../src/routes/leadCommercial.routes';
import { hashLeadStaffPassword } from '../src/services/leadStaffAuth';
import { MartSyncService } from '../src/services/martSyncService';

async function counts() {
  return prisma.$queryRaw`
    SELECT (SELECT COUNT_BIG(*) FROM dbo.Personas) personas,
      (SELECT COUNT_BIG(*) FROM dbo.CaptacionesBuyer) captaciones,
      (SELECT COUNT_BIG(*) FROM dbo.Solicitudes) solicitudes,
      (SELECT COUNT_BIG(*) FROM dbo.PropuestasEconomicasLead) propuestas,
      (SELECT COUNT_BIG(*) FROM dbo.Opciones) opciones,
      (SELECT COUNT_BIG(*) FROM dbo.Reservas) reservas,
      (SELECT COUNT_BIG(*) FROM dbo.EventosEtapa) eventos,
      (SELECT COUNT_BIG(*) FROM dbo.AutorizacionesReservaLead) autorizaciones,
      (SELECT COUNT_BIG(*) FROM dbo.Usuarios) usuarios,
      (SELECT COUNT_BIG(*) FROM dbo.HistorialSolicitudesLead) historial_solicitudes,
      (SELECT COUNT_BIG(*) FROM dbo.HistorialPropuestasLead) historial_propuestas,
      (SELECT COUNT_BIG(*) FROM dbo.HistorialOpcionesLead) historial_opciones
  `;
}

async function run() {
  const [target] = await prisma.$queryRaw<{ db: string }[]>`SELECT DB_NAME() AS db`;
  assert.equal(target.db, 'NexoSalud_LeadPruebas', 'Solo ejecutar en NexoSalud_LeadPruebas.');
  const [schema] = await prisma.$queryRaw<{ ready: boolean }[]>`
    SELECT CAST(CASE WHEN COL_LENGTH('dbo.AutorizacionesReservaLead','id_reserva') IS NOT NULL THEN 1 ELSE 0 END AS bit) ready
  `;
  assert.equal(schema.ready, true, 'Instalar primero los dos scripts de QA de autorización y traspaso.');
  const before = await counts();
  const original = {
    transaction: prisma.$transaction,
    query: prisma.$queryRaw,
    findUser: prisma.usuarios.findUnique,
    sync: MartSyncService.syncBuyer,
    enabled: process.env.LEAD_STAFF_AUTH_QA,
  };
  const app = express();
  app.use(express.json());
  app.use('/buyer', buyer);
  app.use('/lead', leadCommercialRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const email = 'qa-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const passwordHash = await hashLeadStaffPassword(password);
  const rollback = new Error('Reversión intencional del escenario QA');
  const completed: string[] = [];
  let requestId: number | undefined;
  let reservationId: number | undefined;

  async function call(path: string, status: number, method = 'GET', body?: object, token?: string) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    assert.equal(response.status, status, payload.error ?? path);
    return payload;
  }

  try {
    process.env.LEAD_STAFF_AUTH_QA = 'true';
    MartSyncService.syncBuyer = async () => undefined as never;
    try {
      await original.transaction.call(prisma, async tx => {
        // Mantener el escenario completo en una transacción QA permite revertir
        // también las escrituras ejecutadas mediante las rutas HTTP.
        prisma.$transaction = (async action => {
          if (typeof action !== 'function') throw new Error('Este ensayo requiere transacciones interactivas.');
          return action(tx);
        }) as typeof prisma.$transaction;
        prisma.$queryRaw = tx.$queryRaw.bind(tx);
        prisma.usuarios.findUnique = tx.usuarios.findUnique.bind(tx.usuarios);

        const service = await tx.servicios.findFirstOrThrow({ where: { activo: true } });
        const channel = await tx.canales.findFirstOrThrow({ where: { activo: true } });
        const source = await tx.fuentes.findFirstOrThrow({ where: { activo: true } });
        const role = await tx.roles.findFirstOrThrow({ where: { nombre: 'Negociador' } });
        const user = await tx.usuarios.create({ data: {
          nombres: 'Operador', apellidos: 'QA', email, password_hash: passwordHash, id_rol: role.id_rol,
        } });
        const registration = {
          firstName: 'Paciente QA', lastName: 'Flujo comercial', email: 'paciente-' + email,
          id_canal_origen: channel.id_canal, id_fuente: source.id_fuente, id_servicio: service.id_servicio,
          contactAuthorization: true, concreteRequest: 'Solicitud de prueba comercial',
        };
        const person = await call('/buyer', 201, 'POST', registration);
        assert.equal((await call('/buyer', 200, 'POST', registration)).id, person.id);
        const [capture] = await tx.$queryRaw<{ cantidad: number }[]>`
          SELECT COUNT(*) cantidad FROM dbo.CaptacionesBuyer WHERE id_persona=${person.id}
        `;
        assert.equal(capture.cantidad, 1);
        const conversion = await call('/buyer/' + person.id + '/convert', 200, 'POST', {});
        assert.equal((await call('/buyer/' + person.id + '/convert', 200, 'POST', {})).id_solicitud, conversion.id_solicitud);
        requestId = conversion.id_solicitud;
        assert.ok(requestId);
        completed.push('captación y conversión idempotentes');

        await tx.solicitudes.update({ where: { id_solicitud: requestId }, data: { id_negociador: user.id_usuario } });
        const login = await call('/lead/staff/session', 200, 'POST', { email, password });
        const token = login.token;
        const path = '/lead/opportunities/' + requestId;
        if (process.env.LEAD_CHAT_QA === 'true') {
          // The fixture is inside a rollback transaction; the intake procedure
          // requires a committed conversion, so seed its equivalent from the event.
          const inserted = await tx.$executeRaw`
            INSERT dbo.EntradasAgenteLead (id_solicitud, id_evento_etapa, id_captacion, id_persona)
            SELECT e.id_solicitud, e.id_evento_etapa, e.id_captacion, e.id_persona
            FROM dbo.EventosEtapa e WHERE e.id_solicitud = ${requestId}
              AND e.clave_operacion_buyer = CONCAT('BUYER_LEAD:', e.id_captacion)
          `;
          assert.equal(inserted, 1);
          const staffChat = '/lead/chat/staff/' + requestId;
          const patientChat = '/lead/chat/patient/' + requestId;
          await call(staffChat + '/access', 401, 'POST');
          const invite = (await call(staffChat + '/access', 201, 'POST', undefined, token)).token;
          await call('/lead/chat/patient/' + (Number(requestId) + 1), 401, 'GET', undefined, invite);
          const msg = { clave: randomUUID(), texto: 'Consulta desde el chat QA' };
          const posted = await call(patientChat, 200, 'POST', msg, invite);
          assert.deepEqual(await call(patientChat, 200, 'POST', msg, invite), posted);
          await call(patientChat, 409, 'POST', { ...msg, texto: 'Texto distinto' }, invite);
          assert.equal((await call(staffChat, 200, 'GET', undefined, token)).mensajes.length, 1);
          await call(staffChat, 200, 'PATCH', posted, token);
          assert.ok((await call(patientChat, 200, 'GET', undefined, invite)).mensajes[0].recibido_utc);
          const reply = await call(staffChat, 200, 'POST', { clave: randomUUID(), texto: 'Respuesta del equipo QA' }, token);
          const nextPage = await call(patientChat + '?desde=' + posted.id_mensaje, 200, 'GET', undefined, invite);
          assert.equal(nextPage.mensajes.length, 1);
          assert.equal(nextPage.mensajes[0].id_mensaje, reply.id_mensaje);
          const replacement = (await call(staffChat + '/access', 201, 'POST', undefined, token)).token;
          await call(patientChat, 401, 'GET', undefined, invite);
          assert.equal((await call(patientChat, 200, 'GET', undefined, replacement)).mensajes.length, 2);
          await tx.$executeRaw`
            UPDATE dbo.AccesosChatLead SET vence_utc = SYSUTCDATETIME()
            WHERE id_solicitud = ${requestId}
          `;
          await call(patientChat, 401, 'GET', undefined, replacement);
          completed.push('chat bidireccional, confirmación de recepción, reenvío, paginación y acceso limitado');
        }
        const note = { tipo: 'Respuesta del paciente', mensaje: 'Confirmó interés en la atención',
          id_canal: channel.id_canal, es_respuesta_util: true, ultima_interaccion_esperada: null };
        const interaction = await call(path + '/staff/interactions', 201, 'POST', note, token);
        assert.equal(interaction.interaccion.id_usuario, user.id_usuario);
        assert.equal((await call(path + '/staff/interactions', 200, 'POST', note, token)).interaccion.id_interaccion,
          interaction.interaccion.id_interaccion);
        completed.push('interacción con autor y reintento');

        const proposalBody = { presentada: true, precio_cotizado: '150.25', versiones_esperadas: [] };
        await call(path + '/staff/proposals', 401, 'POST', proposalBody);
        const proposal = (await call(path + '/staff/proposals', 201, 'POST', proposalBody, token)).propuesta;
        const staffQuotes = '/lead/chat/staff/' + requestId;
        const patientQuotes = '/lead/chat/patient/' + requestId;
        const chatToken = process.env.LEAD_CHAT_QA === 'true'
          ? (await call(staffQuotes + '/access', 201, 'POST', undefined, token)).token as string : null;
        if (chatToken) {
          const reviewPath = staffQuotes + '/review';
          const pause = { pausado: true, revision_esperada: null, motivo: 'Revisar las condiciones de la propuesta' };
          await call(reviewPath, 401, 'PATCH', pause);
          const paused = (await call(reviewPath, 200, 'PATCH', pause, token)).revision;
          await call(staffQuotes, 409, 'POST', { clave: randomUUID(), texto: 'Seguimiento durante pausa' }, token);
          await call(staffQuotes + '/proposals/' + proposal.id_propuesta, 409, 'POST', undefined, token);
          await call(patientQuotes, 200, 'POST', { clave: randomUUID(), texto: 'Sigo disponible' }, chatToken);
          await call(reviewPath, 409, 'PATCH', { ...pause, pausado: false }, token);
          const resumed = (await call(reviewPath, 200, 'PATCH', {
            pausado: false, revision_esperada: paused.id_revision, motivo: 'Condiciones verificadas',
          }, token)).revision;
          assert.equal(resumed.pausado, false);
          const [audit] = await tx.$queryRaw<{ total: number }[]>`
            SELECT COUNT(*) AS total FROM dbo.RevisionesChatLead
            WHERE id_solicitud = ${requestId} AND id_usuario = ${user.id_usuario}
          `;
          assert.equal(audit.total, 2);
          completed.push('pausa y reanudación auditadas con bloqueo de salida y revisión vigente');
          await call(staffQuotes + '/proposals/' + proposal.id_propuesta, 200, 'POST', undefined, token);
          await call(patientQuotes, 200, 'POST', { clave: randomUUID(), texto: 'Sí, pero me parece caro' }, chatToken);
          const shown = (await call(patientQuotes + '/proposals', 200, 'GET', undefined, chatToken)).propuestas;
          assert.equal(shown[0].estado, 'Pendiente');
        }
        const revisionBody = { ...proposalBody, precio_cotizado: '125.50', versiones_esperadas: [proposal.id_propuesta],
          id_version_anterior: proposal.id_propuesta };
        const current = (await call(path + '/staff/proposals', 201, 'POST', revisionBody, token)).propuesta;
        const acceptProposal = { estado: 'Aceptada', decision_explicita: true };
        await call(path + '/staff/proposals/' + proposal.id_propuesta + '/decision', 409, 'POST', acceptProposal, token);
        if (chatToken) {
          const acceptance = { confirmado: true, precio: '125.50' };
          const currentPath = patientQuotes + '/proposals/' + current.id_propuesta + '/accept';
          await call(patientQuotes + '/proposals/' + proposal.id_propuesta + '/accept', 409, 'POST', acceptance, chatToken);
          await call(currentPath, 404, 'POST', acceptance, chatToken);
          await call(staffQuotes + '/proposals/' + current.id_propuesta, 200, 'POST', undefined, token);
          const shown = (await call(patientQuotes + '/proposals', 200, 'GET', undefined, chatToken)).propuestas;
          assert.deepEqual(shown.map((p: { id_propuesta: number }) => p.id_propuesta), [current.id_propuesta]);
          await call(currentPath, 400, 'POST', { ...acceptance, precio: '150.25' }, chatToken);
          assert.equal((await call(currentPath, 200, 'POST', acceptance, chatToken)).reutilizada, false);
          assert.equal((await call(currentPath, 200, 'POST', acceptance, chatToken)).reutilizada, true);
          const accepted = (await call(patientQuotes + '/proposals', 200, 'GET', undefined, chatToken)).propuestas[0];
          assert.equal(accepted.estado, 'Aceptada');
          assert.ok(accepted.aceptada_utc);
          completed.push('aceptación explícita en chat con versión, importe, evidencia y reintento');
        }
        await call(path + '/staff/proposals/' + current.id_propuesta + '/decision', 200, 'POST', acceptProposal, token);
        completed.push('versionado y aceptación de cotización vigente');

        const site = await tx.sedes.findFirstOrThrow({ where: { activo: true } });
        const professional = await tx.profesionales.findFirstOrThrow({ where: { activo: true } });
        const pair = { id_profesional: professional.id_profesional, id_servicio: service.id_servicio };
        if (!await tx.profesionalServicio.findFirst({ where: pair })) await tx.profesionalServicio.create({ data: pair });
        const day = '2099-06-01';
        const slot = await tx.disponibilidad.create({ data: {
          id_profesional: professional.id_profesional, id_sede: site.id_sede,
          fecha: new Date(day + 'T00:00:00Z'), hora_inicio: new Date('1970-01-01T09:00:00Z'),
          hora_fin: new Date('1970-01-01T10:00:00Z'), estado: 'Disponible',
        } });
        const candidates = await call(path + '/availability?fecha=' + day, 200);
        const candidate = candidates.candidatas.find((entry: { id_disponibilidad: number }) =>
          entry.id_disponibilidad === slot.id_disponibilidad);
        assert.ok(candidate);
        const later = await tx.disponibilidad.create({ data: {
          id_profesional: professional.id_profesional, id_sede: site.id_sede,
          fecha: new Date(day + 'T00:00:00Z'), hora_inicio: new Date('1970-01-01T11:00:00Z'),
          hora_fin: new Date('1970-01-01T12:00:00Z'), estado: 'Disponible',
        } });
        const window = path + '/availability?fecha=' + day + '&desde=11:00&hasta=12:00&ajuste=';
        const flexible = (await call(window + 'flexible', 200)).candidatas;
        assert.deepEqual(flexible.map((entry: { id_disponibilidad: number; coincide_horario: boolean }) =>
          [entry.id_disponibilidad, entry.coincide_horario]), [[later.id_disponibilidad, true], [slot.id_disponibilidad, false]]);
        const required = (await call(window + 'obligatorio', 200)).candidatas;
        assert.deepEqual(required.map((entry: { id_disponibilidad: number }) => entry.id_disponibilidad), [later.id_disponibilidad]);
        await call(path + '/availability?fecha=' + day + '&desde=11:00&ajuste=obligatorio', 400);
        const offer = { ...candidate, precio_ofrecido: '125.50', turno_ofrecido: 'Mañana',
          id_propuesta: current.id_propuesta, opciones_esperadas: [] };
        await tx.disponibilidad.update({ where: { id_disponibilidad: slot.id_disponibilidad }, data: { estado: 'Ocupado' } });
        await call(path + '/alternatives', 409, 'POST', offer, token);
        await tx.disponibilidad.update({ where: { id_disponibilidad: slot.id_disponibilidad }, data: { estado: 'Disponible' } });
        completed.push('rangos obligatorios y flexibles, orden de candidatos y revalidación de agenda');
        const option = (await call(path + '/alternatives', 201, 'POST', offer, token)).alternativa;
        assert.equal((await call(path + '/alternatives', 200, 'POST', offer, token)).alternativa.id_opcion, option.id_opcion);
        const detail = await call(path + '?incluir_interacciones=false', 200);
        const snapshot = detail.condiciones_ofrecidas.find((entry: { id_opcion: number }) => entry.id_opcion === option.id_opcion);
        await call(path + '/alternatives/' + option.id_opcion, 200, 'PATCH',
          { accion: 'decidir', revision: snapshot.revision, estado: 'Aceptada' }, token);
        completed.push('oferta vinculada y aceptación de alternativa');

        await call(path + '/staff/outcome', 200, 'POST',
          { confirmado: true, resultado: 'ACEPTADA', id_propuesta: current.id_propuesta }, token);
        const pending = await call(path + '/payer-readiness', 200);
        assert.equal(pending.estado, 'bloqueado');
        assert.ok(pending.condiciones_autorizables);
        const authorization = await call(path + '/staff/reservation-authorization', 200, 'POST', {
          ...pending.condiciones_autorizables, id_canal: channel.id_canal, referencia_evidencia: 'Referencia temporal QA',
          confirmada: true,
        }, token);
        completed.push('acuerdo y autorización de las condiciones vigentes');

        const transferBody = { confirmado: true, id_autorizacion: authorization.id_autorizacion };
        await tx.disponibilidad.update({ where: { id_disponibilidad: slot.id_disponibilidad }, data: { estado: 'Ocupado' } });
        await call(path + '/staff/payer-transfer', 409, 'POST', transferBody, token);
        assert.equal(await tx.reservas.count({ where: { id_solicitud: requestId } }), 0);
        await tx.disponibilidad.update({ where: { id_disponibilidad: slot.id_disponibilidad }, data: { estado: 'Disponible' } });
        const transfer = await call(path + '/staff/payer-transfer', 201, 'POST', transferBody, token);
        reservationId = transfer.id_reserva;
        assert.equal((await call(path + '/staff/payer-transfer', 200, 'POST', transferBody, token)).id_reserva, reservationId);
        assert.equal((await call(path + '/payer-readiness', 200)).estado, 'traspasado');
        const reservation = await tx.reservas.findUniqueOrThrow({ where: { id_reserva: reservationId },
          include: { Persona: { include: { Etapa: true } } } });
        assert.equal(reservation.estado, 'Pendiente');
        assert.equal(reservation.id_opcion, option.id_opcion);
        assert.equal(reservation.Persona.Etapa.nombre, 'PAYER');
        assert.equal(await tx.reservas.count({ where: { id_solicitud: requestId } }), 1);
        assert.equal(await tx.pagos.count({ where: { id_reserva: reservationId } }), 0);
        const [event] = await tx.$queryRaw<{ cantidad: number }[]>`
          SELECT COUNT(*) cantidad FROM dbo.EventosEtapa e
          JOIN dbo.Etapas t ON t.id_etapa=e.etapa_destino AND t.nombre='PAYER'
          WHERE e.id_solicitud=${requestId}
        `;
        assert.equal(event.cantidad, 1);
        const reference = 'Autorización #' + authorization.id_autorizacion;
        await tx.$executeRaw`
          UPDATE dbo.EventosEtapa SET evidencia = NULL
          WHERE id_solicitud = ${requestId} AND evidencia = ${reference}
        `;
        const incomplete = await call(path + '/payer-readiness', 200);
        assert.equal(incomplete.estado, 'bloqueado');
        assert.ok(incomplete.requisitos.some((check: { codigo: string }) => check.codigo === 'evento_traspaso'));
        await call(path + '/staff/payer-transfer', 409, 'POST', transferBody, token);
        assert.equal(await tx.reservas.count({ where: { id_solicitud: requestId } }), 1);
        await tx.$executeRaw`
          UPDATE e SET evidencia = ${reference}
          FROM dbo.EventosEtapa e JOIN dbo.Etapas t ON t.id_etapa = e.etapa_destino AND t.nombre = 'PAYER'
          WHERE e.id_solicitud = ${requestId}
        `;
        completed.push('reserva y evento únicos con reintento');
        const [measures] = await tx.$queryRaw<{ m1: number; m3: number; m6: number }[]>`
          SELECT
            (SELECT oportunidad_aceptada FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME())
              WHERE id_solicitud=${requestId}) m1,
            (SELECT propuesta_aceptada FROM dbo.fn_Lead_Propuestas_Corte(SYSUTCDATETIME())
              WHERE id_propuesta_logica=${proposal.id_propuesta}) m3,
            (SELECT alternativa_aceptada FROM dbo.fn_Lead_Alternativas_Corte(SYSUTCDATETIME())
              WHERE id_opcion=${option.id_opcion}) m6
        `;
        assert.deepEqual(measures, { m1: 1, m3: 1, m6: 1 });
        completed.push('medidas M1, M3 y M6 del caso aceptado');
        throw rollback;
      }, { timeout: 60_000 });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  } finally {
    prisma.$transaction = original.transaction;
    prisma.$queryRaw = original.query;
    prisma.usuarios.findUnique = original.findUser;
    MartSyncService.syncBuyer = original.sync;
    if (original.enabled === undefined) delete process.env.LEAD_STAFF_AUTH_QA;
    else process.env.LEAD_STAFF_AUTH_QA = original.enabled;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  assert.ok(requestId && reservationId);
  assert.equal(await prisma.solicitudes.count({ where: { id_solicitud: requestId } }), 0);
  assert.equal(await prisma.reservas.count({ where: { id_reserva: reservationId } }), 0);
  assert.deepEqual(await counts(), before, 'La reversión debe conservar los conteos iniciales.');
  for (const result of completed) console.log('OK · ' + result);
  console.log('OK · reversión y conservación de conteos, incluidas las tablas de historial');
  console.log('Alcance: HTTP + SQL en una transacción QA. No prueba concurrencia entre conexiones independientes.');
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
