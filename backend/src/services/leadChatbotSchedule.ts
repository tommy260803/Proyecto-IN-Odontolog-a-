import { excludedLeadShifts, leadScheduleConstraints } from './leadGemini';
import { formatAppointmentTime } from '../utils/appointmentTime';
import { normalizeChatbotText } from './leadChatbotGroq';
import type { LeadNegotiationSlot } from './leadNegotiationSlots';

export type AgendaSite = { id: number; name: string; address?: string };
type CatalogItem = AgendaSite & { aliases?: string[] };
type Preference = { item?: CatalogItem; strict: boolean; excluded: number[]; ambiguous: boolean };
export type AgendaDimension = 'sede' | 'especialista' | 'dia' | 'turno';
type Constraints = ReturnType<typeof leadScheduleConstraints>;
type AgendaQuery = {
  siteId?: number;
  professionalId?: number;
  excludedSiteId?: number;
  excludedProfessionalId?: number;
  constraints: Constraints;
};

const only = /\b(?:solo|solamente|unicamente|exclusivamente)\b/;
const words = (text: string) => normalizeChatbotText(text).replace(/[^a-z0-9]+/g, ' ').trim();
const shortName = (text: string) => words(text).replace(/^sede /, '');
const clauses = (text: string) => normalizeChatbotText(text).split(/[.!?;,\n]|\b(?:pero|en cambio|en vez de)\b|(?=\b(?:ahora si|prefiero)\b)/);
const otherSite = /\b(?:otras? sedes?|cambiar de sede|esta sede (?:me )?queda lejos)\b/;
const otherProfessional = /\b(?:otr[oa] (?:especialista|doctor[a]?|profesional|odontolog[oa])|cambiar de (?:especialista|doctor[a]?))\b/;
const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const rejectChange = /\bno (?:quiero|quisiera|puedo|acepto|deseo|prefiero)\b/;
const sameSite = /\b(?:(?:la )?misma sede|(?:solo|solamente|unicamente) (?:en )?(?:esa|esta) sede|(?:esa|esta) sede nada mas)\b/;
const agendaRequest = /^(?:por favor )?(?:(?:que|cuales|hay|tienen|tienes|disponen)\b|(?:(?:me )?(?:puedes?|pueden|podrias?|podrian) )?(?:me )?(?:mostrar(?:me|nos)?|muestrame|muestra|muestreme|buscar(?:me)?|busca|buscame|dar(?:me)?|dame|revisar|revisa|ver|consultar)\b).*\b(?:horarios?|turnos?|disponibilidad|opciones)\b/;

export const declinesAgendaOffer = (text: string) => /^(?:no|no gracias|prefiero que no|por ahora no)$/.test(words(text));
const isAgendaYes = (text: string) => /^(?:si(?: (?:claro|por favor|busca|adelante))?|dale|de acuerdo|adelante|esta bien)$/.test(text);
export function acceptsAgendaAdvisor(text: string) {
  const answer = words(text);
  return isAgendaYes(answer) || /^(?:si )?(?:por favor )?(?:(?:comunicame|comuniqueme|derivame|deriveme)(?: con (?:un |el )?asesor)?|(?:quiero |quisiera |puedo |puedes ayudarme a )?hablar con (?:un |el )?asesor)(?: por favor)?$/.test(answer);
}

export function continuesAgendaSearch(text: string) {
  const answer = words(text);
  return sameSite.test(answer) || /\b(?:horarios?|turnos?|disponibilidad|tambien puedo|tambien me sirve|solo en|otro dia)\b/.test(answer);
}

export function asksForAgenda(text: string) {
  return clauses(text).some(clause => agendaRequest.test(words(clause)));
}

export function choosesAgendaSite(text: string, offeredSites: AgendaSite[] = []) {
  const answer = words(text);
  return !/\b(?:direccion|donde queda|ubicacion|telefono|precio|cuanto|asesor|especialista)\b/.test(answer) && offeredSites.some(site => {
    const name = shortName(site.name);
    return name && (shortName(answer) === name ||
      (/\b(?:prefiero|quiero|muestrame|dame|revisa|busca|elige|solo)\b/.test(answer) && (` ${answer} `).includes(` ${name} `)));
  });
}

export function asksForAnotherProfessional(text: string) {
  return clauses(text).some(clause => otherProfessional.test(words(clause)) && !rejectChange.test(words(clause)));
}

