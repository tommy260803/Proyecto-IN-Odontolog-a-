import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { explicitWhatsAppOptOut } from '../src/services/leadChatbotGroq';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db';
import { processNextLeadWhatsApp } from '../src/services/leadChatbot';
import { hashAccess } from '../src/services/leadPayerTransfer';
import { processWhatsAppFollowUp, scheduleRequestedWhatsAppFollowUp } from '../src/services/leadWhatsAppAutomaticFollowUp';
import type { WhatsAppJob } from '../src/services/leadWhatsAppInbox';
import { asksAboutWhatsAppFollowUp, asksToResumeWhatsApp, automaticFollowUpPlan, followUpWindow, parseFollowUpPreference, requestedFollowUpDate, resolveFollowUpPreference, silenceFollowUpDue } from '../src/services/leadWhatsAppFollowUpWindow';

const received = new Date('2026-11-13T02:00:00Z'); // 12 de noviembre, 21:00 en Lima

function configureWhatsAppTest(t: TestContext) {
  const settings = {
    OPENWA_LEAD_WEBHOOK_SECRET: 'test', GROQ_LEAD_CHATBOT_API_KEY: 'test',
    OPENWA_BASE_URL: 'https://openwa.example', OPENWA_API_KEY: 'test', OPENWA_SESSION_ID: 'qa',
    LEAD_PUBLIC_RESERVATION_URL: '',
  };
  for (const [key, value] of Object.entries(settings)) {
    const previous = process.env[key];
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
    process.env[key] = value;
  }
}

test('«ya» después de programar el contacto conserva el seguimiento y no envía una propuesta', async t => {
  configureWhatsAppTest(t);
  const job: WhatsAppJob = {
    id: 11n, sessionId: 'qa', chat: '51900000000@c.us', externalId: 'acuse', quotedId: 'oferta-anterior',
    text: 'Ya 👍', receivedAt: received, claimedAt: received, attempts: 1, interactionId: 12, plan: null,
  };
  const offer = { personId: 1, requestId: 2, proposalId: 3, optionId: 4, fingerprint: 'qa' };
  t.mock.method(prisma, '$queryRaw', async (strings: TemplateStringsArray) => {
    const sql = strings.join('');
    if (sql.includes("OBJECT_ID('dbo.MensajesWhatsAppLead'")) return [{ present: 1 }];
    if (sql.includes('WITH next_message')) return [job];
    if (sql.includes('m.id_persona AS personId')) return [offer];
    if (sql.includes('COL_LENGTH')) return [{ ready: 1 }];
    if (sql.includes("f.origen_whatsapp='PACIENTE'")) return [{ found: 1 }];
    return [];
  });
  const solicitudes = prisma.solicitudes;
  const findFirst = solicitudes.findFirst;
  t.after(() => { solicitudes.findFirst = findFirst; });
  solicitudes.findFirst = t.mock.fn(async () => ({
    resultado_comercial_lead: 'PENDIENTE', Persona: { numero: '900000000' },
  })) as unknown as typeof findFirst;
  const write = t.mock.fn(async (_sql: TemplateStringsArray, ..._args: unknown[]) => 1);
  const tx = { $executeRaw: write };
  t.mock.method(prisma, '$transaction', async (run: (db: typeof tx) => unknown) => run(tx));
  const send = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Envío inesperado.'); });

  await processNextLeadWhatsApp();

  assert.equal(send.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 1);
  assert.deepEqual(write.mock.calls[0].arguments.slice(1), ['FINALIZADO', 'SEGUIMIENTO_ACUSE', job.id, job.claimedAt]);
});

test('la indisponibilidad para conversar permite pedir fecha y turno sin cambiar la cita', () => {
  assert.equal(asksToResumeWhatsApp('Estoy en el trabajo'), true);
  assert.equal(asksToResumeWhatsApp('No puedo ir a la cita en la tarde'), false);
  assert.equal(explicitWhatsAppOptOut('No me escriban ahora, escríbanme mañana en la tarde'), false);
  assert.equal(explicitWhatsAppOptOut('No me vuelvan a escribir'), true);
});

