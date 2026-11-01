# Orden de ejecución y alcance de Buyer

**Estado:** versión SQL candidata para pruebas locales. No ejecutada todavía contra SQL Server. No está integrada al backend antiguo.

## Descargar

1. Abrir la rama `analysis/buyer-bases-datos` en GitHub.
2. Seleccionar **Code → Download ZIP** y descomprimir.
3. Abrir `database/buyer_revision/semana9/`.

Los archivos `.md` son documentación; los `.sql` contienen instrucciones ejecutables. Los comentarios dentro de un SQL se conservan para explicar esas instrucciones.

## Crear desde cero

Antes de eliminar bases locales, detener el backend y conservar un respaldo `.bak` de cada una si se quieren retener sus datos. Esta guía no ejecuta ninguna eliminación.

Si se eligió empezar desde cero, eliminar primero `NexoSalud_Mart` y después `NexoSaludDB` desde SSMS. Revisar los nombres y seleccionar el cierre de conexiones existentes. Abrir cada archivo por separado con **Archivo → Abrir → Archivo**, ejecutar con **F5** y detenerse ante cualquier error en **Mensajes**.

| Orden | Archivo | Finalidad |
|---|---|---|
| 1 | `init_oltp.sql` | Crear el transaccional y su extensión Buyer. |
| 2 | `01_catalogos.sql` | Cargar los datos sintéticos originales una sola vez. |
| 3 | `init_mart.sql` | Crear el dimensional, incluido Buyer atómico. |
| 4 | `poblamiento_merge_mart.sql` | Cargar dimensiones necesarias y SOLO el hecho Buyer. |
| 5 | `02_validacion.sql` | Contrastar medidas, eventos y gastos. |
| 6 | `03_indicadores_y_reporte_buyer.sql` | Consultar B1, B2, B3 y la matriz. |
| 7 | `04_pruebas_reglas_buyer.sql` | Probar límites temporales y reparto exacto de céntimos con datos de sesión. |

**No ejecutar `migracion_buyer.sql` si se está creando desde cero.** Tampoco ejecutar los archivos de documentación.

Los otros cuatro hechos se crean, pero este ETL no los puebla. Sus tablas dimensionales vacías no son un fallo de la carga Buyer. El seed sí contiene operaciones transaccionales de esas otras fases.

## Alternativa: conservar una copia existente

Solo para el esquema de Semana 9 que utiliza `fact_captacion_buyer`: ejecutar `migracion_buyer.sql` por bloques y detenerse ante errores; después los pasos 4 a 7. La migración conserva el hecho anterior como `fact_captacion_buyer_legacy_semana9`.

No repetir `init_oltp.sql` ni `01_catalogos.sql` en bases pobladas. No aplicar esta ruta al esquema PascalCase de `main` sin resolver la homologación de nombres.

## Qué se conserva y qué cambia

- Se conservan cinco medidas y tres indicadores, con los umbrales del informe principal.
- `CaptacionesBuyer` es una tabla transaccional de primera captación, no otro hecho ni otra identidad.
- Buyer dimensional guarda una fila por persona/captación, fechas y evento como evidencia.
- Los históricos se marcan `HISTORICO_OBSERVADO`: no prueban el estado original de autorización o calidad.
- No se deduce sede/servicio desde zona o solicitudes posteriores. Los desconocidos pueden alterar la distribución histórica del reporte.
- Las medidas auxiliares persistidas, `OportunidadesCaptacion` y `Fact_GastoCampana` quedan como alternativas posteriores.

## Valores fijos y gastos

`01_catalogos.sql` conserva las instrucciones y datos de prueba originales: nombres, campañas, fechas e importes sintéticos. No representan evidencia de operaciones reales. Los datos fijos de `04_pruebas_reglas_buyer.sql` son casos de prueba aislados.

En el ETL Buyer no se fijan resultados de gastos ni conversiones. Los importes se obtienen de `GastosCampana`, con reparto por campaña/mes y conservación exacta de céntimos. Gastos sin contactos se muestran como no atribuidos. Cuando falta evidencia de gasto, el costo queda `NULL`; no se fabrica cero.

El seed original no carga `GastosCampana`. Por tanto B3 puede quedar `NULL` hasta incorporar gastos reales o un juego sintético claramente identificado. No cambiar importes para forzar un indicador verde.

Son constantes intencionales: 0/1 de conteos, clave 0 de desconocidos, 14 días del indicador, 100 para porcentajes/céntimos, 86400 segundos por día y los umbrales del informe. Las etiquetas de clasificación son reglas explícitas, no resultados medidos.

## Integración posterior del sistema

No ejecutar el `syncBuyer` antiguo sobre el hecho nuevo. El backend deberá registrar `CaptacionesBuyer` junto con la identidad y sus datos declarados, y utilizar `usp_ConvertirBuyerALead` para convertir con transacción y evidencia. El procedimiento no implementa el clasificador IA ni concede autorización.

Las referencias opcionales en `DecisionesIA` preparan el agente futuro, sin llamar a proveedores. Las correcciones de datos históricos deben ser explícitas y trazables: el ETL no las inventa.

## Comprobaciones pendientes en SQL Server

Ejecutar el ETL dos veces y comprobar que no duplica datos; validar eventos y duraciones; probar 14 días exactos y un segundo después, falta de autorización, cronología incorrecta, dimensiones desconocidas y campaña sin contactos. Comprobar que los otros hechos permanecen sin cambios.
