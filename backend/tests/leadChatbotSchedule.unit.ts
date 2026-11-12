import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsAgendaChange, agendaConstraints, agendaOptionNumber, formatLeadAgenda, hasScheduleConflict, readAgendaPreference, searchLeadAgenda } from '../src/services/leadChatbotSchedule';
import type { LeadNegotiationSlot } from '../src/services/leadNegotiationSlots';

const sites = [{ id: 1, name: 'Sede Centro Histórico' }, { id: 2, name: 'Sede California' }];
const doctors = [
  { id: 10, name: 'Diego Salazar', aliases: ['Diego'] },
  { id: 11, name: 'Fernando Vargas León', aliases: ['Fernando'] },
];
const slot: LeadNegotiationSlot = {
  id_disponibilidad: 1, id_sede: 2, id_profesional: 11,
  fecha: '2026-11-18', inicio: '15:00', fin: '15:30', sede: sites[1].name, profesional: doctors[1].name,
};

test('preserves a named site across turns and excludes both explicitly rejected shifts', () => {
  const messages = ['Prefiero California', 'No puedo en la mañana ni en la noche', '¿Qué opciones hay?'];
  const site = readAgendaPreference(messages, sites, 'sede', 1);
  assert.equal(site.item?.id, 2);
  assert.deepEqual(site.excluded, []);
  assert.deepEqual(agendaConstraints(messages).excludedShifts.sort(), ['mañana', 'noche']);
  assert.equal(hasScheduleConflict('Por la mañana trabajo'), true);
});

test('keeps a site when the objection is about a turn and restores a rejected shift only after a correction', () => {
  const messages = ['California no me sirve en la mañana', 'Quiero California por la tarde'];
  assert.equal(readAgendaPreference(messages, sites, 'sede', 2).item?.id, 2);
  assert.deepEqual(agendaConstraints(messages).excludedShifts, ['mañana']);
  assert.deepEqual(agendaConstraints([...messages, 'Ahora sí puedo por la mañana']).excludedShifts, []);
  assert.deepEqual(agendaConstraints(['Ese turno no me sirve', '¿Qué opciones hay?'], 'tarde').excludedShifts, ['tarde']);
});

test('does not confuse mañana the date with the morning shift and accepts a later clarification', () => {
  assert.equal(agendaConstraints(['No puedo mañana']).needsTimeClarification, true);
  assert.deepEqual(agendaConstraints(['No puedo mañana']).excludedShifts, []);
  assert.equal(agendaConstraints(['Solo después de las 16:00', 'viernes por la tarde']).needsTimeClarification, true);
  const clarified = agendaConstraints(['Solo después de las 16:00', 'Ahora me sirve cualquier horario', 'viernes por la tarde']);
  assert.equal(clarified.needsTimeClarification, false);
  assert.deepEqual(clarified.preferredDays, [4]);
  assert.deepEqual(clarified.preferredShifts, ['tarde']);
});

test('keeps a rejected specialist excluded and asks for an ambiguous first name', () => {
  assert.deepEqual(readAgendaPreference(['Prefiero otro especialista'], doctors, 'especialista', 10).excluded, [10]);
  assert.deepEqual(readAgendaPreference(['No quiero con Diego', 'Fernando'], doctors, 'especialista', 10).excluded, [10]);
  assert.equal(readAgendaPreference(['Prefiero con Diego'], [...doctors, {
    id: 12, name: 'Diego Torres', aliases: ['Diego'],
  }], 'especialista').ambiguous, true);
});

test('asks before offering another specialist, even if the preference was flexible', async () => {
  const messages = ['Solo en California, con Diego', 'No puedo en la mañana'];
  const input = {
    site: readAgendaPreference(messages, sites, 'sede', 1),
    professional: readAgendaPreference(messages, doctors, 'especialista', 10),
    constraints: agendaConstraints(messages), messages,
  };
  const queried: (number | undefined)[] = [];
  const find: Parameters<typeof searchLeadAgenda>[1] = async query => {
    assert.equal(query.siteId, 2);
    assert.deepEqual(query.constraints.excludedShifts, ['mañana']);
    queried.push(query.professionalId);
    if (!query.professionalId) assert.equal(query.excludedProfessionalId, 10);
    return query.professionalId ? [] : [slot];
  };
  const pending = await searchLeadAgenda(input, find);
  assert.deepEqual(pending.slots, []);
  assert.deepEqual(queried, [10]);
  assert.match(pending.notice, /^Disculpa.*California.*Diego/);
  assert.equal(pending.permission, 'especialista');
  const approved = await searchLeadAgenda({ ...input, permission: 'especialista' }, find);
  assert.deepEqual(approved.slots, [slot]);
  assert.match(approved.notice, /cambian solo el especialista/);
});

