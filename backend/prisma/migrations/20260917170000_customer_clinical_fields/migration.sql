ALTER TABLE [Atenciones] ADD [fecha_inicio] DATETIME2 NULL;
ALTER TABLE [Atenciones] ADD [fecha_fin] DATETIME2 NULL;
ALTER TABLE [Atenciones] ADD [motivo_consulta] VARCHAR(300) NULL;
ALTER TABLE [Atenciones] ADD [antecedentes] VARCHAR(500) NULL;
ALTER TABLE [Atenciones] ADD [alergias] VARCHAR(300) NULL;
ALTER TABLE [Atenciones] ADD [evaluacion] VARCHAR(500) NULL;
ALTER TABLE [Atenciones] ADD [procedimiento] VARCHAR(500) NULL;

UPDATE [Personas]
SET [apellidos] = RTRIM(LEFT([apellidos], LEN([apellidos]) - CHARINDEX('(', REVERSE([apellidos]))))
WHERE [apellidos] LIKE '% (Buyer)'
   OR [apellidos] LIKE '% (Lead)'
   OR [apellidos] LIKE '% (Payer)'
   OR [apellidos] LIKE '% (Customer)'
   OR [apellidos] LIKE '% (Turned)';