test('mañana se calcula en Lima y un turno negado no se programa', () => {
  const date = parseFollowUpPreference('Mañana', received);
  assert.deepEqual(parseFollowUpPreference('En la mañana', received, date), { date: '2026-11-13', turn: 'mañana' });
  assert.deepEqual(parseFollowUpPreference('Mañana en la tarde', received), { date: '2026-11-13', turn: 'tarde' });
  assert.deepEqual(parseFollowUpPreference('No puedo mañana en la tarde', received), {});
  assert.equal(followUpWindow('2026-11-13', 'tarde').start.toISOString(), '2026-11-13T18:00:00.000Z');
});

test('los plazos de contacto usan el día de Lima y reemplazan la fecha anterior', () => {
  const at = new Date('2026-11-14T00:26:00Z'); // 13 de noviembre en Lima
  for (const text of ['QUIERO QUE ME HABLES EN 3 DÍAS', 'Háblame dentro de tres días', 'Escríbeme de aquí a 3 días']) {
    assert.equal(asksToResumeWhatsApp(text), true, text);
    assert.equal(parseFollowUpPreference(text, at, { date: '2026-11-15', turn: 'mañana' }).date, '2026-11-16', text);
  }
  assert.deepEqual(parseFollowUpPreference('Estoy ocupado, háblame en 3 días por la tarde', at),
    { date: '2026-11-16', turn: 'tarde' });
  assert.equal(parseFollowUpPreference('No puedo hablar ahora, contáctame en 2 días', at).date, '2026-11-15');
  assert.equal(parseFollowUpPreference('En una semana', at).date, '2026-11-20');
  assert.equal(parseFollowUpPreference('En 3 días', new Date('2026-12-31T23:00:00Z')).date, '2027-01-03');
  assert.deepEqual(parseFollowUpPreference('No puedo en 3 días', at), {});
  assert.deepEqual(parseFollowUpPreference('En 2 días o en 3 días', at), {});
  assert.deepEqual(parseFollowUpPreference('En 0 días', at), {});
  assert.equal(asksToResumeWhatsApp('Quiero asistir a la cita en 3 días'), false);
  assert.equal(asksAboutWhatsAppFollowUp('¿POR QUÉ NO PUEDES PARA 3 DÍAS?'), true);
  assert.equal(resolveFollowUpPreference('Háblame en 3 días', at, { date: '2026-11-15' }, {
    dia: 'pasado mañana', turno: '', hora: '', cita_textual: 'en 3 días', ocupado: false,
  }).date, '2026-11-16');
});

test('un nuevo pedido reactiva la cancelación automática y respeta una pausa o cancelación manual', async t => {
  const at = new Date('2026-11-14T00:26:00Z');
  t.mock.timers.enable({ apis: ['Date'], now: at });
  const job: WhatsAppJob = {
    id: 443n, sessionId: 'qa', chat: '51900000000@c.us', externalId: 'nuevo-contacto', quotedId: null,
    text: 'Quiero que me hables en 3 días', receivedAt: at, claimedAt: at, attempts: 1, interactionId: 12, plan: null,
  };
  let state = { estado: 'CANCELADO', motivo: 'Hubo actividad posterior en la conversación.', revision: 5,
    origen_whatsapp: null as string | null, id_mensaje_origen_whatsapp: null as bigint | null, clave: null };
  const write = t.mock.fn(async (_sql: TemplateStringsArray, ..._args: unknown[]) => 1);
  const tx = {
    solicitudes: { findUnique: async () => ({ estado: 'Abierta', Persona: {
      numero: '900000000', autoriza_contacto: true, Etapa: { nombre: 'LEAD' },
    } }) },
    $queryRaw: async (sql: TemplateStringsArray) => sql.join('').includes('COL_LENGTH') ? [{ ready: 1 }] : [state],
    $executeRaw: write,
  } as unknown as Prisma.TransactionClient;
  const offer = { personId: 1, requestId: 2, proposalId: 3, optionId: 4, fingerprint: 'qa' };
  const preference = parseFollowUpPreference(job.text, at);
  assert.equal(await scheduleRequestedWhatsAppFollowUp(tx, job, offer, preference), 'PROGRAMADO');
  const args = write.mock.calls[0].arguments;
  assert.ok(args.some(value => value instanceof Date && value.toISOString() === '2026-11-16T13:00:00.000Z'));
  assert.ok(args.includes('PACIENTE'));
  assert.ok(args.includes(job.id));
  state = { ...state, estado: 'PAUSADO' };
  assert.equal(await scheduleRequestedWhatsAppFollowUp(tx, job, offer, preference), 'SUSPENDIDO');
  state = { ...state, estado: 'CANCELADO', motivo: 'El asesor canceló este seguimiento.' };
  assert.equal(await scheduleRequestedWhatsAppFollowUp(tx, job, offer, preference), 'SUSPENDIDO');
  assert.equal(write.mock.callCount(), 1);
});

