import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '../db';

export interface PersuasionRule {
  id: string;
  nombre: string;
  activa: boolean;
  criterio_campo: 'servicio' | 'motivo' | 'sede' | 'horario' | 'recurrencia' | 'general';
  criterio_valor: string;
  angulo_persuasion: string;
  argumento_clave: string;
  prioridad: number;
}

export interface ChatbotRule {
  id: string;
  nombre: string;
  activa: boolean;
  tema: string;
  instruccion: string;
}

export interface DescuentoPorDatosRule {
  activo: boolean;
  porcentaje_base: number;
  porcentaje_por_dato_extra: number;
  porcentaje_maximo: number;
  urgencia_texto: string;
}

export interface BuyerAgentRulesConfig {
  persuasion: {
    tono: 'consultivo' | 'empatico' | 'directo';
    objetivo_campana: string;
    descuento_por_datos: DescuentoPorDatosRule;
    reglas: PersuasionRule[];
  };
  chatbot: {
    tono: 'calido' | 'profesional' | 'breve';
    beneficios_permitidos: string[];
    reglas: ChatbotRule[];
  };
  updatedAt: string;
}

export interface BuyerDescuentoCalculado {
  activo: boolean;
  porcentaje: number;
  datos_completados: string[];
  datos_faltantes: string[];
  total_datos: number;
  urgencia_texto: string;
  frases_gancho: string[];
}

export interface BuyerPersuasionResult {
  id_persona: number;
  angulo_principal: string;
  argumentos: string[];
  reglas_aplicadas: string[];
  objecion_probable: string;
  guion_whatsapp: string;
  descuento_recomendado: BuyerDescuentoCalculado;
  source: 'gemini' | 'reglas_locales';
}

const RULES_FILE_PATH = path.resolve(__dirname, '../../data/buyerAgentRules.json');
const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const;
const DEFAULT_TIMEOUT_MS = 15000;

