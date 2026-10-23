import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const prisma = new PrismaClient();

const EXTERNAL_PATH = path.resolve(__dirname, '../../../database/external/whatsapp_interactions.json');

const UNIVERSIDADES_TRUJILLO = [
  { universidad: 'Universidad César Vallejo (UCV) - Trujillo', carrera: 'Derecho y Ciencias Políticas', ciclo: '7mo ciclo' },
  { universidad: 'Universidad Privada del Norte (UPN) - Trujillo', carrera: 'Arquitectura y Urbanismo', ciclo: '5to ciclo' },
  { universidad: 'Universidad Nacional de Trujillo (UNT)', carrera: 'Medicina Humana', ciclo: '9no ciclo' },
  { universidad: 'Universidad Privada Antenor Orrego (UPAO)', carrera: 'Estomatología / Odontología', ciclo: '6to ciclo' },
  { universidad: 'Universidad César Vallejo (UCV) - Trujillo', carrera: 'Ingeniería de Sistemas', ciclo: '8vo ciclo' },
  { universidad: 'Universidad Privada del Norte (UPN) - Trujillo', carrera: 'Administración y Marketing', ciclo: '4to ciclo' },
];

const EMPRESAS_TRUJILLO = [
  { empresa: 'Banco de Crédito del Perú (BCP) - Trujillo', ocupacion: 'Analista de Operaciones Financieras', modalidad: 'Presencial', disponibilidad: 'Tardes a partir de las 18:30' },
  { empresa: 'Danper Trujillo S.A.C.', ocupacion: 'Coordinador de Calidad y Exportaciones', modalidad: 'Presencial', disponibilidad: 'Sábados por la mañana' },
  { empresa: 'Gobierno Regional de La Libertad', ocupacion: 'Especialista Administrativo', modalidad: 'Presencial', disponibilidad: 'Vespertino (17:30 a 20:00)' },
  { empresa: 'Camposol S.A.', ocupacion: 'Ingeniero Agrónomo de Planta', modalidad: 'Híbrido', disponibilidad: 'Viernes y sábados' },
  { empresa: 'Establecimiento Comercial Propio', ocupacion: 'Comerciante Independiente', modalidad: 'Flexible', disponibilidad: 'Mañanas de 09:00 a 12:00' },
  { empresa: 'Colegio Privado San José Obrero', ocupacion: 'Docente de Nivel Secundario', modalidad: 'Presencial', disponibilidad: 'Tardes después de las 16:00' },
];

function getSedeByZone(zone: string): string {
  const z = (zone || '').toLowerCase();
  if (z.includes('larco') || z.includes('buenos aires') || z.includes('california')) return 'Sede California';
  if (z.includes('golf') || z.includes('moche') || z.includes('huanchaco') || z.includes('porvenir')) return 'Sede El Golf';
  return 'Sede Centro Historico';
}

function parseClinicalProfile(message: string, idx: number) {
  const m = (message || '').toLowerCase();

  let servicioNombre = 'Evaluación General';
  let motivo = 'Evaluación odontológica general y diagnóstico preventivo';
  let nivelDolor = 'Ninguno';
  let sensibilidad = 'No';
  let sangrado = 'Ninguno';
  let ultimaVisita = '6 a 12 meses';
  let condicionEspecial = 'Ninguna';
  let aparatos = 'Ninguno';

  if (m.includes('ortodoncia') || m.includes('bracket') || m.includes('hijo') || m.includes('alinead')) {
    servicioNombre = 'Ortodoncia Inicial';
    motivo = 'Consulta para diagnóstico y tratamiento de ortodoncia';
    nivelDolor = 'Ninguno';
    sensibilidad = 'No';
    ultimaVisita = 'Menos de 6 meses';
    aparatos = idx % 3 === 0 ? 'Ortodoncia previa' : 'Ninguno';
  } else if (m.includes('blanquea') || m.includes('estet') || m.includes('mancha') || m.includes('diseño')) {
    servicioNombre = 'Blanqueamiento Dental';
    motivo = 'Consulta para blanqueamiento dental y cosmética de sonrisa';
    nivelDolor = 'Ninguno';
    sensibilidad = 'Sí (Frío/Calor)';
    ultimaVisita = '6 a 12 meses';
  } else if (m.includes('limpieza') || m.includes('sarro') || m.includes('profilaxis')) {
    servicioNombre = 'Evaluación General';
    motivo = 'Limpieza bucal profunda y remoción de cálculo dental';
    nivelDolor = 'Leve';
    sangrado = idx % 2 === 0 ? 'Al cepillarse' : 'Ninguno';
    ultimaVisita = 'Más de 1 año';
  } else if (m.includes('dolor') || m.includes('urgenc') || m.includes('muela') || m.includes('fractur')) {
    servicioNombre = 'Evaluación General';
    motivo = 'Dolor dental agudo que requiere atención clínica prioritaria';
    nivelDolor = idx % 2 === 0 ? 'Moderado' : 'Severo';
    sensibilidad = 'Sí (Constante)';
    condicionEspecial = idx % 3 === 0 ? 'Ansiedad dental severa / Fobia' : 'Ninguna';
    ultimaVisita = 'Más de 2 años';
  } else {
    // Variación realista
    const painLevels = ['Ninguno', 'Ninguno', 'Leve', 'Moderado'];
    nivelDolor = painLevels[idx % painLevels.length];
    if (nivelDolor === 'Moderado') {
      sensibilidad = 'Sí (Frío)';
      condicionEspecial = idx % 5 === 0 ? 'Ansiedad dental' : 'Ninguna';
    }
  }

  return {
    servicioNombre,
    motivo,
    nivelDolor,
    sensibilidad,
    sangrado,
    ultimaVisita,
    condicionEspecial,
    aparatos,
  };
}

