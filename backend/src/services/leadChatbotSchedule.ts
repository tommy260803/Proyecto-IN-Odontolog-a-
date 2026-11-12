import { excludedLeadShifts, leadScheduleConstraints } from './leadGemini';
import { normalizeChatbotText } from './leadChatbotGroq';
import type { LeadNegotiationSlot } from './leadNegotiationSlots';

type CatalogItem = { id: number; name: string; aliases?: string[] };
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
const otherSite = /\b(?:otra sede|cambiar de sede|esta sede (?:me )?queda lejos)\b/;
const otherProfessional = /\b(?:otr[oa] (?:especialista|doctor[a]?|profesional|odontolog[oa])|cambiar de (?:especialista|doctor[a]?))\b/;
const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const rejectChange = /\bno (?:quiero|quisiera|puedo|acepto|deseo|prefiero)\b/;

export function asksForAnotherProfessional(text: string) {
  return clauses(text).some(clause => otherProfessional.test(words(clause)) && !rejectChange.test(words(clause)));
}

export function readAgendaPreference(
  messages: string[], catalog: CatalogItem[], dimension: 'sede' | 'especialista',
  originalId?: number, requested = '', references: (LeadNegotiationSlot[] | undefined)[] = [],
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
          /\b(?:prefiero|quiero|busco|necesito|puedo|me sirve|me conviene|solo|solamente|con|en|sede|dr|dra|doctor|doctora)\b/.test(before);
        if (clearPreference || (index === messages.length - 1 && shortName(requested) === alias)) {
          preferred.set(candidate.id, candidate);
        }
      }
      if (preferred.size) {
        ambiguous = preferred.size > 1;
        if (preferred.size === 1) {
          const next = [...preferred.values()][0];
          strict = only.test(text) || (strict && item?.id === next.id);
          item = next;
          excluded.delete(next.id);
        }
      } else if (other.test(text) && !rejectChange.test(text) && !matches.length) {
        const shown = references[index]?.map(slot => dimension === 'sede' ? slot.id_sede : slot.id_profesional);
        const previousId = item?.id ?? originalId;
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
  return leadScheduleConstraints(messages.flatMap(message => {
    const text = words(message);
    if (originalShift && rejectedOriginal.test(text)) return [message, 'no puedo en el turno de la ' + originalShift];
    if (broadAnswer.test(text)) return ['prefiero ' + text];
    return [message];
  }));
}

export function hasScheduleConflict(text: string) {
  return excludedLeadShifts(text).length > 0 || asksForAnotherProfessional(text) ||
    clauses(text).some(clause => otherSite.test(words(clause)) && !rejectChange.test(words(clause))) ||
    /\b(?:no (?:puedo|podria|podre|me sirve|me acomoda|me queda bien|estoy disponible|estoy libre|tengo disponibilidad)(?: (?:en|a|por))? (?:ese turno|esa hora|ese horario|esa franja)|otro horario|cambiar (?:el|de) horario)\b/.test(normalizeChatbotText(text));
}

export function agendaOptionNumber(text: string) {
  const number = /^(?:opcion\s+)?([1-5])\s*[.)]?$/.exec(normalizeChatbotText(text))?.[1];
  return number ? Number(number) : undefined;
}

export function acceptsAgendaChange(text: string, dimension: AgendaDimension) {
  const answer = words(text);
  if (/\bno\b/.test(answer)) return false;
  if (/^(?:si(?: (?:claro|por favor|busca|adelante))?|dale|de acuerdo|adelante|esta bien)$/.test(answer)) return true;
  const changes = { sede: otherSite, especialista: otherProfessional, dia: /\botro dia\b/, turno: /\botro turno\b/ };
  return changes[dimension].test(answer) && !/\b(?:solo|unicamente|prefiero quedarme)\b/.test(answer);
}

const dimensionLabels = { sede: 'la sede', especialista: 'el especialista', turno: 'el turno', dia: 'el día' };

export async function searchLeadAgenda(input: {
  site: Preference; professional: Preference; constraints: Constraints;
  day?: string; shift?: string; messages: string[]; permission?: AgendaDimension;
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
  if (site.item) changes.push({
    dimension: 'sede',
    question: '¿Quieres que busque en otra sede?', strict: site.strict,
    query: { ...query, siteId: undefined, excludedSiteId: site.item.id },
  });

  const approved = changes.find(change => change.dimension === input.permission);
  const effective = approved?.query ?? query;
  const slots = await find(effective);
  if (slots.length) {
    const matches = [
      effective.siteId && site.item ? 'la sede indicada' : '',
      effective.professionalId && professional.item ? 'el especialista indicado' : '',
      effective.constraints.preferredDays.length ? 'el día que pediste' : '',
      effective.constraints.preferredShifts.length ? 'el turno que pediste' : '',
    ].filter(Boolean);
    const recommendation = matches.length
      ? 'Te recomiendo la opción 1 porque coincide con ' + new Intl.ListFormat('es').format(matches) + ' y es el horario disponible más próximo.'
      : 'Te recomiendo la opción 1 porque es el horario compatible más próximo.';
    return {
      slots, recommendation,
      notice: approved ? 'Estas opciones mantienen tus demás preferencias y cambian solo ' + dimensionLabels[approved.dimension] + '.' : '',
    };
  }

  const unavailable = 'Disculpa, por el momento no encontré horarios compatibles' +
    (site.item ? ' en ' + site.item.name : '') + (professional.item ? ' con ' + professional.item.name : '') +
    (days.length ? ' para ' + days.join(' o ') : '') +
    (shifts.length ? ' en el turno de ' + shifts.join(' o ') :
      constraints.excludedShifts.length ? ' fuera del turno de ' + new Intl.ListFormat('es').format(constraints.excludedShifts) : '') + '.';
  const remaining = changes.filter(change => change.dimension !== input.permission);
  const next = remaining.find(change => !change.strict) ?? remaining[0];
  if (next) return { slots: [], notice: unavailable + ' ' + next.question, permission: next.dimension };
  return { slots: [], notice: unavailable + ' ¿Hay algún día, turno, sede o especialista que puedas cambiar?' };
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
          slot.inicio + '–' + slot.fin + (number === 1 ? ' · *Recomendada*' : '');
      }),
    ].join('\n');
  });
  return {
    slots: ordered,
    text: [notice, '📅 *Horarios disponibles (hora de Lima)*', ...sections, recommendation,
      'Responde con el número que prefieras y comprobaré si sigue disponible.'].filter(Boolean).join('\n\n'),
  };
}
