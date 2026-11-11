import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leadOperationalPriority } from '../src/services/leadOperationalPriority';

test('closed and paused opportunities cannot become urgent overdue cases', () => {
  const base={ followUp:new Date('2026-11-10T12:00:00Z'), firstResponse:null };
  assert.equal(leadOperationalPriority({...base,active:false},new Date('2026-11-11T15:00:00Z')).orden,5);
  assert.equal(leadOperationalPriority({...base,active:true,paused:true},new Date('2026-11-11T15:00:00Z')).orden,4);
});
test('priority follows due dates using the Lima day instead of the UTC day', () => {
  const now=new Date('2026-11-11T23:00:00Z');
  assert.equal(leadOperationalPriority({active:true,followUp:new Date('2026-11-11T22:00:00Z'),firstResponse:null},now).orden,1);
  assert.equal(leadOperationalPriority({active:true,followUp:new Date('2026-11-12T02:00:00Z'),firstResponse:null},now).orden,2);
  assert.equal(leadOperationalPriority({active:true,followUp:null,firstResponse:null},now).orden,3);
});
