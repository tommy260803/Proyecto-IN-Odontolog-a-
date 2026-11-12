# Fallos y concurrencia Buyer: reproduccion QA

Este bloque reutiliza sin cambios [consultas_qa.cjs](../buyer_backend/consultas_qa.cjs) y [entorno_qa.cjs](../buyer_backend/entorno_qa.cjs) del arnés anterior. Los archivos nuevos están separados en esta carpeta. No se necesita editar producción ni instalar dependencias.

**Es una prueba con escrituras reales confirmadas.** Mantener detenidos backend general, Mart, dunning y recuperadores. Nunca arrancar index.ts. Usar exclusivamente DANIELPC / NexoSalud_LeadEnsayoFinal; el arnés comprueba la base configurada antes de conectar, el servidor/base efectivos antes de escribir, módulos SQL, etapas y servicio activo. No usar contactos históricos. Las variables de aislamiento y clave ficticia solo afectan al proceso de prueba; no se edita ni imprime ningún archivo de entorno.

Desde la raíz del repositorio, con Node 24 y dependencias del backend existentes:

```powershell
node --check database/qa/buyer_fallos_concurrencia/entorno_fallos.cjs
node --check database/qa/buyer_fallos_concurrencia/gemini_fallos_controlados.cjs
node --check database/qa/buyer_fallos_concurrencia/pruebas_fallos_concurrencia.test.cjs
Remove-Item Env:QA_BUYER_FAILURE_RUN_ID -ErrorAction SilentlyContinue
node --test --test-concurrency=1 database/qa/buyer_fallos_concurrencia/pruebas_fallos_concurrencia.test.cjs
$LASTEXITCODE
```

Un identificador nuevo crea su propia carpeta y prefijo `QA_BFC_<id>_`. No reutilizar `20261112T200939Z`: es la ejecución preservada y el arnés rechaza sus resultados/prefijo existentes. No hay DELETE ni limpieza; se conservan los fixtures y sus IDs. Las lecturas previas/posteriores comparan ocho tablas fuera del prefijo mediante conteos y SHA-256 del JSON ordenado por PK.

[pruebas_fallos_concurrencia.test.cjs](./pruebas_fallos_concurrencia.test.cjs) monta el router real en Express loopback con puerto efímero. Restringe las rutas a registro público y retry explícito, observa Prisma delegando siempre a next(params), y no invoca recuperadores. Las ocho huellas de producción se comparan antes/después.

[gemini_fallos_controlados.cjs](./gemini_fallos_controlados.cjs) solo reemplaza Models.generateContent del SDK en memoria, mediante una subclase que conserva su constructor real. A devuelve tres errores 503 controlados con mensaje QA_GEMINI_503; los reintentos y el backoff son los reales del clasificador. B devuelve SOLO_CONSULTA para la misma interacción. C devuelve SOLICITA_RESERVA con un servicio activo y un retardo de 600 ms en esa respuesta externa simulada. No se simulan decisiones, Prisma, conversión ni receptor SQL. No hay llamadas reales a Gemini; el monitor fetch solo permite el origen HTTP propio del arnés.

Aunque el runner usa test-concurrency=1 para ordenar A/B/C, **dentro de C** se lanzan dos fetch con Promise.allSettled, liberados por una barrera cliente y otra barrera HTTP antes del router. La barrera servidor espera ambas peticiones y las libera juntas; no reemplaza el router ni bloquea Prisma. El timeout de barrera queda identificado como fallo del arnés (HTTP 599), distinto de la lógica de aplicación. Se guardan tiempos monotónicos de recepción, entrada al router, finalización y lecturas reales de la clave.

**Resultado del commit 19613358530e899bfc68d5e6b3c33b6336ab9ce4: A/B pasan; C falla por duplicar interacción y decisión con la misma clave. Salida esperada del caso defectuoso actual: 1.** Ambas respuestas son HTTP 201; los procedimientos conservan una única solicitud/evento/entrada. No cambiar el esperado a dos filas ni convertir el fallo en test.todo para obtener verde. Las comprobaciones comerciales positivas no validan la idempotencia del registro.

[02_DIAGNOSTICO_SOLO_LECTURA.sql](./02_DIAGNOSTICO_SOLO_LECTURA.sql) corrobora únicamente los fixtures preservados y los índices/columnas efectivos. Ejemplo, escoger un archivo de salida nuevo para preservar evidencia:

```powershell
sqlcmd -S DANIELPC -d NexoSalud_LeadEnsayoFinal -E -b -r 1 -f 65001 -y 0 -w 65535 -i database\qa\buyer_fallos_concurrencia\02_DIAGNOSTICO_SOLO_LECTURA.sql -o "$env:TEMP\buyer_fallos_revision_nueva.txt"
```

Detalle y caso para Germain: [PRUEBAS_FALLOS_CONCURRENCIA_BUYER_QA_DANIEL.md](../../../docs/agentes/PRUEBAS_FALLOS_CONCURRENCIA_BUYER_QA_DANIEL.md). Repetir en la versión final de Germain con prefijo nuevo. No se prueban Gemini real, interfaz, caída o recuperación automática ni concurrencia entre varias instancias del backend.