export function readAgendaPreference(
  messages: string[], catalog: CatalogItem[], dimension: 'sede' | 'especialista',
  originalId?: number, requested = '', references: (LeadNegotiationSlot[] | undefined)[] = [],
  fallbackId = originalId,
): Preference {
  let item = catalog.find(candidate => candidate.id === originalId);
  let strict = false;
  let ambiguous = false;
  const excluded = new Set<number>();
  const other = dimension === 'sede' ? otherSite : otherProfessional;
  const any = dimension === 'sede'
    ? /\b(?:cualquier sede|me da igual la sede)\b/
    : /\b(?:cualquier (?:especialista|profesional|doctor[a]?)|me da igual el especialista)\b/;
  for (const [index, message] of messages.entries()) {
    for (const clause of clauses(message)) {
      const text = ' ' + words(clause) + ' ';
      if (dimension === 'sede' && item && sameSite.test(text) && !rejectChange.test(text)) strict = true;
      if (any.test(text)) {
        item = undefined;
        strict = false;
        ambiguous = false;
        continue;
      }
      const matches = catalog.flatMap(candidate => {
        const aliases = [shortName(candidate.name), ...(candidate.aliases ?? []).map(words)];
        return aliases.filter(Boolean).flatMap(alias => {
          const at = text.indexOf(' ' + alias + ' ');
          return at < 0 ? [] : [{ candidate, alias, at }];
        });
      }).filter((match, _, all) => !all.some(longer =>
        longer.at <= match.at && longer.at + longer.alias.length >= match.at + match.alias.length &&
        longer.alias.length > match.alias.length));
      const preferred = new Map<number, CatalogItem>();
      for (const { candidate, alias, at } of matches) {
        const before = text.slice(0, at);
        const after = text.slice(at + alias.length + 2);
        // A restriction on a time in California is not a rejection of California.
        const denied = /\b(?:no (?:quiero|puedo|podria|me sirve|me queda bien)|no(?= (?:en|con)\b)|excepto|menos|descarto)(?: (?:ir|atenderme|asistir|atencion|a|en|con|la|el|sede|dr|dra|doctor|doctora|especialista))*$/.test(before) ||
          /^(?:me )?queda (?:muy )?lejos\b/.test(after) ||
          (/^no (?:me sirve|me conviene)\b/.test(after) && !/\b(?:manana|tarde|noche|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(after));
        if (denied) {
          excluded.add(candidate.id);
          if (item?.id === candidate.id) { item = undefined; strict = false; }
          continue;
        }
        const clearPreference = text.trim() === alias || text.trim() === 'sede ' + alias ||
          (!before.trim() && /^(?:por la|en la|los|el)\b/.test(after)) ||
          /\b(?:prefiero|quiero|busco|busca|muestrame|dame|necesito|puedo|me sirve|me conviene|solo|solamente|con|en|sede|dr|dra|doctor|doctora)\b/.test(before);
        if (clearPreference || (index === messages.length - 1 && shortName(requested) === alias)) {
          preferred.set(candidate.id, candidate);
        }
      }
      if (preferred.size) {
        ambiguous = preferred.size > 1;
        if (preferred.size === 1) {
          const next = [...preferred.values()][0];
          strict = only.test(text) || /\b(?:nada mas|solamente)$/.test(text.trim()) || (strict && item?.id === next.id);
          item = next;
          excluded.delete(next.id);
        }
      } else if (other.test(text) && !rejectChange.test(text) && !matches.length) {
        const shown = references[index]?.map(slot => dimension === 'sede' ? slot.id_sede : slot.id_profesional);
        const previousId = item?.id ?? fallbackId;
        if (shown?.length) shown.forEach(id => excluded.add(id));
        else if (previousId !== undefined) excluded.add(previousId);
        item = undefined;
        strict = false;
        ambiguous = false;
      } else if (index === messages.length - 1 && requested && !matches.length &&
                 text.includes(' ' + shortName(requested) + ' ')) {
        ambiguous = true;
      }
    }
  }
  return { item, strict, excluded: [...excluded], ambiguous };
}

export function agendaConstraints(messages: string[], originalShift?: string) {
  const rejectedOriginal = /\b(?:no (?:puedo|podria|podre|me sirve|me acomoda|me queda bien|estoy disponible|estoy libre|tengo disponibilidad) (?:en |a )?(?:ese|esa) (?:turno|franja)|ese turno no me (?:sirve|acomoda))\b/;
  const broadAnswer = /^(?:(?:el |los )?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:s)?(?: (?:por|en) la (?:manana|tarde|noche))?|(?:por|en) la (?:manana|tarde|noche)|tarde|noche)$/;
  const parsed: string[] = [];
  for (const message of messages) {
    const text = words(message);
    const previous = leadScheduleConstraints(parsed);
    const requested = clauses(message).map(words).map(clause => {
      if (broadAnswer.test(clause)) return 'prefiero ' + clause;
      if (agendaRequest.test(clause) && !/\b(?:no|excepto|menos|descarto)\b/.test(clause)) {
        return 'prefiero ' + clause;
      }
      return clause;
    });
    // Keep punctuation for precise-time detection and treat inclusive changes as additions.
    parsed.push(message, ...requested.filter(clause => clause.startsWith('prefiero ')));
    if (originalShift && rejectedOriginal.test(text)) parsed.push('no puedo en el turno de la ' + originalShift);
    const alternative = /\b(?:otro|cualquier) (?:horario|turno) que no sea (.+)/.exec(text)?.[1];
    const excluded = alternative ? excludedLeadShifts('no puedo ' + alternative) : [];
    if (excluded.length) {
      const allowed = ['mañana', 'tarde', 'noche'].filter(shift =>
        ![...previous.excludedShifts, ...excluded].includes(shift));
      parsed.push('no puedo ' + alternative);
      if (allowed.length) parsed.push('prefiero el turno de la ' + allowed.join(' o el turno de la '));
    } else if (/\b(?:tambien|ademas) (?:puedo|me sirve|me acomoda)\b/.test(text) && previous.preferredShifts.length) {
      const next = leadScheduleConstraints([message]);
      const allowed = [...new Set([...previous.preferredShifts, ...next.preferredShifts])].filter(shift => !next.excludedShifts.includes(shift));
      if (next.preferredShifts.length && allowed.length) parsed.push('prefiero el turno de la ' + allowed.join(' o el turno de la '));
    }
  }
  return leadScheduleConstraints(parsed);
}