export function getDefaultBuyerAgentRules(): BuyerAgentRulesConfig {
  return {
    persuasion: {
      tono: 'consultivo',
      objetivo_campana:
        'Convertir el interés inicial en una evaluación diagnóstica presencial resaltando confianza clínica, cercanía de sede y facilidades de pago.',
      descuento_por_datos: {
        activo: true,
        porcentaje_base: 5,
        porcentaje_por_dato_extra: 3,
        porcentaje_maximo: 20,
        urgencia_texto: 'Oferta válida por los últimos 3 días',
      },
      reglas: [
        {
          id: 'pers-dolor',
          nombre: 'Dolor o Urgencia Clínica',
          activa: true,
          criterio_campo: 'motivo',
          criterio_valor: 'dolor, duele, frío, frio, sensibilidad, urgente, inflamación, hincha',
          angulo_persuasion: 'Alivio rápido y atención prioritaria sin dolor',
          argumento_clave:
            'Destacar que contamos con atención prioritaria para aliviar la molestia desde la primera visita y diagnóstico digital preciso.',
          prioridad: 1,
        },
        {
          id: 'pers-ortodoncia-estetica',
          nombre: 'Ortodoncia y Estética Dental',
          activa: true,
          criterio_campo: 'servicio',
          criterio_valor: 'ortodoncia, brackets, alineadores, estética, diseño, carillas, blanqueamiento',
          angulo_persuasion: 'Transformación de sonrisa con financiamiento accesible',
          argumento_clave:
            'Enfatizar evaluación con planificación digital 3D y cuotas mensuales directas sin intereses.',
          prioridad: 2,
        },
        {
          id: 'pers-implantes',
          nombre: 'Implantes y Rehabilitación',
          activa: true,
          criterio_campo: 'servicio',
          criterio_valor: 'implante, prótesis, corona, rehabilitación',
          angulo_persuasion: 'Seguridad clínica y recuperación funcional definitiva',
          argumento_clave:
            'Resaltar cirugía guiada de alta precisión, materiales biocompatibles y plan por etapas.',
          prioridad: 2,
        },
        {
          id: 'pers-precio',
          nombre: 'Consulta de Precios o Presupuesto',
          activa: true,
          criterio_campo: 'motivo',
          criterio_valor: 'precio, costo, cuánto, cuanto, presupuesto, caro, barato, cuotas',
          angulo_persuasion: 'Transparencia y valor diagnóstico antes del gasto',
          argumento_clave:
            'Explicar que la evaluación permite dar un presupuesto exacto a su medida y mostrar opciones de financiamiento.',
          prioridad: 3,
        },
        {
          id: 'pers-recurrente',
          nombre: 'Contacto Recurrente',
          activa: true,
          criterio_campo: 'recurrencia',
          criterio_valor: 'recurrente',
          angulo_persuasion: 'Seguimiento personalizado sin empezar de cero',
          argumento_clave:
            'Retomar su consulta previa demostrando memoria del caso y ofrecer prioridad de horario en su sede preferida.',
          prioridad: 2,
        },
      ],
    },
    chatbot: {
      tono: 'calido',
      beneficios_permitidos: [
        'Evaluación odontológica integral',
        'Financiamiento directo en cuotas sin intereses para ortodoncia e implantes',
        'Atención de lunes a sábado en nuestras sedes',
      ],
      reglas: [
        {
          id: 'chat-empatia',
          nombre: 'Orientación empática de síntomas',
          activa: true,
          tema: 'Síntomas y dolor',
          instruccion:
            'Ante dolor o sensibilidad, validar la molestia con empatía y mencionar la especialidad probable sin emitir recetas médicas.',
        },
        {
          id: 'chat-limite-lead',
          nombre: 'No cotizar ni agendar citas cerradas',
          activa: true,
          tema: 'Precios y agenda',
          instruccion:
            'No confirmar horarios específicos de doctores ni precios cerrados; explicar que un asesor de LEAD lo coordinará tras el registro.',
        },
      ],
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function loadBuyerAgentRules(): Promise<BuyerAgentRulesConfig> {
  try {
    const raw = await fs.readFile(RULES_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BuyerAgentRulesConfig>;
    const defaults = getDefaultBuyerAgentRules();
    return {
      persuasion: {
        tono: parsed.persuasion?.tono || defaults.persuasion.tono,
        objetivo_campana:
          parsed.persuasion?.objetivo_campana || defaults.persuasion.objetivo_campana,
        descuento_por_datos: {
          ...defaults.persuasion.descuento_por_datos,
          ...(parsed.persuasion?.descuento_por_datos || {}),
        },
        reglas: Array.isArray(parsed.persuasion?.reglas)
          ? parsed.persuasion.reglas
          : defaults.persuasion.reglas,
      },
      chatbot: {
        tono: parsed.chatbot?.tono || defaults.chatbot.tono,
        beneficios_permitidos: Array.isArray(parsed.chatbot?.beneficios_permitidos)
          ? parsed.chatbot.beneficios_permitidos
          : defaults.chatbot.beneficios_permitidos,
        reglas: Array.isArray(parsed.chatbot?.reglas)
          ? parsed.chatbot.reglas
          : defaults.chatbot.reglas,
      },
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    const defaults = getDefaultBuyerAgentRules();
    try {
      await fs.mkdir(path.dirname(RULES_FILE_PATH), { recursive: true });
      await fs.writeFile(RULES_FILE_PATH, JSON.stringify(defaults, null, 2), 'utf-8');
    } catch {}
    return defaults;
  }
}

export async function saveBuyerAgentRules(
  input: Partial<BuyerAgentRulesConfig>
): Promise<BuyerAgentRulesConfig> {
  let current = getDefaultBuyerAgentRules();
  try {
    const raw = await fs.readFile(RULES_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BuyerAgentRulesConfig>;
    current = {
      persuasion: {
        tono: parsed.persuasion?.tono || current.persuasion.tono,
        objetivo_campana:
          parsed.persuasion?.objetivo_campana || current.persuasion.objetivo_campana,
        descuento_por_datos: {
          ...current.persuasion.descuento_por_datos,
          ...(parsed.persuasion?.descuento_por_datos || {}),
        },
        reglas: Array.isArray(parsed.persuasion?.reglas)
          ? parsed.persuasion.reglas
          : current.persuasion.reglas,
      },
      chatbot: {
        tono: parsed.chatbot?.tono || current.chatbot.tono,
        beneficios_permitidos: Array.isArray(parsed.chatbot?.beneficios_permitidos)
          ? parsed.chatbot.beneficios_permitidos
          : current.chatbot.beneficios_permitidos,
        reglas: Array.isArray(parsed.chatbot?.reglas)
          ? parsed.chatbot.reglas
          : current.chatbot.reglas,
      },
      updatedAt: parsed.updatedAt || current.updatedAt,
    };
  } catch {}
  const next: BuyerAgentRulesConfig = {
    persuasion: {
      tono: input.persuasion?.tono || current.persuasion.tono,
      objetivo_campana:
        typeof input.persuasion?.objetivo_campana === 'string'
          ? input.persuasion.objetivo_campana.trim()
          : current.persuasion.objetivo_campana,
      descuento_por_datos: {
        ...current.persuasion.descuento_por_datos,
        ...(input.persuasion?.descuento_por_datos || {}),
      },
      reglas: Array.isArray(input.persuasion?.reglas)
        ? input.persuasion.reglas
        : current.persuasion.reglas,
    },
    chatbot: {
      tono: input.chatbot?.tono || current.chatbot.tono,
      beneficios_permitidos: Array.isArray(input.chatbot?.beneficios_permitidos)
        ? input.chatbot.beneficios_permitidos
        : current.chatbot.beneficios_permitidos,
      reglas: Array.isArray(input.chatbot?.reglas)
        ? input.chatbot.reglas
        : current.chatbot.reglas,
    },
    updatedAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(RULES_FILE_PATH), { recursive: true });
  await fs.writeFile(RULES_FILE_PATH, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

const HORARIO_NAMES: Record<number, string> = {
  1: 'Mañana (08:00 - 13:00)',
  2: 'Tarde (13:00 - 18:00)',
  3: 'Noche (18:00 - 21:00)',
};

function matchPersuasionRules(
  rules: PersuasionRule[],
  context: {
    servicio: string;
    motivo: string;
    sede: string;
    horario: string;
    totalInteracciones: number;
  }
): PersuasionRule[] {
  const active = rules.filter((r) => r.activa).sort((a, b) => a.prioridad - b.prioridad);
  const matched: PersuasionRule[] = [];

  for (const rule of active) {
    const keywords = rule.criterio_valor
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    if (rule.criterio_campo === 'general') {
      matched.push(rule);
      continue;
    }
    if (rule.criterio_campo === 'recurrencia') {
      if (context.totalInteracciones > 1) matched.push(rule);
      continue;
    }

    const targetText =
      rule.criterio_campo === 'servicio'
        ? context.servicio.toLowerCase()
        : rule.criterio_campo === 'sede'
          ? context.sede.toLowerCase()
          : rule.criterio_campo === 'horario'
            ? context.horario.toLowerCase()
            : `${context.motivo} ${context.servicio}`.toLowerCase();

    if (keywords.some((kw) => targetText.includes(kw))) {
      matched.push(rule);
    }
  }

  return matched;
}

export async function generateBuyerPersuasionStrategy(
  personId: number
): Promise<BuyerPersuasionResult> {
  const person = await prisma.personas.findUnique({
    where: { id_persona: personId },
    include: {
      CanalOrigen: true,
      Preferencias: {
        take: 1,
        orderBy: { id_preferencia: 'desc' },
        include: { ServicioInteres: true },
      },
      Interacciones: {
        take: 5,
        orderBy: { id_interaccion: 'desc' },
      },
      Solicitudes: {
        take: 1,
        orderBy: { id_solicitud: 'desc' },
        include: { Servicio: true },
      },
    },
  });

  if (!person) {
    throw new Error('Persona no encontrada');
  }

  const [capture] = await prisma.$queryRaw<
    { motivo_consulta: string | null; id_servicio: number | null; id_sede: number | null }[]
  >`
    SELECT TOP (1) motivo_consulta, id_servicio, id_sede
    FROM dbo.CaptacionesBuyer
    WHERE id_persona = ${personId}
    ORDER BY id_captacion DESC
  `;

  const pref = person.Preferencias[0];
  const latestInt = person.Interacciones[0];
  const servicioNombre =
    pref?.ServicioInteres?.nombre ||
    person.Solicitudes[0]?.Servicio?.nombre ||
    'Evaluación Odontológica Integral';
  const sedeNombre = pref?.sede_preferida || 'No especificada';
  const horarioNombre = pref?.id_horario ? HORARIO_NAMES[pref.id_horario] || 'Flexible' : 'No especificado';
  const motivo =
    latestInt?.mensaje ||
    capture?.motivo_consulta ||
    'Consulta general de servicios odontológicos';
  const totalInteracciones = person.Interacciones.length;

  const config = await loadBuyerAgentRules();
  const matchedRules = matchPersuasionRules(config.persuasion.reglas, {
    servicio: servicioNombre,
    motivo,
    sede: sedeNombre,
    horario: horarioNombre,
    totalInteracciones,
  });

  // Cálculo progresivo de descuento según cantidad de datos proporcionados por el Buyer
  const checklist: Array<{ label: string; present: boolean }> = [
    { label: 'Nombre completo', present: Boolean(person.nombres?.trim()) },
    { label: 'Teléfono / Celular', present: Boolean(person.numero?.trim()) },
    { label: 'DNI', present: Boolean(person.dni?.trim()) },
    { label: 'Correo electrónico', present: Boolean(person.email?.trim()) },
    { label: 'Sede preferida', present: sedeNombre !== 'No especificada' },
    { label: 'Disponibilidad horaria', present: horarioNombre !== 'No especificado' },
    { label: 'Autorización de contacto', present: Boolean(person.autoriza_contacto) },
  ];
  const datosCompletados = checklist.filter((c) => c.present).map((c) => c.label);
  const datosFaltantes = checklist.filter((c) => !c.present).map((c) => c.label);

  const descCfg = config.persuasion.descuento_por_datos;
  const extraFields = Math.max(0, datosCompletados.length - 2);
  const rawPct = descCfg.porcentaje_base + extraFields * descCfg.porcentaje_por_dato_extra;
  const porcentajeDescuento = descCfg.activo
    ? Math.min(descCfg.porcentaje_maximo, Math.max(0, rawPct))
    : 0;

  const descuentoRecomendado: BuyerDescuentoCalculado = {
    activo: descCfg.activo,
    porcentaje: porcentajeDescuento,
    datos_completados: datosCompletados,
    datos_faltantes: datosFaltantes,
    total_datos: checklist.length,
    urgencia_texto: descCfg.urgencia_texto,
    frases_gancho: descCfg.activo
      ? [
          `${descCfg.urgencia_texto}: ${porcentajeDescuento}% de descuento en tu consulta de ${servicioNombre}.`,
          `Beneficio exclusivo por haber completado ${datosCompletados.length} de ${checklist.length} datos en tu ficha.`,
          `Asegura tu ${porcentajeDescuento}% OFF reservando tu evaluación esta semana${sedeNombre !== 'No especificada' ? ` en ${sedeNombre}` : ''}.`,
        ]
      : [],
  };

  const buyerProfile = {
    nombre: `${person.nombres} ${person.apellidos}`.trim(),
    tipo_persona: person.tipo_persona || 'Adulto General',
    servicio_interes: servicioNombre,
    motivo_consulta: motivo,
    sede_preferida: sedeNombre,
    horario_preferido: horarioNombre,
    canal_origen: person.CanalOrigen?.nombre || 'Digital',
    total_interacciones: totalInteracciones,
    autoriza_contacto: person.autoriza_contacto,
    descuento_calculado_por_datos: descuentoRecomendado,
  };

  const buildLocalFallback = (): BuyerPersuasionResult => {
    const primaryRule = matchedRules[0];
    const args: string[] = matchedRules.map((r) => r.argumento_clave);

    if (descCfg.activo && porcentajeDescuento > 0) {
      args.unshift(
        `Ofrecer ${porcentajeDescuento}% de descuento en la primera consulta (${descCfg.urgencia_texto}) por haber brindado ${datosCompletados.length}/${checklist.length} datos.`
      );
    }

    if (sedeNombre !== 'No especificada') {
      args.push(`Confirmar disponibilidad cercana en ${sedeNombre}${horarioNombre !== 'No especificado' ? ` en turno ${horarioNombre}` : ''}.`);
    }
    if (args.length === 0) {
      args.push(
        `Enfatizar los beneficios de ${servicioNombre} con evaluación diagnóstica personalizada.`,
        'Mencionar facilidades de pago y atención con especialistas.'
      );
    }

    const firstName = person.nombres.split(' ')[0] || 'hola';
    const sedeClause = sedeNombre !== 'No especificada' ? ` en nuestra ${sedeNombre}` : '';
    const horarioClause = horarioNombre !== 'No especificado' ? ` en el turno ${horarioNombre}` : '';
    const discountClause =
      descCfg.activo && porcentajeDescuento > 0
        ? ` Además, por completar tu registro tienes un ${porcentajeDescuento}% de descuento en tu evaluación (${descCfg.urgencia_texto}).`
        : '';

    return {
      id_persona: personId,
      angulo_principal:
        primaryRule?.angulo_persuasion ||
        'Confianza clínica y evaluación personalizada sin compromiso',
      argumentos: args.slice(0, 4),
      reglas_aplicadas: [
        ...matchedRules.map((r) => r.nombre),
        ...(descCfg.activo ? [`Descuento progresivo (${porcentajeDescuento}%)`] : []),
      ],
      objecion_probable:
        /precio|costo|cuanto|cuánto/i.test(motivo)
          ? 'Duda sobre el costo total del tratamiento antes de evaluarse.'
          : 'Incertidumbre sobre duración o comodidad de la primera atención.',
      guion_whatsapp: `Hola ${firstName}, te saluda el equipo de NexoSalud. Revisamos tu consulta sobre ${servicioNombre}${sedeClause}.${discountClause} Podemos ayudarte con una evaluación personalizada${horarioClause}. ¿Te gustaría aprovecharlo y coordinar tu atención?`,
      descuento_recomendado: descuentoRecomendado,
      source: 'reglas_locales',
    };
  };

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildLocalFallback();
  }

  const client = new GoogleGenAI({ apiKey });
  const systemInstruction = `Eres el Agente de Estrategia y Persuasión Comercial de NexoSalud (etapa BUYER del método IMPULSE).
Tu tarea es responder al asesor comercial: "¿De qué manera convencer a este cliente específico para que adquiera el servicio o avance a evaluación en LEAD?"

TONO CONFIGURADO POR EL ADMINISTRADOR: ${config.persuasion.tono}
OBJETIVO DE CAMPAÑA ACTIVO: ${config.persuasion.objetivo_campana}

REGLAS DE PERSUASIÓN ACTIVAS CONFIGURADAS EN LA APLICACIÓN:
${JSON.stringify(
  config.persuasion.reglas.filter((r) => r.activa),
  null,
  2
)}

REGLAS QUE HICIERON MATCH AUTOMÁTICO CON ESTE BUYER:
${JSON.stringify(matchedRules, null, 2)}

INSTRUCCIONES:
1. Basa tu estrategia estrictamente en los DATOS DEL BUYER y las REGLAS DE PERSUASIÓN ACTIVAS. No inventes sedes ni horarios si dicen "No especificada"/"No especificado".
2. Genera:
   - angulo_principal: enfoque persuasivo principal en 1 frase corta.
   - argumentos: 2 a 4 puntos concretos de convencimiento adaptados al perfil del cliente y las reglas aplicadas.
   - objecion_probable: la duda o freno más probable de este cliente y cómo abordarlo brevemente.
   - guion_whatsapp: un mensaje listo para enviar por WhatsApp al cliente (cercano, persuasivo, máximo 4 líneas) aplicando las reglas activas.
3. Responde siempre en español.`;

  const prompt = `DATOS DEL BUYER:\n${JSON.stringify(buyerProfile, null, 2)}\n\nGenera la estrategia de convencimiento personalizada.`;

  for (const modelName of CANDIDATE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          abortSignal: controller.signal,
          httpOptions: { timeout: DEFAULT_TIMEOUT_MS },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              angulo_principal: { type: Type.STRING },
              argumentos: { type: Type.ARRAY, items: { type: Type.STRING } },
              objecion_probable: { type: Type.STRING },
              guion_whatsapp: { type: Type.STRING },
            },
            required: ['angulo_principal', 'argumentos', 'objecion_probable', 'guion_whatsapp'],
          },
        },
      });

      clearTimeout(timer);
      const parsed = JSON.parse(response.text?.trim() || '{}') as Record<string, unknown>;

      return {
        id_persona: personId,
        angulo_principal:
          typeof parsed.angulo_principal === 'string' && parsed.angulo_principal.trim()
            ? parsed.angulo_principal.trim()
            : buildLocalFallback().angulo_principal,
        argumentos: Array.isArray(parsed.argumentos)
          ? parsed.argumentos.filter((x): x is string => typeof x === 'string').slice(0, 4)
          : buildLocalFallback().argumentos,
        reglas_aplicadas: [
          ...matchedRules.map((r) => r.nombre),
          ...(descCfg.activo ? [`Descuento progresivo (${porcentajeDescuento}%)`] : []),
        ],
        objecion_probable:
          typeof parsed.objecion_probable === 'string' && parsed.objecion_probable.trim()
            ? parsed.objecion_probable.trim()
            : buildLocalFallback().objecion_probable,
        guion_whatsapp:
          typeof parsed.guion_whatsapp === 'string' && parsed.guion_whatsapp.trim()
            ? parsed.guion_whatsapp.trim()
            : buildLocalFallback().guion_whatsapp,
        descuento_recomendado: descuentoRecomendado,
        source: 'gemini',
      };
    } catch (err) {
      clearTimeout(timer);
      console.warn(
        `[BuyerPersuasion] Modelo ${modelName} no disponible:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return buildLocalFallback();
}
