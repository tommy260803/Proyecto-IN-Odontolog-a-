-- CARGA ATOMICA: BUYER publicado + dimensiones y cinco hechos LEAD.
-- Ejecutar despues de 01,02,03 y del poblamiento OLTP que se quiera analizar.
-- Reejecutable. No ejecuta ETL legado de LEAD/PAYER/CUSTOMER/TURNED.
-- IMPORTANTE: la rutina BUYER publicada puede completar CaptacionesBuyer HISTORICO_OBSERVADO.
-- LEAD solo lee OLTP. No se fabrican acuerdos ni rechazos para poblar el Mart.
-- sqlcmd -S "SU_INSTANCIA" -E -C -I -b -t 120 -f 65001 -d master -v Origen=NexoSaludDB Mart=NexoSalud_Mart -i database/lead_revision/instalacion_actualizada/04_POBLAR_MART_ACTUALIZADO.sql
-- Par de bases NUEVAS del paquete. Los nombres se sustituyen mediante SQLCMD, no SQL dinamico.
:ON ERROR EXIT
USE [master];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_ID(N'$(Origen)') IS NULL OR DB_ID(N'$(Mart)') IS NULL OR N'$(Origen)'=N'$(Mart)'
 OR N'$(Origen)' NOT LIKE N'NexoSalud%' OR N'$(Mart)' NOT LIKE N'NexoSalud[_]Mart%'
 OR N'$(Origen)' COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9_]%'
 OR N'$(Mart)' COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9_]%'
 THROW 55200,'Par de bases inexistente o nombre de destino no permitido.',1;
IF NOT EXISTS (SELECT 1 FROM [$(Origen)].sys.extended_properties WHERE class=0 AND name=N'NexoSaludPaquete'
 AND CONVERT(nvarchar(100),value)=N'LEAD-OLTP-2026-11')
 OR NOT EXISTS (SELECT 1 FROM [$(Mart)].sys.extended_properties WHERE class=0 AND name=N'NexoSaludPaquete'
 AND CONVERT(nvarchar(100),value)=N'LEAD-MART-2026-11-BUYER-REVISADO')
 THROW 55201,'El par no pertenece al nuevo paquete validado; no cargar bases principales anteriores.',1;
IF COL_LENGTH(N'[$(Mart)].dbo.fact_captacion_buyer','id_persona') IS NULL
 OR COL_LENGTH(N'[$(Mart)].dbo.fact_inversion_campana_buyer','id_gasto') IS NULL
 THROW 55202,'Falta la estructura BUYER publicada.',1;
GO
USE [$(Mart)];
GO
IF OBJECT_ID(N'[$(Origen)].dbo.usp_SincronizarCaptacionBuyer','P') IS NULL
 OR OBJECT_ID(N'dbo.usp_SincronizarInversionCampanaBuyer','P') IS NULL
 THROW 55207,'Ejecute 03_INSTALAR_ETL_BUYER.sql primero.',1;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
DECLARE @nivelCarga int=@@TRANCOUNT;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lockCarga int;
 EXEC @lockCarga=[$(Origen)].sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
  @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
 IF @lockCarga<0 THROW 55208,'Otra carga esta en curso; no se modificaron hechos.',1;
 -- 1. BUYER conserva sus medidas, grain y reglas de su entrega publicada.
 EXEC [$(Origen)].dbo.usp_SincronizarCaptacionBuyer;
 EXEC dbo.usp_SincronizarInversionCampanaBuyer;
 -- 2. DIMENSIONES LEAD: fuentes y MERGE aprobados, sin alterar sus jerarquias.
-- Datos fuente de uso común para carga y conciliación. No escribe en la OLTP.
IF OBJECT_ID(N'[$(Origen)].dbo.HistorialOpcionesLead','U') IS NULL
 OR OBJECT_ID(N'[$(Origen)].dbo.v_OrigenMedidasOportunidadLead','V') IS NULL
 THROW 54714,'La fuente no tiene la revisión OLTP de LEAD.',1;

SELECT id_fecha INTO #Fechas FROM (
 SELECT CAST(fecha_solicitud AS date) AS id_fecha FROM [$(Origen)].dbo.v_OrigenMedidasOportunidadLead
 UNION SELECT CAST(fecha_ingreso_lead AS date) FROM [$(Origen)].dbo.HistorialSolicitudesLead
 UNION SELECT CAST(fecha_decision_comercial_lead AS date) FROM [$(Origen)].dbo.HistorialSolicitudesLead
 UNION SELECT CAST(fecha_presentacion AS date) FROM [$(Origen)].dbo.HistorialPropuestasLead
 UNION SELECT CAST(fecha_decision AS date) FROM [$(Origen)].dbo.HistorialPropuestasLead
 UNION SELECT CAST(fecha_ofrecida AS date) FROM [$(Origen)].dbo.HistorialOpcionesLead
 UNION SELECT CAST(fecha_respuesta AS date) FROM [$(Origen)].dbo.HistorialOpcionesLead
 UNION SELECT fecha_disponibilidad FROM [$(Origen)].dbo.HistorialOpcionesLead
 UNION SELECT pref_fecha_lead FROM [$(Origen)].dbo.HistorialOpcionesLead
) fechas WHERE id_fecha IS NOT NULL;
CREATE UNIQUE CLUSTERED INDEX IX_Fechas ON #Fechas(id_fecha);