export function hasScheduleConflict(text: string) {
  return excludedLeadShifts(text).length > 0 || asksForAnotherProfessional(text) ||
    clauses(text).some(clause => otherSite.test(words(clause)) && !rejectChange.test(words(clause))) ||
    /\b(?:no (?:puedo|podria|podre|me sirve|me acomoda|me queda bien|estoy disponible|estoy libre|tengo disponibilidad)(?: (?:en|a|por))? (?:ese turno|esa hora|ese horario|esa franja)|otro horario|cambiar (?:el|de) horario)\b/.test(normalizeChatbotText(text));
}

export function agendaOptionNumber(text: string) {
  if (/[¿?]/.test(text)) return;
  const answer = words(text);
  const number = /^(?:(?:perfecto|si|bien|listo|de acuerdo|gracias|ok|vale) )*(?:(?:elijo|escojo|selecciono|prefiero|acepto|me quedo con|me sirve|me va bien|me acomoda|voy con|(?:quiero|quisiera|me gustaria)(?: (?:elegir|escoger|seleccionar|tomar))?)(?: entonces)? )?(?:la )?(?:opcion(?: numero)? )?(\d{1,3}|primera|segunda|tercera|cuarta|quinta)(?: opcion)?(?: entonces)?(?: por favor| gracias)?$/.exec(answer)?.[1];
  if (!number) return;
  const ordinals = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta'];
  return /^\d+$/.test(number) ? Number(number) : ordinals.indexOf(number) + 1;
}

export function acceptsAgendaChange(text: string, dimension: AgendaDimension) {
  const answer = words(text);
  if (/\b(?:no|direccion|donde queda|ubicacion|telefono|precio|cuanto|asesor)\b/.test(answer)) return false;
  if (isAgendaYes(answer)) return true;
  if (/^(?:si |ya )?(?:quiero ver|muestrame|dame|enviame|si quiero ver|puedes mostrarme|veamos) (?:las |los |otras? )?(?:opciones|alternativas|horarios)(?: disponibles| por favor)?$/.test(answer)) return true;
  const changes = { sede: otherSite, especialista: otherProfessional, dia: /\botro dia\b/, turno: /\botro turno\b/ };
  return changes[dimension].test(answer) && !/\b(?:solo|unicamente|prefiero quedarme)\b/.test(answer) &&
    /\b(?:si|puede ser|me sirve|busca|muestra|muestrame|quiero|quisiera|prefiero|dame|enviame|revisa|veamos)\b/.test(answer);
}

