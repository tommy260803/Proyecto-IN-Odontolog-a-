import { BuyerService } from '../services/buyerService';
import { prisma } from '../db';

async function main() {
  console.log('====================================================');
  console.log('PRUEBAS AUTOMATIZADAS DEL FLUJO OPERATIVO BUYER (HITO 3)');
  console.log('====================================================\n');

  const testPhone = '977112233';
  const testEmail = 'paciente.test@nexosalud.pe';

  // Limpieza de datos de prueba previos si existen
  const prevPerson = await prisma.personas.findFirst({
    where: { OR: [{ telefono_normalizado: testPhone }, { email_normalizado: testEmail }] }
  });
  if (prevPerson) {
    await prisma.impulseAlerts.deleteMany({ where: { id_persona: prevPerson.id_persona } });
    await prisma.interacciones.deleteMany({ where: { id_persona: prevPerson.id_persona } });
    await prisma.oportunidadesCaptacion.deleteMany({ where: { id_persona: prevPerson.id_persona } });
    await prisma.eventosEtapa.deleteMany({ where: { id_persona: prevPerson.id_persona } });
    await prisma.solicitudes.deleteMany({ where: { id_persona: prevPerson.id_persona } });
    await prisma.personas.delete({ where: { id_persona: prevPerson.id_persona } });
  }

  // 1. Registro inicial de nuevo interesado
  console.log('▶ [Prueba 1] Registro omnicanal de nuevo interesado en fase BUYER...');
  const reg1 = await BuyerService.registerOpportunity({
    nombres: 'Prueba Ana',
    apellidos: 'Torres Valdivia',
    telefono: testPhone,
    email: testEmail,
    dni: '48963251',
    concreteRequest: 'Buenas tardes, quisiera consultar costos de ortodoncia invisible y sedes disponibles.',
    consentimiento_atencion: true,
    consentimiento_promocional: false,
    consentimiento_ia: true,
    id_canal: 1,
    id_fuente: 1
  });

  console.log('  ✔ Persona creada ID:', reg1.persona.id_persona);
  console.log('  ✔ Etapa actual de Persona:', reg1.persona.id_etapa_actual, '(1 = BUYER)');
  console.log('  ✔ Oportunidad creada ID:', reg1.oportunidad.id_oportunidad);
  console.log('  ✔ Estado de Oportunidad:', reg1.oportunidad.estado_oportunidad);
  if (reg1.persona.id_etapa_actual !== 1) {
    throw new Error('FALLÓ PRUEBA 1: La persona no quedó en Etapa 1 (BUYER)');
  }
  if (reg1.oportunidad.estado_oportunidad !== 'NUEVO' && reg1.oportunidad.estado_oportunidad !== 'CALIFICADO') {
    throw new Error('FALLÓ PRUEBA 1: Estado de oportunidad inesperado');
  }

  // 2. Verificación de duplicados
  console.log('\n▶ [Prueba 2] Verificación de duplicados en tiempo real...');
  const dupCheck = await BuyerService.checkDuplicates({ telefono: testPhone, email: testEmail });
  console.log('  ✔ Duplicado detectado:', dupCheck.hasDuplicate);
  console.log('  ✔ Candidatos encontrados:', dupCheck.candidatesCount);
  if (!dupCheck.hasDuplicate) {
    throw new Error('FALLÓ PRUEBA 2: No detectó el registro recién creado como candidato');
  }

  // 3. Registro recurrente de la misma persona con nueva consulta
  console.log('\n▶ [Prueba 3] Reingreso del mismo paciente con nueva oportunidad...');
  const reg2 = await BuyerService.registerOpportunity({
    nombres: 'Ana',
    apellidos: 'Torres Valdivia',
    telefono: testPhone,
    email: testEmail,
    concreteRequest: 'Consulta de seguimiento para presupuesto familiar.',
    consentimiento_atencion: true
  });

  console.log('  ✔ Es recurrente:', reg2.esRecurrente);
  console.log('  ✔ Persona ID reutilizada:', reg2.persona.id_persona);
  console.log('  ✔ Nueva Oportunidad ID:', reg2.oportunidad.id_oportunidad);
  if (reg2.persona.id_persona !== reg1.persona.id_persona) {
    throw new Error('FALLÓ PRUEBA 3: Duplicó la fila de Personas en vez de vincular la oportunidad');
  }

  // 4. Conversión formal de Oportunidad a LEAD
  console.log('\n▶ [Prueba 4] Conversión formal a LEAD...');
  const conv = await BuyerService.convertToLead(reg1.oportunidad.id_oportunidad, {
    motivo_conversion: 'Presupuesto formal de ortodoncia aprobado por asesor',
    prioridad: 'Alta'
  });

  console.log('  ✔ Conversión exitosa:', conv.success);
  console.log('  ✔ Solicitud LEAD creada ID:', conv.id_solicitud);
  console.log('  ✔ Nueva etapa:', conv.etapa_nueva);

  const personaDespues = await prisma.personas.findUnique({ where: { id_persona: reg1.persona.id_persona } });
  const oportunidadDespues = await prisma.oportunidadesCaptacion.findUnique({ where: { id_oportunidad: reg1.oportunidad.id_oportunidad } });
  const eventosEtapa = await prisma.eventosEtapa.findMany({ where: { id_persona: reg1.persona.id_persona } });

  console.log('  ✔ Etapa final en Personas:', personaDespues?.id_etapa_actual, '(2 = LEAD)');
  console.log('  ✔ Estado final en Oportunidades:', oportunidadDespues?.estado_oportunidad);
  console.log('  ✔ Total EventosEtapa registrados:', eventosEtapa.length);

  if (personaDespues?.id_etapa_actual !== 2) {
    throw new Error('FALLÓ PRUEBA 4: Persona no avanzó a Etapa 2 (LEAD)');
  }
  if (oportunidadDespues?.estado_oportunidad !== 'CONVERTIDO_LEAD') {
    throw new Error('FALLÓ PRUEBA 4: Oportunidad no se actualizó a CONVERTIDO_LEAD');
  }

  // 5. Prevención de doble conversión
  console.log('\n▶ [Prueba 5] Verificación de idempotencia (Prevenir doble conversión)...');
  const conv2 = await BuyerService.convertToLead(reg1.oportunidad.id_oportunidad);
  console.log('  ✔ Respuesta ante reintento:', conv2);
  if (!conv2.alreadyConverted) {
    throw new Error('FALLÓ PRUEBA 5: No bloqueó la doble conversión');
  }

  console.log('\n====================================================');
  console.log('✔ TODAS LAS PRUEBAS DEL HITO 3 PASARON SATISFACTORIAMENTE');
  console.log('====================================================');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Error en pruebas Hito 3:', err);
  process.exit(1);
});
