import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsAgendaAdvisor, acceptsAgendaChange, agendaConstraints, agendaOptionNumber, asksForAgenda, choosesAgendaSite, continuesAgendaSearch, formatLeadAgenda, hasScheduleConflict, readAgendaPreference, searchLeadAgenda } from '../src/services/leadChatbotSchedule';
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

test('a polite request for afternoon replaces the previous night filter without reopening the morning', async () => {
  const first = 'No puedo asistir en la mañana. ¿Qué horarios tienen por la noche?';
  assert.deepEqual(agendaConstraints([first]).preferredShifts, ['noche']);
  for (const correction of ['Puedes mostrarme horarios por la tarde?', '¿Me podrían mostrar los horarios por la tarde?', '¿Podrías darme opciones para la tarde?']) {
    const messages = [first, correction];
    assert.equal(asksForAgenda(correction), true);
    const result = await searchLeadAgenda({
      site: readAgendaPreference(messages, sites, 'sede', 2),
      professional: readAgendaPreference(messages, doctors, 'especialista'),
      constraints: agendaConstraints(messages), messages, shift: 'noche',
    }, async query => {
      assert.equal(query.siteId, 2);
      assert.deepEqual(query.constraints.preferredShifts, ['tarde']);
      assert.deepEqual(query.constraints.excludedShifts, ['mañana']);
      return [slot];
    });
    assert.deepEqual(result.slots, [slot]);
  }
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
  assert.deepEqual(queried, [10, undefined]);
  assert.match(pending.notice, /^Disculpa.*California.*Diego/);
  assert.equal(pending.permission, 'especialista');
  const approved = await searchLeadAgenda({ ...input, permission: 'especialista' }, find);
  assert.deepEqual(approved.slots, [slot]);
  assert.match(approved.notice, /cambian solo el especialista/);
});