SELECT id_promocion,nombre,tipo_promocion,id_servicio,activo
INTO #Promocion FROM [$(Origen)].dbo.PromocionesLead;
SELECT DISTINCT CONVERT(nvarchar(150),TRIM(promocion_aplicada)) COLLATE Latin1_General_100_BIN2 AS Texto
INTO #PromocionTexto
FROM (
 SELECT id_promocion_lead,promocion_aplicada FROM [$(Origen)].dbo.PropuestasEconomicasLead
 UNION ALL
 SELECT id_promocion_lead,promocion_aplicada FROM [$(Origen)].dbo.HistorialPropuestasLead
) p WHERE id_promocion_lead IS NULL AND NULLIF(TRIM(promocion_aplicada),'') IS NOT NULL;

SELECT id_motivo_rechazo,codigo,ambito,categoria,motivo,activo
INTO #Motivo FROM [$(Origen)].dbo.MotivosRechazoLead;

SELECT DISTINCT NumeroDiaSemana,Turno,HoraInicio,HoraFin INTO #Horario
FROM (
 SELECT CONVERT(tinyint,COALESCE(pref_dia_semana_lead,
   ((DATEDIFF(day,CONVERT(date,'19000101',112),pref_fecha_lead)%7+7)%7)+1)) AS NumeroDiaSemana,
  CONVERT(nvarchar(30),NULLIF(TRIM(pref_turno_lead),'')) COLLATE DATABASE_DEFAULT AS Turno,
  pref_hora_inicio_lead AS HoraInicio,pref_hora_fin_lead AS HoraFin
 FROM [$(Origen)].dbo.HistorialOpcionesLead
 WHERE accion<>'DELETE'
 UNION ALL
 SELECT CONVERT(tinyint,((DATEDIFF(day,CONVERT(date,'19000101',112),fecha_disponibilidad)%7+7)%7)+1),
  CONVERT(nvarchar(30),NULLIF(TRIM(ofr_turno_lead),'')) COLLATE DATABASE_DEFAULT,hora_inicio,hora_fin
 FROM [$(Origen)].dbo.HistorialOpcionesLead WHERE accion<>'DELETE'
 UNION ALL
 SELECT dia_semana,CAST(NULL AS nvarchar(30)) COLLATE DATABASE_DEFAULT,hora_inicio,hora_fin
 FROM [$(Origen)].dbo.Horarios
) h
WHERE NumeroDiaSemana IS NOT NULL OR Turno IS NOT NULL OR HoraInicio IS NOT NULL OR HoraFin IS NOT NULL;

