import { prisma } from '../db';
import { normalizeChatbotText, type LeadChatbotAnalysis } from './leadChatbotGroq';
import type { WhatsAppOffer } from './leadWhatsAppInbox';

const catalogName = (value: string) => normalizeChatbotText(value).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function matchCatalog<T extends { nombre: string }>(items: T[], name: string) {
  const key = catalogName(name);
  if (!key) return undefined;
  const exact = items.find(item => catalogName(item.nombre) === key);
  if (exact) return exact;
  const matches = items.filter(item => ` ${catalogName(item.nombre)} `.includes(` ${key} `));
  return matches.length === 1 ? matches[0] : undefined;
}

// CAP-02 uses the same service-to-professional relation as the availability search.
export async function readLeadChatbotCatalog(offer: WhatsAppOffer, analysis: LeadChatbotAnalysis) {
  const topics = analysis.temas ?? [];
  const asksSites = topics.includes('SEDES');
  const asksProfessionals = topics.includes('ESPECIALISTAS');
  const requestedService = analysis.servicio?.trim();
  if (!asksSites && !asksProfessionals && !requestedService) return { text: '', differentService: false, activity: false };

  const request = await prisma.solicitudes.findFirst({
    where: { id_solicitud: offer.requestId, id_persona: offer.personId },
    select: { id_servicio: true, Servicio: { select: { id_servicio: true, nombre: true, descripcion: true, activo: true } } },
  });
  const service = requestedService ? matchCatalog(await prisma.servicios.findMany({
    where: { activo: true }, select: { id_servicio: true, nombre: true, descripcion: true, activo: true },
  }), requestedService) : request?.Servicio;
  if (requestedService && !service) return {
    text: '¿Qué tratamiento quieres consultar? Escríbeme su nombre para que pueda buscarlo en nuestro catálogo.',
    differentService: true, activity: false,
  };
  const differentService = Boolean(service && service.id_servicio !== request?.id_servicio);
  const sections: string[] = [];
  if (asksSites || asksProfessionals) {
    const sites = await prisma.sedes.findMany({
      where: { activo: true }, select: { id_sede: true, nombre: true, direccion: true }, orderBy: { nombre: 'asc' },
    });
    const site = analysis.sede ? matchCatalog(sites.map(row => ({ ...row, nombre: row.nombre.replace(/^sede\s+/i, ''), label: row.nombre })),
      analysis.sede.replace(/^sede\s+/i, '')) : undefined;
    if (analysis.sede && !site) return {
      text: '¿A cuál sede te refieres? Estas son nuestras sedes activas:\n' + sites.map(s => `• ${s.nombre} · ${s.direccion}`).join('\n'),
      differentService, activity: true, needsSite: true,
    };
    const professionals = service?.activo && (asksProfessionals || (asksSites && requestedService)) ? await prisma.profesionales.findMany({
      where: { activo: true, ProfesionalServicio: { some: { id_servicio: service.id_servicio } } },
      select: { nombres: true, apellidos: true, especialidad: true, Disponibilidad: {
        where: { id_sede: site?.id_sede, Sede: { activo: true }, fecha: { gte: new Date(new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)) } },
        distinct: ['id_sede'], select: { id_sede: true, Sede: { select: { nombre: true } } },
      } }, orderBy: [{ nombres: 'asc' }, { apellidos: 'asc' }],
    }) : [];
    if (asksSites) {
      const serviceSites = new Set(professionals.flatMap(p => p.Disponibilidad.map(d => d.id_sede)));
      const matches = sites.filter(s => (!site || s.id_sede === site.id_sede) && (!requestedService || serviceSites.has(s.id_sede)));
      sections.push(matches.length ? `📍 *${requestedService ? `Sedes con agenda registrada para ${service!.nombre}` : 'Sedes de NexoSalud'}*\n` +
        matches.map(s => `• ${s.nombre} · ${s.direccion}`).join('\n') : 'Por ahora no encuentro sedes con agenda registrada para ese tratamiento.');
    }
    if (asksProfessionals) {
      const matches = professionals.filter(p => !site || p.Disponibilidad.length);
      sections.push(matches.length ? `👤 *Especialistas habilitados para ${service!.nombre}${site ? ` en ${site.label}` : ''}*\n` +
        matches.map(p => `• ${p.nombres} ${p.apellidos}${p.especialidad ? ` (${p.especialidad})` : ''}` +
          (p.Disponibilidad.length ? ` · ${p.Disponibilidad.map(d => d.Sede.nombre).sort().join(', ')}` : '')).join('\n') :
        'Por ahora no encuentro especialistas para esa combinación de tratamiento y sede.');
    }
  }
  if (differentService && service) {
    if (topics.includes('DETALLES') || analysis.intent === 'DETALLES') {
      sections.push(`🦷 *${service.nombre}*${service.descripcion ? `\n${service.descripcion}` : ''}`);
    }
    if (topics.includes('PRECIO') || analysis.intent === 'PRECIO') {
      const tariff = await currentLeadTariff(prisma, service.id_servicio);
      sections.push(tariff ? `💰 *Tarifa de catálogo de ${service.nombre}:* S/ ${tariff.precio.toFixed(2)}.` : 'Ese tratamiento aún no tiene una tarifa vigente publicada.');
    }
    if (topics.includes('VIGENCIA')) sections.push('La vigencia de tu propuesta corresponde al tratamiento cotizado en ese mensaje.');
  }
  return { text: sections.join('\n\n'), differentService, activity: asksSites || asksProfessionals };
}

export function currentLeadTariff(db: Pick<typeof prisma, 'tarifas'>, serviceId: number, now = new Date()) {
  return db.tarifas.findFirst({
    where: { id_servicio: serviceId, activo: true, fecha_inicio: { lte: now }, OR: [{ fecha_fin: null }, { fecha_fin: { gt: now } }] },
    orderBy: [{ fecha_inicio: 'desc' }, { id_tarifa: 'desc' }],
  });
}