const dimensionLabels = { sede: 'la sede', especialista: 'el especialista', turno: 'el turno', dia: 'el día' };

export async function searchLeadAgenda(input: {
  site: Preference; professional: Preference; constraints: Constraints;
  day?: string; shift?: string; messages: string[]; permission?: AgendaDimension;
  sites?: AgendaSite[]; offeredSiteIds?: number[]; declined?: AgendaDimension[];
}, find: (query: AgendaQuery) => Promise<LeadNegotiationSlot[]>) {
  const { site, professional } = input;
  const day = dayNames.findIndex(name => words(name) === input.day);
  const constraints = { ...input.constraints };
  if (!constraints.preferredDays.length && day >= 0 && !constraints.excludedDays.includes(day)) {
    constraints.preferredDays = [day];
  }
  if (!constraints.preferredShifts.length && input.shift && !constraints.excludedShifts.includes(input.shift)) {
    constraints.preferredShifts = [input.shift];
  }
  const query: AgendaQuery = { siteId: site.item?.id, professionalId: professional.item?.id, constraints };
  const days = constraints.preferredDays.map(day => dayNames[day]);
  const shifts = constraints.preferredShifts;
  const strictTime = (values: string[]) => {
    const latest = [...input.messages].reverse().flatMap(message => clauses(message).reverse()).find(clause =>
      values.some(value => (' ' + words(clause) + ' ').includes(' ' + words(value) + ' ')));
    return Boolean(latest && only.test(latest));
  };
  const changes: { dimension: AgendaDimension; question: string; strict: boolean; query: AgendaQuery }[] = [];
  if (professional.item) changes.push({
    dimension: 'especialista',
    question: '¿Te serviría otro especialista?', strict: professional.strict,
    query: { ...query, professionalId: undefined, excludedProfessionalId: professional.item.id },
  });
  if (site.item) changes.push({
    dimension: 'sede', question: '¿Quieres ver los horarios de otra sede?', strict: site.strict,
    query: { ...query, siteId: undefined, excludedSiteId: site.item.id },
  });
  if (shifts.length) changes.push({
    dimension: 'turno', question: '¿Quieres revisar otro turno?',
    strict: strictTime(shifts),
    query: { ...query, constraints: { ...constraints, preferredShifts: [],
      excludedShifts: [...new Set([...constraints.excludedShifts, ...shifts])] } },
  });
  if (days.length) changes.push({
    dimension: 'dia', question: '¿Quieres revisar otro día?',
    strict: strictTime(days),
    query: { ...query, constraints: { ...constraints, preferredDays: [],
      excludedDays: [...new Set([...constraints.excludedDays, ...constraints.preferredDays])] } },
  });
  const approved = changes.find(change => change.dimension === input.permission) ??
    (input.permission === 'sede' && input.offeredSiteIds?.length ? { dimension: 'sede' as const, query } : undefined);
  const effective = approved?.query ?? query;
  const allowedSites = (input.sites ?? []).filter(s => s.id !== site.item?.id && !site.excluded.includes(s.id));
  const slotsBySite = async (ids: number[], criteria: AgendaQuery) => Promise.all(ids.map(id => find({ ...criteria, siteId: id })));
  let slots: LeadNegotiationSlot[];
  if (approved?.dimension === 'sede' && input.offeredSiteIds?.length) {
    const ids = allowedSites.filter(s => input.offeredSiteIds?.includes(s.id)).map(s => s.id);
    const bySite = await slotsBySite(ids, effective);
    // Include the closest option from each verified site before filling the remaining positions.
    const sortSlots = (a: LeadNegotiationSlot, b: LeadNegotiationSlot) => `${a.fecha} ${a.inicio}`.localeCompare(`${b.fecha} ${b.inicio}`);
    slots = [...bySite.flatMap(rows => rows.slice(0, 1)).sort(sortSlots), ...bySite.flatMap(rows => rows.slice(1)).sort(sortSlots)].slice(0, 5);
  } else slots = await find(effective);
  if (slots.length) {
    const matches = [
      effective.siteId && site.item && approved?.dimension !== 'sede' ? 'la sede indicada' : '',
      effective.professionalId && professional.item ? 'el especialista indicado' : '',
      effective.constraints.preferredDays.length ? 'el día que pediste' : '',
      effective.constraints.preferredShifts.length ? 'el turno que pediste' : '',
    ].filter(Boolean);
    const recommendation = matches.length
      ? 'Te recomiendo la opción 1 porque coincide con ' + new Intl.ListFormat('es').format(matches) + '.'
      : 'Te recomiendo la opción 1 porque es compatible con las preferencias revisadas.';
    return {
      slots, recommendation,
      notice: approved ? 'Estas opciones mantienen tus demás preferencias y cambian solo ' + dimensionLabels[approved.dimension] + '.' : '',
    };
  }

  const unavailable = approved?.dimension === 'sede' && input.offeredSiteIds?.length
    ? 'Disculpa, los horarios que encontré en las otras sedes ya no están disponibles con tus preferencias.'
    : 'Disculpa, por el momento no encontré horarios compatibles' +
    (site.item ? ' en ' + site.item.name + (site.item.address ? ' (' + site.item.address + ')' : '') : '') +
    (professional.item ? ' con ' + professional.item.name : '') +
    (days.length ? ' para ' + days.join(' o ') : '') +
    (shifts.length ? ' en el turno de ' + shifts.join(' o ') :
      constraints.excludedShifts.length ? ' fuera del turno de ' + new Intl.ListFormat('es').format(constraints.excludedShifts) : '') + '.';
  const remaining = changes.filter(change => change.dimension !== input.permission && !change.strict &&
    !input.declined?.includes(change.dimension) && !(site.strict && ['turno', 'dia'].includes(change.dimension)));
  for (const change of remaining) {
    if (change.dimension === 'sede' && input.sites) {
      const available = await slotsBySite(allowedSites.map(s => s.id), change.query);
      const candidates = allowedSites.filter((_, index) => available[index].length > 0);
      if (!candidates.length) continue;
      return {
        slots: [], permission: change.dimension, offeredSiteIds: candidates.map(s => s.id),
        notice: [unavailable, 'Encontré disponibilidad que mantiene tus demás preferencias en:',
          candidates.map(s => `• *${s.name}*${s.address ? ' · ' + s.address : ''}`).join('\n'),
          '¿Quieres ver los horarios de estas sedes? También puedes decirme el nombre de la sede que prefieres.'].join('\n\n'),
      };
    }
    if (!(await find(change.query)).length) continue;
    return { slots: [], notice: unavailable + ' ' + change.question, permission: change.dimension };
  }
  return { slots: [], needsAdvisorOffer: true, notice: unavailable +
    ' Si quieres, puedo comunicarte con un asesor para que revise cómo ayudarte a coordinar un turno. ¿Te gustaría hablar con un asesor?' };
}

