import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LeadSeedData {
  nombres: string;
  apellidos: string;
  dni: string;
  numero: string;
  email: string;
  tipo_persona: string;
  id_servicio: number;
  id_sede: number;
  id_canal: number;
  id_profesional: number;
  motivo: string;
  tipo_consulta: string;
  prioridad: string;
  seleccionada: boolean;
  turno: string;
  horaInicioStr: string;
  horaFinStr: string;
  diasAdelante: number;
  salud: {
    nivel_dolor: string;
    ultima_visita: string;
    tratamiento_previo: string;
    sensibilidad: string;
    sangrado_inflamacion: string;
    aparato_protesis: string;
    condicion_especial: string;
  };
  laboral?: {
    ocupacion: string;
    empresa: string;
    modalidad: string;
  };
  academico?: {
    universidad: string;
    carrera: string;
    ciclo: string;
  };
  mensajeWhatsApp: string;
}

const leadsData: LeadSeedData[] = [
  {
    nombres: 'Camila',
    apellidos: 'Morales Ríos',
    dni: '76543201',
    numero: '976543201',
    email: 'camila.morales@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 3, // Ortodoncia Inicial
    id_sede: 2, // Sede California
    id_canal: 1, // WhatsApp
    id_profesional: 1, // Dra. Valeria Mendoza
    motivo: 'Evaluación para brackets estéticos o alineadores invisibles',
    tipo_consulta: 'Cotización',
    prioridad: 'Alta',
    seleccionada: false,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '15:00',
    horaFinStr: '16:00',
    diasAdelante: 3,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: '6-12 meses',
      tratamiento_previo: 'Limpieza',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    laboral: {
      ocupacion: 'Diseñadora Gráfica',
      empresa: 'Estudio Creativo Norte',
      modalidad: 'Híbrida',
    },
    mensajeWhatsApp: 'Buenas tardes, quisiera consultar el precio y los planes de financiamiento para ortodoncia en la sede California.',
  },
  {
    nombres: 'Mateo',
    apellidos: 'Salazar Quispe',
    dni: '76543202',
    numero: '976543202',
    email: 'mateo.salazar@outlook.com',
    tipo_persona: 'Joven Universitario',
    id_servicio: 2, // Limpieza / Profilaxis
    id_sede: 1, // Sede Centro Historico
    id_canal: 2, // Instagram
    id_profesional: 2, // Dr. Diego Salazar
    motivo: 'Presencia de sarro en dientes anteriores inferiores y manchitas de café',
    tipo_consulta: 'Evaluación',
    prioridad: 'Media',
    seleccionada: true,
    turno: 'Mañana (09:00 - 13:00)',
    horaInicioStr: '10:00',
    horaFinStr: '11:00',
    diasAdelante: 2,
    salud: {
      nivel_dolor: 'Leve',
      ultima_visita: 'más de 1 año',
      tratamiento_previo: 'Limpieza',
      sensibilidad: 'Sí',
      sangrado_inflamacion: 'sangrado',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    academico: {
      universidad: 'UPAO',
      carrera: 'Ingeniería de Sistemas',
      ciclo: '8vo',
    },
    mensajeWhatsApp: '¡Hola! Vi su publicidad en Instagram sobre la profilaxis ultrasónica. ¿Tienen turnos disponibles en el Centro?',
  },
  {
    nombres: 'Valeria',
    apellidos: 'Rojas Huamán',
    dni: '76543203',
    numero: '976543203',
    email: 'valeria.rojas@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 6, // Blanqueamiento Dental
    id_sede: 3, // Sede El Golf
    id_canal: 1, // WhatsApp
    id_profesional: 3, // Dra. Lucía Vásquez
    motivo: 'Blanqueamiento dental láser previo a evento de graduación',
    tipo_consulta: 'Cotización',
    prioridad: 'Alta',
    seleccionada: false,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '16:00',
    horaFinStr: '17:00',
    diasAdelante: 4,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: 'Menos de 6 meses',
      tratamiento_previo: 'Limpieza',
      sensibilidad: 'Sí',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    mensajeWhatsApp: 'Hola, ¿cuántas sesiones toma el blanqueamiento láser? Lo necesito antes del fin de mes para mi graduación.',
  },
  {
    nombres: 'Rodrigo',
    apellidos: 'Chiroque Paredes',
    dni: '76543204',
    numero: '976543204',
    email: 'rodrigo.chiroque@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 4, // Implante Dental
    id_sede: 2, // Sede California
    id_canal: 4, // Página Web
    id_profesional: 2, // Dr. Diego Salazar
    motivo: 'Evaluación tomográfica para implante tras pérdida de molar inferior',
    tipo_consulta: 'Cotización',
    prioridad: 'Alta',
    seleccionada: false,
    turno: 'Mañana (09:00 - 13:00)',
    horaInicioStr: '11:00',
    horaFinStr: '12:00',
    diasAdelante: 5,
    salud: {
      nivel_dolor: 'Leve',
      ultima_visita: '6-12 meses',
      tratamiento_previo: 'extracción',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    laboral: {
      ocupacion: 'Gerente de Operaciones',
      empresa: 'Logística Andina S.A.C.',
      modalidad: 'Presencial',
    },
    mensajeWhatsApp: 'Estimados, solicito información sobre implantes dentales de titanio y si realizan el escaneo tomográfico en la clínica.',
  },
  {
    nombres: 'Luciana',
    apellidos: 'Benites Castro',
    dni: '76543205',
    numero: '976543205',
    email: 'luciana.benites@hotmail.com',
    tipo_persona: 'Joven Universitario',
    id_servicio: 1, // Evaluación General
    id_sede: 1, // Sede Centro Historico
    id_canal: 1, // WhatsApp
    id_profesional: 4, // Dr. Renzo Alva
    motivo: 'Dolor punzante e inflamación en muela del juicio al masticar',
    tipo_consulta: 'Urgencia',
    prioridad: 'Alta',
    seleccionada: true,
    turno: 'Mañana (09:00 - 13:00)',
    horaInicioStr: '09:00',
    horaFinStr: '10:00',
    diasAdelante: 1,
    salud: {
      nivel_dolor: 'Moderado',
      ultima_visita: 'más de 1 año',
      tratamiento_previo: 'restauración',
      sensibilidad: 'Sí',
      sangrado_inflamacion: 'ambos',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    academico: {
      universidad: 'UNT',
      carrera: 'Medicina Humana',
      ciclo: '5to',
    },
    mensajeWhatsApp: 'Buen día, me duele bastante la muela del juicio al pasar saliva, ¿tienen horario hoy o mañana en el Centro Histórico?',
  },
  {
    nombres: 'Álvaro',
    apellidos: 'Mendoza Tello',
    dni: '76543206',
    numero: '976543206',
    email: 'alvaro.mendoza@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 5, // Restauración Estética
    id_sede: 2, // Sede California
    id_canal: 1, // WhatsApp
    id_profesional: 1, // Dra. Valeria Mendoza
    motivo: 'Fractura pequeña en borde incisal de diente frontal superior',
    tipo_consulta: 'Evaluación',
    prioridad: 'Alta',
    seleccionada: false,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '17:00',
    horaFinStr: '18:00',
    diasAdelante: 3,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: 'Menos de 6 meses',
      tratamiento_previo: 'restauración',
      sensibilidad: 'Sí',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    mensajeWhatsApp: 'Hola, se me astilló un diente frontal y quisiera que lo reconstruyan con resina estética de alta gama.',
  },
  {
    nombres: 'Gabriela',
    apellidos: 'Flores Seminario',
    dni: '76543207',
    numero: '976543207',
    email: 'gaby.flores@yahoo.com',
    tipo_persona: 'Adulto General',
    id_servicio: 3, // Ortodoncia Inicial
    id_sede: 3, // Sede El Golf
    id_canal: 2, // Instagram
    id_profesional: 3, // Dra. Lucía Vásquez
    motivo: 'Apiñamiento dental anterior y problemas de oclusión',
    tipo_consulta: 'Cotización',
    prioridad: 'Media',
    seleccionada: true,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '15:00',
    horaFinStr: '16:00',
    diasAdelante: 4,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: 'Menos de 6 meses',
      tratamiento_previo: 'ninguno',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    mensajeWhatsApp: 'Hola! Quisiera agendar cita diagnóstica para ortodoncia en El Golf. ¿Qué días atiende la especialista?',
  },
  {
    nombres: 'Joaquín',
    apellidos: 'Vargas Zavaleta',
    dni: '76543208',
    numero: '976543208',
    email: 'joaquin.vargas@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 2, // Limpieza / Profilaxis
    id_sede: 2, // Sede California
    id_canal: 1, // WhatsApp
    id_profesional: 4, // Dr. Renzo Alva
    motivo: 'Mantenimiento preventivo anual y destartraje',
    tipo_consulta: 'Evaluación',
    prioridad: 'Baja',
    seleccionada: false,
    turno: 'Mañana (09:00 - 13:00)',
    horaInicioStr: '09:00',
    horaFinStr: '10:00',
    diasAdelante: 6,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: '6-12 meses',
      tratamiento_previo: 'Limpieza',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    laboral: {
      ocupacion: 'Contador Público',
      empresa: 'Consultores Vargas',
      modalidad: 'Remoto',
    },
    mensajeWhatsApp: 'Hola, deseo coordinar una limpieza dental profunda para este sábado en la mañana en la sede California.',
  },
  {
    nombres: 'Andrea',
    apellidos: 'Carranza Medina',
    dni: '76543209',
    numero: '976543209',
    email: 'andrea.carranza@gmail.com',
    tipo_persona: 'Joven Universitario',
    id_servicio: 6, // Blanqueamiento Dental
    id_sede: 1, // Sede Centro Historico
    id_canal: 1, // WhatsApp
    id_profesional: 2, // Dr. Diego Salazar
    motivo: 'Aclaramiento dental y consulta sobre sensibilidad dental',
    tipo_consulta: 'Cotización',
    prioridad: 'Media',
    seleccionada: false,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '14:00',
    horaFinStr: '15:00',
    diasAdelante: 3,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: 'Menos de 6 meses',
      tratamiento_previo: 'Limpieza',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    academico: {
      universidad: 'UPAO',
      carrera: 'Arquitectura',
      ciclo: '10mo',
    },
    mensajeWhatsApp: '¿El blanqueamiento dental causa dolor o sensibilidad posterior? Me gustaría recibir asesoría.',
  },
  {
    nombres: 'Diego Alonso',
    apellidos: 'Villanueva Paredes',
    dni: '76543210',
    numero: '976543210',
    email: 'diego.villanueva@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 4, // Implante Dental
    id_sede: 3, // Sede El Golf
    id_canal: 4, // Página Web
    id_profesional: 1, // Dra. Valeria Mendoza
    motivo: 'Cotización de implante unitario con corona de zirconio',
    tipo_consulta: 'Cotización',
    prioridad: 'Alta',
    seleccionada: true,
    turno: 'Mañana (09:00 - 13:00)',
    horaInicioStr: '11:00',
    horaFinStr: '12:00',
    diasAdelante: 2,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: 'más de 1 año',
      tratamiento_previo: 'extracción',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    laboral: {
      ocupacion: 'Ingeniero Civil',
      empresa: 'Constructora del Norte',
      modalidad: 'Presencial',
    },
    mensajeWhatsApp: 'Buenos días, dejé mis datos en su web solicitando cotización detallada de implantes en sede El Golf.',
  },
  {
    nombres: 'Mariana',
    apellidos: 'Chávez Lozano',
    dni: '76543211',
    numero: '976543211',
    email: 'mariana.chavez@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 1, // Evaluación General
    id_sede: 2, // Sede California
    id_canal: 1, // WhatsApp
    id_profesional: 3, // Dra. Lucía Vásquez
    motivo: 'Chequeo general preventivo con radiografías panorámicas',
    tipo_consulta: 'Evaluación',
    prioridad: 'Media',
    seleccionada: false,
    turno: 'Mañana (09:00 - 13:00)',
    horaInicioStr: '10:00',
    horaFinStr: '11:00',
    diasAdelante: 4,
    salud: {
      nivel_dolor: 'Leve',
      ultima_visita: '6-12 meses',
      tratamiento_previo: 'restauración',
      sensibilidad: 'Sí',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    mensajeWhatsApp: 'Hola buenas tardes, hace más de un año no visito al odontólogo y quiero un chequeo completo preventivo.',
  },
  {
    nombres: 'Sebastián',
    apellidos: 'Arévalo Ramos',
    dni: '76543212',
    numero: '976543212',
    email: 'sebastian.arevalo@hotmail.com',
    tipo_persona: 'Joven Universitario',
    id_servicio: 3, // Ortodoncia Inicial
    id_sede: 1, // Sede Centro Historico
    id_canal: 3, // Facebook
    id_profesional: 4, // Dr. Renzo Alva
    motivo: 'Evaluación y diagnóstico para iniciar tratamiento de ortodoncia',
    tipo_consulta: 'Cotización',
    prioridad: 'Media',
    seleccionada: false,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '16:00',
    horaFinStr: '17:00',
    diasAdelante: 5,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: 'Menos de 6 meses',
      tratamiento_previo: 'Limpieza',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    academico: {
      universidad: 'UPN',
      carrera: 'Derecho y Ciencias Políticas',
      ciclo: '7mo',
    },
    mensajeWhatsApp: '¿Tienen promociones o facilidades de pago de ortodoncia para estudiantes universitarios?',
  },
  {
    nombres: 'Fiorella',
    apellidos: 'Bazán Córdova',
    dni: '76543213',
    numero: '976543213',
    email: 'fiorella.bazan@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 5, // Restauración Estética
    id_sede: 3, // Sede El Golf
    id_canal: 1, // WhatsApp
    id_profesional: 1, // Dra. Valeria Mendoza
    motivo: 'Reemplazo estético de 3 amalgamas antiguas por resina nanohíbrida',
    tipo_consulta: 'Cotización',
    prioridad: 'Media',
    seleccionada: true,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '17:00',
    horaFinStr: '18:00',
    diasAdelante: 3,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: '6-12 meses',
      tratamiento_previo: 'restauración',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    laboral: {
      ocupacion: 'Administradora de Empresas',
      empresa: 'Corporación Inmobiliaria',
      modalidad: 'Híbrida',
    },
    mensajeWhatsApp: 'Hola! Tengo tres calzas metálicas oscuras antiguas y quiero cambiarlas por resinas estéticas. ¿Cuánto demoran?',
  },
  {
    nombres: 'Renzo',
    apellidos: 'Guillén Peralta',
    dni: '76543214',
    numero: '976543214',
    email: 'renzo.guillen@gmail.com',
    tipo_persona: 'Adulto Mayor',
    id_servicio: 1, // Evaluación General
    id_sede: 2, // Sede California
    id_canal: 1, // WhatsApp
    id_profesional: 2, // Dr. Diego Salazar
    motivo: 'Evaluación integral de prótesis dental superior y rehabilitación oral',
    tipo_consulta: 'Evaluación',
    prioridad: 'Alta',
    seleccionada: false,
    turno: 'Mañana (09:00 - 13:00)',
    horaInicioStr: '10:00',
    horaFinStr: '11:00',
    diasAdelante: 2,
    salud: {
      nivel_dolor: 'Leve',
      ultima_visita: 'más de 1 año',
      tratamiento_previo: 'extracción',
      sensibilidad: 'No',
      sangrado_inflamacion: 'Ninguno',
      aparato_protesis: 'prótesis',
      condicion_especial: 'Hipertensión controlada',
    },
    mensajeWhatsApp: 'Buenas tardes, quisiera consultar por una evaluación para renovar una prótesis dental superior en Sede California.',
  },
  {
    nombres: 'Claudia',
    apellidos: 'Silva Paredes',
    dni: '76543215',
    numero: '976543215',
    email: 'claudia.silva@gmail.com',
    tipo_persona: 'Adulto General',
    id_servicio: 2, // Limpieza / Profilaxis
    id_sede: 1, // Sede Centro Historico
    id_canal: 1, // WhatsApp
    id_profesional: 3, // Dra. Lucía Vásquez
    motivo: 'Profilaxis ultrasónica profunda y pulido dental con pasta diamantada',
    tipo_consulta: 'Evaluación',
    prioridad: 'Baja',
    seleccionada: false,
    turno: 'Tarde (14:00 - 18:00)',
    horaInicioStr: '15:00',
    horaFinStr: '16:00',
    diasAdelante: 4,
    salud: {
      nivel_dolor: 'Ninguno',
      ultima_visita: '6-12 meses',
      tratamiento_previo: 'Limpieza',
      sensibilidad: 'No',
      sangrado_inflamacion: 'inflamación',
      aparato_protesis: 'Ninguno',
      condicion_especial: 'Ninguna',
    },
    laboral: {
      ocupacion: 'Docente de Educación Primaria',
      empresa: 'Colegio San José',
      modalidad: 'Presencial',
    },
    mensajeWhatsApp: 'Buenas tardes, quisiera reservar una cita de profilaxis dental para el día viernes en la tarde en el Centro.',
  },
];

async function seedActiveLeads() {
  console.log('--- Iniciando siembra de Leads Activos en NexoSaludDB ---');

  // Sedes y Tarifas en memoria para precios exactos
  const sedes = await prisma.sedes.findMany();
  const sedeMap = new Map(sedes.map(s => [s.id_sede, s.nombre]));

  const tarifas = await prisma.tarifas.findMany({ where: { activo: true } });
  const tarifaMap = new Map(tarifas.map(t => [t.id_servicio, Number(t.precio)]));

  const profesionales = await prisma.profesionales.findMany();
  const profMap = new Map(profesionales.map(p => [p.id_profesional, `${p.nombres} ${p.apellidos}`]));

  let insertCount = 0;

  for (const item of leadsData) {
    // 1. Limpieza idempotente si ya existía el DNI
    const existing = await prisma.personas.findFirst({
      where: { dni: item.dni },
      include: {
        Solicitudes: {
          include: {
            Opciones: true,
            Reservas: true,
          }
        }
      }
    });

    if (existing) {
      console.log(`Eliminando registro previo con DNI ${item.dni}...`);
      for (const sol of existing.Solicitudes) {
        await prisma.opciones.deleteMany({ where: { id_solicitud: sol.id_solicitud } });
        await prisma.solicitudes.delete({ where: { id_solicitud: sol.id_solicitud } });
      }
      await prisma.interacciones.deleteMany({ where: { id_persona: existing.id_persona } });
      await prisma.personaSaludOdontologica.deleteMany({ where: { id_persona: existing.id_persona } });
      await prisma.personaPreferencias.deleteMany({ where: { id_persona: existing.id_persona } });
      await prisma.datosAcademicos.deleteMany({ where: { id_persona: existing.id_persona } });
      await prisma.datosLaborales.deleteMany({ where: { id_persona: existing.id_persona } });
      await prisma.personas.delete({ where: { id_persona: existing.id_persona } });
    }

    const now = new Date();
    // Simular que entraron hoy en las últimas horas
    const minutesAgo = Math.floor(Math.random() * 120) + 15;
    const registrationDate = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const firstResponseDate = new Date(registrationDate.getTime() + 4 * 60 * 1000);

    // 2. Crear Persona
    const persona = await prisma.personas.create({
      data: {
        nombres: item.nombres,
        apellidos: item.apellidos,
        dni: item.dni,
        numero: item.numero,
        email: item.email,
        tipo_persona: item.tipo_persona,
        autoriza_contacto: true,
        fecha_autorizacion: registrationDate,
        estado_calidad: 'Valido',
        id_canal_origen: item.id_canal,
        id_etapa_actual: 2, // LEAD
        fecha_registro: registrationDate,
      }
    });

    const sedeNombre = sedeMap.get(item.id_sede) || 'Sede California';
    const doctorNombre = profMap.get(item.id_profesional) || 'Odontólogo Especialista';
    const precio = tarifaMap.get(item.id_servicio) || 100.00;

    // 3. Crear Preferencias
    await prisma.personaPreferencias.create({
      data: {
        id_persona: persona.id_persona,
        id_canal: item.id_canal,
        id_servicio_interes: item.id_servicio,
        sede_preferida: sedeNombre,
        profesional_preferido: doctorNombre,
        fecha_inicio: registrationDate,
      }
    });

    // 4. Crear Salud Odontológica
    await prisma.personaSaludOdontologica.create({
      data: {
        id_persona: persona.id_persona,
        nivel_dolor: item.salud.nivel_dolor,
        ultima_visita_odontologica: item.salud.ultima_visita,
        tratamiento_previo: item.salud.tratamiento_previo,
        presenta_sensibilidad: item.salud.sensibilidad,
        sangrado_o_inflamacion: item.salud.sangrado_inflamacion,
        usa_aparato_o_protesis: item.salud.aparato_protesis,
        condicion_atencion_especial: item.salud.condicion_especial,
        motivo_consulta: item.motivo,
        fecha_registro: registrationDate,
      }
    });

    // 5. Crear Datos Académicos o Laborales
    if (item.academico) {
      await prisma.datosAcademicos.create({
        data: {
          id_persona: persona.id_persona,
          universidad: item.academico.universidad,
          carrera: item.academico.carrera,
          ciclo: item.academico.ciclo,
          aplica: true,
        }
      });
    }

    if (item.laboral) {
      await prisma.datosLaborales.create({
        data: {
          id_persona: persona.id_persona,
          ocupacion: item.laboral.ocupacion,
          empresa: item.laboral.empresa,
          modalidad: item.laboral.modalidad,
          aplica: true,
        }
      });
    }

    // 6. Crear Solicitud (En Negociacion)
    const solicitud = await prisma.solicitudes.create({
      data: {
        id_persona: persona.id_persona,
        id_servicio: item.id_servicio,
        fecha_solicitud: registrationDate,
        fecha_ingreso_lead: registrationDate,
        motivo: item.motivo,
        tipo_consulta: item.tipo_consulta,
        prioridad: item.prioridad,
        estado: 'En Negociacion',
        fecha_primera_respuesta: firstResponseDate,
        id_canal_origen: item.id_canal,
        id_sede_interes_lead: item.id_sede,
        resultado_comercial_lead: 'PENDIENTE',
      }
    });

    // 7. Crear Disponibilidad futura en horario acorde
    const targetDate = new Date(Date.UTC(2026, 10, 14 + item.diasAdelante)); // Noviembre 2026
    const horaInicio = new Date(`1970-01-01T${item.horaInicioStr}:00.000Z`);
    const horaFin = new Date(`1970-01-01T${item.horaFinStr}:00.000Z`);

    const slot = await prisma.disponibilidad.create({
      data: {
        id_profesional: item.id_profesional,
        id_sede: item.id_sede,
        fecha: targetDate,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        estado: item.seleccionada ? 'Reservada' : 'Ofertada',
      }
    });

    // 8. Crear Opción para la solicitud
    await prisma.opciones.create({
      data: {
        id_solicitud: solicitud.id_solicitud,
        id_disponibilidad: slot.id_disponibilidad,
        precio_ofrecido: precio,
        fecha_ofrecida: registrationDate,
        seleccionada: item.seleccionada,
        estado_respuesta: item.seleccionada ? 'Aceptada' : 'Pendiente',
        fecha_respuesta: item.seleccionada ? new Date(firstResponseDate.getTime() + 10 * 60 * 1000) : null,
        ofr_turno_lead: item.turno,
      }
    });

    // 9. Crear Interacciones (Mensaje del paciente + Respuesta del sistema)
    await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_solicitud: solicitud.id_solicitud,
        id_canal: item.id_canal,
        tipo: 'Mensaje Paciente',
        mensaje: item.mensajeWhatsApp,
        fecha_hora: registrationDate,
        es_respuesta_util: false,
      }
    });

    await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_solicitud: solicitud.id_solicitud,
        id_canal: item.id_canal,
        tipo: 'Respuesta Bot',
        mensaje: `¡Hola ${item.nombres}! Gracias por escribir a NexoSalud Dental. Tenemos disponibilidad en ${sedeNombre} con el especialista ${doctorNombre} para tu tratamiento. La tarifa oficial es de S/ ${precio.toFixed(2)}. ¿Te gustaría confirmar tu turno?`,
        fecha_hora: firstResponseDate,
        es_respuesta_util: true,
      }
    });

    insertCount++;
    console.log(`[OK] Lead sembrado (${insertCount}/${leadsData.length}): ${item.nombres} ${item.apellidos} - DNI: ${item.dni} - Servicio: ${item.id_servicio} - Estado: ${item.seleccionada ? 'ALTERNATIVE_SELECTED' : 'IN_NEGOTIATION'}`);
  }

  console.log(`\n¡Siembra completada con éxito! Se insertaron ${insertCount} leads activos.`);
}

seedActiveLeads()
  .catch((e) => {
    console.error('Error sembrando leads:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
