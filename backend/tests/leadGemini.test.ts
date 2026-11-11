import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyLeadChat, LeadGeminiError } from '../src/services/leadGemini';

const config = { key: 'synthetic-test-key', model: 'gemini-test' };
const context = [{ remitente: 'PACIENTE', texto: '¿Puedo ir por la tarde?' }];
const response = (text: string, finishReason = 'STOP') => Response.json({
  candidates: [{ finishReason, content: { parts: [{ text }] } }],
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
