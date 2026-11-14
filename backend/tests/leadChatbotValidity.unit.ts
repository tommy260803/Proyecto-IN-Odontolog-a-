import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db';
import { prepareChatbotReply } from '../src/services/leadChatbotAgent';
import { acceptsOfferFollowUp, asksAboutOfferValidity, interpretLeadWhatsApp } from '../src/services/leadChatbotGroq';
import { hashAccess } from '../src/services/leadPayerTransfer';
import { resolveFollowUpPreference } from '../src/services/leadWhatsAppFollowUpWindow';
import { getStoredServiciosRules } from '../src/routes/config.routes';
import type { WhatsAppJob } from '../src/services/leadWhatsAppInbox';

test('rounds half the configured maximum up to a whole percentage and directs further discounts to an advisor', async t => {
  const regularPrice = new Prisma.Decimal(1800);
  const serviceId = 2;
  const discount = new Prisma.Decimal(Math.ceil(getStoredServiciosRules()[serviceId].descuentoMaximo / 2));
  const expected = regularPrice.mul(new Prisma.Decimal(1).minus(discount.div(100))).toFixed(2);
  const expiry = new Date(Date.now() + 86_400_000);
  const day = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
  const slot = {
    id_disponibilidad: 6, id_sede: 7, id_profesional: 9, fecha: new Date(day + 'T00:00:00Z'),
    hora_inicio: new Date('1970-01-01T15:00:00Z'), hora_fin: new Date('1970-01-01T15:30:00Z'),
    estado: 'Disponible', Sede: { activo: true, nombre: 'California' },
    Profesional: { activo: true, nombres: 'Ana', apellidos: 'Ramos' },
  };
  const request = {
    id_solicitud: 2, id_persona: 1, id_servicio: serviceId, estado: 'Abierta', resultado_comercial_lead: 'PENDIENTE',
    Persona: { Etapa: { nombre: 'LEAD' }, numero: '900000000' }, Servicio: { activo: true, nombre: 'Tratamiento dental' },
  };
  const original = {
    id_propuesta: 4, numero_version: 1, precio_cotizado: regularPrice, id_solicitud: 2, id_servicio: serviceId,
    estado: 'Pendiente', fecha_vigencia_hasta_utc_lead: expiry, promocion_aplicada: null as string | null,
  };
  const option = { id_opcion: 3, Propuesta: original, Disponibilidad: slot, precio_ofrecido: regularPrice };
  let promoProposal: typeof original | undefined;
  let promoOption: typeof option | undefined;
  const tx = {
    solicitudes: { findFirst: async () => request },
    opciones: {
      findFirst: async ({ where }: { where: { id_opcion?: number } }) =>
        where.id_opcion === 3 ? option : promoOption,
      create: async ({ data }: { data: { id_disponibilidad: number; precio_ofrecido: Prisma.Decimal } }) => {
        assert.equal(data.id_disponibilidad, slot.id_disponibilidad);
        promoOption = { ...option, id_opcion: 5, precio_ofrecido: data.precio_ofrecido, Propuesta: promoProposal! };
        return promoOption;
      },
    },
    propuestasEconomicasLead: { create: async ({ data }: { data: Partial<typeof original> }) => {
      promoProposal = { ...original, ...data, id_propuesta: 8 };
      return promoProposal;
    } },
    disponibilidad: { findUnique: async () => slot },
    tarifas: { findFirst: async () => ({ precio: regularPrice, fecha_fin: null }) },
    profesionalServicio: { findFirst: async () => ({}) },
    reservas: { findFirst: async () => null },
    eventosEtapa: { findFirst: async () => null },
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('');
      if (sql.includes('sp_getapplock')) return [{ code: 0 }];
      if (sql.includes('HistorialOpcionesLead')) return [{ ok: 1 }];
      return [];
    },
  };
  t.mock.method(prisma, '$transaction', async (run: (db: typeof tx) => unknown) => run(tx));
  const createProposal = t.mock.method(tx.propuestasEconomicasLead, 'create');
  const fingerprint = hashAccess(JSON.stringify([1, 2, 3, 4, 1, '1800.00', expiry.toISOString(), '1800.00', 6, 7, 9, day, '15:00:00', '15:30:00']));
  const job: WhatsAppJob = {
    id: 1n, sessionId: 'unit', chat: '51900000000@c.us', externalId: 'inbound', quotedId: null, text: 'Tienes promociones?',
    receivedAt: new Date(), claimedAt: new Date(), attempts: 1, interactionId: null, plan: null,
  };
  const context = { menuWasShown: false, hasSuggestedSlots: false };
  const analysis = await interpretLeadWhatsApp(job.text, [], context);
  assert.equal(analysis.buscaMenorPrecio, true);
  const input = {
    offer: { personId: 1, requestId: 2, optionId: 3, proposalId: 4, fingerprint }, analysis,
    patientMessages: [job.text], publicReservation: true, menuWasShown: false, job,
  };
  const regular = await prepareChatbotReply({ ...input, analysis: { ...analysis, buscaMenorPrecio: false }, patientMessages: ['¿Cuánto cuesta?'] });
  assert.match(regular.text, /S\/ 1800\.00/);
  assert.equal(createProposal.mock.callCount(), 0);

  const promotion = await prepareChatbotReply(input);
  assert.equal(promotion.accionComercial, 'MEJORA_PROMOCION');
  assert.equal(promotion.offer?.optionId, 5);
  assert.equal(promoProposal?.precio_cotizado.toFixed(2), expected);
  assert.equal(promoProposal?.fecha_vigencia_hasta_utc_lead, expiry);
  assert.ok(promotion.text.includes(`S/ ${expected}`));
  assert.ok(promotion.text.includes(`-${discount}%`));
  assert.deepEqual((await prepareChatbotReply(input)).offer, promotion.offer);
  assert.equal(createProposal.mock.callCount(), 1);

  const lower = '¿Me puedes bajar un poco más?';
  const next = await prepareChatbotReply({ ...input, offer: promotion.offer!, patientMessages: [lower],
    analysis: await interpretLeadWhatsApp(lower, [], context) });
  assert.equal(next.discountAdvisorOffer, true);
  assert.equal(next.review, undefined);
  assert.equal(createProposal.mock.callCount(), 1);

  const confirmation = await prepareChatbotReply({ ...input, offer: promotion.offer!,
    revisionOrigin: promotion.revisionOrigin,
    patientMessages: ['Quiero hacer la prerreserva'], analysis: { ...analysis, intent: 'CONFIRMAR', buscaMenorPrecio: false } });
  assert.deepEqual(confirmation.offer, promotion.offer);
  assert.equal(confirmation.decision, 'REVISION_PROPUESTA');
  assert.equal(confirmation.confirmationLink, undefined);
  assert.equal(confirmation.review, true);
  assert.deepEqual(confirmation.revisionOrigin, input.offer);
});