async function main() {
  console.log('🚀 Iniciando poblamiento masivo de perfiles de negociación...');

  let events: any[] = [];
  if (fs.existsSync(EXTERNAL_PATH)) {
    const raw = fs.readFileSync(EXTERNAL_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    events = parsed.events || [];
    console.log(`📂 Leídos ${events.length} eventos de ${EXTERNAL_PATH}`);
  }

  // Mapear eventos por teléfono y email
  const eventByPhone = new Map<string, any>();
  for (const ev of events) {
    if (ev.phone) eventByPhone.set(ev.phone.replace(/\D/g, ''), ev);
  }

  const allPersonas = await prisma.personas.findMany({
    include: {
      Preferencias: true,
      SaludOdontologica: true,
      DatosAcademicos: true,
      DatosLaborales: true,
      Solicitudes: true,
      Interacciones: true
    }
  });

  console.log(`📊 Procesando ${allPersonas.length} personas en base de datos...`);

  const sedes = await prisma.sedes.findMany();
  const horarios = await prisma.horarios.findMany();
  const modalidades = await prisma.modalidades.findMany();
  const servicios = await prisma.servicios.findMany();
  const profesionales = await prisma.profesionales.findMany();

  let updatedCount = 0;

  for (let idx = 0; idx < allPersonas.length; idx++) {
    const p = allPersonas[idx];
    const cleanPhone = (p.numero || '').replace(/\D/g, '');
    const matchedEvent = eventByPhone.get(cleanPhone) || events[idx % events.length] || {};

    const zone = p.zona || matchedEvent.zone || 'Centro Historico';
    const message = matchedEvent.message || p.Interacciones?.[0]?.mensaje || 'Solicitud de evaluación odontológica';

    const clinical = parseClinicalProfile(message, idx);
    const sedeNombre = getSedeByZone(zone);

    // Preferencias
    if (p.Preferencias.length === 0) {
      const matchedHorario = horarios[idx % horarios.length];
      const matchedModalidad = modalidades[0];
      const matchedProf = profesionales[idx % profesionales.length];

      await prisma.personaPreferencias.create({
        data: {
          id_persona: p.id_persona,
          sede_preferida: sedeNombre,
          profesional_preferido: matchedProf ? `Esp. ${matchedProf.apellidos}` : 'Staff Odontológico',
          id_horario: matchedHorario ? matchedHorario.id_horario : null,
          id_modalidad: matchedModalidad ? matchedModalidad.id_modalidad : null,
        }
      });
    }

    // Salud Odontológica
    if (p.SaludOdontologica.length === 0) {
      await prisma.personaSaludOdontologica.create({
        data: {
          id_persona: p.id_persona,
          motivo_consulta: clinical.motivo,
          nivel_dolor: clinical.nivelDolor,
          presenta_sensibilidad: clinical.sensibilidad,
          sangrado_o_inflamacion: clinical.sangrado,
          ultima_visita_odontologica: clinical.ultimaVisita,
          usa_aparato_o_protesis: clinical.aparatos,
          condicion_atencion_especial: clinical.condicionEspecial,
          tratamiento_previo: 'Ninguno'
        }
      });
    }

    // Datos Académicos (Aproximadamente 40% son estudiantes con convenio)
    const isStudent = (idx % 5 === 1 || idx % 5 === 3);
    if (p.DatosAcademicos.length === 0) {
      const uni = UNIVERSIDADES_TRUJILLO[idx % UNIVERSIDADES_TRUJILLO.length];
      await prisma.datosAcademicos.create({
        data: {
          id_persona: p.id_persona,
          aplica: isStudent,
          universidad: isStudent ? uni.universidad : null,
          carrera: isStudent ? uni.carrera : null,
          ciclo: isStudent ? uni.ciclo : null,
        }
      });
    }

    // Datos Laborales
    const isWorker = !isStudent || (idx % 2 === 0);
    if (p.DatosLaborales.length === 0) {
      const work = EMPRESAS_TRUJILLO[idx % EMPRESAS_TRUJILLO.length];
      await prisma.datosLaborales.create({
        data: {
          id_persona: p.id_persona,
          aplica: isWorker,
          empresa: isWorker ? work.empresa : null,
          ocupacion: isWorker ? work.ocupacion : null,
          modalidad: isWorker ? work.modalidad : null,
          disponibilidad: isWorker ? work.disponibilidad : null,
        }
      });
    }

    // Solicitudes
    if (p.Solicitudes.length === 0) {
      const matchedServicio = servicios.find(s => s.nombre.toLowerCase().includes(clinical.servicioNombre.toLowerCase())) || servicios[0];
      await prisma.solicitudes.create({
        data: {
          id_persona: p.id_persona,
          id_servicio: matchedServicio ? matchedServicio.id_servicio : 1,
          motivo: clinical.motivo,
          tipo_consulta: 'Primera consulta'
        }
      });
    }

    updatedCount++;
    if (updatedCount % 100 === 0) {
      console.log(`  ✓ Pobladas ${updatedCount} / ${allPersonas.length} personas...`);
    }
  }

  console.log(`✅ ¡Poblamiento completado con éxito! Se procesaron ${updatedCount} pacientes con datos reales contextuales de Trujillo.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
