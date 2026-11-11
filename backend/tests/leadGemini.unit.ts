import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyLeadChat, commercialRecommendation, excludedLeadShifts, LeadGeminiError } from '../src/services/leadGemini';

const config = { key: 'synthetic-test-key', model: 'gemini-test' };
const context = [{ remitente: 'PACIENTE', texto: '¿Puedo ir por la tarde?' }];
const response = (text: string, finishReason = 'STOP') => Response.json({
  candidates: [{ finishReason, content: { parts: [{ text }] } }],
});

test('negated shifts override a stale location classification without offering the rejected shift', async () => {
  const result = await classifyLeadChat([
    { remitente: 'paciente', texto: 'Me queda lejos Centro Histórico' },
    { remitente: 'paciente', texto: 'que no puedo en la tarde' },
  ], config, async () => response(JSON.stringify({
    intencion: 'SEDE', dia: 'sin_dato', turno: 'tarde', objecion_economica: false,
    sugerencia: 'Pregunta desde qué zona se desplaza.',
  })), true, { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: null, promociones: [] });
  assert.equal(result.intencion, 'HORARIO');
  assert.equal(result.turno, '');
  assert.deepEqual(result.turnos_excluidos, ['tarde']);
  assert.equal(result.objecion_economica, false);
});

test('tomorrow as a calendar day does not reject the morning shift', () => {
  assert.deepEqual(excludedLeadShifts('no puedo mañana'), []);
  assert.deepEqual(excludedLeadShifts('no puedo en la mañana'), ['mañana']);
  assert.deepEqual(excludedLeadShifts('excepto por la noche'), ['noche']);
});

test('sends one bounded request and returns a locally defined suggestion', async () => {
  let calls = 0;
  const result = await classifyLeadChat(context, config, async (url, init) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), config.key);
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    assert.deepEqual(JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text), context);
    return response('{"intencion":"HORARIO"}');
  });
  assert.equal(calls, 1);
  assert.equal(result.intencion, 'HORARIO');
  assert.match(result.sugerencia, /rango horario/);
});

test('rejects invalid and truncated output and maps quota errors without retry', async () => {
  for (const [reply, status] of [
    [response('{"intencion":"RESERVAR"}'), 502],
    [response('{"intencion":"HORARIO","accion":"reservar"}'), 502],
    [response('{"intencion":"HORARIO"}', 'MAX_TOKENS'), 502],
    [new Response(null, { status: 429 }), 429],
  ] as const) {
    let calls = 0;
    await assert.rejects(classifyLeadChat(context, config, async () => {
      calls++;
      return reply;
    }), (error: unknown) => error instanceof LeadGeminiError && error.status === status);
    assert.equal(calls, 1);
  }
});

test('commercial suggestions use the conversation and supplied terms without replacing the answer with a template', async () => {
  const facts = { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: '60.00', promociones: [] };
  const answer = 'Entiendo que ese importe supera lo que puedes pagar. ¿Prefieres revisar la atención para otro momento con el asesor?';
  const result = await classifyLeadChat(context, config, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), { mensajes: context, condiciones: facts });
    return response(JSON.stringify({ intencion: 'PRECIO', dia: 'jueves', turno: 'tarde',
      objecion_economica: true, sugerencia: answer }));
  }, true, facts);
  assert.equal(result.sugerencia, answer);
  assert.equal(result.dia, 'jueves');
  assert.equal(result.turno, 'tarde');
});

test('commercial suggestions reject empty answers and invalid preferences', async () => {
  const facts = { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: null, promociones: [] };
  const base = { intencion: 'PRECIO', dia: 'sin_dato', turno: 'sin_dato', objecion_economica: true };
  for (const change of [
    { sugerencia: '   ' },
    { sugerencia: 'Revisemos horarios.', dia: 'ayer' },
  ]) {
    await assert.rejects(classifyLeadChat(context, config, async () =>
      response(JSON.stringify({ ...base, ...change })), true, facts), LeadGeminiError);
  }
});

test('unsupported money claims produce a verified next step instead of blocking the saved conversation', async () => {
  const facts = { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: null, promociones: [] };
  for (const suggested of ['Podemos dejarlo en S/ 30.', 'Tienes un descuento del 20%.']) {
    const result = await classifyLeadChat(context, config, async () => response(JSON.stringify({
      intencion: 'PRECIO', dia: 'sin_dato', turno: 'sin_dato', objecion_economica: true, sugerencia: suggested,
    })), true, facts);
    assert.match(result.sugerencia, /responsable comercial/);
    assert.doesNotMatch(result.sugerencia, /S\/ 30|20%/);
  }
});

