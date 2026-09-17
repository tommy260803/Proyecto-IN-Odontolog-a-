
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const etapas = await prisma.etapas.findMany();
  const getEtapa = (n: string) => etapas.find(e => e.nombre === n)?.id_etapa || 1;

  const disp = await prisma.disponibilidad.findFirst();
  const serv = await prisma.servicios.findFirst();

  if (!serv) throw new Error('No hay servicios');

  // 1. BUYER
  await prisma.personas.create({
    data: { nombres: 'Ana', apellidos: 'Garcia', numero: '999111222', id_etapa_actual: getEtapa('BUYER') }
  });

  // 2. LEAD
  const lead = await prisma.personas.create({
    data: { nombres: 'Carlos', apellidos: 'Lopez', numero: '999333444', id_etapa_actual: getEtapa('LEAD') }
  });
  const sol = await prisma.solicitudes.create({
    data: { id_persona: lead.id_persona, id_servicio: serv.id_servicio, motivo: 'Consulta de ortodoncia' }
  });
  if (disp) {
    await prisma.opciones.create({
      data: { id_solicitud: sol.id_solicitud, id_disponibilidad: disp.id_disponibilidad, precio_ofrecido: 150, seleccionada: false }
    });
  }

  // 3. PAYER
  const payer = await prisma.personas.create({
    data: { nombres: 'Maria', apellidos: 'Sanchez', numero: '999555666', id_etapa_actual: getEtapa('PAYER') }
  });
  const sol2 = await prisma.solicitudes.create({
    data: { id_persona: payer.id_persona, id_servicio: serv.id_servicio, motivo: 'Consulta general', estado: 'Cerrada' }
  });
  if (disp) {
    const op2 = await prisma.opciones.create({
      data: { id_solicitud: sol2.id_solicitud, id_disponibilidad: disp.id_disponibilidad, precio_ofrecido: 50, seleccionada: true }
    });
    const res = await prisma.reservas.create({
      data: { id_persona: payer.id_persona, id_solicitud: sol2.id_solicitud, id_opcion: op2.id_opcion, estado: 'Pendiente' }
    });
    await prisma.pagos.create({
      data: { id_persona: payer.id_persona, id_reserva: res.id_reserva, importe: 50, estado: 'Pendiente' }
    });
  }

  // 4. CUSTOMER
  const customer = await prisma.personas.create({
    data: { nombres: 'Jorge', apellidos: 'Martinez', numero: '999777888', id_etapa_actual: getEtapa('CUSTOMER') }
  });
  const sol3 = await prisma.solicitudes.create({
    data: { id_persona: customer.id_persona, id_servicio: serv.id_servicio, motivo: 'Blanqueamiento', estado: 'Cerrada' }
  });
  if (disp) {
    const op3 = await prisma.opciones.create({
      data: { id_solicitud: sol3.id_solicitud, id_disponibilidad: disp.id_disponibilidad, precio_ofrecido: 200, seleccionada: true }
    });
    const res2 = await prisma.reservas.create({
      data: { id_persona: customer.id_persona, id_solicitud: sol3.id_solicitud, id_opcion: op3.id_opcion, estado: 'Confirmada' }
    });
    await prisma.pagos.create({
      data: { id_persona: customer.id_persona, id_reserva: res2.id_reserva, importe: 200, estado: 'Validado' }
    });
    await prisma.atenciones.create({
      data: { 
        id_persona: customer.id_persona, id_reserva: res2.id_reserva, id_servicio: serv.id_servicio, 
        id_profesional: disp.id_profesional, id_sede: disp.id_sede, fecha_atencion: disp.fecha, 
        estado_servicio: 'Programado' 
      }
    });
  }

  // 5. TURNED
  const turned = await prisma.personas.create({
    data: { nombres: 'Lucia', apellidos: 'Gomez', numero: '999999000', id_etapa_actual: getEtapa('TURNED') }
  });
  const sol4 = await prisma.solicitudes.create({
    data: { id_persona: turned.id_persona, id_servicio: serv.id_servicio, motivo: 'Implante', estado: 'Cerrada' }
  });
  if (disp) {
    const op4 = await prisma.opciones.create({
      data: { id_solicitud: sol4.id_solicitud, id_disponibilidad: disp.id_disponibilidad, precio_ofrecido: 1500, seleccionada: true }
    });
    const res3 = await prisma.reservas.create({
      data: { id_persona: turned.id_persona, id_solicitud: sol4.id_solicitud, id_opcion: op4.id_opcion, estado: 'Confirmada' }
    });
    await prisma.pagos.create({
      data: { id_persona: turned.id_persona, id_reserva: res3.id_reserva, importe: 1500, estado: 'Validado' }
    });
    const atencion = await prisma.atenciones.create({
      data: { 
        id_persona: turned.id_persona, id_reserva: res3.id_reserva, id_servicio: serv.id_servicio, 
        id_profesional: disp.id_profesional, id_sede: disp.id_sede, fecha_atencion: disp.fecha, 
        estado_servicio: 'Finalizado' 
      }
    });
    await prisma.seguimientos.create({
      data: { id_persona: turned.id_persona, id_atencion: atencion.id_atencion, tipo: 'Llamada', satisfaccion: 5 }
    });
  }

  console.log('Pacientes de prueba insertados correctamente.');
}

main().catch(console.error).finally(() => {
  prisma.$disconnect();
});