IF EXISTS (SELECT 1 FROM #Horario WHERE NumeroDiaSemana NOT BETWEEN 1 AND 7
 OR (HoraInicio IS NULL AND HoraFin IS NOT NULL)
 OR (HoraInicio IS NOT NULL AND HoraFin IS NULL) OR HoraInicio>=HoraFin)
 THROW 54715,'La fuente contiene un día o intervalo no válido; reconciliar el origen.',1;

 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo=0)
  INSERT dbo.Dim_Tiempo(KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia) VALUES(0,'19000101',1900,1,1,1);

 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Servicio WHERE KeyServicio=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Servicio ON;
  INSERT dbo.Dim_Servicio(KeyServicio,id_servicio,ServicioOdontologico,Categoria,Procedimiento)
   VALUES(0,0,'No especificado','No especificada','No especificado');
  SET IDENTITY_INSERT dbo.Dim_Servicio OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Canal WHERE KeyCanal=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Canal ON;
  INSERT dbo.Dim_Canal(KeyCanal,id_canal,NombreCanal,TipoMedio) VALUES(0,0,'No especificado','No especificado');
  SET IDENTITY_INSERT dbo.Dim_Canal OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Sede WHERE KeySede=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Sede ON;
  INSERT dbo.Dim_Sede(KeySede,id_sede,Sede,Distrito,Zona) VALUES(0,0,'No especificada','No especificado','No especificada');
  SET IDENTITY_INSERT dbo.Dim_Sede OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Negociador WHERE KeyNegociador=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Negociador ON;
  INSERT dbo.Dim_Negociador(KeyNegociador,id_usuario,NombreNegociador) VALUES(0,0,'No especificado');
  SET IDENTITY_INSERT dbo.Dim_Negociador OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Profesional WHERE KeyProfesional=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Profesional ON;
  INSERT dbo.Dim_Profesional(KeyProfesional,id_profesional,Odontologo,EspecialidadPrincipal)
   VALUES(0,0,'No especificado',NULL);
  SET IDENTITY_INSERT dbo.Dim_Profesional OFF;
 END;

 -- Se preserva cualquier clave sustituta ya asignada a la fecha.
 MERGE dbo.Dim_Tiempo WITH (HOLDLOCK) AS d USING #Fechas AS s ON d.id_fecha=s.id_fecha
 WHEN NOT MATCHED THEN INSERT(KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
 VALUES (CONVERT(int,CONVERT(char(8),s.id_fecha,112)),s.id_fecha,YEAR(s.id_fecha),
  DATEPART(quarter,s.id_fecha),MONTH(s.id_fecha),DAY(s.id_fecha));

 MERGE dbo.Dim_Servicio WITH (HOLDLOCK) AS d USING [$(Origen)].dbo.Servicios AS s ON d.id_servicio=s.id_servicio
 WHEN MATCHED AND EXISTS(SELECT s.nombre EXCEPT SELECT d.ServicioOdontologico)
  THEN UPDATE SET ServicioOdontologico=s.nombre
 WHEN NOT MATCHED THEN INSERT(id_servicio,ServicioOdontologico,Categoria,Procedimiento)
 VALUES(s.id_servicio,s.nombre,NULL,LEFT(NULLIF(TRIM(s.descripcion),''),100));

 MERGE dbo.Dim_Canal WITH (HOLDLOCK) AS d USING [$(Origen)].dbo.Canales AS s ON d.id_canal=s.id_canal
 WHEN MATCHED AND EXISTS(SELECT s.nombre EXCEPT SELECT d.NombreCanal) THEN UPDATE SET NombreCanal=s.nombre
 WHEN NOT MATCHED THEN INSERT(id_canal,NombreCanal,TipoMedio) VALUES(s.id_canal,s.nombre,NULL);

 MERGE dbo.Dim_Sede WITH (HOLDLOCK) AS d
 USING (SELECT id_sede,nombre,NULLIF(TRIM(zona),'') AS zona FROM [$(Origen)].dbo.Sedes) AS s ON d.id_sede=s.id_sede
 WHEN MATCHED AND EXISTS(SELECT s.nombre,s.zona EXCEPT SELECT d.Sede,d.Zona) THEN UPDATE SET Sede=s.nombre,Zona=s.zona
 WHEN NOT MATCHED THEN INSERT(id_sede,Sede,Distrito,Zona) VALUES(s.id_sede,s.nombre,NULL,s.zona);

 MERGE dbo.Dim_Negociador WITH (HOLDLOCK) AS d
 USING (SELECT id_usuario,LEFT(TRIM(CONCAT(TRIM(nombres),' ',TRIM(apellidos))),100) AS nombre
 FROM [$(Origen)].dbo.Usuarios) AS s ON d.id_usuario=s.id_usuario
 WHEN MATCHED AND EXISTS(SELECT s.nombre EXCEPT SELECT d.NombreNegociador) THEN UPDATE SET NombreNegociador=s.nombre
 WHEN NOT MATCHED THEN INSERT(id_usuario,NombreNegociador) VALUES(s.id_usuario,s.nombre);

 MERGE dbo.Dim_Profesional WITH (HOLDLOCK) AS d
 USING (SELECT id_profesional,LEFT(TRIM(CONCAT(TRIM(nombres),' ',TRIM(apellidos))),100) AS nombre,
  NULLIF(TRIM(especialidad),'') AS especialidad FROM [$(Origen)].dbo.Profesionales) AS s ON d.id_profesional=s.id_profesional
 WHEN MATCHED AND EXISTS(SELECT s.nombre,s.especialidad EXCEPT SELECT d.Odontologo,d.EspecialidadPrincipal)
  THEN UPDATE SET Odontologo=s.nombre,EspecialidadPrincipal=s.especialidad
 WHEN NOT MATCHED THEN INSERT(id_profesional,Odontologo,EspecialidadPrincipal) VALUES(s.id_profesional,s.nombre,s.especialidad);

 SET IDENTITY_INSERT dbo.Dim_Promocion ON;
 INSERT dbo.Dim_Promocion(KeyPromocion,Origen,PromocionAplicada)
 SELECT v.Id,v.Origen,v.Nombre FROM (VALUES (0,'DESCONOCIDO',N'Desconocida'),
  (-1,'SIN_PROMOCION',N'Sin promoción'),(-2,'NO_ESPECIFICADO',N'No especificada'),(-3,'NO_APLICA',N'No aplica')) v(Id,Origen,Nombre)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_Promocion d WHERE d.KeyPromocion=v.Id);
 SET IDENTITY_INSERT dbo.Dim_Promocion OFF;

 MERGE dbo.Dim_Promocion WITH (HOLDLOCK) AS d USING #Promocion AS s ON d.id_promocion=s.id_promocion
 WHEN MATCHED AND EXISTS(SELECT CONVERT(nvarchar(150),s.nombre) COLLATE Latin1_General_100_BIN2,s.tipo_promocion,s.id_servicio,s.activo
  EXCEPT SELECT d.PromocionAplicada,d.TipoPromocion,d.id_servicio,d.Activo)
  THEN UPDATE SET PromocionAplicada=s.nombre,TipoPromocion=s.tipo_promocion,id_servicio=s.id_servicio,Activo=s.activo
 WHEN NOT MATCHED THEN INSERT(id_promocion,Origen,PromocionAplicada,TipoPromocion,id_servicio,Activo)
  VALUES(s.id_promocion,'CATALOGO',s.nombre,s.tipo_promocion,s.id_servicio,s.activo);

 MERGE dbo.Dim_Promocion WITH (HOLDLOCK) AS d USING #PromocionTexto AS s
 ON d.Origen='TEXTO' AND d.PromocionAplicada=s.Texto
 WHEN NOT MATCHED THEN INSERT(Origen,PromocionAplicada) VALUES('TEXTO',s.Texto);

 SET IDENTITY_INSERT dbo.Dim_MotivoRechazo ON;
 INSERT dbo.Dim_MotivoRechazo(KeyMotivoRechazo,MotivoRechazo)
 SELECT v.Id,v.Nombre FROM (VALUES (0,N'Desconocido'),(-2,N'No especificado'),(-3,N'No aplica')) v(Id,Nombre)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_MotivoRechazo d WHERE d.KeyMotivoRechazo=v.Id);
 SET IDENTITY_INSERT dbo.Dim_MotivoRechazo OFF;
 MERGE dbo.Dim_MotivoRechazo WITH (HOLDLOCK) AS d USING #Motivo AS s ON d.id_motivo_rechazo=s.id_motivo_rechazo
 WHEN MATCHED AND EXISTS(SELECT s.codigo,s.ambito,s.categoria,s.motivo,s.activo
  EXCEPT SELECT d.Codigo,d.Ambito,d.TipoMotivoRechazo,d.MotivoRechazo,d.Activo)
  THEN UPDATE SET Codigo=s.codigo,Ambito=s.ambito,TipoMotivoRechazo=s.categoria,MotivoRechazo=s.motivo,Activo=s.activo
 WHEN NOT MATCHED THEN INSERT(id_motivo_rechazo,Codigo,Ambito,TipoMotivoRechazo,MotivoRechazo,Activo)
  VALUES(s.id_motivo_rechazo,s.codigo,s.ambito,s.categoria,s.motivo,s.activo);

 SET IDENTITY_INSERT dbo.Dim_Horario ON;
 INSERT dbo.Dim_Horario(KeyHorario,TipoMiembro)
 SELECT v.Id,v.Tipo FROM (VALUES (0,'DESCONOCIDO'),(-2,'NO_ESPECIFICADO'),(-3,'NO_APLICA')) v(Id,Tipo)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_Horario d WHERE d.KeyHorario=v.Id);
 SET IDENTITY_INSERT dbo.Dim_Horario OFF;
 MERGE dbo.Dim_Horario WITH (HOLDLOCK) AS d USING #Horario AS s ON d.TipoMiembro='OBSERVADO'
  AND EXISTS(SELECT s.NumeroDiaSemana,s.Turno,s.HoraInicio,s.HoraFin INTERSECT
             SELECT d.NumeroDiaSemana,d.Turno,d.HoraInicio,d.HoraFin)
 WHEN NOT MATCHED THEN INSERT(TipoMiembro,NumeroDiaSemana,Turno,HoraInicio,HoraFin)
  VALUES('OBSERVADO',s.NumeroDiaSemana,s.Turno,s.HoraInicio,s.HoraFin);


 DROP TABLE #Fechas,#Promocion,#PromocionTexto,#Motivo,#Horario;
 -- 3. HECHOS LEAD: identidad transaccional primero; agregacion dimensional despues.
 DECLARE @corte datetime2(7)=SYSUTCDATETIME();
