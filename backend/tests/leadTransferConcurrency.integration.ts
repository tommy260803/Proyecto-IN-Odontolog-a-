import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { prisma } from '../src/db';
import { leadCommercialRouter } from '../src/routes/leadCommercial.routes';
import { hashLeadStaffPassword } from '../src/services/leadStaffAuth';

async function run() {
  const [target] = await prisma.$queryRaw<{ db: string }[]>`SELECT DB_NAME() AS db`;
  assert.equal(target.db, 'NexoSalud_LeadPruebas', 'Solo ejecutar en NexoSalud_LeadPruebas.');
  const [schema] = await prisma.$queryRaw<{ ready: number }[]>`
    SELECT 1 ready WHERE COL_LENGTH('dbo.AutorizacionesReservaLead','id_reserva') IS NOT NULL
  `;
  assert.ok(schema, 'Instalar los scripts de autorización y traspaso de QA.');
  const originalTransaction = prisma.$transaction;
  const originalEnabled = process.env.LEAD_STAFF_AUTH_QA;
  const email = 'qa-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const passwordHash = await hashLeadStaffPassword(password);
  const fixtures: { request: number; person: number; option: number; proposal: number; authorization: number }[] = [];
  let userId: number | undefined;
  let professionalId: number | undefined;
  const slotIds: number[] = [];
  const spids = new Set<number>();
  let committed = false;
  let failEvent = false;
  const app = express();
  app.use(express.json());
  app.use(leadCommercialRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  try {
    process.env.LEAD_STAFF_AUTH_QA = 'true';
    await prisma.$transaction(async tx => {
      const role = await tx.roles.findFirstOrThrow({ where: { nombre: 'Negociador' } });
      const lead = await tx.etapas.findUniqueOrThrow({ where: { nombre: 'LEAD' } });
      const service = await tx.servicios.findFirstOrThrow({ where: { activo: true } });
      const site = await tx.sedes.findFirstOrThrow({ where: { activo: true } });
      const channel = await tx.canales.findFirstOrThrow({ where: { activo: true } });
      const user = await tx.usuarios.create({ data: {
        nombres: 'Concurrencia', apellidos: 'QA', email, password_hash: passwordHash, id_rol: role.id_rol,
      } });
      userId = user.id_usuario;
      const professional = await tx.profesionales.create({ data: { nombres: 'Concurrencia', apellidos: 'QA' } });
      professionalId = professional.id_profesional;
      await tx.profesionalServicio.create({ data: { id_profesional: professionalId, id_servicio: service.id_servicio } });
      for (const day of ['2099-07-01', '2099-07-02']) {
        const slot = await tx.disponibilidad.create({ data: {
          id_profesional: professionalId, id_sede: site.id_sede, fecha: new Date(day + 'T00:00:00Z'),
          hora_inicio: new Date('1970-01-01T09:00:00Z'), hora_fin: new Date('1970-01-01T10:00:00Z'),
        } });
        slotIds.push(slot.id_disponibilidad);
      }
      for (const slot of [slotIds[0], slotIds[1], slotIds[1]]) {
        const now = new Date();
        const person = await tx.personas.create({ data: {
          nombres: 'Concurrencia', apellidos: 'QA', email: randomUUID() + '@example.invalid', id_etapa_actual: lead.id_etapa,
        } });
        const request = await tx.solicitudes.create({ data: {
          id_persona: person.id_persona, id_servicio: service.id_servicio, id_negociador: userId,
          fecha_solicitud: now, fecha_ingreso_lead: now, resultado_comercial_lead: 'PENDIENTE',
        } });
        const proposal = await tx.propuestasEconomicasLead.create({ data: {
          id_solicitud: request.id_solicitud, id_servicio: service.id_servicio, precio_cotizado: '125.50',
          fecha_presentacion: now, estado: 'Aceptada', fecha_decision: now,
        } });
        const option = await tx.opciones.create({ data: {
          id_solicitud: request.id_solicitud, id_disponibilidad: slot, precio_ofrecido: '125.50',
          fecha_ofrecida: now, estado_respuesta: 'Aceptada', fecha_respuesta: now, seleccionada: true,
          id_propuesta_lead: proposal.id_propuesta,
        } });
        await tx.solicitudes.update({ where: { id_solicitud: request.id_solicitud }, data: {
          resultado_comercial_lead: 'ACEPTADA', fecha_decision_comercial_lead: now,
          id_propuesta_aceptada_lead: proposal.id_propuesta, valor_acordado_lead: '125.50',
        } });
        const [authorization] = await tx.$queryRaw<{ id_autorizacion: number }[]>`
          INSERT dbo.AutorizacionesReservaLead
            (id_solicitud,id_opcion,id_propuesta,id_historial_opcion,id_usuario,id_canal,referencia_evidencia)
          OUTPUT inserted.id_autorizacion
          SELECT TOP (1) ${request.id_solicitud}, ${option.id_opcion}, ${proposal.id_propuesta}, h.id_historial,
            ${userId}, ${channel.id_canal}, N'Caso temporal de concurrencia QA'
          FROM dbo.HistorialOpcionesLead h WHERE h.id_opcion=${option.id_opcion} ORDER BY h.id_historial DESC
        `;
        fixtures.push({ request: request.id_solicitud, person: person.id_persona, option: option.id_opcion,
          proposal: proposal.id_propuesta, authorization: authorization.id_autorizacion });
      }
    });
    committed = true;

    // Conservar las transacciones reales y observar el SPID de cada conexión.
    prisma.$transaction = ((action: (tx: unknown) => Promise<unknown>, options: object) =>
      originalTransaction.call(prisma, async tx => {
        const [connection] = await tx.$queryRaw<{ spid: number }[]>`SELECT @@SPID AS spid`;
        spids.add(connection.spid);
        const client = new Proxy(tx, { get(target, property) {
          if (property === '$executeRaw') return async (...args: unknown[]) => {
            if (failEvent && String(args[0]).includes('INSERT dbo.EventosEtapa')) {
              throw new Error('Fallo intencional QA antes de guardar el evento');
            }
            return (target.$executeRaw as (...values: unknown[]) => Promise<number>)(...args);
          };
          return Reflect.get(target, property);
        } });
        return action(client);
      }, options)) as typeof prisma.$transaction;

    const login = await fetch(base + '/staff/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    async function transfer(fixture: typeof fixtures[number]) {
      const response = await fetch(base + '/opportunities/' + fixture.request + '/staff/payer-transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ confirmado: true, id_autorizacion: fixture.authorization }),
      });
      return { status: response.status, body: await response.json() };
    }
    const first = fixtures[0];
    failEvent = true;
    assert.equal((await transfer(first)).status, 500);
    failEvent = false;
    assert.equal(await prisma.reservas.count({ where: { id_solicitud: first.request } }), 0);
    assert.equal((await prisma.disponibilidad.findUniqueOrThrow({ where: { id_disponibilidad: slotIds[0] } })).estado, 'Disponible');
    assert.equal((await prisma.personas.findUniqueOrThrow({ where: { id_persona: first.person },
      include: { Etapa: true } })).Etapa.nombre, 'LEAD');
    const [unused] = await prisma.$queryRaw<{ id_reserva: number | null }[]>`
      SELECT id_reserva FROM dbo.AutorizacionesReservaLead WHERE id_autorizacion=${first.authorization}
    `;
    assert.equal(unused.id_reserva, null);
    console.log('OK · fallo después de crear la reserva revierte reserva, etapa, horario y vínculo');

    spids.clear();
    const simultaneous = await Promise.all([transfer(first), transfer(first)]);
    assert.ok(simultaneous.every(result => [200, 201, 409].includes(result.status)), JSON.stringify(simultaneous));
    assert.equal(simultaneous.filter(result => result.status === 201).length, 1);
    assert.ok(spids.size >= 2, 'Los envíos simultáneos deben usar conexiones SQL distintas.');
    const replay = await transfer(first);
    assert.equal(replay.status, 200);
    assert.equal(await prisma.reservas.count({ where: { id_solicitud: first.request } }), 1);
    console.log('OK · mismo traspaso simultáneo en conexiones distintas y reintento sin duplicar');

    spids.clear();
    const competing = await Promise.all([transfer(fixtures[1]), transfer(fixtures[2])]);
    assert.equal(competing.filter(result => result.status === 201).length, 1, JSON.stringify(competing));
    assert.equal(competing.filter(result => result.status === 409).length, 1, JSON.stringify(competing));
    assert.ok(spids.size >= 2);
    const loser = fixtures[competing[0].status === 409 ? 1 : 2];
    assert.equal((await prisma.personas.findUniqueOrThrow({ where: { id_persona: loser.person },
      include: { Etapa: true } })).Etapa.nombre, 'LEAD');
    const [totals] = await prisma.$queryRaw<{ reservas: number; eventos: number }[]>`
      SELECT (SELECT COUNT(*) FROM dbo.Reservas WHERE id_solicitud IN
        (${fixtures[0].request},${fixtures[1].request},${fixtures[2].request})) reservas,
        (SELECT COUNT(*) FROM dbo.EventosEtapa e JOIN dbo.Etapas t ON t.id_etapa=e.etapa_destino
          WHERE t.nombre='PAYER' AND e.id_solicitud IN
            (${fixtures[0].request},${fixtures[1].request},${fixtures[2].request})) eventos
    `;
    assert.deepEqual(totals, { reservas: 2, eventos: 2 });
    console.log('OK · dos solicitudes compiten por un horario y solo una lo reserva');
  } finally {
    prisma.$transaction = originalTransaction;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    // Eliminar únicamente los registros sintéticos de esta ejecución.
    // Las conexiones independientes requieren fixtures confirmadas previamente.
    if (committed) {
      const requests = fixtures.map(fixture => fixture.request);
      const options = fixtures.map(fixture => fixture.option);
      const proposals = fixtures.map(fixture => fixture.proposal);
      const people = fixtures.map(fixture => fixture.person);
      await prisma.$transaction(async tx => {
        assert.equal(await tx.pagos.count({ where: { Reserva: { id_solicitud: { in: requests } } } }), 0);
        for (const fixture of fixtures) {
          await tx.$executeRaw`DELETE dbo.AutorizacionesReservaLead WHERE id_autorizacion=${fixture.authorization}
            AND id_solicitud=${fixture.request} AND id_usuario=${userId}`;
          await tx.$executeRaw`DELETE dbo.EventosEtapa WHERE id_solicitud=${fixture.request} AND id_persona=${fixture.person}`;
        }
        await tx.reservas.deleteMany({ where: { id_solicitud: { in: requests }, id_persona: { in: people } } });
        await tx.solicitudes.updateMany({ where: { id_solicitud: { in: requests } }, data: {
          resultado_comercial_lead: 'PENDIENTE', id_propuesta_aceptada_lead: null,
          valor_acordado_lead: null, fecha_decision_comercial_lead: null,
        } });
        await tx.opciones.deleteMany({ where: { id_opcion: { in: options }, id_solicitud: { in: requests } } });
        await tx.propuestasEconomicasLead.deleteMany({ where: { id_propuesta: { in: proposals }, id_solicitud: { in: requests } } });
        await tx.solicitudes.deleteMany({ where: { id_solicitud: { in: requests }, id_persona: { in: people } } });
        for (const fixture of fixtures) {
          await tx.$executeRaw`DELETE dbo.CambiosOpcionLead WHERE id_opcion=${fixture.option}`;
          await tx.$executeRaw`DELETE dbo.HistorialOpcionesLead WHERE id_opcion=${fixture.option}`;
          await tx.$executeRaw`DELETE dbo.HistorialPropuestasLead WHERE id_propuesta=${fixture.proposal}`;
          await tx.$executeRaw`DELETE dbo.HistorialSolicitudesLead WHERE id_solicitud=${fixture.request}`;
        }
        await tx.personas.deleteMany({ where: { id_persona: { in: people } } });
        await tx.disponibilidad.deleteMany({ where: { id_disponibilidad: { in: slotIds }, id_profesional: professionalId } });
        await tx.profesionalServicio.deleteMany({ where: { id_profesional: professionalId } });
        await tx.profesionales.delete({ where: { id_profesional: professionalId } });
        await tx.usuarios.delete({ where: { id_usuario: userId, email } });
      });
      assert.equal(await prisma.solicitudes.count({ where: { id_solicitud: { in: requests } } }), 0);
      assert.equal(await prisma.personas.count({ where: { id_persona: { in: people } } }), 0);
      assert.equal(await prisma.propuestasEconomicasLead.count({ where: { id_propuesta: { in: proposals } } }), 0);
      assert.equal(await prisma.opciones.count({ where: { id_opcion: { in: options } } }), 0);
      assert.equal(await prisma.reservas.count({ where: { id_solicitud: { in: requests } } }), 0);
      assert.equal(await prisma.disponibilidad.count({ where: { id_disponibilidad: { in: slotIds } } }), 0);
      for (const fixture of fixtures) {
        const [remaining] = await prisma.$queryRaw<{ cantidad: number }[]>`
          SELECT (SELECT COUNT(*) FROM dbo.AutorizacionesReservaLead WHERE id_autorizacion=${fixture.authorization})
            + (SELECT COUNT(*) FROM dbo.EventosEtapa WHERE id_solicitud=${fixture.request})
            + (SELECT COUNT(*) FROM dbo.HistorialOpcionesLead WHERE id_opcion=${fixture.option})
            + (SELECT COUNT(*) FROM dbo.HistorialPropuestasLead WHERE id_propuesta=${fixture.proposal})
            + (SELECT COUNT(*) FROM dbo.HistorialSolicitudesLead WHERE id_solicitud=${fixture.request}) cantidad
        `;
        assert.equal(remaining.cantidad, 0);
      }
      assert.equal(await prisma.usuarios.count({ where: { email } }), 0);
      console.log('OK · limpieza de registros sintéticos e historiales verificada');
    }
    if (originalEnabled === undefined) delete process.env.LEAD_STAFF_AUTH_QA;
    else process.env.LEAD_STAFF_AUTH_QA = originalEnabled;
  }
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
