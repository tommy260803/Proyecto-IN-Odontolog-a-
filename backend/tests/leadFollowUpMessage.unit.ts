import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLeadFollowUpMessage, FollowUpMessageContext } from '../src/services/leadFollowUpMessage';

const base: FollowUpMessageContext = {
  name:'Diana',service:'Evaluación General',now:new Date('2026-11-11T15:00:00Z'),
  contactAt:new Date('2026-11-14T15:00:00Z'),replies:[],proposals:[],
};
test('only documented patient text supplies conversation context, and advisor notes are not input',()=>{
  const text=buildLeadFollowUpMessage({...base,replies:['No puedo el jueves por la tarde','La sede me queda lejos']});
  assert.ok(text.includes('«La sede me queda lejos»; después, «No puedo el jueves por la tarde»'));
  assert.ok(text.includes('restricciones que nos indicaste'));
  assert.ok(!text.includes('Ya reservamos'));
});
test('does not advertise a price that expires before scheduled contact',()=>{
  const text=buildLeadFollowUpMessage({...base,proposals:[{id:1,price:'48',expiresAt:new Date('2026-11-12T15:00:00Z')}]});
  assert.ok(!text.includes('48.00'));
  assert.ok(text.includes('comprobar nuevamente'));
});
test('uses current verified proposal price and Lima expiry without claiming acceptance',()=>{
  const text=buildLeadFollowUpMessage({...base,proposals:[{id:1,price:'48',expiresAt:new Date('2026-11-15T03:00:00Z')}]});
  assert.ok(text.includes('S/ 48.00'));
  assert.ok(text.includes('14/11/2026'));
  assert.ok(!text.includes('aceptaste'));
});
test('multiple proposal roots cannot be presented as a single selected agreement',()=>{
  const text=buildLeadFollowUpMessage({...base,proposals:[1,2].map(id=>({id,price:'48',expiresAt:new Date('2026-11-15T15:00:00Z')}))});
  assert.ok(text.includes('varias propuestas'));
  assert.ok(!text.includes('S/ 48.00'));
});
test('economic concern receives an authorized review path, never a promised discount',()=>{
  const text=buildLeadFollowUpMessage({...base,replies:['Solo cuento con 45 soles']});
  assert.ok(text.includes('«Solo cuento con 45 soles»'));
  assert.ok(text.includes('condición económica autorizada'));
  assert.ok(!text.includes('S/ 45.00'));
});
test('site concern does not offer the rejected site or fabricate alternatives',()=>{
  const text=buildLeadFollowUpMessage({...base,replies:['No puedo en la sede California']});
  assert.ok(text.includes('revisar otra sede'));
  assert.ok(!text.includes('disponible en California'));
});
test('missing evidence does not invent a prior conversation or a commercial reason',()=>{
  const text=buildLeadFollowUpMessage(base);
  assert.ok(!text.includes('nos comentaste'));
  assert.ok(!text.includes('descuento'));
  assert.ok(text.includes('importe, la sede'));
});
test('WhatsApp receipt changes the follow-up question without claiming interest or reading', () => {
  const delivered = buildLeadFollowUpMessage({ ...base, whatsappStatus: 'delivered' });
  const read = buildLeadFollowUpMessage({ ...base, whatsappStatus: 'read' });
  assert.match(delivered, /¿Pudiste revisar la propuesta\?/);
  assert.match(read, /¿Te gustaría que revisemos otro horario/);
  assert.doesNotMatch(read, /vimos que|ya leíste|aceptaste|descuento/i);
});
test('bounded context remains inside persisted draft limit and past expiry is excluded',()=>{
  const text=buildLeadFollowUpMessage({...base,replies:['precio sede horario especialista '.repeat(100),'x'.repeat(1000)],
    proposals:[{id:1,price:'100',expiresAt:new Date('2026-11-01T15:00:00Z')}]});
  assert.ok(text.length<=2000);
  assert.ok(!text.includes('S/ 100.00'));
});