-- El corte y las identidades son los mismos de R1, R2 y R3.
SELECT * INTO #Solicitudes FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte);
SELECT * INTO #Raices FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corte);
SELECT * INTO #Opciones FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corte);

IF EXISTS (SELECT id_solicitud FROM #Solicitudes GROUP BY id_solicitud HAVING COUNT(*)>1)
 OR EXISTS (SELECT id_propuesta_logica FROM #Raices GROUP BY id_propuesta_logica HAVING COUNT(*)>1)
 OR EXISTS (SELECT id_opcion FROM #Opciones GROUP BY id_opcion HAVING COUNT(*)>1)
 THROW 54903,'El origen duplicó una identidad de negocio.',1;
IF EXISTS (SELECT 1 FROM #Solicitudes WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo>1)
 OR EXISTS (SELECT 1 FROM #Raices WHERE propuesta_aceptada+propuesta_rechazada>1
            OR propuesta_rechazada_economica>propuesta_rechazada)
 OR EXISTS (SELECT 1 FROM #Opciones WHERE alternativa_aceptada+alternativa_rechazada>1
            OR alternativa_rechazada_incompatibilidad>alternativa_rechazada)
 THROW 54904,'El origen contiene medidas incompatibles.',1;
IF EXISTS (
 SELECT 1 FROM #Opciones o LEFT JOIN #Solicitudes s ON s.id_solicitud=o.id_solicitud
 WHERE o.alternativa_aceptada+o.alternativa_rechazada=1 AND s.id_solicitud IS NULL)
 THROW 54905,'Una opción resuelta no tiene oportunidad LEAD al corte. Revisar su servicio y evidencia.',1;

-- Un identificador de origen nulo busca el miembro de control por su ID
-- natural. Nunca se sustituye una clave de origen explícita sin correspondencia.
SELECT t.KeyTiempo,v.KeyServicio,c.KeyCanal,z.KeySede,n.KeyNegociador,
 s.oportunidad_aceptada,s.oportunidad_cerrada_sin_acuerdo
INTO #Oportunidad
FROM #Solicitudes s
LEFT JOIN dbo.Dim_Tiempo t ON t.id_fecha=CONVERT(date,s.fecha_solicitud)
LEFT JOIN dbo.Dim_Servicio v ON v.id_servicio=ISNULL(s.id_servicio,0)
LEFT JOIN dbo.Dim_Canal c ON c.id_canal=ISNULL(s.id_canal_origen,0)
LEFT JOIN dbo.Dim_Sede z ON z.id_sede=ISNULL(s.id_sede_interes_lead,0)
LEFT JOIN dbo.Dim_Negociador n ON n.id_usuario=ISNULL(s.id_negociador,0)
WHERE s.oportunidad_aceptada+s.oportunidad_cerrada_sin_acuerdo=1;

SELECT t.KeyTiempo,v.KeyServicio,p.KeyPromocion,m.KeyMotivoRechazo,
 r.propuesta_aceptada,r.propuesta_rechazada,r.propuesta_rechazada_economica
INTO #Propuesta
FROM #Raices r
LEFT JOIN dbo.Dim_Tiempo t ON t.id_fecha=CONVERT(date,r.fecha_presentacion)
LEFT JOIN dbo.Dim_Servicio v ON v.id_servicio=ISNULL(r.id_servicio,0)
LEFT JOIN dbo.Dim_Promocion p ON p.id_promocion=r.id_promocion_lead
 OR (r.id_promocion_lead IS NULL AND p.Origen='TEXTO'
     AND p.PromocionAplicada=CONVERT(nvarchar(150),TRIM(r.promocion_aplicada)) COLLATE Latin1_General_100_BIN2)
 -- La OLTP no distingue una negativa explícita de un campo sin informar.
 OR (r.id_promocion_lead IS NULL AND NULLIF(TRIM(r.promocion_aplicada),'') IS NULL
     AND p.Origen='NO_ESPECIFICADO')
LEFT JOIN dbo.Dim_MotivoRechazo m ON r.propuesta_rechazada=1
 AND ((m.id_motivo_rechazo=r.id_motivo_rechazo_lead AND m.Ambito='PROPUESTA')
 OR (r.id_motivo_rechazo_lead IS NULL AND m.id_motivo_rechazo IS NULL AND m.MotivoRechazo=N'No especificado'))
WHERE r.propuesta_aceptada+r.propuesta_rechazada=1;

-- Se reproduce la clave natural de Horario, incluso si faltan día o turno.
SELECT o.*,s.id_servicio,
 COALESCE(o.pref_dia_semana_lead,((DATEDIFF(day,CONVERT(date,'19000101',112),o.pref_fecha_lead)%7+7)%7)+1) AS DiaPreferido,
 ((DATEDIFF(day,CONVERT(date,'19000101',112),o.fecha_disponibilidad)%7+7)%7)+1 AS DiaOfrecido,
 NULLIF(TRIM(o.pref_turno_lead),'') AS TurnoPreferido,
 NULLIF(TRIM(o.ofr_turno_lead),'') AS TurnoOfrecido
INTO #HorarioOpcion
FROM #Opciones o
JOIN #Solicitudes s ON s.id_solicitud=o.id_solicitud
WHERE o.alternativa_aceptada+o.alternativa_rechazada=1;

SELECT t.KeyTiempo,v.KeyServicio,z.KeySede,d.KeyProfesional,
 hp.KeyHorario AS KeyHorarioPreferido,ho.KeyHorario AS KeyHorarioOfrecido,m.KeyMotivoRechazo,
 o.alternativa_aceptada,o.alternativa_rechazada,o.alternativa_rechazada_incompatibilidad
INTO #Alternativa
FROM #HorarioOpcion o
LEFT JOIN dbo.Dim_Tiempo t ON t.id_fecha=CONVERT(date,o.fecha_ofrecida)
LEFT JOIN dbo.Dim_Servicio v ON v.id_servicio=ISNULL(o.id_servicio,0)
LEFT JOIN dbo.Dim_Sede z ON z.id_sede=ISNULL(o.id_sede,0)
LEFT JOIN dbo.Dim_Profesional d ON d.id_profesional=ISNULL(o.id_profesional,0)
LEFT JOIN dbo.Dim_Horario hp ON
 (hp.TipoMiembro='OBSERVADO'
  AND (hp.NumeroDiaSemana=o.DiaPreferido OR (hp.NumeroDiaSemana IS NULL AND o.DiaPreferido IS NULL))
  AND (hp.Turno=o.TurnoPreferido OR (hp.Turno IS NULL AND o.TurnoPreferido IS NULL))
  AND ((hp.HoraInicio=o.pref_hora_inicio_lead AND hp.HoraFin=o.pref_hora_fin_lead)
       OR (hp.HoraInicio IS NULL AND o.pref_hora_inicio_lead IS NULL AND o.pref_hora_fin_lead IS NULL)))
 OR (hp.TipoMiembro='NO_ESPECIFICADO' AND o.DiaPreferido IS NULL AND o.TurnoPreferido IS NULL
     AND o.pref_hora_inicio_lead IS NULL AND o.pref_hora_fin_lead IS NULL)
LEFT JOIN dbo.Dim_Horario ho ON
 (ho.TipoMiembro='OBSERVADO'
  AND (ho.NumeroDiaSemana=o.DiaOfrecido OR (ho.NumeroDiaSemana IS NULL AND o.DiaOfrecido IS NULL))
  AND (ho.Turno=o.TurnoOfrecido OR (ho.Turno IS NULL AND o.TurnoOfrecido IS NULL))
  AND ((ho.HoraInicio=o.hora_inicio AND ho.HoraFin=o.hora_fin)
       OR (ho.HoraInicio IS NULL AND o.hora_inicio IS NULL AND o.hora_fin IS NULL)))
 OR (ho.TipoMiembro='NO_ESPECIFICADO' AND o.DiaOfrecido IS NULL AND o.TurnoOfrecido IS NULL
     AND o.hora_inicio IS NULL AND o.hora_fin IS NULL)
LEFT JOIN dbo.Dim_MotivoRechazo m ON o.alternativa_rechazada=1
 AND ((m.id_motivo_rechazo=o.id_motivo_rechazo_lead AND m.Ambito='ALTERNATIVA')
 OR (o.id_motivo_rechazo_lead IS NULL AND m.id_motivo_rechazo IS NULL AND m.MotivoRechazo=N'No especificado'));

IF EXISTS (SELECT 1 FROM #Oportunidad WHERE KeyTiempo IS NULL OR KeyServicio IS NULL
            OR KeyCanal IS NULL OR KeySede IS NULL OR KeyNegociador IS NULL)
 OR EXISTS (SELECT 1 FROM #Propuesta WHERE KeyTiempo IS NULL OR KeyServicio IS NULL OR KeyPromocion IS NULL
            OR (propuesta_rechazada=1 AND KeyMotivoRechazo IS NULL))
 OR EXISTS (SELECT 1 FROM #Alternativa WHERE KeyTiempo IS NULL OR KeyServicio IS NULL OR KeySede IS NULL
            OR KeyProfesional IS NULL OR KeyHorarioPreferido IS NULL OR KeyHorarioOfrecido IS NULL
            OR (alternativa_rechazada=1 AND KeyMotivoRechazo IS NULL))
 THROW 54906,'No se pudo resolver un miembro dimensional. Revisar el origen o actualizar dimensiones en QA.',1;
IF (SELECT COUNT_BIG(*) FROM #Oportunidad)<>(SELECT COUNT_BIG(*) FROM #Solicitudes WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo=1)
 OR (SELECT COUNT_BIG(*) FROM #Propuesta)<>(SELECT COUNT_BIG(*) FROM #Raices WHERE propuesta_aceptada+propuesta_rechazada=1)
 OR (SELECT COUNT_BIG(*) FROM #Alternativa)<>(SELECT COUNT_BIG(*) FROM #Opciones WHERE alternativa_aceptada+alternativa_rechazada=1)
 THROW 54907,'Una unión dimensional multiplicó o perdió filas de negocio.',1;

-- F1. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeyCanal, KeySede, KeyNegociador,
       SUM(CONVERT(bigint,oportunidad_aceptada)) AS oportunidad_aceptada,
       SUM(CONVERT(bigint,oportunidad_cerrada_sin_acuerdo)) AS oportunidad_cerrada_sin_acuerdo
INTO #F1
FROM #Oportunidad
WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo=1
GROUP BY KeyTiempo, KeyServicio, KeyCanal, KeySede, KeyNegociador;

MERGE dbo.fact_oportunidades_lead WITH (HOLDLOCK) AS d
USING #F1 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeyCanal=s.KeyCanal AND
    d.KeySede=s.KeySede AND
    d.KeyNegociador=s.KeyNegociador
WHEN MATCHED AND (d.oportunidad_aceptada<>s.oportunidad_aceptada OR d.oportunidad_cerrada_sin_acuerdo<>s.oportunidad_cerrada_sin_acuerdo) THEN
 UPDATE SET oportunidad_aceptada=s.oportunidad_aceptada, oportunidad_cerrada_sin_acuerdo=s.oportunidad_cerrada_sin_acuerdo
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeyCanal, KeySede, KeyNegociador, oportunidad_aceptada, oportunidad_cerrada_sin_acuerdo)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeyCanal, s.KeySede, s.KeyNegociador, s.oportunidad_aceptada, s.oportunidad_cerrada_sin_acuerdo)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F2. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeyPromocion,
       COUNT_BIG(*) AS propuesta_aceptada
INTO #F2
FROM #Propuesta
WHERE propuesta_aceptada=1
GROUP BY KeyTiempo, KeyServicio, KeyPromocion;

MERGE dbo.fact_propuestas_aceptadas_lead WITH (HOLDLOCK) AS d
USING #F2 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeyPromocion=s.KeyPromocion
WHEN MATCHED AND (d.propuesta_aceptada<>s.propuesta_aceptada) THEN
 UPDATE SET propuesta_aceptada=s.propuesta_aceptada
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeyPromocion, propuesta_aceptada)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeyPromocion, s.propuesta_aceptada)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F3. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeyPromocion, KeyMotivoRechazo,
       COUNT_BIG(*) AS propuesta_rechazada,
       SUM(CONVERT(bigint,propuesta_rechazada_economica)) AS propuesta_rechazada_economica
INTO #F3
FROM #Propuesta
WHERE propuesta_rechazada=1
GROUP BY KeyTiempo, KeyServicio, KeyPromocion, KeyMotivoRechazo;

MERGE dbo.fact_propuestas_rechazadas_lead WITH (HOLDLOCK) AS d
USING #F3 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeyPromocion=s.KeyPromocion AND
    d.KeyMotivoRechazo=s.KeyMotivoRechazo
WHEN MATCHED AND (d.propuesta_rechazada<>s.propuesta_rechazada OR d.propuesta_rechazada_economica<>s.propuesta_rechazada_economica) THEN
 UPDATE SET propuesta_rechazada=s.propuesta_rechazada, propuesta_rechazada_economica=s.propuesta_rechazada_economica
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeyPromocion, KeyMotivoRechazo, propuesta_rechazada, propuesta_rechazada_economica)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeyPromocion, s.KeyMotivoRechazo, s.propuesta_rechazada, s.propuesta_rechazada_economica)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F4. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido,
       COUNT_BIG(*) AS alternativa_aceptada
INTO #F4
FROM #Alternativa
WHERE alternativa_aceptada=1
GROUP BY KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido;

MERGE dbo.fact_alternativas_aceptadas_lead WITH (HOLDLOCK) AS d
USING #F4 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeySede=s.KeySede AND
    d.KeyProfesional=s.KeyProfesional AND
    d.KeyHorarioPreferido=s.KeyHorarioPreferido AND
    d.KeyHorarioOfrecido=s.KeyHorarioOfrecido
WHEN MATCHED AND (d.alternativa_aceptada<>s.alternativa_aceptada) THEN
 UPDATE SET alternativa_aceptada=s.alternativa_aceptada
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, alternativa_aceptada)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeySede, s.KeyProfesional, s.KeyHorarioPreferido, s.KeyHorarioOfrecido, s.alternativa_aceptada)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F5. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, KeyMotivoRechazo,
       COUNT_BIG(*) AS alternativa_rechazada,
       SUM(CONVERT(bigint,alternativa_rechazada_incompatibilidad)) AS alternativa_rechazada_incompatibilidad
