import { prisma } from '../db';
import { patientAuthService } from '../services/patientAuthService';

async function main() {
  await patientAuthService.ensureSchema();

  // Buscar el o los clientes (CUSTOMER o TURNED)
  const customers = await prisma.personas.findMany({
    where: {
      OR: [
        { id_etapa_actual: { gte: 4 } },
        { Etapa: { nombre: { in: ['CUSTOMER', 'TURNED'] } } }
      ]
    },
    include: {
      Etapa: true,
      Reservas: true,
      Pagos: true
    }
  });

  console.log(`Encontrados ${customers.length} clientes en la base de datos:`);
  for (const c of customers) {
    console.log(`- ID: ${c.id_persona}, Nombre: ${c.nombres} ${c.apellidos}, DNI: ${c.dni}, Email: ${c.email}, Tel: ${c.numero}, Etapa: ${c.Etapa?.nombre}`);

    const dni = c.dni || '72849102'; // Si no tuviera DNI asignado, colocar uno válido

    if (!c.dni) {
      await prisma.personas.update({
        where: { id_persona: c.id_persona },
        data: { dni }
      });
      console.log(`  -> DNI actualizado a ${dni}`);
    }

    // Generar token de activación
    const token = await patientAuthService.generateActivationTokenForCustomer(c.id_persona, dni);
    console.log(`  -> Token de Activación generado: ${token}`);
    console.log(`  -> Enlace de Activación: http://localhost:5173/activar-cuenta?token=${token}`);

    // Si tiene email, enviar correo de activación
    if (c.email) {
      await patientAuthService.sendWelcomeActivationEmail({
        email: c.email,
        nombres: c.nombres,
        apellidos: c.apellidos,
        dni,
        token
      });
      console.log(`  -> Correo de bienvenida y activación enviado a: ${c.email}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

