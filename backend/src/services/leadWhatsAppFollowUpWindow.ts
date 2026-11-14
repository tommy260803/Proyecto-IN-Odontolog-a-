import { normalizeChatbotText, type LeadContactInterpretation } from './leadChatbotGroq';

export type FollowUpTurn = 'mañana' | 'tarde' | 'noche';
export type FollowUpPreference = { date?: string; turn?: FollowUpTurn; time?: string; clarifyTime?: boolean; wasBusy?: boolean };
export type FollowUpFailure = 'CONFIGURACION' | 'OPORTUNIDAD' | 'SUSPENDIDO' | 'FECHA';

export function followUpFailureMessage(reason?: FollowUpFailure) {
  const reasons = {
    CONFIGURACION: 'Hay un problema con la configuración del seguimiento. Un asesor debe revisarlo para poder programarlo.',
    OPORTUNIDAD: 'La oportunidad o su autorización de contacto cambiaron. Un asesor debe revisarlas antes de programar el mensaje.',
    SUSPENDIDO: 'El seguimiento está pausado o cancelado por el asesor. Se necesita su revisión para reactivarlo.',
    FECHA: 'La fecha o la hora solicitada ya pasó o queda fuera del horario de contacto. Puedes indicarme otro día o turno.',
  };
  return '🙏 Disculpa. ' + (reason ? reasons[reason] :
    'La solicitud anterior quedó pendiente y su registro no contiene el motivo específico. Puedes repetir el día en que quieres que te escribamos para volver a intentarlo.');
}

export function asksAboutWhatsAppFollowUp(text: string) {
  return /\b(?:por ?que|que paso|que ocurrio|cual es el (?:problema|motivo)|no (?:puedes|pudiste)|(?:quedo|esta|sigue) (?:programado|agendado)|cuando (?:me |nos )?(?:escribes|escribiran|contactas|contactaran))\b/
    .test(normalizeChatbotText(text));
}
const limaOffset = 5 * 60 * 60_000;
const turns = { mañana: [8, 13], tarde: [13, 18], noche: [18, 20] } as const;
const weekdays = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const followUpTurns: FollowUpTurn[] = ['mañana', 'tarde', 'noche'];
const hourMs = 3600_000;
const relativeContactDays = /\b(?:dentro de|de aqui a|en) (\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince) (dias?|semanas?)\b/;
const contactDayNumbers = ['un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince'];
export const limaDay = (date: Date) => new Date(date.getTime() - limaOffset).toISOString().slice(0, 10);

export function isFollowUpTurn(value: unknown): value is FollowUpTurn {
  return followUpTurns.some(turn => turn === value);
}

export function asksToResumeWhatsApp(text: string) {
  const value = normalizeChatbotText(text);
  return (relativeContactDays.test(value) && /\b(?:habl(?:a|e|en|ar)me|(?:me|nos) (?:habl|escrib|contact|llam)\w*|escrib(?:anme|eme|irme)|contact(?:enme|ame|arme)|llam(?:enme|ame|arme)|retomemos|hablemos|conversemos|seguimos)\b/.test(value)) ||
    /\b(?:escrib(?:anme|eme|irme)|contact(?:enme|ame|arme)|llam(?:enme|ame|arme)|(?:hablame|hablenme|hablarme|retomemos|hablemos|conversemos|seguimos)\b.*\b(?:despues|luego|otro|manana|tarde|lunes|martes|miercoles|jueves|viernes|sabado|domingo)|(?:ahora|por ahora|en este momento) no puedo\b(?!.*\b(?:cita|asistir|ir|horario))|no puedo (?:hablar|conversar|responder|comunicarme)|estoy (?:en (?:el trabajo|clases?|una reunion)|trabajando|ocupad[oa]))\b/.test(value) ||
    isBusyForWhatsApp(value) ||
    /\bno (?:me |nos )?(?:escrib\w*|contact\w*|llam\w*) (?:ahora|en este momento)\b/.test(value);
}

export function isBusyForWhatsApp(text: string) {
  return /\b(?:estoy (?:ocupad[oa]|trabajando|en (?:el trabajo|clases?|una reunion))|no tengo tiempo para (?:hablar\w*|conversar\w*|responder\w*)|no puedo (?:hablar|conversar|responder|comunicarme)|no puedo (?:ahora|en este momento))\b/
    .test(normalizeChatbotText(text));
}

export function acknowledgesFollowUp(text: string) {
  const words = normalizeChatbotText(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).join(' ');
  return !words || /^(?:ya|ok(?:ay)?|okey|listo|perfecto|de acuerdo|esta bien|entendido|vale|dale|si|(?:muchas )?gracias)(?: (?:(?:muchas )?gracias|perfecto|esta bien))?$/.test(words);
}

export function explicitlyContinuesReservation(text: string) {
  const value = normalizeChatbotText(text);
  return !/\b(?:no (?:quiero|deseo|acepto|confirmo|puedo)|todavia no|aun no)\b/.test(value) &&
    /\b(?:pre[ -]?reserva\w*|reservar|reservo|reservalo|agendar|agendo|agendalo|enlace|link|formulario|confirm\w* (?:la |mi |esta )?cita|(?:acept\w*|confirm\w*) (?:la |esta |tu )?(?:oferta|propuesta|promocion))\b/.test(value);
}

