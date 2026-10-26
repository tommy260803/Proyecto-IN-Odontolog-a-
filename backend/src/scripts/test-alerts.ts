import { AlertService } from '../services/alertService';
import { BuyerService } from '../services/buyerService';
import { prisma } from '../db';

async function main() {
  console.log('====================================================');
  console.log('BATERÍA DE PRUEBAS DE IMPULSE ALERTS (HITO 5)');
  console.log('====================================================\n');

  // 1. Registro con datos incompletos -> dispara BUYER-01-INCOMPLETO
  console.log('▶ [Prueba 1] Disparo automático de BUYER-01-INCOMPLETO...');
  const regIncompleto = await BuyerService.registerOpportunity({
    nombres: 'J', // Inválido (1 caracter)
    apellidos: 'X',
    telefono: '123', // Inválido (3 dígitos)
    concreteRequest: 'hola',
    consentimiento_atencion: true
  });

  const alerts1 = regIncompleto.alertas;
  console.log('  ✔ Alertas generadas en registro:', alerts1.map(a => a.codigo_alerta));
  const hasIncompleto = alerts1.some(a => a.codigo_alerta === 'BUYER-01-INCOMPLETO');
  if (!hasIncompleto) {
    throw new Error('FALLÓ PRUEBA 1: No generó alerta de registro incompleto');
  }

  // 2. Listado de alertas
  console.log('\n▶ [Prueba 2] Listado de alertas activas...');
  const activas = await AlertService.listAlerts({ estado: 'ACTIVA' });
  console.log(`  ✔ Total de alertas activas encontradas: ${activas.length}`);
  if (activas.length === 0) {
    throw new Error('FALLÓ PRUEBA 2: No retornó alertas activas');
  }

  // 3. Resolución de una alerta
  console.log('\n▶ [Prueba 3] Resolución controlada de alerta...');
  const alertToResolve = activas[0];
  const resolved = await AlertService.resolveAlert(alertToResolve.id_alerta, {
    motivo_resolucion: 'Datos corregidos telefónicamente con el paciente por asesor',
    id_usuario: 1
  });

  console.log('  ✔ Alerta ID resuelta:', resolved.id_alerta);
  console.log('  ✔ Estado final:', resolved.estado);
  console.log('  ✔ Motivo de resolución:', resolved.motivo_resolucion);
  console.log('  ✔ Fecha de resolución:', resolved.fecha_resolucion);
  if (resolved.estado !== 'RESUELTA') {
    throw new Error('FALLÓ PRUEBA 3: El estado no cambió a RESUELTA');
  }

  // 4. Escaneo de SLA de primera respuesta
  console.log('\n▶ [Prueba 4] Escaneo de violación de SLA (umbral 0 min para prueba)...');
  const scanResult = await AlertService.scanSlaBreaches(0);
  console.log(`  ✔ Oportunidades evaluadas: ${scanResult.scannedCount}`);
  console.log(`  ✔ Alertas de SLA generadas: ${scanResult.alertsCreatedCount}`);

  console.log('\n====================================================');
  console.log('✔ TODAS LAS PRUEBAS DE IMPULSE ALERTS PASARON SATISFACTORIAMENTE');
  console.log('====================================================');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Error en pruebas Hito 5:', err);
  process.exit(1);
});