INTO #F5
FROM #Alternativa
WHERE alternativa_rechazada=1
GROUP BY KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, KeyMotivoRechazo;

MERGE dbo.fact_alternativas_rechazadas_lead WITH (HOLDLOCK) AS d
USING #F5 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeySede=s.KeySede AND
    d.KeyProfesional=s.KeyProfesional AND
    d.KeyHorarioPreferido=s.KeyHorarioPreferido AND
    d.KeyHorarioOfrecido=s.KeyHorarioOfrecido AND
    d.KeyMotivoRechazo=s.KeyMotivoRechazo
WHEN MATCHED AND (d.alternativa_rechazada<>s.alternativa_rechazada OR d.alternativa_rechazada_incompatibilidad<>s.alternativa_rechazada_incompatibilidad) THEN
 UPDATE SET alternativa_rechazada=s.alternativa_rechazada, alternativa_rechazada_incompatibilidad=s.alternativa_rechazada_incompatibilidad
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, KeyMotivoRechazo, alternativa_rechazada, alternativa_rechazada_incompatibilidad)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeySede, s.KeyProfesional, s.KeyHorarioPreferido, s.KeyHorarioOfrecido, s.KeyMotivoRechazo, s.alternativa_rechazada, s.alternativa_rechazada_incompatibilidad)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- Además de los totales, comparar cada combinación dimensional persistida.
IF EXISTS (SELECT * FROM #F1 EXCEPT SELECT * FROM dbo.fact_oportunidades_lead)
 OR EXISTS (SELECT * FROM dbo.fact_oportunidades_lead EXCEPT SELECT * FROM #F1)
 THROW 54909,'Los grupos persistidos de F1 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F2 EXCEPT SELECT * FROM dbo.fact_propuestas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_aceptadas_lead EXCEPT SELECT * FROM #F2)
 THROW 54909,'Los grupos persistidos de F2 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F3 EXCEPT SELECT * FROM dbo.fact_propuestas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_rechazadas_lead EXCEPT SELECT * FROM #F3)
 THROW 54909,'Los grupos persistidos de F3 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F4 EXCEPT SELECT * FROM dbo.fact_alternativas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_aceptadas_lead EXCEPT SELECT * FROM #F4)
 THROW 54909,'Los grupos persistidos de F4 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F5 EXCEPT SELECT * FROM dbo.fact_alternativas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_rechazadas_lead EXCEPT SELECT * FROM #F5)
 THROW 54909,'Los grupos persistidos de F5 no coinciden con la carga.',1;


-- 4. CONCILIACION INDEPENDIENTE AL MISMO CORTE.
-- Conteos OLTP independientes del mapeo dimensional y de las banderas del ETL.
-- Las funciones OLTP existentes resuelven las identidades e historiales aprobados.
SELECT COUNT_BIG(CASE WHEN resultado_comercial_lead='ACEPTADA' THEN 1 END) M1,
       COUNT_BIG(CASE WHEN resultado_comercial_lead='CERRADA_SIN_ACUERDO' THEN 1 END) M2
INTO #ControlO
FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte);

SELECT COUNT_BIG(CASE WHEN estado='Aceptada' THEN 1 END) M3,
       COUNT_BIG(CASE WHEN estado='Rechazada' THEN 1 END) M4,
       COUNT_BIG(CASE WHEN estado='Rechazada' AND categoria_motivo='ECONOMICO' THEN 1 END) M5
INTO #ControlP
FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corte);