test('el chatbot confirma el plazo real y explica un fallo conservando el contexto', async t => {
  for (const cancelledByActivity of [true, false]) {
    await t.test(cancelledByActivity ? 'reactiva el contacto solicitado y confirma su fecha' : 'explica una pausa del asesor y mantiene el motivo', async t => {
      configureWhatsAppTest(t);
      const at = new Date('2026-11-14T00:26:00Z');
      t.mock.timers.enable({ apis: ['Date'], now: at });
      const job: WhatsAppJob = {
        id: 443n, sessionId: 'qa', chat: '51900000000@c.us', externalId: 'contacto', quotedId: null,
        text: 'Quiero que me hables en 3 días', receivedAt: at, claimedAt: at, attempts: 1, interactionId: 12, plan: null,
      };
      const offer = { personId: 1, requestId: 2, proposalId: 3, optionId: 4, fingerprint: 'qa' };
      let state = { estado: cancelledByActivity ? 'CANCELADO' : 'PAUSADO',
        motivo: cancelledByActivity ? 'Hubo actividad posterior en la conversación.' : 'Pausado por el asesor',
        revision: 5, origen_whatsapp: null as string | null, id_mensaje_origen_whatsapp: null as bigint | null, clave: null };
      let plan: Record<string, unknown> | undefined;
      let previousBot: { messageId: bigint; externalId: string; type: string; text: string; decision: string; plan: string } | undefined;
      let scheduledCount = 0;
      const read = async (strings: TemplateStringsArray) => {
        const sql = strings.join('');
        if (sql.includes("OBJECT_ID('dbo.MensajesWhatsAppLead'")) return [{ present: 1 }];
        if (sql.includes('WITH next_message')) return [job];
        if (sql.includes('m.id_persona AS personId')) return [offer];
        if (sql.includes('COL_LENGTH')) return [{ ready: 1 }];
        if (sql.includes('sp_getapplock')) return [{ code: 0 }];
        if (sql.includes("f.origen_whatsapp='PACIENTE'")) return state.estado === 'PROGRAMADO' ? [{ found: 1 }] : [];
        if (sql.includes('CONVERT(varchar(36),clave_envio)')) return [state];
        if (sql.includes('id_mensaje AS messageId') || sql.includes('m.id_externo AS externalId, m.plan_respuesta')) {
          return previousBot ? [previousBot] : [];
        }
        return [];
      };
      const write = async (strings: TemplateStringsArray, ...args: unknown[]) => {
        const sql = strings.join('');
        if (sql.includes('SET plan_respuesta=')) plan = JSON.parse(String(args[0]));
        if (sql.includes('MERGE dbo.SeguimientoOperativoLead')) {
          scheduledCount++;
          state = { ...state, estado: 'PROGRAMADO', origen_whatsapp: 'PACIENTE', id_mensaje_origen_whatsapp: job.id };
        }
        if (sql.includes('INSERT dbo.MensajesWhatsAppLead')) previousBot = {
          messageId: job.id + 1n, externalId: String(args[1]), type: 'BOT', text: String(args[3]),
          decision: String(args[4]), plan: JSON.stringify(plan),
        };
        return 1;
      };
      t.mock.method(prisma, '$queryRaw', read);
      t.mock.method(prisma, '$executeRaw', write);
      const solicitudes = prisma.solicitudes;
      const findFirst = solicitudes.findFirst;
      t.after(() => { solicitudes.findFirst = findFirst; });
      solicitudes.findFirst = t.mock.fn(async () => ({
        resultado_comercial_lead: 'PENDIENTE', Persona: { numero: '900000000' },
      })) as unknown as typeof findFirst;
      const tx = { $queryRaw: read, $executeRaw: write,
        solicitudes: { findUnique: async () => ({ estado: 'Abierta', Persona: {
          autoriza_contacto: true, numero: '900000000', Etapa: { nombre: 'LEAD' },
        } }) },
        canales: { findFirst: async () => ({ id_canal: 1 }) },
        interacciones: { create: async () => ({ id_interaccion: 12 }) },
      };
      t.mock.method(prisma, '$transaction', async (run: (db: typeof tx) => unknown) => run(tx));
      const sent: string[] = [];
      t.mock.method(globalThis, 'fetch', async (url: string, init: { body: string }) => {
        assert.match(url, /^https:\/\/openwa\.example\//);
        sent.push(JSON.parse(init.body).text);
        return Response.json({ messageId: `respuesta-${sent.length}` }, { status: 201 });
      });

      await processNextLeadWhatsApp();
      assert.equal(sent.length, 1);
      assert.equal((plan?.followUpPreference as { date: string }).date, '2026-11-16');
      assert.equal(scheduledCount, cancelledByActivity ? 1 : 0);
      assert.equal(previousBot?.decision, cancelledByActivity ? 'SEGUIMIENTO_CONTACTO' : 'SEGUIMIENTO_PENDIENTE');
      assert.match(sent[0], cancelledByActivity ? /16 de noviembre de 2026/ : /pausado o cancelado por el asesor/);

      job.id += 2n;
      job.externalId = 'pregunta-sobre-contacto';
      job.text = cancelledByActivity ? '¿Entonces quedó programado?' : '¿POR QUÉ NO PUEDES PARA 3 DÍAS?';
      await processNextLeadWhatsApp();
      assert.equal(sent.length, 2);
      assert.equal(previousBot?.decision, 'ESTADO_SEGUIMIENTO');
      assert.equal(scheduledCount, cancelledByActivity ? 1 : 0);
      assert.match(sent[1], cancelledByActivity ? /programado el 16 de noviembre de 2026/ : /pausado o cancelado por el asesor/);
      assert.doesNotMatch(sent[1], /revisar de la propuesta/);
    });
  }
});

test('la lectura tiene prioridad sobre la entrega y cada una tiene su plazo', () => {
  assert.equal(silenceFollowUpDue(null, null), null);
  assert.equal(silenceFollowUpDue(received, null)?.toISOString(), '2026-11-15T02:00:00.000Z');
  const read = new Date('2026-11-13T12:00:00Z');
  assert.equal(silenceFollowUpDue(received, read)?.toISOString(), '2026-11-14T12:00:00.000Z');
});

test('agenda solo la fecha al pedir que lo contacten mañana y respeta una precisión posterior', async t => {
  const at = new Date('2026-11-13T23:47:00Z');
  t.mock.timers.enable({ apis: ['Date'], now: at });
  const text = 'No tengo tiempo para hablarte ahora, contáctame mañana';
  assert.equal(asksToResumeWhatsApp('hablame el día de mañana'), true);
  assert.equal(asksToResumeWhatsApp(text), true);
  const preference = parseFollowUpPreference(text, at);
  assert.deepEqual(preference, { date: '2026-11-14', turn: undefined });
  assert.deepEqual(parseFollowUpPreference('Mejor por la tarde', at, preference), { date: '2026-11-14', turn: 'tarde' });
  assert.equal(requestedFollowUpDate('2026-11-14', undefined, undefined, new Date('2026-11-13T14:00:00Z'))?.toISOString(),
    '2026-11-14T18:00:00.000Z');

  const job: WhatsAppJob = {
    id: 11n, sessionId: 'qa', chat: '51900000000@c.us', externalId: 'request', quotedId: null,
    text, receivedAt: at, claimedAt: at, attempts: 1, interactionId: null, plan: null,
  };
  const write = t.mock.fn(async (_sql: TemplateStringsArray, ..._args: unknown[]) => 1);
  const tx = {
    solicitudes: { findUnique: async () => ({ estado: 'Abierta', Persona: { numero: '900000000',
      autoriza_contacto: true, Etapa: { nombre: 'LEAD' } } }) },
    $queryRaw: async (sql: TemplateStringsArray) => sql.join('').includes('COL_LENGTH') ? [{ ready: 1 }] : [],
    $executeRaw: write,
  } as unknown as Prisma.TransactionClient;
  assert.equal(await scheduleRequestedWhatsAppFollowUp(tx, job, {
    personId: 1, requestId: 2, proposalId: 3, optionId: 4, fingerprint: 'qa',
  }, { ...preference, wasBusy: true }), 'PROGRAMADO');
  const args = write.mock.calls[0].arguments;
  assert.ok(args.includes(null));
  assert.ok(args.some(value => value instanceof Date && value.toISOString() === '2026-11-14T13:00:00.000Z'));
  assert.ok(args.some(value => typeof value === 'string' && /paciente estaba ocupado.*14 de noviembre/.test(value)));
});

test('guarda turno sin hora o conserva la hora exacta indicada por el paciente', () => {
  assert.deepEqual(parseFollowUpPreference('Mañana a las 4 p. m.', received),
    { date: '2026-11-13', turn: 'tarde', time: '16:00' });
  const hour = parseFollowUpPreference('A las 4', received);
  assert.deepEqual(parseFollowUpPreference('Mañana', received, hour),
    { date: '2026-11-13', turn: 'tarde', time: '16:00' });
  assert.equal(requestedFollowUpDate('2026-11-13', 'tarde', undefined, received)?.toISOString(), '2026-11-13T18:00:00.000Z');
  assert.equal(requestedFollowUpDate('2026-11-13', 'tarde', '16:00', received)?.toISOString(), '2026-11-13T21:00:00.000Z');
  assert.equal(requestedFollowUpDate('2026-11-13', 'tarde', '18:00', received), null);
  assert.equal(requestedFollowUpDate('2026-11-31', 'tarde', undefined, received), null);
});

test('combina vigencia y silencio en un seguimiento y evita enviar fuera del turno', () => {
  const base = { sent: received, delivered: received, read: null };
  const expiry = new Date('2026-11-14T20:00:00Z');
  const warning = automaticFollowUpPlan({ ...base, promotionExpiry: expiry });
  assert.equal(warning?.origin, 'VIGENCIA');
  assert.equal(warning?.turn, 'tarde');
  assert.equal(warning?.due.toISOString(), '2026-11-13T20:00:00.000Z');
  const afterHours = automaticFollowUpPlan({ ...base, promotionExpiry: null });
  assert.equal(afterHours?.origin, 'ENTREGADO');
  assert.equal(afterHours?.due.toISOString(), '2026-11-15T13:00:00.000Z');
  const expired = automaticFollowUpPlan({ ...base, promotionExpiry: new Date('2026-11-13T10:00:00Z'), delivered: null });
  assert.equal(expired?.due.toISOString(), '2026-11-13T13:00:00.000Z');
  const first = automaticFollowUpPlan({ ...base, promotionExpiry: new Date('2026-11-20T20:00:00Z') });
  assert.equal(first?.origin, 'ENTREGADO');
});

test('el programador envía un solo mensaje de vigencia por OpenWA y registra el envío', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-13T20:00:00Z') });
  const expiry = new Date('2026-11-14T20:00:00Z');
  const price = new Prisma.Decimal(100);
  const fingerprint = hashAccess(JSON.stringify([1, 2, 3, 4, 1, '100.00', expiry.toISOString(),
    '100.00', 6, 7, 9, '2026-11-16', '15:00:00', '15:30:00']));
  const request = {
    id_persona: 1, id_solicitud: 2, id_servicio: 5, estado: 'Abierta', resultado_comercial_lead: 'PENDIENTE',
    fecha_proximo_seguimiento: null as Date | null,
    Persona: { nombres: 'Paciente de prueba', autoriza_contacto: true, Etapa: { nombre: 'LEAD' }, numero: '900000000' },
    Servicio: { nombre: 'Limpieza', activo: true },
  };
  const offer = { id: 10n, personId: 1, requestId: 2, optionId: 3, proposalId: 4, fingerprint,
    externalId: 'oferta', chat: '51900000000@c.us', sent: received, delivered: received, read: null };
  const proposal = { id_propuesta: 4, numero_version: 1, precio_cotizado: price, id_solicitud: 2, id_servicio: 5,
    estado: 'Pendiente', promocion_aplicada: 'Promoción de prueba', fecha_vigencia_hasta_utc_lead: expiry };
  let state: { estado: string; revision: number; origen_whatsapp: string; id_mensaje_origen_whatsapp: bigint;
    turno_whatsapp: string; clave: string; ultimo_envio_utc: Date | null } | undefined;
  let replied = false;
  const tx = {
    solicitudes: { findUnique: async () => request, findFirst: async () => request },
    opciones: { findFirst: async () => ({ id_opcion: 3, precio_ofrecido: price, Propuesta: proposal, Disponibilidad: {
      id_disponibilidad: 6, id_sede: 7, id_profesional: 9, fecha: new Date('2026-11-16'),
      hora_inicio: new Date('1970-01-01T15:00:00Z'), hora_fin: new Date('1970-01-01T15:30:00Z'),
    } }) },
    canales: { findFirst: async () => ({ id_canal: 1 }) },
    interacciones: { create: async () => ({ id_interaccion: 12 }) },
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('');
      if (sql.includes('AS externalId')) return [offer];
      if (sql.includes('sp_getapplock')) return [{ code: 0 }];
      if (sql.includes('CONVERT(varchar(36),clave_envio)')) return state ? [state] : [];
      if (sql.includes('AS found') && sql.includes("'FINALIZADO','REVISION'")) return replied ? [{ found: 1 }] : [];
      return [];
    },
    $executeRaw: async (strings: TemplateStringsArray, ...args: unknown[]) => {
      const sql = strings.join('');
      if (sql.includes('MERGE dbo.SeguimientoOperativoLead')) {
        state = { estado: 'PROGRAMADO', revision: 1, origen_whatsapp: 'VIGENCIA', id_mensaje_origen_whatsapp: offer.id,
          turno_whatsapp: 'tarde', clave: 'test-key', ultimo_envio_utc: null };
        request.fecha_proximo_seguimiento = args.find(arg => arg instanceof Date) as Date;
      } else if (sql.includes('UPDATE dbo.SeguimientoOperativoLead SET estado=')) {
        state = { ...state!, estado: String(args[0]), ultimo_envio_utc: new Date() };
        request.fecha_proximo_seguimiento = null;
      }
      return 1;
    },
  };
  t.mock.method(prisma, '$transaction', async (run: (db: typeof tx) => unknown) => run(tx));
  const sent = t.mock.method(globalThis, 'fetch', async (_url: string, init: { body: string }) => {
    assert.match(JSON.parse(init.body).text, /promoción para Limpieza sigue vigente/);
    return Response.json({ messageId: 'seguimiento' }, { status: 201 });
  });
  const settings = { sessionId: 'qa', base: 'https://openwa.example', apiKey: 'mock', publicUrl: null, localReservation: false };
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(state?.estado, 'ENVIADO');
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(sent.mock.callCount(), 1);
  state = { ...state!, estado: 'PROGRAMADO' };
  replied = true;
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(state.estado, 'CANCELADO');
  assert.equal(sent.mock.callCount(), 1);
});

