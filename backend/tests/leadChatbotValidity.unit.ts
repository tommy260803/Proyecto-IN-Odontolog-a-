import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db';
import { prepareChatbotReply } from '../src/services/leadChatbotAgent';
import { acceptsOfferFollowUp, asksAboutOfferValidity, interpretLeadWhatsApp } from '../src/services/leadChatbotGroq';
import { hashAccess } from '../src/services/leadPayerTransfer';

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
      } else {
        assert.equal(reply.offerFollowUp, undefined);
        assert.equal(reply.review, true);
      }
    } finally {
      transaction.mock.restore();
    }
  }
});