export function formatLeadAgenda(slots: LeadNegotiationSlot[], recommendation: string, notice = '') {
  const groups = new Map<string, LeadNegotiationSlot[]>();
  for (const slot of slots.slice(0, 5)) {
    const key = slot.id_profesional + '/' + slot.id_sede;
    const group = groups.get(key) ?? [];
    group.push(slot);
    groups.set(key, group);
  }
  const ordered: LeadNegotiationSlot[] = [];
  const date = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const sections = [...groups.values()].map(group => {
    const [first] = group;
    return [
      '*Esp.: ' + first.profesional + ' — Sede: ' + first.sede.replace(/^sede\s+/i, '') + '*',
      ...group.map(slot => {
        const number = ordered.push(slot);
        return number + '. ' + date.format(new Date(slot.fecha + 'T00:00:00Z')) + ', ' +
          formatAppointmentTime(`${slot.inicio} - ${slot.fin}`) + (number === 1 ? ' · *Recomendada*' : '');
      }),
    ].join('\n');
  });
  return {
    slots: ordered,
    text: [notice, '📅 *Horarios disponibles (hora de Lima)*', ...sections, recommendation,
      'Responde con el número que prefieras y comprobaré si sigue disponible.'].filter(Boolean).join('\n\n'),
  };
}
