# Poblamiento de NexoSalud

Hay **dos scripts de poblamiento**:

1. `poblamiento_transaccional.sql`: inserta una cohorte de demostración en la base **existente** `NexoSaludDB`. Agrega 805 personas sintéticas con nombres y apellidos plausibles y sus registros relacionados. No crea tablas ni borra datos anteriores; si la cohorte ya existe, actualiza únicamente sus nombres de marcador. Los correos terminan en `@example.invalid` y los pacientes no tienen teléfono ni consentimiento de contacto. **No ejecutarlo si se requieren indicadores exclusivamente reales:** los registros de demostración aparecerán en las consultas y reportes.
2. `poblamiento_dimensional.sql`: carga las dimensiones y reconcilia los hechos de `NexoSalud_Mart` a partir de **todos** los datos de `NexoSaludDB`, incluidos los sintéticos si se cargaron. Puede actualizar y eliminar agregados antiguos del Data Mart que ya no correspondan al origen.

Para una instalación **nueva**, `init_oltp.sql` e `init_mart.sql` definen las tablas; no son poblamientos. No ejecutar `init_oltp.sql` sobre la base transaccional ya desplegada: crea tablas sin comprobar si existen. El Data Mart debe existir antes de ejecutar su poblamiento. Ambas bases deben estar en la misma instancia de SQL Server porque el script dimensional usa nombres de tres partes (`[NexoSaludDB].dbo...`).

Orden si se desean datos de demostración: verificar el esquema y hacer una copia de respaldo; ejecutar `poblamiento_transaccional.sql` en `NexoSaludDB`; ejecutar `poblamiento_dimensional.sql` en `NexoSalud_Mart`. Si solo se quieren datos reales, omitir el primer script. El segundo no se ha ejecutado ni verificado contra el Data Mart desplegado porque no hay una conexión local configurada para esa base.