SELECT COUNT_BIG(CASE WHEN a.estado_respuesta='Aceptada' THEN 1 END) M6,
       COUNT_BIG(CASE WHEN a.estado_respuesta='Rechazada' THEN 1 END) M7,
       COUNT_BIG(CASE WHEN a.estado_respuesta='Rechazada' AND a.categoria_motivo='INCOMPATIBILIDAD' THEN 1 END) M8
INTO #ControlA
FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corte) a
JOIN [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte) s ON s.id_solicitud=a.id_solicitud;

SELECT o.M1,o.M2,p.M3,p.M4,p.M5,a.M6,a.M7,a.M8 INTO #ControlOLTP
FROM #ControlO o CROSS JOIN #ControlP p CROSS JOIN #ControlA a;

-- Sumas Mart. Un hecho sin grupos produce cero.
SELECT
 (SELECT ISNULL(SUM(oportunidad_aceptada),0) FROM dbo.fact_oportunidades_lead) M1,
 (SELECT ISNULL(SUM(oportunidad_cerrada_sin_acuerdo),0) FROM dbo.fact_oportunidades_lead) M2,
 (SELECT ISNULL(SUM(propuesta_aceptada),0) FROM dbo.fact_propuestas_aceptadas_lead) M3,
 (SELECT ISNULL(SUM(propuesta_rechazada),0) FROM dbo.fact_propuestas_rechazadas_lead) M4,
 (SELECT ISNULL(SUM(propuesta_rechazada_economica),0) FROM dbo.fact_propuestas_rechazadas_lead) M5,
 (SELECT ISNULL(SUM(alternativa_aceptada),0) FROM dbo.fact_alternativas_aceptadas_lead) M6,
 (SELECT ISNULL(SUM(alternativa_rechazada),0) FROM dbo.fact_alternativas_rechazadas_lead) M7,
 (SELECT ISNULL(SUM(alternativa_rechazada_incompatibilidad),0) FROM dbo.fact_alternativas_rechazadas_lead) M8
INTO #ControlMart;

SELECT 'OLTP' AS Fuente,* FROM #ControlOLTP
UNION ALL
SELECT 'Mart',* FROM #ControlMart;
IF EXISTS (SELECT * FROM #ControlOLTP EXCEPT SELECT * FROM #ControlMart)
 THROW 54908,'Las sumas de los hechos no coinciden con los conteos OLTP.',1;
DROP TABLE #ControlO,#ControlP,#ControlA,#ControlOLTP,#ControlMart;

 DROP TABLE #F1,#F2,#F3,#F4,#F5,#Solicitudes,#Raices,#Opciones,
  #Oportunidad,#Propuesta,#HorarioOpcion,#Alternativa;
 IF @@TRANCOUNT<>@nivelCarga+1 THROW 55209,'Las cargas cambiaron la transaccion externa.',1;
 COMMIT TRANSACTION;
 SELECT N'$(Origen)' origen,N'$(Mart)' mart,@corte CorteUTC;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
GO