test('patient budget remains a declared budget and never becomes an authorized price', async () => {
  const result = await classifyLeadChat([{ remitente: 'paciente', texto: 'solo cuento con 45 soles' }],
    config, async () => response(JSON.stringify({
      intencion: 'PRECIO', dia: 'sin_dato', turno: 'sin_dato', objecion_economica: true,
      sugerencia: 'El presupuesto del paciente es de 45 soles. Consulta la reducción.',
    })), true, { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: null, promociones: [] });
  assert.match(result.sugerencia, /presupuesto de S\/ 45.00/);
  assert.match(result.sugerencia, /si la autoriza/);
});

test('a location objection after a budget message returns site advice even if the model mentions the old budget', async () => {
  const result = await classifyLeadChat([
    { remitente: 'paciente', texto: 'solo cuento con 45 soles' },
    { remitente: 'paciente', texto: 'me queda muy lejos la sede de centro historico' },
  ], config, async () => response(JSON.stringify({
    intencion: 'SEDE', dia: 'sin_dato', turno: 'sin_dato', objecion_economica: false,
    sugerencia: 'Consulta otra sede y considera los 45 soles del paciente.',
  })), true, { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: null, promociones: [],
    sedesConAgenda: ['Sede California'] });
  assert.match(result.sugerencia, /Sede California/);
  assert.doesNotMatch(result.sugerencia, /45|reducción/);
});

test('price objections produce an actionable escalation when there is no authorized lower proposal', () => {
  const result = commercialRecommendation({ intencion: 'PRECIO', objecion_economica: true }, {
    servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: '60.00', promociones: [],
  });
  assert.match(result, /No hay una propuesta vigente de menor importe/);
  assert.match(result, /responsable comercial/);
  assert.match(result, /nueva versión si la autoriza/);
  assert.match(result, /pendiente/);
  assert.doesNotMatch(result, /¿/);
});

test('lower proposal recommendations identify the actual proposal instead of inventing a reduction', async () => {
  const facts = { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: '60.00', promociones: [],
    propuestasMenores: [{ id_propuesta: 23, precio: '40.00' }] };
  const answer = 'Hay una propuesta por S/ 40.00 que podemos revisar contigo antes de ofrecerla.';
  const result = await classifyLeadChat(context, config, async () =>
    response(JSON.stringify({ intencion: 'PRECIO', dia: 'sin_dato', turno: 'sin_dato',
      objecion_economica: true, sugerencia: answer })), true, facts);
  assert.equal(result.sugerencia, answer);
  assert.match(result.recomendacion!, /#23 por S\/ 40.00/);
});

test('schedule, acceptance and clinical messages have distinct review actions', () => {
  const facts = { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: null, promociones: [] };
  assert.match(commercialRecommendation({ intencion: 'HORARIO' }, facts), /verificar la disponibilidad/);
  assert.match(commercialRecommendation({ intencion: 'REVISION' }, facts), /versión, horario y autorización/);
  assert.match(commercialRecommendation({ intencion: 'REVISION' }, facts), /clínico/);
  assert.match(commercialRecommendation({ intencion: 'AMBIGUO' }, facts), /Aclara/);
});

test('the repeated generic question from a price objection is replaced with a concrete authorized next step', async () => {
  const facts = { servicio: 'Evaluación', precioPropuesta: '48.00', tarifaReferencia: null, promociones: [] };
  const result = await classifyLeadChat([
    { remitente: 'paciente', texto: '48 soles es muy caro' },
    { remitente: 'paciente', texto: 'que sea menos dinero' },
  ], config, async () => response(JSON.stringify({
    intencion: 'PRECIO', dia: 'sin_dato', turno: 'sin_dato', objecion_economica: true,
    sugerencia: 'Comprendo. ¿Qué alternativa o momento le resulta viable para revisarlo con el asesor?',
  })), true, facts);
  assert.doesNotMatch(result.sugerencia, /alternativa o momento/);
  assert.match(result.sugerencia, /Solicita al responsable comercial autorización/);
  assert.match(result.recomendacion!, /nueva versión/);
});