test('asks before changing a preferred site, then keeps the specialist and excluded shift after permission', async () => {
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
  assert.match(pending.notice, /¿Quieres ver los horarios de otra sede\?/);
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

test('previews only verified alternate sites and searches them again once the patient agrees', async () => {
  const branches = [...sites.map(site => ({ ...site, address: 'Dirección ' + site.id })), { id: 3, name: 'Sede El Golf' }];
  const messages = ['No puedo asistir por la mañana. ¿Qué horarios tienen por la tarde?'];
  const input = {
    site: readAgendaPreference(messages, branches, 'sede', 2),
    professional: readAgendaPreference(messages, doctors, 'especialista', undefined, '', [], 10),
    constraints: agendaConstraints(messages), messages, sites: branches,
  };
  const queries: (number | undefined)[] = [];
  const find: Parameters<typeof searchLeadAgenda>[1] = async query => {
    queries.push(query.siteId);
    assert.equal(query.professionalId, undefined);
    assert.deepEqual(query.constraints.preferredShifts, ['tarde']);
    assert.deepEqual(query.constraints.excludedShifts, ['mañana']);
    return query.siteId === 1 ? [{ ...slot, id_sede: 1, sede: branches[0].name }] : [];
  };
  const pending = await searchLeadAgenda(input, find);
  assert.deepEqual(pending.slots, []);
  assert.deepEqual(pending.offeredSiteIds, [1]);
  assert.match(pending.notice, /California \(Dirección 2\)/);
  assert.match(pending.notice, /Centro Histórico\* · Dirección 1/);
  assert.doesNotMatch(pending.notice, /El Golf|15:00/);

  queries.length = 0;
  assert.equal(acceptsAgendaChange('Sí, muéstrame las opciones', 'sede'), true);
  assert.equal(acceptsAgendaChange('¿Dónde queda la otra sede?', 'sede'), false);
  const approved = await searchLeadAgenda({ ...input, permission: 'sede', offeredSiteIds: pending.offeredSiteIds }, find);
  assert.deepEqual(approved.slots.map(row => row.id_sede), [1]);
  assert.deepEqual(queries, [1]);
  const stale = await searchLeadAgenda({ ...input, permission: 'sede', offeredSiteIds: pending.offeredSiteIds }, async () => []);
  assert.deepEqual(stale.slots, []);
  assert.match(stale.notice, /ya no están disponibles/);
  assert.equal(stale.needsAdvisorOffer, true);
});

test('understands a named branch and keeps an exclusive site while offering advisor help with consent', async () => {
  const messages = ['No puedo asistir por la mañana. ¿Qué horarios tienen por la tarde?',
    'En la misma sede de mi preferencia, pero con otro horario que no sea en la mañana.'];
  assert.equal(continuesAgendaSearch(messages[1]), true);
  assert.equal(choosesAgendaSite('Muéstrame los de Centro Histórico', sites), true);
  assert.equal(choosesAgendaSite('¿Cuál es la dirección de Centro Histórico?', sites), false);
  assert.equal(readAgendaPreference(['Muéstrame los de Centro Histórico'], sites, 'sede', 2).item?.id, 1);
  assert.deepEqual(agendaConstraints(messages).preferredShifts, ['tarde', 'noche']);
  assert.deepEqual(agendaConstraints(messages).excludedShifts, ['mañana']);
  assert.deepEqual(agendaConstraints([messages[0], 'También puedo por la noche']).preferredShifts, ['tarde', 'noche']);
  const selected = readAgendaPreference(messages, sites, 'sede', 2);
  assert.equal(selected.strict, true);
  const response = await searchLeadAgenda({ site: selected, professional: readAgendaPreference(messages, doctors, 'especialista'),
    constraints: agendaConstraints(messages), messages, sites }, async query => {
    assert.equal(query.siteId, 2);
    return [];
  });
  assert.deepEqual(response.slots, []);
  assert.equal(response.needsAdvisorOffer, true);
  assert.match(response.notice, /¿Te gustaría hablar con un asesor\?/);
  assert.equal(acceptsAgendaAdvisor('Sí, por favor'), true);
  assert.equal(acceptsAgendaAdvisor('Sí, comunícame con un asesor'), true);
  assert.equal(acceptsAgendaAdvisor('Sí, quiero ver los horarios antes de hablar con un asesor'), false);
  assert.equal(acceptsAgendaAdvisor('No, gracias'), false);
  assert.equal(acceptsAgendaAdvisor('Solo en California'), false);
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
  assert.match(agenda.text, /3:00 p\. m\. - 3:30 p\. m\./);
  assert.equal(agenda.slots[0].inicio, '15:00');
  assert.match(agenda.text, /\*Esp\.: Fernando Vargas León — Sede: California\*\n1\./);
  assert.match(agenda.text, /\*Esp\.: Diego Salazar — Sede: Centro Histórico\*\n3\./);
  assert.match(agenda.text, /\*Esp\.: Fernando Vargas León — Sede: Centro Histórico\*\n5\./);
  assert.equal(agenda.slots[agendaOptionNumber('opción 5')! - 1].id_disponibilidad, 4);
  assert.equal((agenda.text.match(/\*Recomendada\*/g) ?? []).length, 1);
  assert.doesNotMatch(agenda.text, /\n6\./);
});

test('selects the numbered slot from a natural reply and leaves questions and conditional choices alone', () => {
  const second = { ...slot, id_disponibilidad: 20, inicio: '15:30', fin: '16:00' };
  const agenda = formatLeadAgenda([slot, second], 'Te recomiendo la opción 1.');
  for (const text of ['Perfecto, me gustaría escoger entonces la opción 1.', '1.', 'Elijo la opción 1', 'Me quedo con la primera, por favor']) {
    assert.equal(agenda.slots[agendaOptionNumber(text)! - 1]?.id_disponibilidad, slot.id_disponibilidad, text);
  }
  assert.equal(agendaOptionNumber('Sí, la segunda opción'), 2);
  assert.equal(agendaOptionNumber('Opción 6'), 6);
  for (const text of ['¿Qué precio tiene la opción 1?', '¿La opción 1 sigue disponible?', 'No quiero la opción 1',
    'La opción 1 si es en California', 'Opción 1 o 2', 'Puedo a la 1:00', 'Me quedo con la opción 1, pero más tarde']) {
    assert.equal(agendaOptionNumber(text), undefined, text);
  }
});