test('recognizes a validity question as a query, separate from accepting an offer or asking about a turn', async () => {
  for (const message of ['¿La oferta sigue disponible?', '¿Hasta cuándo está vigente la promoción?', '¿Sigue vigente?']) {
    assert.equal(asksAboutOfferValidity(message), true);
    const result = await interpretLeadWhatsApp(message, [], { menuWasShown: true, hasSuggestedSlots: false });
    assert.equal(result.intent, 'VIGENCIA');
  }
  assert.equal(asksAboutOfferValidity('Sí, acepto la oferta'), false);
  assert.equal(asksAboutOfferValidity('¿Sigue disponible el horario de la tarde?'), false);
});

test('only continues with the action the patient agreed to in the prior offer reply', () => {
  assert.equal(acceptsOfferFollowUp('Sí, búscame otra oferta', 'nueva_oferta'), true);
  assert.equal(acceptsOfferFollowUp('Sí, búscame otra oferta', 'prerreserva'), false);
  assert.equal(acceptsOfferFollowUp('Quiero otro horario', 'horario'), true);
  assert.equal(acceptsOfferFollowUp('¿Sigue vigente la oferta?', 'prerreserva'), false);
  assert.equal(acceptsOfferFollowUp('No, no quiero reservar', 'prerreserva'), false);
});