test('tomar control conserva el seguimiento del paciente y al devolverlo se envía en la fecha acordada', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-13T20:00:00Z') });
  const due = new Date('2026-11-14T18:00:00Z');
  const expiry = new Date('2026-11-20T20:00:00Z');
  const price = new Prisma.Decimal(100);
  const fingerprint = hashAccess(JSON.stringify([1, 2, 3, 4, 1, '100.00', expiry.toISOString(),
    '100.00', 6, 7, 9, '2026-11-16', '15:00:00', '15:30:00']));
  const request = { id_persona: 1, id_solicitud: 2, id_servicio: 5, estado: 'Abierta', resultado_comercial_lead: 'PENDIENTE',
    fecha_proximo_seguimiento: due as Date | null,
    Persona: { nombres: 'Paciente de prueba', numero: '900000000', autoriza_contacto: true, Etapa: { nombre: 'LEAD' } },
    Servicio: { nombre: 'Limpieza', activo: true },
  };
  const offer = { id: 10n, personId: 1, requestId: 2, optionId: 3, proposalId: 4, fingerprint,
    externalId: 'oferta', chat: '51900000000@c.us', sent: received, delivered: received, read: null };
  const proposal = { id_propuesta: 4, numero_version: 1, precio_cotizado: price, id_solicitud: 2, id_servicio: 5,
    estado: 'Pendiente', fecha_vigencia_hasta_utc_lead: expiry };
  const state = { estado: 'PROGRAMADO', motivo: 'El paciente pidió contacto mañana por la tarde.', revision: 1,
    origen_whatsapp: 'PACIENTE', id_mensaje_origen_whatsapp: 20n, turno_whatsapp: 'tarde',
    clave: 'test-contact-key', ultimo_envio_utc: null };
  let advisor = true;
  let pendingReview = false;
  const write = t.mock.fn(async (strings: TemplateStringsArray, ...args: unknown[]) => {
    if (strings.join('').includes('UPDATE dbo.SeguimientoOperativoLead SET estado=')) {
      state.estado = String(args[0]);
      request.fecha_proximo_seguimiento = null;
    }
    return 1;
  });
  const tx = { solicitudes: { findUnique: async () => request, findFirst: async () => request },
    opciones: { findFirst: async () => ({ id_opcion: 3, precio_ofrecido: price, Propuesta: proposal, Disponibilidad: {
      id_disponibilidad: 6, id_sede: 7, id_profesional: 9, fecha: new Date('2026-11-16'),
      hora_inicio: new Date('1970-01-01T15:00:00Z'), hora_fin: new Date('1970-01-01T15:30:00Z'),
    } }) },
    canales: { findFirst: async () => ({ id_canal: 1 }) }, interacciones: { create: async () => ({ id_interaccion: 12 }) },
    $executeRaw: write,
    $queryRaw: async (strings: TemplateStringsArray, ...args: unknown[]) => {
      const sql = Prisma.sql(strings, ...args).sql;
      if (sql.includes('AS externalId')) return [offer];
      if (sql.includes('sp_getapplock')) return [{ code: 0 }];
      if (sql.includes('CONVERT(varchar(36),clave_envio)')) return [state];
      if (sql.includes('AS ownerKey')) return [{ id: advisor ? 31n : 34n, requestId: 2, decision: advisor ? 'CONTROL_ASESOR' : 'CONTROL_BOT' }];
      if (sql.includes('AS paused')) return pendingReview ? [{ paused: 1 }] : [];
      if (sql.includes('AS active')) return [{ active: 1 }];
      if (sql.includes('AS found') && sql.includes("'FINALIZADO','REVISION'")) {
        // El chat tiene una toma de control antigua y entradas registradas mientras atendía el asesor.
        return sql.includes("OR decision IN ('MENSAJE_ASESOR','CONTROL_ASESOR')") ||
          !sql.includes("ISNULL(decision,'')<>'CON_ASESOR'") ? [{ found: 1 }] : [];
      }
      return [];
    },
  };
  t.mock.method(prisma, '$transaction', async (run: (db: typeof tx) => unknown) => run(tx));
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ messageId: 'contacto-programado' }, { status: 201 }));
  const settings = { sessionId: 'qa', base: 'https://openwa.example', apiKey: 'mock', publicUrl: null, localReservation: false };

  await processWhatsAppFollowUp(settings, 2);
  assert.equal(state.estado, 'PROGRAMADO');
  assert.equal(request.fecha_proximo_seguimiento, due);
  assert.equal(write.mock.callCount(), 0);
  assert.equal(send.mock.callCount(), 0);

  advisor = false;
  pendingReview = true;
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(state.estado, 'PROGRAMADO');
  assert.equal(write.mock.callCount(), 0);
  pendingReview = false;
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(state.estado, 'PROGRAMADO');
  assert.equal(request.fecha_proximo_seguimiento, due);
  assert.equal(send.mock.callCount(), 0);

  t.mock.timers.setTime(due.getTime());
  advisor = true;
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(send.mock.callCount(), 0);
  advisor = false;
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(state.estado, 'ENVIADO');
  assert.equal(send.mock.callCount(), 1);
  await processWhatsAppFollowUp(settings, 2);
  assert.equal(send.mock.callCount(), 1);
});
