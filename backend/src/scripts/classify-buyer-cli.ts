import {
  BuyerMessageClassifier,
  type BuyerClassificationResult,
} from '../services/buyerMessageClassifier';
import {
  SYNTHETIC_SERVICE_CATALOG,
  SYNTHETIC_BUYER_MESSAGES,
} from '../services/buyerSyntheticData';

interface ParsedCliArgs {
  customMessage?: string;
  catalogPath?: string;
  timeoutMs?: number;
  showHelp: boolean;
  verbose: boolean;
  error?: string;
}

function parseArgs(args: string[]): ParsedCliArgs {
  const result: ParsedCliArgs = {
    showHelp: false,
    verbose: false,
  };

  const KNOWN_FLAGS = new Set(['--help', '-h', '--verbose', '-v', '--message', '-m', '--timeout', '-t']);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.showHelp = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--message' || arg === '-m') {
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        result.error = 'La opción --message (-m) requiere un texto no vacío a clasificar.';
        return result;
      }
      const val = args[++i].trim();
      if (!val) {
        result.error = 'El mensaje provisto a --message no puede estar vacío.';
        return result;
      }
      result.customMessage = val;
    } else if (arg === '--timeout' || arg === '-t') {
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        result.error = 'La opción --timeout (-t) requiere un valor numérico en milisegundos.';
        return result;
      }
      const num = Number(args[++i]);
      if (!Number.isFinite(num) || num <= 0) {
        result.error = `El tiempo límite provisto ("${args[i]}") debe ser un número positivo y finito de milisegundos.`;
        return result;
      }
      result.timeoutMs = num;
    } else if (arg.startsWith('-')) {
      result.error = `Opción desconocida o no admitida: "${arg}". Use --help para ver los comandos válidos.`;
      return result;
    } else if (!result.customMessage) {
      result.customMessage = arg;
    } else {
      result.error = `Argumento inesperado: "${arg}". Use comillas para mensajes con espacios: --message "texto".`;
      return result;
    }
  }

  return result;
}

function printUsage() {
  console.log(`
Uso de la herramienta CLI del Clasificador Buyer:
  npx tsx src/scripts/classify-buyer-cli.ts [opciones] [mensaje]

Opciones:
  -m, --message <texto>    Mensaje de texto a clasificar (requerido si no se ejecuta el benchmark).
  -t, --timeout <ms>       Límite de tiempo por intento (predeterminado: 10000 ms, positivo).
  -v, --verbose            Muestra detalles adicionales e historial de reintentos.
  -h, --help               Muestra esta ayuda.

Ejemplos:
  1. Suite sintética completa (evaluación con código de salida estricto):
     npm --prefix backend run classify:buyer

  2. Clasificación de mensaje puntual:
     npx tsx src/scripts/classify-buyer-cli.ts --message "Quiero agendar una cita para ponerme brackets"

  3. Argumento directo con timeout personalizado:
     npx tsx src/scripts/classify-buyer-cli.ts "¿Cuánto cuesta el blanqueamiento dental?" --timeout 8000
`);
}