test('keeps both catalog questions when interpreting a single message', async t => {
  const query = '¿En qué sedes atienden y qué especialistas tienen para mi tratamiento?';
  const analysis = {
    intent: 'CATALOGO' as const, dia: '', turno: '', sede: '', profesional: '', tono: 'neutro',
    buscaMenorPrecio: false, temas: ['SEDES', 'ESPECIALISTAS'] as const, servicio: '',
  };
  const previousKey = process.env.GROQ_LEAD_CHATBOT_API_KEY;
  process.env.GROQ_LEAD_CHATBOT_API_KEY = 'simulated';
  t.after(() => {
    if (previousKey === undefined) delete process.env.GROQ_LEAD_CHATBOT_API_KEY;
    else process.env.GROQ_LEAD_CHATBOT_API_KEY = previousKey;
  });
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(analysis) } }],
  }));
  const classified = await interpretLeadWhatsApp(query, [], { menuWasShown: false, hasSuggestedSlots: false });
  assert.equal(classified.intent, 'CATALOGO');
  assert.deepEqual(classified.temas, ['SEDES', 'ESPECIALISTAS']);
  assert.equal((await interpretLeadWhatsApp('Sí, acepto la promoción', [], { menuWasShown: true, hasSuggestedSlots: false })).intent, 'CONFIRMAR');
  assert.equal(fetch.mock.callCount(), 1);
});

test('usa la interpretación de Groq para agendar expresiones coloquiales y valida su evidencia', async t => {
  const message = 'Me agarraste en plena chamba, ¿lo vemos al día siguiente después de almorzar?';
  const analysis = {
    intent: 'SEGUIMIENTO', dia: '', turno: '', sede: '', profesional: '', tono: 'empatia',
    buscaMenorPrecio: false, temas: [], servicio: '', seguimiento: {
      dia: 'mañana', turno: 'tarde', hora: '', cita_textual: 'al día siguiente después de almorzar', ocupado: true,
    },
  };
  const key = process.env.GROQ_LEAD_CHATBOT_API_KEY;
  process.env.GROQ_LEAD_CHATBOT_API_KEY = 'simulated';
  t.after(() => {
    if (key === undefined) delete process.env.GROQ_LEAD_CHATBOT_API_KEY;
    else process.env.GROQ_LEAD_CHATBOT_API_KEY = key;
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(analysis) } }],
  }));
  const result = await interpretLeadWhatsApp(message, [], { menuWasShown: false, hasSuggestedSlots: false });
  const receivedAt = new Date('2026-11-13T23:47:00Z');
  assert.deepEqual(resolveFollowUpPreference(message, receivedAt, undefined, result.seguimiento),
    { date: '2026-11-14', turn: 'tarde', wasBusy: true });
  const unsupported = { ...analysis.seguimiento, cita_textual: 'el domingo a las 11' };
  assert.equal(resolveFollowUpPreference(message, receivedAt, undefined, unsupported).date, undefined);
  const dateOnly = 'Mejor déjalo para el día siguiente';
  assert.deepEqual(resolveFollowUpPreference(dateOnly, receivedAt, { date: '2026-11-13', turn: 'noche', time: '19:30' }, {
    dia: 'mañana', turno: '', hora: '', cita_textual: 'el día siguiente', ocupado: false,
  }), { date: '2026-11-14', turn: undefined, wasBusy: false });
});

