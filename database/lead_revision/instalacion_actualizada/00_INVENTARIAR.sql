:ON ERROR EXIT
-- Fase 1: solo lectura del catalogo. No instala objetos ni consulta datos personales.
-- Ejecutar por separado en la OLTP y el Mart con sqlcmd -y 0 -w 65535.
-- JSON se usa exclusivamente para exportar el inventario; no forma parte del ETL.
SET NOCOUNT ON;
IF DB_NAME() IN ('master','model','msdb','tempdb')
 THROW 55000,'Seleccione explicitamente una base del proyecto.',1;

SELECT @@SERVERNAME servidor, DB_NAME() base,
 CONVERT(varchar(30),SERVERPROPERTY('ProductVersion')) version_sql,
 CONVERT(nvarchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation')) cotejamiento,
 SYSUTCDATETIME() capturado_utc,
 (SELECT SCHEMA_NAME(t.schema_id) esquema,t.name tabla,
    (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id=t.object_id AND p.index_id IN (0,1)) filas_catalogo
  FROM sys.tables t WHERE t.is_ms_shipped=0 ORDER BY esquema,tabla FOR JSON PATH) tablas,
 (SELECT SCHEMA_NAME(t.schema_id) esquema,t.name tabla,c.column_id ordinal,c.name columna,
    TYPE_NAME(c.user_type_id) tipo,c.max_length longitud_bytes,c.precision precision,c.scale escala,
    c.is_nullable admite_null,c.is_identity identidad,c.is_computed calculada,c.collation_name cotejamiento,
    CONVERT(varchar(50),ic.seed_value) semilla_identidad,CONVERT(varchar(50),ic.increment_value) incremento_identidad,
    cc.definition expresion_calculada,dc.definition valor_predeterminado
  FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
  LEFT JOIN sys.identity_columns ic ON ic.object_id=c.object_id AND ic.column_id=c.column_id
  LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id
  LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
  WHERE t.is_ms_shipped=0 ORDER BY esquema,tabla,ordinal FOR JSON PATH) columnas,
 (SELECT SCHEMA_NAME(t.schema_id) esquema,t.name tabla,i.name indice,i.type_desc tipo,
    i.is_unique unico,i.is_primary_key clave_primaria,i.is_unique_constraint restriccion_unica,
    i.filter_definition filtro,i.is_disabled deshabilitado,
    (SELECT COL_NAME(x.object_id,x.column_id) columna,x.key_ordinal orden_clave,
      x.is_descending_key descendente,x.is_included_column incluida
     FROM sys.index_columns x WHERE x.object_id=i.object_id AND x.index_id=i.index_id
     ORDER BY x.index_column_id FOR JSON PATH) columnas
  FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id
  WHERE t.is_ms_shipped=0 AND i.name IS NOT NULL ORDER BY esquema,tabla,indice FOR JSON PATH) indices,
 (SELECT SCHEMA_NAME(t.schema_id) esquema,t.name tabla,f.name relacion,
    OBJECT_SCHEMA_NAME(f.referenced_object_id) esquema_destino,OBJECT_NAME(f.referenced_object_id) tabla_destino,
    f.delete_referential_action_desc al_eliminar,f.update_referential_action_desc al_actualizar,
    f.is_disabled deshabilitada,f.is_not_trusted no_confiable,
    (SELECT COL_NAME(x.parent_object_id,x.parent_column_id) columna,
      COL_NAME(x.referenced_object_id,x.referenced_column_id) columna_destino
     FROM sys.foreign_key_columns x WHERE x.constraint_object_id=f.object_id
     ORDER BY x.constraint_column_id FOR JSON PATH) columnas
  FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id=f.parent_object_id
  ORDER BY esquema,tabla,relacion FOR JSON PATH) relaciones,
 (SELECT OBJECT_SCHEMA_NAME(c.parent_object_id) esquema,OBJECT_NAME(c.parent_object_id) tabla,
    c.name restriccion,c.definition definicion,c.is_disabled deshabilitada,c.is_not_trusted no_confiable
  FROM sys.check_constraints c ORDER BY esquema,tabla,restriccion FOR JSON PATH) comprobaciones,
 (SELECT SCHEMA_NAME(o.schema_id) esquema,o.name objeto,o.type_desc tipo,
    CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),m.definition)),2) sha256,
    m.uses_ansi_nulls,m.uses_quoted_identifier
  FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id
  WHERE o.is_ms_shipped=0 ORDER BY esquema,objeto FOR JSON PATH) modulos,
 (SELECT OBJECT_SCHEMA_NAME(d.referencing_id) esquema,OBJECT_NAME(d.referencing_id) objeto,
    d.referenced_server_name servidor_destino,d.referenced_database_name base_destino,
    d.referenced_schema_name esquema_destino,d.referenced_entity_name objeto_destino,
    d.is_caller_dependent depende_del_llamador,d.is_ambiguous ambigua
  FROM sys.sql_expression_dependencies d WHERE OBJECTPROPERTY(d.referencing_id,'IsMSShipped')=0
  ORDER BY esquema,objeto,base_destino,esquema_destino,objeto_destino FOR JSON PATH) dependencias
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
