# Revisión QA Buyer — Daniel

Fecha: 12 de noviembre de 2026. **Actualización estructural QA aplicada y repetida con éxito en DANIELPC / NexoSalud_LeadEnsayoFinal. Listado y ficha HTTP 200; seis lecturas Prisma correctas.**

La preparación y el diagnóstico que siguen se conservan como historial. El estado actual, la autorización, el respaldo y las evidencias nuevas están en [Ejecución autorizada](#ejecución-autorizada-del-12-de-noviembre-de-2026). No se ensayó rollback ante fallo ni restauración del respaldo.

## Revisión inspeccionada y frontera de trabajo

- Rama real y prevista: `feature/buyer-orientacion-interactiva`.
- HEAD: `19613358530e899bfc68d5e6b3c33b6336ab9ce4`.
- Último cambio de la guía de Germain: `a0fbd765d53b9a9b66b466cbf869061e35fbcddf`.
- Estado inicial: sin modificaciones de archivos versionados; seis reportes locales sin versionar, desde [RESULTADOS_REVISION_BUYER.md](../../RESULTADOS_REVISION_BUYER.md) hasta [RESULTADOS_REVISION_BUYER_V6.md](../../RESULTADOS_REVISION_BUYER_V6.md). Se conservaron.
- No se ejecutaron pull, fetch, cambio de rama, merge, reset, stash, commit ni push.
- No se encontraron archivos AGENTS.md en la raíz ni en los subárboles aplicables; tampoco en las rutas ascendentes accesibles comprobadas.
- Daniel conserva SQL Server, compatibilidad y QA. El panel y comportamiento del agente corresponden a Germain en `feature/buyer-agent-gemini`.
- No se modificaron rutas, servicios, tipos, componentes, pruebas del agente ni [schema.prisma](../../backend/prisma/schema.prisma). No se propone cambiar contratos de procedimientos para resolver este P2022.

Se leyó el TXT adjunto `Texto pegado(20261112-182445).txt` de Downloads como evidencia previa y propuesta de Antigravity, sin asumir su aprobación. Sus operaciones Git históricas no se repitieron.

Referencias leídas: [guía de relevo](GUIA_RELEVO_GERMAIN_BUYER.md), [entrega Buyer](ENTREGA_AGENTE_BUYER.md), [esquema Prisma](../../backend/prisma/schema.prisma), [instalador LEAD](../../database/lead_revision/INSTALAR_LEAD_COMPLETO.sql), [punto de entrada](../../database/lead_revision/APLICAR_BUYER_LEAD.sql), [bloque Buyer](../../database/lead_revision/01_BUYER_OLTP.sql), [procedimiento de instalación](../../database/lead_revision/PROCEDIMIENTO_INSTALACION_OLTP.md), [contrato Buyer–LEAD](../../database/lead_revision/CONTRATO_BUYER_LEAD.md) y [entrada LEAD QA](../../database/lead_revision/ENTRADA_AGENTE_LEAD_QA.sql).

## Destino y resolución de conexiones

**Confirmado por consultas reales, exclusivamente contra `DANIELPC / NexoSalud_LeadEnsayoFinal`.** Tanto `@@SERVERNAME` como `SERVERPROPERTY('ServerName')` identificaron DANIELPC. Versión consultada: `15.0.2000.5` (SQL Server 2019).

En [db.ts](../../backend/src/db.ts), dotenv carga el entorno del backend sin sobrescribir variables ya heredadas del proceso. Prisma resuelve:

1. `TEST_SQLSERVER_URL`, si tiene un valor no vacío.
2. Si no existe la anterior y `RUN_SQL_TESTS === 'true'`, toma `SQLSERVER_URL` y sustituye su propiedad `database=...` por `NexoSalud_LeadEnsayoFinal`.
3. En otro caso, usa `SQLSERVER_URL`. El datasource de [Prisma](../../backend/prisma/schema.prisma) también declara esa variable como configuración base.

En el proceso inspeccionado, `TEST_SQLSERVER_URL` no estaba definida y la fuente efectiva fue `SQLSERVER_URL`, configurada explícitamente para QA. `QA_ENV=true` no redirige conexiones. El reemplazo de `RUN_SQL_TESTS` tampoco es una guarda si falta la propiedad `database`; la sonda rechaza destinos distintos antes de conectarse.

[mart.ts](../../backend/src/db/mart.ts) mantiene pools separados: `OLTP_CONNECTION_STRING` y `MART_CONNECTION_STRING`, con valores predeterminados independientes. No heredan la selección `TEST_SQLSERVER_URL`. Solo se inspeccionó el nombre de base configurado para OLTP, también QA; **no se abrieron esos pools ni se consultó otra base**. El mensaje fijo de log del pool OLTP tampoco demuestra su destino real. No se imprimieron archivos de entorno, cadenas completas ni claves.

## Diagnóstico confirmado

El GET del listado en [buyer.routes.ts](../../backend/src/routes/buyer.routes.ts) incluye `Solicitudes` con `Servicio`. Prisma solicita todos los campos escalares declarados de `Solicitudes`, aunque la llamada raíz sea `personas.findMany`. Por eso `meta.modelName = Personas` no identifica la tabla física donde faltan las columnas.

Se reprodujeron las rutas reales montando únicamente el router en Express, en un puerto efímero local. No se arrancó [index.ts](../../backend/src/index.ts), porque inicia dunning y recuperación de evaluaciones, con posibles escrituras. No se invocó Gemini.

| Operación real | Resultado observado |
| --- | --- |
| `GET /api/buyer?page=1&pageSize=25` | HTTP 500, `Error al obtener buyers`, P2022, modelo raíz Personas |
| `GET /api/buyer/:id` con una persona existente | HTTP 500, `Error al obtener ficha de buyer`, mismo P2022 |
| Lectura Prisma de Solicitudes | P2022 |
| Lectura Prisma de Opciones | P2022 |
| Lectura Prisma de las cuatro tablas de soporte | P2021 en cada tabla |

Las once columnas rechazadas son `id_negociador`, `id_canal_origen`, `id_sede_interes_lead`, `fecha_ingreso_lead`, `archivada_lead_en`, `resultado_comercial_lead`, `fecha_decision_comercial_lead`, `valor_acordado_lead`, `id_propuesta_aceptada_lead`, `motivo_cierre_lead` y `fecha_proximo_seguimiento`, todas de `dbo.Solicitudes`.

La ficha tiene la misma dependencia de Solicitudes. Ni listado ni ficha incluyen Opciones o propuestas en esa consulta: esos otros faltantes se comprobaron separadamente. No se utilizó `/api/ping` como prueba de esquema; su `SELECT 1` solo acredita conectividad.

## Objetos afectados y alcance propuesto

El bloqueo inmediato del listado son las once columnas anteriores. La propuesta amplía ese mínimo a las **secciones estructurales B–G** del instalador original, para conservar sus relaciones y reglas y cubrir los modelos adicionales examinados. Este alcance debe aprobarse expresamente antes de aplicar; no equivale a habilitar todo LEAD.

| Objeto | Estado físico observado | Cambio propuesto |
| --- | --- | --- |
| dbo.Solicitudes | 10 columnas baseline; faltan 11 de Prisma y 2 de registro web SQL | 13 columnas NULL, 4 FK, 2 CHECK, índice único filtrado de clave web |
| dbo.Opciones | 6 columnas baseline; faltan 12 de Prisma y 2 campos SQL heredados de rechazo | 14 columnas NULL, 3 FK, 3 CHECK |
| dbo.PromocionesLead | No existe | Tabla original: 5 columnas, PK, FK a Servicios, default de activo y 2 CHECK |
| dbo.MotivosRechazoLead | No existe | Tabla original: 6 columnas, PK, UQ de código, default de activo y 4 CHECK |
| dbo.PropuestasEconomicasLead | No existe | Tabla original y extensiones: 15 columnas, PK, 6 FK, 3 defaults, 4 CHECK e índice único filtrado raíz/versión |
| dbo.CambiosOpcionLead | No existe | Tabla original y extensiones: 10 columnas, PK, FK a Opciones, 3 defaults y 1 CHECK |
| dbo.Interacciones | `id_solicitud INT NULL` ya existe; falta su FK | Conservar columna y datos; agregar FK a Solicitudes con WITH CHECK |

Totales del cambio sobre el estado observado: **27 columnas nuevas en tablas existentes, 4 tablas vacías, 4 PK, 1 UQ, 16 FK, 16 CHECK, 8 defaults de tablas nuevas y 2 índices únicos filtrados**. Ninguna columna existente cambia de tipo o nulabilidad.

Tipos de las extensiones de Solicitudes: identificadores `INT NULL`, fechas `DATETIME2(7) NULL`, resultado `VARCHAR(25) NULL`, importe `DECIMAL(14,2) NULL`, motivo de cierre `VARCHAR(400) NULL`, clave web `VARCHAR(36) NULL` y hash web `CHAR(64) NULL`.

Opciones conserva las definiciones originales: `DATETIME2(7)` para archivo/respuesta, `VARCHAR(20)` para estado, tres identificadores `INT`, fecha preferida `DATE`, día `TINYINT`, turnos `VARCHAR(30)`, horas `TIME(7)`, motivo `VARCHAR(200)` y tipo de motivo `VARCHAR(30)`, todos NULL.

Se conservan también `motivo_rechazo` y `tipo_motivo_rechazo` en propuestas aunque Prisma no los exponga. No hace falta agregarlos a Prisma para esta corrección.

FK previstas por grupo: Solicitudes → Usuarios/Canales/Sedes/Propuestas; Opciones → Propuestas/PersonaPreferencias/Motivos; Promociones → Servicios; Propuestas → Solicitudes/Servicios/raíz/Sedes/Promociones/Motivos; Cambios → Opciones; Interacciones → Solicitudes. Todas conservan NO ACTION y comprobación de datos.

Índices nuevos: `UX_Solicitudes_RegistroWebLead` y `UX_PropuestasLead_RaizVersion`, con sus filtros originales. El índice existente `IX_Solicitudes_Persona_Fecha` está presente y se conserva. Las claves candidatas base requeridas para las FK existen.

`CaptacionesBuyer`, la vista de captación, la conversión Buyer, `EntradasAgenteLead` y el receptor están presentes. La conversión expone `@id_captacion`, `@id_servicio`, `@motivo NVARCHAR(200)` y `@id_usuario`; el receptor, `@id_solicitud`. Solo se consultó su catálogo, no se ejecutaron.

No existen ConfiguracionLeadRevision, las tres tablas Historial LEAD, el procedimiento de presentar alternativa ni R1/R2/R3. **No los crea esta actualización**. Tampoco instala triggers, fuentes analíticas, DataMart, catálogos de datos o backfill. No marca `LEAD-V2` ni inventa un inicio de auditoría. Las reglas transversales implementadas mediante triggers en el paquete completo siguen pendientes; las FK de este parche no prueban por sí solas pertenencia a la misma persona/solicitud.

## Auditoría de la propuesta de Antigravity

No se aprueba el SQL del TXT tal como está:

- Sus guardas están en lotes separados por GO. Un THROW detiene su lote; sin SQLCMD `:ON ERROR EXIT` no garantiza que SSMS deje de enviar los siguientes lotes con DDL.
- Inserta `LEAD-V2` con una fecha de auditoría sin instalar historia, snapshots ni triggers. Atribuiría al parche una instalación que no realiza.
- Omite los 16 CHECK, los dos índices únicos filtrados, la FK de preferencia de Opciones y campos SQL de rechazo de Opciones/Propuestas. También omite la FK de Interacciones, cuya columna ya existe.
- Comprueba pocas tablas base: no cubre, por ejemplo, Servicios y PersonaPreferencias con sus claves requeridas.
- La guarda conjunta de clave/hash web no es repetible cuando solo existe una de las dos columnas. El original tiene la misma fragilidad; la propuesta QA comprueba cada columna por separado.
- No verifica forma de columnas preexistentes, PK/UQ/defaults, mapeo de FK ni confianza de restricciones.
- Sus referencias a columnas agregadas y objetos nuevos no tienen el aislamiento de compilación suficiente para dar por probado el lote en un esquema parcialmente instalado. Un TRY/CATCH del mismo ámbito no captura todos los errores de compilación.

La propuesta QA reutiliza B–G del [instalador original](../../database/lead_revision/INSTALAR_LEAD_COMPLETO.sql). Las diferencias deliberadas son las guardas independientes de clave/hash, las comprobaciones adicionales, la delimitación transaccional y dar nombre estable `FK_PropuestasLead_SedeLead` a la relación a Sedes que el original crea con nombre automático. Se mantienen tipos, nulabilidad, defaults y expresiones CHECK originales.

El orden general del instalador completo es [APLICAR_BUYER_LEAD.sql](../../database/lead_revision/APLICAR_BUYER_LEAD.sql) → [01_BUYER_OLTP.sql](../../database/lead_revision/01_BUYER_OLTP.sql) → [INSTALAR_LEAD_COMPLETO.sql](../../database/lead_revision/INSTALAR_LEAD_COMPLETO.sql), con SQLCMD y transacción externa. Este diagnóstico **no prescribe repetir ese paquete** sobre la copia existente. La entrada de agente tiene su [instalador separado](../../database/lead_revision/ENTRADA_AGENTE_LEAD_QA.sql) y ya está presente.

## Archivos y garantías de ejecución

- [Comprobación previa](../../database/qa/buyer_p2022/00_COMPROBACION_PREVIA.sql): lectura de catálogo, conteos, referencias y parámetros. Incluye un manifiesto de 228 columnas relevantes para las operaciones inspeccionadas y sus prerrequisitos.
- [Propuesta SQL parcial](../../database/qa/buyer_p2022/01_PROPUESTA_ALINEAR_BUYER_QA.sql): DDL aditivo; posteriormente aplicado y repetido en el destino autorizado, con la misma huella aprobada. Evidencia en la sección de ejecución.
- [Comprobación posterior](../../database/qa/buyer_p2022/02_COMPROBACION_POSTERIOR.sql): consulta catálogo, verifica forma, claves, defaults, FK, CHECK e índices y compila proyecciones sin devolver pacientes.
- [Sonda HTTP/Prisma de solo lectura](../../database/qa/buyer_p2022/COMPROBAR_BUYER_SOLO_LECTURA.cjs): usa las rutas existentes, bloquea escrituras Prisma y omite el arranque general. Salida 0 solo si ambos GET y las seis lecturas pasan; 1 si falla una lectura; 2 si la sonda no puede completar la comprobación.
- [Evidencia previa real](../../database/qa/buyer_p2022/EVIDENCIA_PREVIA_20261112.txt) y [evidencia HTTP/Prisma real](../../database/qa/buyer_p2022/EVIDENCIA_HTTP_20261112.json): sin nombres, mensajes ni cuerpos de pacientes.

Huellas SHA-256 de los archivos SQL finales (bytes de esta revisión):

| Archivo | SHA-256 |
| --- | --- |
| [Comprobación previa](../../database/qa/buyer_p2022/00_COMPROBACION_PREVIA.sql) | `96E809EC18AC8EAEF91CB64826BFA2E60BF23D3C9AB49B14BB32A4E705A016D7` |
| [Propuesta parcial](../../database/qa/buyer_p2022/01_PROPUESTA_ALINEAR_BUYER_QA.sql) | `EB38A85DC76AE96002ECDA7D046663B9BFB68A0CD9A4F1E95931E794117BCFF8` |
| [Comprobación posterior](../../database/qa/buyer_p2022/02_COMPROBACION_POSTERIOR.sql) | `D09E43BAB017104E1E352B8C8FC4354FC6F3D666DD64608EAC93F96CD31C5E9E` |

El DDL exige servidor y base exactos, VIEW DEFINITION, sesión sin transacción previa o implícita, base escribible, columnas base y claves compatibles, módulos Buyer y etapas existentes. Rechaza tipos distintos y tablas de soporte preexistentes incompletas; no reconcilia fragmentos desconocidos ni duplica FK equivalentes con otro nombre. Comprueba referencias huérfanas antes de agregar la FK de Interacciones.

Es **un solo lote sin separadores GO ni inclusiones `:r`**. Las guardas preceden al DDL. Todo el bloque B–G se ejecuta en un ámbito inferior mediante `sp_executesql`; sus ALTER, índices, FK y CHECK dependientes de columnas nuevas se ejecutan dinámicamente en el orden original. Los errores de ese ámbito llegan al CATCH externo, que revierte la transacción propia y relanza el error. La confirmación ocurre después de los controles finales. No hay instrucciones persistentes de INSERT/UPDATE/DELETE, inicializadores destructivos ni llamadas a Prisma de sincronización de esquema.

Los controles verifican presencia/confianza de los CHECK y muestran sus expresiones; **no demuestran equivalencia semántica de un CHECK preexistente con el mismo nombre**. En el estado observado no existe ninguno de los 16. Si el catálogo cambia antes de la ventana, revisar sus definiciones en la salida previa, además de repetir los controles automáticos.

## Resultados del diagnóstico previo y límites de esa validación (histórico)

| Verificación ejecutada | Resultado |
| --- | --- |
| Identidad Prisma y SQLCMD | DANIELPC / NexoSalud_LeadEnsayoFinal |
| Comprobación previa | SQLCMD, salida 0; `PRERREQUISITOS_VERIFICADOS; ACTUALIZACION NO APLICADA` |
| Manifiesto estructural | 63 campos ausentes: 27 en tablas existentes y 36 en las cuatro tablas ausentes; sin diferencias de tipo/nulabilidad/identidad en los campos presentes del manifiesto |
| Comparación global de nombres escalares Prisma con catálogo | 57 campos sin correspondencia: 11 Solicitudes, 12 Opciones y 34 en las cuatro tablas ausentes; incluye ausencias de tablas, no 57 ALTER de tablas existentes |
| Referencias de Interacciones a Solicitudes | 0 vínculos presentes, 0 huérfanos, 0 personas discordantes |
| Sonda HTTP/Prisma | Salida 1 esperada en el estado previo; dos HTTP 500/P2022, dos lecturas P2022 y cuatro P2021 |
| Sintaxis JS de la sonda | `node --check`, salida 0 |
| Sintaxis SQL | `SET PARSEONLY ON`, salida 0 para 60 bloques: tres archivos y sus cadenas SQL dinámicas extraídas recursivamente |
| Aplicación, rollback real y segunda ejecución idempotente | **No ejecutados** |
| Comprobación posterior y HTTP 200 posterior | **Pendientes** |
| Suites de agente / SQL con escrituras / Gemini | No ejecutadas en este bloque |

PARSEONLY no ejecuta DDL ni resuelve todas sus dependencias: no acredita compilación semántica del esquema nuevo, atomicidad probada ni compatibilidad completa. No se creó otra base ni se usó una transacción de DDL con rollback como ensayo encubierto.

Conteos de referencia de la copia observada: Personas **10809**, Solicitudes **2861**, Opciones **310**, Interacciones **20004**. Las evidencias incluyen fecha UTC del servidor. Para exigir igualdad después, repetir la captura con todos los escritores detenidos; estos conteos por sí solos no prueban igualdad de cada valor original.

## Orden previsto en la preparación (histórico; ejecución registrada abajo)

1. Daniel y Germain revisan el alcance parcial de 27 columnas/cuatro tablas, las definiciones originales y el efecto de nuevas restricciones sobre futuras escrituras. Confirmar que se desea cubrir esos modelos adicionales y no solo el mínimo del listado.
2. Confirmar nuevamente rama, HEAD, servidor, base y huellas de los archivos revisados. No sustituir los originales durante la revisión. Preparar respaldo recuperable de QA y una ventana sin escritores antes de cualquier aplicación autorizada.
3. Ejecutar de nuevo la [comprobación previa](../../database/qa/buyer_p2022/00_COMPROBACION_PREVIA.sql) completa, guardar su salida con nombre nuevo y revisar expresiones de restricciones y conteos. Si falla, no quitar guardas.
4. Autorizar por separado el ensayo DDL en una copia QA acordada. La propuesta está fijada a DANIELPC/NexoSalud_LeadEnsayoFinal; ensayarla en otra copia exige revisar una variante con destino explícito, nunca eliminar la guarda. Verificar primer pase, segunda ejecución sin cambios y rollback ante un fallo controlado. Nada de esto se ejecutó ahora.
5. **Solo tras esa revisión y autorización**, ejecutar el archivo de [propuesta](../../database/qa/buyer_p2022/01_PROPUESTA_ALINEAR_BUYER_QA.sql) completo en una sesión nueva de SSMS sobre el destino aprobado. No ejecutar selecciones ni insertar GO. No repetir el instalador completo.
6. Ejecutar la [comprobación posterior](../../database/qa/buyer_p2022/02_COMPROBACION_POSTERIOR.sql). Exigir cero diferencias del manifiesto, 16 FK y 16 CHECK confiables, claves/defaults e índices correctos, conteos conservados y comparación acordada de datos originales. Registrar como **QA-BUYER-P2022-PARCIAL**, nunca como instalación completa LEAD-V2.
7. Repetir la sonda siguiente desde la raíz, conservando una evidencia posterior independiente:

   ```powershell
   node database/qa/buyer_p2022/COMPROBAR_BUYER_SOLO_LECTURA.cjs
   ```

   Exigir HTTP 200 en listado y ficha con persona existente, seis `LECTURA_OK` y salida 0. Una lista vacía o `/api/ping` exitoso no sustituye la ficha y las proyecciones revisadas.
8. Antes de arrancar el backend general, revisar con Germain las evaluaciones pendientes que su recuperación automática podría procesar. El parche no certifica conversión, recepción, concurrencia, identidad `BUYER_LEAD` ni llamadas Gemini. Mantener esos ensayos y los pendientes P1/P2/P3 de la entrega como tareas separadas.

**Cierre del bloque de preparación (histórico): diagnóstico reproducido y propuesta revisable preparada; destino confirmado; SQL todavía sin aplicar en ese momento.**

## Ejecución autorizada del 12 de noviembre de 2026

El usuario revisó el ZIP previo y autorizó expresamente aplicar **exclusivamente la actualización estructural propuesta sobre DANIELPC / NexoSalud_LeadEnsayoFinal**, preparar respaldo COPY_ONLY si era necesario y repetir el script para comprobar idempotencia. Esta autorización posterior sustituyó la restricción inicial de no aplicar SQL. No incluyó desarrollo del agente, cambios de Prisma/procedimientos, Gemini, recuperadores, commit ni push; no se realizaron esas acciones.

Se conservó la rama `feature/buyer-orientacion-interactiva` y HEAD `19613358530e899bfc68d5e6b3c33b6336ab9ce4`. No hubo archivos versionados modificados: los entregables QA siguen apareciendo como nuevos sin versionar. Los seis reportes locales preexistentes y el ZIP anterior se conservaron. No se incorporaron cambios de Germain.

Las tres huellas SQL coinciden con la tabla anterior y con el paquete aprobado. **No se editaron los tres SQL ni se insertaron separadores GO.** Las dos aplicaciones usaron íntegramente el mismo archivo aprobado mediante SQLCMD con `-b -I`, conectado directamente a QA.

### Sonda corregida

En [COMPROBAR_BUYER_SOLO_LECTURA.cjs](../../database/qa/buyer_p2022/COMPROBAR_BUYER_SOLO_LECTURA.cjs), la ausencia de persona agrega un resultado explícito `INCOMPLETO_SIN_PERSONA`, con estado HTTP nulo, `complete=false` y salida 1. Solo declara el recorrido completo cuando existen persona y dos respuestas comprobadas. No modifica datos para fabricar el caso.

Se probaron los casos simulados de persona ausente y presente: salidas 1 y 0 respectivamente. Estas pruebas no se confunden con las peticiones HTTP/SQL reales posteriores. Se conserva la [evidencia sintética inicial](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/SONDA_CASOS_SINTETICOS.json). La [prueba de la versión final](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/SONDA_CASOS_SINTETICOS_FINAL.json) repitió ambos casos y verificó además SELECT parametrizado permitido y escritura de modelo, executeRaw y SQL mixto bloqueados. Ambas sondas pasan `node --check`; el editor no reportó errores.

En la primera sonda posterior al DDL, ambos GET devolvieron 200, pero el middleware bloqueó una consulta SELECT parametrizada del listado por el formato de argumentos de Prisma. Esa ejecución **no se aceptó como validación limpia**, aunque la versión inicial de la sonda devolvió salida 0. Se conservó [esa evidencia](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/07_HTTP_PRISMA_POSTERIOR.json), se ajustó exclusivamente el reconocimiento del arreglo de fragmentos SQL y se añadió el criterio de salida no exitosa ante cualquier `QA_WRITE_BLOCKED`. La consulta seguía siendo de lectura y no se relajó la prohibición de escrituras. La [repetición corregida](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/07b_HTTP_PRISMA_VALIDADO.json) y la [sonda final](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/14_HTTP_PRISMA_FINAL.json) terminaron con salida 0 y sin bloqueos ni errores.

### Destino, escritores y respaldo

Se confirmó nuevamente el destino efectivo mediante Prisma y SQLCMD. La configuración siguió resolviéndose desde `SQLSERVER_URL` hacia QA. No se abrieron conexiones del DataMart ni se arrancó el backend general.

No se encontraron procesos del proyecto ni listeners en 3001/5173 antes de aplicar y después de finalizar; SQL Server Agent estaba detenido. Existía una sesión SSMS inactiva, sin transacción abierta: no se cerró ni se mató. Las guardas y las capturas no observaron peticiones ajenas ni transacciones de usuario abiertas en QA. Estas son comprobaciones de la ventana observada; no se cambió la base a modo de usuario único ni se bloquearon aplicaciones ajenas mediante cambios de configuración.

Evidencias: [entorno SQL](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/00_ENTORNO_LECTURA.txt), [procesos antes](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/04_PROCESOS_ANTES.json), [guarda SQL](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/04_GUARDA_ESCRITORES_ANTES.txt) y [procesos después](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/15_PROCESOS_DESPUES.json).

No constaba un respaldo previo de esta copia en msdb. Se creó un respaldo completo nuevo **COPY_ONLY + CHECKSUM + COMPRESSION**, sin FORMAT ni INIT y con nombre exclusivo comprobado antes de escribir:

```text
C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\Backup\NexoSalud_LeadEnsayoFinal_QA_BUYER_20261112T191639Z_E57F5A45-B726-45DC-A997-AD46CE185F13.bak
```

- UUID del conjunto: `3CEE13F0-6F83-487A-BA9E-9070CEB82529`.
- SHA-256 del archivo: `63B196B8081A623C596EFB302BA06ED7D659459CF73D30FA8BC9F147CE3A9A57`.
- `is_copy_only=1`, `has_backup_checksums=1`, `is_damaged=0`; tamaño comprimido reportado: 2.100.744 bytes.
- `DBCC CHECKDB` sin errores reportados y salida 0; `RESTORE VERIFYONLY ... WITH CHECKSUM` devolvió conjunto válido antes de aplicar el DDL.
- Respaldo conservado fuera del repositorio y excluido del ZIP. No se sobrescribió ni restauró otro respaldo. La verificación del conjunto **no equivale a una restauración ensayada**.

Se incluyen el [SQL de respaldo utilizado](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/01_RESPALDAR_QA.sql), su [resultado](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/01_RESPALDO_RESULTADO.txt) y la [huella del archivo](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/01_RESPALDO_SHA256.json), sin incluir el respaldo binario.

### Aplicación y verificaciones reales

La [nueva comprobación previa](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/02_COMPROBACION_PREVIA.txt) terminó con salida 0. Su salida completa coincide con el diagnóstico anterior al excluir únicamente la marca UTC de identidad; se conserva [la comparación](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/02_COMPARACION_DIAGNOSTICO.json). No se detectó deriva que exigiera detener o modificar las protecciones.

| Paso | Resultado real |
| --- | --- |
| Primera aplicación íntegra | Salida 0, `QA-BUYER-P2022-PARCIAL`, DDL confirmado |
| Comprobación posterior | Salida 0; cero diferencias del manifiesto, FK/CHECK confiables, claves/defaults/índices compatibles |
| Sonda corregida tras primera aplicación | Listado 200, ficha de persona existente 200, seis `LECTURA_OK`, `complete=true`, salida 0 y ningún error capturado |
| Segunda aplicación íntegra, mismo SHA-256 | Salida 0; ninguna incorporación adicional al catálogo |
| Comprobación posterior repetida | Salida 0 |
| Sonda final tras segunda aplicación | Listado 200, ficha 200, seis `LECTURA_OK`, `complete=true`, salida 0 y ningún error capturado |
| Procedimientos, vistas y demás módulos SQL originales | Huellas de definición conservadas |

Se aplicaron exactamente los objetos previstos: 27 columnas en tablas existentes, 4 tablas nuevas, 4 PK, 1 UQ, 16 FK, 16 CHECK, 8 defaults y los dos índices únicos filtrados. El inventario pasó de **207 a 256 objetos** en sys.objects; los 49 nuevos son las cuatro tablas y sus restricciones. Los índices se inventariaron aparte. El número final de tablas es 36; las cuatro nuevas están vacías. No se creó ConfiguracionLeadRevision ni se registró LEAD-V2; no se instalaron procedimientos, triggers, reportes ni historial completo LEAD.

Las capturas de catálogo/contenido se tomaron a las **19:19:39.615Z** antes, **19:20:50.291Z** tras la primera aplicación y **19:22:01.256Z** tras la segunda. Existe además una captura inmediatamente anterior a la repetición. La sonda final corresponde a **19:22:43.293Z**.

Evidencias de ejecución: [primera aplicación](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/05_APLICACION_PRIMERA.txt), [comprobación posterior](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/06_COMPROBACION_POSTERIOR.txt), [segunda aplicación](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/10_APLICACION_SEGUNDA.txt), [comprobación repetida](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/13_COMPROBACION_TRAS_SEGUNDA.txt) y [HTTP/Prisma final](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/14_HTTP_PRISMA_FINAL.json).

### Conservación de datos e idempotencia

| Tabla | Antes | Tras primera aplicación | Tras segunda aplicación |
| --- | --- | --- | --- |
| dbo.Personas | 10809 | 10809 | 10809 |
| dbo.Solicitudes | 2861 | 2861 | 2861 |
| dbo.Opciones | 310 | 310 | 310 |
| dbo.Interacciones | 20004 | 20004 | 20004 |

También coinciden los conteos de las otras 28 tablas originales. La conservación de conteos **no demuestra por sí sola conservación de cada valor**.

Como evidencia adicional se usó [CAPTURAR_ESTADO_SOLO_LECTURA.cjs](../../database/qa/buyer_p2022/CAPTURAR_ESTADO_SOLO_LECTURA.cjs), que solo emite SELECT y guarda metadatos/huellas, nunca filas de pacientes. Calcula SHA-256 sobre la serialización SQL `FOR JSON PATH, INCLUDE_NULL_VALUES` de todas las filas, ordenadas por PK. Para comparar antes/después de la primera aplicación usa las columnas originales; para la segunda compara todas las columnas.

- Las 32 tablas originales conservaron conteos y huellas de las columnas originales.
- Entre inmediatamente antes y después de la segunda aplicación, el catálogo serializado fue exactamente igual: objetos, identificadores, fechas de definición, columnas, PK, índices, FK, CHECK y defaults.
- Las 36 tablas conservaron conteos y huellas del contenido de todas sus columnas durante la segunda aplicación. No se detectaron objetos adicionales ni cambios de datos en ese alcance: idempotencia comprobada en este destino.
- Las huellas son una comparación determinista de la representación JSON, no una comparación binaria de páginas ni una comparación explícita valor por valor con tratamiento especial para cada tipo. Tampoco sustituyen una restauración verificada. No se declara una auditoría integral de todas las reglas o usos de la base.

Consultar [comparación y resultados](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/12_COMPARACION_Y_RESULTADOS.json), [captura original](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/03_ESTADO_ANTES.json), [captura tras primera aplicación](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/08_ESTADO_TRAS_PRIMERA.json), [captura anterior a la repetición](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/09_ESTADO_ANTES_REPETICION.json) y [captura final](../../database/qa/buyer_p2022/ejecucion_20261112T191639Z/11_ESTADO_TRAS_SEGUNDA.json).

### Pendientes y cierre actual

- **No se ensayó rollback ante fallo.** Las dos aplicaciones confirmaron correctamente; no prueban el camino de error.
- No se restauró el respaldo en otra base. Se conserva el conjunto COPY_ONLY verificado por checksum para recuperación.
- Continúan pendientes las pruebas de conversión, recepción, concurrencia, recuperación automática, Gemini y demás funcionalidades del agente. No se arrancaron esos trabajos ni se modificaron sus contratos o implementación.
- La actualización es parcial y específica de QA. No acredita una instalación completa LEAD ni autoriza aplicar el paquete a otra base.
- Se preservaron las evidencias previas y se generó una carpeta nueva para esta ventana. El ZIP de ejecución conserva rutas relativas y excluye entorno, credenciales, dependencias, compilados, Git y respaldos.

**Cierre actual: P2022 de listado/ficha corregido en el destino autorizado; DDL aplicado, lecturas validadas e idempotencia comprobada. Sin cambios de agente, Prisma o procedimientos; sin Gemini, recuperadores, commit ni push.**