test('checks the quoted offer and answers separately for expired terms, unavailable time and a valid offer', async t => {
  const amount = new Prisma.Decimal(100);
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  const day = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
  const offer = { personId: 1, requestId: 2, optionId: 3, proposalId: 4, fingerprint: '' };
  const analysis = await interpretLeadWhatsApp('¿Mi propuesta sigue disponible?', [], { menuWasShown: false, hasSuggestedSlots: false });
  for (const state of ['expired', 'busy', 'valid', 'changed', 'inactivePromotion'] as const) {
    const expiry = state === 'expired' ? past : future;
    const proposal = {
      id_propuesta: 4, numero_version: 1, precio_cotizado: amount, id_solicitud: 2, id_servicio: 5,
      estado: 'Pendiente', fecha_vigencia_hasta_utc_lead: expiry,
      id_promocion_lead: state === 'inactivePromotion' ? 8 : null,
    };
    const slot = {
      id_disponibilidad: 6, id_sede: 7, id_profesional: 9, fecha: new Date(day + 'T00:00:00Z'),
      hora_inicio: new Date('1970-01-01T15:00:00Z'), hora_fin: new Date('1970-01-01T15:30:00Z'),
      estado: state === 'busy' ? 'Ocupado' : 'Disponible', Sede: { activo: true }, Profesional: { activo: true },
    };
    const snapshot = [1, 2, 3, 4, 1, '100.00', expiry.toISOString(), '100.00', 6, 7, 9, day, '15:00:00', '15:30:00'];
    const fingerprint = state === 'changed' ? 'cambió' : hashAccess(JSON.stringify(snapshot));
    const rows = [[], [{ ok: 1 }], []];
    const tx = {
      solicitudes: { findFirst: async () => ({
        id_solicitud: 2, id_servicio: 5, estado: 'Abierta', Persona: { Etapa: { nombre: 'LEAD' } },
        Servicio: { activo: true }, resultado_comercial_lead: 'PENDIENTE',
      }) },
      opciones: { findFirst: async () => ({ id_opcion: 3, Propuesta: proposal, Disponibilidad: slot, precio_ofrecido: amount }) },
      promocionesLead: { findFirst: async () => null },
      profesionalServicio: { findFirst: async () => ({}) },
      reservas: { findFirst: async () => null },
      eventosEtapa: { findFirst: async () => null },
      $queryRaw: async () => rows.shift(),
    };
    const transaction = t.mock.method(prisma, '$transaction', async (run: (db: typeof tx) => unknown) => run(tx));
    try {
      const reply = await prepareChatbotReply({
        offer: { ...offer, fingerprint }, analysis, menuWasShown: false,
        patientMessages: ['¿Mi propuesta sigue disponible?'], publicReservation: true,
      });
      if (state === 'expired' || state === 'inactivePromotion') {
        assert.equal(reply.offerFollowUp, 'nueva_oferta');
        assert.match(reply.text, /ya no está vigente/);
      } else if (state === 'busy') {
        assert.equal(reply.offerFollowUp, 'horario');
        assert.match(reply.text, /tarifa.*vigente.*horario.*ya no está disponible/);
      } else if (state === 'valid') {
        assert.equal(reply.offerFollowUp, 'prerreserva');
        assert.equal(reply.verifyOffer, true);
        assert.equal(reply.confirmationLink, undefined);

        const input = {
          offer: { ...offer, fingerprint }, menuWasShown: false, publicReservation: true,
          analysis: { ...analysis, intent: 'CONFIRMAR' as const }, patientMessages: ['¿Cómo hago la prerreserva?'],
        };
        for (const publicReservation of [true, false]) {
          const options = [[], [{ ok: 1 }], []];
          rows.push(...options);
          const confirmation = await prepareChatbotReply({ ...input, publicReservation });
          assert.equal(confirmation.confirmationLink, publicReservation || undefined);
          assert.equal(confirmation.review, undefined);
          assert.match(confirmation.text, /S\/ 100.00/);
          assert.match(confirmation.text, /3:00 p\. m\. - 3:30 p\. m\./);
        }
        rows.push([], [{ ok: 1 }], []);
        const information = await prepareChatbotReply({ ...input, analysis: {
          ...analysis, intent: 'DETALLES', temas: ['DETALLES', 'PRECIO'],
        }, patientMessages: ['Me interesa, ¿qué incluye y cuánto cuesta?'] });
        assert.equal(information.confirmationLink, undefined);
        assert.equal(information.review, undefined);
        assert.match(information.text, /S\/ 100.00/);
      } else {
        assert.equal(reply.offerFollowUp, 'nueva_oferta');
        assert.equal(reply.review, undefined);
        assert.match(reply.text, /condiciones de la propuesta cambiaron/);
      }
    } finally {
      transaction.mock.restore();
    }
  }
});