test('asks before changing an exclusive site, then keeps the specialist and excluded shift after permission', async () => {
  const messages = ['Prefiero California. Solo con Fernando', 'No puedo por la mañana'];
  const input = {
    site: readAgendaPreference(messages, sites, 'sede', 1),
    professional: readAgendaPreference(messages, doctors, 'especialista', 10),
    constraints: agendaConstraints(messages), messages,
  };
  const find: Parameters<typeof searchLeadAgenda>[1] = async query => {
    assert.deepEqual(query.constraints.excludedShifts, ['mañana']);
    return !query.siteId && query.professionalId === 11 ? [{ ...slot, id_sede: 1 }] : [];
  };
  const pending = await searchLeadAgenda(input, find);
  assert.deepEqual(pending.slots, []);
  assert.equal(pending.permission, 'sede');
  assert.match(pending.notice, /¿Quieres que busque en otra sede\?/);
  const approved = await searchLeadAgenda({ ...input, permission: 'sede' }, find);
  assert.equal(approved.slots[0].id_sede, 1);
  assert.equal(approved.slots[0].id_profesional, 11);
});

test('when the patient allows another turn the site, specialist and exclusions remain', async () => {
  const messages = ['Prefiero California con Fernando por la tarde', 'No puedo en la mañana'];
  const result = await searchLeadAgenda({
    site: readAgendaPreference(messages, sites, 'sede'),
    professional: readAgendaPreference(messages, doctors, 'especialista'),
    constraints: agendaConstraints(messages), messages, permission: 'turno',
  }, async query => {
    assert.deepEqual(query.constraints.excludedShifts, ['mañana', 'tarde']);
    return query.siteId === 2 && query.professionalId === 11 && !query.constraints.preferredShifts.length
      ? [{ ...slot, inicio: '18:00', fin: '18:30' }] : [];
  });
  assert.equal(result.slots[0].inicio, '18:00');
  assert.match(result.notice, /cambian solo el turno/);
});

test('another specialist refers to the displayed agenda and survives a follow-up answer', () => {
  const messages = ['Quisiera otro especialista', 'California'];
  const preferred = readAgendaPreference(messages, doctors, 'especialista', 10, '', [[slot], undefined]);
  assert.equal(preferred.item, undefined);
  assert.deepEqual(preferred.excluded, [11]);
  assert.equal(readAgendaPreference(['No quiero otro especialista'], doctors, 'especialista', 10, '', [[slot]]).item?.id, 10);
  assert.equal(acceptsAgendaChange('Sí, puede ser otro especialista', 'especialista'), true);
  assert.equal(acceptsAgendaChange('No, prefiero al mismo especialista', 'especialista'), false);
});

test('shows at most five slots grouped by specialist and site and stores the displayed order', () => {
  const row = (id: number, id_profesional: number, id_sede: number) => ({
    ...slot, id_disponibilidad: id, id_profesional, id_sede,
    profesional: doctors.find(item => item.id === id_profesional)!.name,
    sede: sites.find(item => item.id === id_sede)!.name,
  });
  const agenda = formatLeadAgenda([
    row(1, 11, 2), row(2, 10, 1), row(3, 11, 2), row(4, 11, 1), row(5, 10, 1), row(6, 10, 2),
  ], 'Te recomiendo la opción 1 porque coincide con el turno que pediste.');
  assert.deepEqual(agenda.slots.map(item => item.id_disponibilidad), [1, 3, 2, 5, 4]);
  assert.match(agenda.text, /\*Esp\.: Fernando Vargas León — Sede: California\*\n1\./);
  assert.match(agenda.text, /\*Esp\.: Diego Salazar — Sede: Centro Histórico\*\n3\./);
  assert.match(agenda.text, /\*Esp\.: Fernando Vargas León — Sede: Centro Histórico\*\n5\./);
  assert.equal(agenda.slots[agendaOptionNumber('opción 5')! - 1].id_disponibilidad, 4);
  assert.equal((agenda.text.match(/\*Recomendada\*/g) ?? []).length, 1);
  assert.doesNotMatch(agenda.text, /\n6\./);
});