async function runCustomClassification(message: string, options: ParsedCliArgs) {
  console.log('='.repeat(72));
  console.log('🤖 AGENTE CLASIFICADOR BUYER - NexoSalud (SDK @google/genai)');
  console.log('='.repeat(72));
  console.log(`📡 Modelo: gemini-3.5-flash-lite`);
  console.log(`💬 Mensaje a clasificar: "${message}"`);
  console.log(`📚 Catálogo activo: ${SYNTHETIC_SERVICE_CATALOG.length} servicios`);
  console.log('-'.repeat(72));

  const classifier = new BuyerMessageClassifier({
    timeoutMs: options.timeoutMs,
  });

  try {
    const result: BuyerClassificationResult = await classifier.classify(
      message,
      SYNTHETIC_SERVICE_CATALOG
    );

    const matchedService = result.id_servicio
      ? SYNTHETIC_SERVICE_CATALOG.find((s) => s.id_servicio === result.id_servicio)?.nombre ??
        `ID ${result.id_servicio}`
      : 'Ninguno / No aplica (null)';

    console.log('\n✅ Resultado Validado JSON:');
    console.log(
      JSON.stringify(
        {
          intencion: result.intencion,
          id_servicio: result.id_servicio,
          intentos_realizados: result.intentos_realizados,
          duracion_total_ms: result.duracion_total_ms,
        },
        null,
        2
      )
    );

    console.log('\n📋 Resumen de Auditoría y Rendimiento:');
    console.log(`   - Intención detectada:  ${result.intencion}`);
    console.log(`   - ID de servicio:      ${result.id_servicio ?? 'null'}`);
    console.log(`   - Servicio asociado:   ${matchedService}`);
    console.log(`   - Intentos ejecutados: ${result.intentos_realizados}`);
    console.log(`   - Duración total:      ${result.duracion_total_ms} ms`);

    if (result.intentos && result.intentos.length > 0) {
      console.log('   - Detalle de intentos:');
      for (const att of result.intentos) {
        console.log(
          `     • Intento #${att.intento}: ${att.duracion_ms} ms (${att.exitoso ? 'Éxito' : 'Fallo'}${
            att.error ? ` - ${att.error}` : ''
          })`
        );
      }
    }

    console.log('='.repeat(72));
  } catch (error) {
    console.error('\n❌ Error durante la clasificación:');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

async function runSyntheticBenchmark(options: ParsedCliArgs) {
  console.log('='.repeat(85));
  console.log('🧪 SUITE SINTÉTICA DE CLASIFICACIÓN BUYER (Terminal Independiente)');
  console.log('   Sin servidor Express | Sin base de datos SQL Server');
  console.log('='.repeat(85));
  console.log(`📡 SDK Oficial:  @google/genai`);
  console.log(`🧠 Modelo:       gemini-3.5-flash-lite`);
  console.log(`📦 Catálogo:     ${SYNTHETIC_SERVICE_CATALOG.length} servicios odontológicos sintéticos`);
  console.log(`📨 Casos prueba: ${SYNTHETIC_BUYER_MESSAGES.length} mensajes calibrados`);
  console.log('='.repeat(85));

  const classifier = new BuyerMessageClassifier({
    timeoutMs: options.timeoutMs ?? 10000,
  });

  let passedCount = 0;
  const resultsTable: Array<{
    Caso: string;
    Categoría: string;
    'Intención Esp': string;
    'Intención Obtenida': string;
    'ID Esp': string;
    'ID Obtenido': string;
    Intentos: number;
    Duración: string;
    Estado: string;
  }> = [];

  for (const tc of SYNTHETIC_BUYER_MESSAGES) {
    try {
      const res = await classifier.classify(tc.mensaje, SYNTHETIC_SERVICE_CATALOG);

      const intencionMatch = res.intencion === tc.intencionEsperada;
      const idMatch = res.id_servicio === tc.idServicioEsperado;
      const isOk = intencionMatch && idMatch;

      if (isOk) passedCount++;

      resultsTable.push({
        Caso: tc.id,
        Categoría: tc.categoriaPrueba ?? 'general',
        'Intención Esp': tc.intencionEsperada,
        'Intención Obtenida': res.intencion,
        'ID Esp': String(tc.idServicioEsperado ?? 'null'),
        'ID Obtenido': String(res.id_servicio ?? 'null'),
        Intentos: res.intentos_realizados,
        Duración: `${res.duracion_total_ms}ms`,
        Estado: isOk ? '✅ OK' : '⚠️ DISCREPANCIA',
      });

      if (options.verbose) {
        console.log(`\n[${isOk ? 'OK' : 'DISCREPANCIA'}] Caso: ${tc.id}`);
        console.log(`Mensaje: "${tc.mensaje}"`);
        console.log(`Esperado: { intencion: ${tc.intencionEsperada}, id_servicio: ${tc.idServicioEsperado} }`);
        console.log(`Obtenido: { intencion: ${res.intencion}, id_servicio: ${res.id_servicio} }`);
        console.log(`Intentos: ${res.intentos_realizados}, Duración: ${res.duracion_total_ms}ms`);
      }
    } catch (err) {
      resultsTable.push({
        Caso: tc.id,
        Categoría: tc.categoriaPrueba ?? 'general',
        'Intención Esp': tc.intencionEsperada,
        'Intención Obtenida': 'ERROR',
        'ID Esp': String(tc.idServicioEsperado ?? 'null'),
        'ID Obtenido': 'ERROR',
        Intentos: 0,
        Duración: 'N/A',
        Estado: `❌ ERROR: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  console.log('\n📊 Resultados de la Evaluación Sintética:\n');
  console.table(resultsTable);

  const total = SYNTHETIC_BUYER_MESSAGES.length;
  console.log('='.repeat(85));
  console.log(`🎯 Calificación Final: ${passedCount} / ${total} aprobados (${Math.round((passedCount / total) * 100)}%)`);
  console.log('='.repeat(85));

  if (passedCount < total) {
    console.error(`\n❌ Fallo en la suite sintética: ${total - passedCount} caso(s) discrepante(s).`);
    process.exitCode = 1;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.error) {
    console.error(`\n❌ Error en argumentos de línea de comandos:\n   ${args.error}\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (args.showHelp) {
    printUsage();
    return;
  }

  if (args.customMessage) {
    await runCustomClassification(args.customMessage, args);
  } else {
    await runSyntheticBenchmark(args);
  }
}

main().catch((error) => {
  console.error('Error no controlado en CLI:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
