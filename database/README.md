# Poblamiento de datos

Los datos de ejemplo representan una clinica odontologica en Trujillo, La Libertad, Peru.

## Orden de ejecucion

1. Aplicar el esquema de `backend/prisma/init.sql` y las migraciones Prisma.
2. Ejecutar `database/seed/01_catalogos.sql` en SQL Server.
3. Ejecutar `database/seed/03_disponibilidades_masivas.sql` para generar espacios de atencion.
4. Ejecutar `py database/generate_synthetic_data.py` para ampliar las fuentes externas.
5. Configurar `SQLSERVER_CONNECTION_STRING` con una cadena ODBC para SQL Server.
6. Instalar la dependencia: `py -m pip install -r database/requirements.txt`.
7. Ejecutar desde la raiz: `py database/import_external_data.py`.
8. Ejecutar `database/seed/02_validacion.sql` y comprobar que las consultas de validacion no devuelvan filas.

El generador conserva los registros existentes y agrega 1,000 interacciones, 600 pagos y 300 gastos sinteticos. El importador es transaccional y puede ejecutarse varias veces: usa el contacto y mensaje para evitar interacciones repetidas, fecha/campana/importe para gastos y referencias de pago antes de insertar. Los datos sinteticos no representan pacientes reales.