export function isFollowUpDateOrTurnReply(text: string) {
  const value = normalizeChatbotText(text);
  const relative = relativeContactDays.exec(value);
  return Boolean(relative && /^(?:(?:mejor|prefiero)\s+)?$/.test(value.slice(0, relative.index))) ||
    /^(?:(?:mejor|prefiero)\s+)?(?:(?:hoy|manana|pasado manana|(?:el )?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo))(?:\s+.*)?|(?:(?:en|por) la )?(?:manana|tarde|noche)|(?:a la[s]? )?\d{1,2}(?::\d{2})?(?:\s*[ap]\s*\.?\s*m\.?)?|durante el dia|(?:a )?cualquier hora)[.!\s]*$/.test(value);
}

// Convierte expresiones como «mañana en la tarde» en una fecha de Lima y un turno de contacto.
export function parseFollowUpPreference(text: string, receivedAt: Date, previous: FollowUpPreference = {}): FollowUpPreference {
  const normalized = normalizeChatbotText(text).replace(/\b([ap])\s*\.\s*m\.?/g, '$1m');
  const value = normalized.replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const local = new Date(receivedAt.getTime() - limaOffset);
  const explicitContact = /\b(?:contact(?:ame|enme)|escrib(?:eme|anme)|habla(?:me|nme)|llama(?:me|nme)) (.+)$/.exec(value)?.[1];
  const preference = /\b(?:mejor|prefiero|puedo a partir de) (.+)$/.exec(value)?.[1] ?? explicitContact ??
    value.replace(/^.*?\b(?:ahora|en este momento)\b\s+(?:pero\s+)?(?=(?:hoy|manana|pasado manana|el \w+|por la|en la)\b)/, '');
  const relativeDays = [...preference.matchAll(new RegExp(relativeContactDays.source, 'g'))];
  if (/\b(?:no puedo|no me sirve|excepto|menos|ni)\b.*\b(?:hoy|manana|tarde|noche|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(preference) ||
      (relativeDays.length && /\b(?:no puedo|no me sirve|excepto|menos|ni)\s*$/.test(preference.slice(0, relativeDays[0].index)))) return {};
  const dates = [...preference.replace(/\b(?:la|esta|por la|en la|de la) manana\b/g, '')
    .matchAll(/\b(hoy|pasado manana|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/g)];
  if (dates.length + relativeDays.length > 1) return {};
  const day = dates[0]?.[1];
  const relative = relativeDays[0];
  const count = relative ? Number(relative[1]) || contactDayNumbers.indexOf(relative[1].replace(/^un[oa]$/, 'un')) + 1 : 0;
  if (relative && /^0+$/.test(relative[1])) return {};
  const shifts = [...preference.matchAll(/\b(?:la|esta|por la|en la|de la) (manana|tarde|noche)\b/g)];
  if (new Set(shifts.map(match => match[1])).size > 1) return {};
  const shift = shifts[0]?.[1] ??
    (/^(?:tarde|noche)$/.test(preference) ? preference : undefined) ??
    /\b(?:hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo) (tarde|noche)\b/.exec(preference)?.[1];
  if (relative) local.setUTCDate(local.getUTCDate() + count * (relative[2].startsWith('semana') ? 7 : 1));
  else if (day === 'manana' || day === 'pasado manana') local.setUTCDate(local.getUTCDate() + (day === 'manana' ? 1 : 2));
  else if (day && day !== 'hoy') local.setUTCDate(local.getUTCDate() + ((weekdays.indexOf(day) - local.getUTCDay() + 7) % 7 || 7));
  const newDate = Boolean(day || relative);
  const date = newDate ? local.toISOString().slice(0, 10) : previous.date;
  if (/\b(?:durante el dia|cualquier hora)\b/.test(preference)) return { date, turn: undefined };
  const keepPrevious = !newDate || !previous.date;
  const turn = shift === 'manana' ? 'mañana' : isFollowUpTurn(shift) ? shift : keepPrevious ? previous.turn : undefined;
  const clock = /\ba la[s]? (\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=\s|$)/.exec(preference) ??
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(preference);
  if (!clock) return { date, turn, ...(!shift && keepPrevious && previous.time ? { time: previous.time } : {}),
    ...(previous.clarifyTime && !shift && keepPrevious ? { clarifyTime: true } : {}) };
  const hour = Number(clock[1]);
  const minute = Number(clock[2] ?? 0);
  const meridiem = clock[3];
  const hours = meridiem ? hour >= 1 && hour <= 12 ? [hour % 12 + (meridiem === 'pm' ? 12 : 0)] : []
    : hour >= 1 && hour <= 12 ? [hour % 12, hour % 12 + 12] : [hour];
  const candidates = hours.flatMap(h => followUpTurns.filter(t => h >= turns[t][0] && h < turns[t][1] && (!turn || turn === t))
    .map(t => ({ turn: t, time: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}` })));
  if (minute > 59 || candidates.length !== 1) {
    return { date, turn, clarifyTime: true };
  }
  return { date, ...candidates[0] };
}

export function followUpWindow(date: string, turn: FollowUpTurn) {
  const [start, end] = turns[turn];
  const at = (hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00-05:00`);
  return { start: at(start), end: at(end) };
}

export function resolveFollowUpPreference(text: string, receivedAt: Date, previous?: FollowUpPreference,
  interpreted?: LeadContactInterpretation | null): FollowUpPreference {
  const explicit = parseFollowUpPreference(text, receivedAt);
  const fromText = parseFollowUpPreference(text, receivedAt, previous);
  const evidence = normalizeChatbotText(interpreted?.cita_textual ?? '');
  const supported = interpreted && evidence && normalizeChatbotText(text).includes(evidence) ? interpreted : undefined;
  const wasBusy = isBusyForWhatsApp(text) || previous?.wasBusy || supported?.ocupado;
  if (!supported || /\b(?:no puedo|no me sirve|no me conviene|excepto|menos|ni|o bien)\b/.test(evidence)) {
    return { ...fromText, wasBusy };
  }
  const { dia, turno, hora } = supported;
  const normalizedTime = hora && /\d|\b(?:una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|mediodia)\b/.test(evidence) ? hora : '';
  if (!dia && !turno && !normalizedTime) return { ...fromText, wasBusy };
  const inferred = parseFollowUpPreference([dia, turno && `por la ${turno}`, normalizedTime && `a las ${normalizedTime}`].filter(Boolean).join(' '), receivedAt);
  const date = explicit.date ?? inferred.date ?? fromText.date;
  const usesPriorTime = !explicit.turn && !inferred.turn && ((!explicit.date && !inferred.date) || !previous?.date);
  const time = explicit.time ?? inferred.time ?? (usesPriorTime ? fromText.time : undefined);
  return {
    date,
    turn: explicit.turn ?? inferred.turn ?? (usesPriorTime ? fromText.turn : undefined),
    ...(time ? { time } : {}),
    ...(!time && (explicit.clarifyTime || inferred.clarifyTime || fromText.clarifyTime) ? { clarifyTime: true } : {}),
    wasBusy,
  };
}

export function requestedFollowUpDate(date: string, turn: FollowUpTurn | undefined, time?: string, now = new Date(), receivedAt = now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const startOfDay = followUpWindow(date, 'mañana').start;
  if (!Number.isFinite(startOfDay.getTime()) || limaDay(startOfDay) !== date || date < limaDay(now)) return null;
  if (!turn) {
    const incomingTurn = followUpTurns.find(value => {
      const window = followUpWindow(limaDay(receivedAt), value);
      return receivedAt >= window.start && receivedAt < window.end;
    });
    const available = followUpTurns.map(value => ({ ...followUpWindow(date, value), turn: value })).filter(window => window.end > now);
    const window = available.find(candidate => candidate.turn !== incomingTurn) ?? available[0];
    return window ? new Date(Math.max(window.start.getTime(), now.getTime())) : null;
  }
  const window = followUpWindow(date, turn);
  if (now >= window.end) return null;
  if (!time) return window.start;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const exact = new Date(`${date}T${time}:00-05:00`);
  return exact >= window.start && exact < window.end && exact > now ? exact : null;
}

export function withinFollowUpHours(earliest: Date) {
  const date = limaDay(earliest);
  for (const turn of followUpTurns) {
    const { start, end } = followUpWindow(date, turn);
    if (earliest < end) return { due: earliest > start ? earliest : start, turn };
  }
  return { due: followUpWindow(limaDay(new Date(earliest.getTime() + 24 * hourMs)), 'mañana').start, turn: 'mañana' as const };
}

// Calcula el primer recordatorio a las 24 horas de lectura o a las 48 horas de entrega sin lectura confirmada.
export function silenceFollowUpDue(delivered: Date | null, read: Date | null) {
  const receipt = read ?? delivered;
  return receipt ? new Date(receipt.getTime() + (read ? 24 : 48) * 3600_000) : null;
}

export function automaticFollowUpPlan(input: {
  sent: Date; delivered: Date | null; read: Date | null; promotionExpiry: Date | null; earliest?: Date;
}) {
  const silence = silenceFollowUpDue(input.delivered, input.read);
  const earliest = input.earliest?.getTime() ?? 0;
  const schedule = (date: Date) => withinFollowUpHours(new Date(Math.max(earliest, date.getTime())));
  const reminder = silence ? { ...schedule(silence), origin: input.read ? 'LEIDO' as const : 'ENTREGADO' as const } : null;
  if (!input.promotionExpiry) return reminder;
  const warning = schedule(new Date(Math.max(input.sent.getTime() + hourMs, input.promotionExpiry.getTime() - 24 * hourMs)));
  const promotion = warning.due < input.promotionExpiry ? warning : schedule(new Date(Math.max(
    input.promotionExpiry.getTime(), input.sent.getTime() + hourMs,
  )));
  return !reminder || promotion.due <= reminder.due ? { ...promotion, origin: 'VIGENCIA' as const } : reminder;
}
