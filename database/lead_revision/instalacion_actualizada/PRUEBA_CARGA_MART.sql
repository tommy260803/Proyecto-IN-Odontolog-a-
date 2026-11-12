-- Ensayo aislado; casos temporales con ROLLBACK. No es el poblamiento de presentacion.
-- Ejecutar desde la raiz tras 03 y una carga vacia04.
:ON ERROR EXIT
USE [$(Mart)];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(Origen)'<>'NexoSalud_InstalacionValidacion' OR DB_NAME()<>'NexoSalud_Mart_InstalacionValidacion'
 THROW 55220,'El ensayo se limita al par aislado de instalacion.',1;
IF EXISTS(SELECT 1 FROM [$(Origen)].dbo.Personas) OR EXISTS(SELECT 1 FROM [$(Origen)].dbo.Servicios)
 OR EXISTS(SELECT 1 FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id
 WHERE t.name LIKE 'fact[_]%' AND p.index_id IN(0,1) AND p.rows>0)
 THROW 55221,'Se requiere el corte vacio, sin datos operativos.',1;
SELECT * INTO #DimBase0 FROM dbo.Dim_Tiempo;
SELECT * INTO #DimBase1 FROM dbo.Dim_Servicio;
SELECT * INTO #DimBase2 FROM dbo.Dim_Canal;
SELECT * INTO #DimBase3 FROM dbo.Dim_Sede;
SELECT * INTO #DimBase4 FROM dbo.Dim_Negociador;
SELECT * INTO #DimBase5 FROM dbo.Dim_Profesional;
SELECT * INTO #DimBase6 FROM dbo.Dim_Promocion;
SELECT * INTO #DimBase7 FROM dbo.Dim_MotivoRechazo;
SELECT * INTO #DimBase8 FROM dbo.Dim_Horario;
BEGIN TRANSACTION;

-- La persona LEAD sin evento no debe contarse como conversion BUYER.
DECLARE @etLead int=(SELECT id_etapa FROM [$(Origen)].dbo.Etapas WHERE nombre='LEAD'),
 @etBuyer int=(SELECT id_etapa FROM [$(Origen)].dbo.Etapas WHERE nombre='BUYER'),
 @canalTest int=(SELECT id_canal FROM [$(Origen)].dbo.Canales WHERE nombre='Formulario Web'),
 @servTest int,@sedeTest int,@profTest int,@fuenteTest int,@campTest int,@sinContactos int,
 @buyerTest int,@captTest int;
INSERT [$(Origen)].dbo.Servicios(nombre,descripcion) VALUES ('Temporal ETL','Caso revertido'); SET @servTest=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Sedes(nombre,direccion,zona) VALUES ('Temporal ETL','Direccion ficticia','Zona ficticia'); SET @sedeTest=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Profesionales(nombres,apellidos) VALUES ('Temporal','ETL'); SET @profTest=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.ProfesionalServicio(id_profesional,id_servicio) VALUES (@profTest,@servTest);
INSERT [$(Origen)].dbo.Disponibilidad(id_profesional,id_sede,fecha,hora_inicio,hora_fin)
 VALUES (@profTest,@sedeTest,DATEADD(day,7,CONVERT(date,SYSDATETIME())),'09:00','10:00');
INSERT [$(Origen)].dbo.Personas(nombres,apellidos,numero,id_etapa_actual) VALUES ('Temporal','LEAD','999000101',@etLead);
INSERT [$(Origen)].dbo.Fuentes(nombre) VALUES ('TEMP-ETL'); SET @fuenteTest=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Campanas(nombre,id_fuente,id_canal) VALUES ('TEMP-CON-CONTACTOS',@fuenteTest,@canalTest); SET @campTest=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Campanas(nombre,id_fuente,id_canal) VALUES ('TEMP-SIN-CONTACTOS',@fuenteTest,@canalTest); SET @sinContactos=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.GastosCampana(id_campana,fecha,importe) VALUES (@campTest,CONVERT(date,SYSDATETIME()),100),(@sinContactos,CONVERT(date,SYSDATETIME()),30);
INSERT [$(Origen)].dbo.Personas(nombres,apellidos,numero,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen,id_campana_origen)
 VALUES ('Temporal','Conversion','999000102',@etBuyer,1,SYSDATETIME(),@canalTest,@campTest); SET @buyerTest=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_fuente,id_campana,id_servicio,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES (@buyerTest,SYSDATETIME(),@canalTest,@fuenteTest,@campTest,@servTest,'Valido',1,SYSDATETIME(),'REGISTRO_DIRECTO'); SET @captTest=SCOPE_IDENTITY();
EXEC [$(Origen)].dbo.usp_ConvertirBuyerALead @id_captacion=@captTest,@id_servicio=@servTest,@motivo=N'Intencion expresa temporal',@id_usuario=NULL;
INSERT [$(Origen)].dbo.Personas(nombres,apellidos,numero,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen,id_campana_origen)
 VALUES ('Temporal','Informativo','999000103',@etBuyer,1,SYSDATETIME(),@canalTest,@campTest); SET @buyerTest=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_fuente,id_campana,id_servicio,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES (@buyerTest,SYSDATETIME(),@canalTest,@fuenteTest,@campTest,@servTest,'Valido',1,SYSDATETIME(),'REGISTRO_DIRECTO'); SET @captTest=SCOPE_IDENTITY();

DECLARE @corteAnterior datetime2(7)=SYSUTCDATETIME();
WAITFOR DELAY '00:00:00.025';
-- Fechas de negocio a ambos lados de medianoche en Lima. Las observaciones
-- se registran ahora en UTC, con independencia de estas fechas de negocio.
DECLARE @inicioDia datetime2=DATEADD(day,-2,CONVERT(date,SYSDATETIME()));
DECLARE @hoy datetime2=DATEADD(minute,1439,@inicioDia);
DECLARE @diaSiguiente datetime2=DATEADD(minute,2,@hoy),@raizFecha datetime2=DATEADD(day,-1,@hoy);
DECLARE @persona int=(SELECT MIN(id_persona) FROM [$(Origen)].dbo.Personas),
 @servicio int=(SELECT MIN(id_servicio) FROM [$(Origen)].dbo.Servicios WHERE activo=1),
 @slot int=(SELECT MIN(id_disponibilidad) FROM [$(Origen)].dbo.Disponibilidad);
DECLARE @s1 int,@s2 int,@s3 int,@acuerdo int,@raiz int,@version int,@promo int,@me int,@mp int,@mi int,@ma int,@opcion int;
INSERT [$(Origen)].dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@hoy,@hoy,'PENDIENTE');
SET @s1=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@hoy,@hoy,'PENDIENTE');
SET @s2=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@hoy,@hoy,'PENDIENTE');
SET @s3=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PromocionesLead(nombre,tipo_promocion,id_servicio)
 VALUES(N'QA hechos catálogo','QA',@servicio);
SET @promo=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-PE','PROPUESTA','ECONOMICO','Caso QA económico');
SET @me=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-PO','PROPUESTA','OTROS','Caso QA otro de propuesta');
SET @mp=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-AI','ALTERNATIVA','INCOMPATIBILIDAD','Caso QA incompatibilidad');
SET @mi=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-AO','ALTERNATIVA','OTROS','Caso QA otro de alternativa');
SET @ma=SCOPE_IDENTITY();

-- Dos raíces aceptadas con la misma combinación deben formar un solo grupo.
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,
 fecha_presentacion,promocion_aplicada,estado,fecha_decision)
 VALUES(@s1,@servicio,100,@hoy,N'QA hechos texto','Aceptada',@hoy);
SET @acuerdo=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,
 fecha_presentacion,promocion_aplicada,estado,fecha_decision)
 VALUES(@s3,@servicio,100,@hoy,N'QA hechos texto','Aceptada',@hoy);
UPDATE [$(Origen)].dbo.Solicitudes
 SET resultado_comercial_lead='ACEPTADA',fecha_decision_comercial_lead=@hoy,
 valor_acordado_lead=100,id_propuesta_aceptada_lead=@acuerdo WHERE id_solicitud=@s1;
UPDATE [$(Origen)].dbo.Solicitudes
 SET resultado_comercial_lead='CERRADA_SIN_ACUERDO',fecha_decision_comercial_lead=@hoy,motivo_cierre_lead='QA'
 WHERE id_solicitud=@s2;

INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
 estado,fecha_decision,id_motivo_rechazo_lead)
 VALUES(@s2,@servicio,200,@raizFecha,'Rechazada',@hoy,@me);
SET @raiz=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
 id_propuesta_raiz,numero_version,id_promocion_lead,estado,fecha_decision,id_motivo_rechazo_lead)
 VALUES(@s2,@servicio,150,@hoy,@raiz,2,@promo,'Rechazada',@hoy,@me);
SET @version=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
 estado,fecha_decision,id_motivo_rechazo_lead)
 VALUES(@s2,@servicio,170,@hoy,'Rechazada',@hoy,@mp);
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion)
 VALUES(@s3,@servicio,175,@hoy);

-- Opción con intervalo preferido sin día y dos cambios en la misma identidad.
INSERT [$(Origen)].dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,
 pref_hora_inicio_lead,pref_hora_fin_lead,ofr_turno_lead)
 VALUES(@s2,@slot,150,@hoy,'Pendiente','09:00','10:00','QA');
SET @opcion=SCOPE_IDENTITY();
UPDATE [$(Origen)].dbo.Opciones SET precio_ofrecido=145 WHERE id_opcion=@opcion;
UPDATE [$(Origen)].dbo.Opciones SET estado_respuesta='Rechazada',fecha_respuesta=@hoy,id_motivo_rechazo_lead=@mi
 WHERE id_opcion=@opcion;
INSERT [$(Origen)].dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,
 fecha_respuesta,id_motivo_rechazo_lead,pref_dia_semana_lead)
 VALUES(@s2,@slot,170,@diaSiguiente,'Rechazada',@diaSiguiente,@ma,3),
       (@s1,@slot,100,@hoy,'Aceptada',@hoy,NULL,NULL);
INSERT [$(Origen)].dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,pref_dia_semana_lead)
 VALUES(@s3,@slot,175,@hoy,'Pendiente',4);
IF CONVERT(date,@hoy)<>DATEADD(day,-1,CONVERT(date,SWITCHOFFSET(@hoy AT TIME ZONE 'SA Pacific Standard Time','+00:00')))
 OR EXISTS (SELECT 1 FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corteAnterior) WHERE id_solicitud IN(@s1,@s2,@s3))
 OR EXISTS (SELECT 1 FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corteAnterior) WHERE id_solicitud IN(@s1,@s2,@s3))
 OR EXISTS (SELECT 1 FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corteAnterior) WHERE id_solicitud IN(@s1,@s2,@s3))
 THROW 54915,'El caso no reprodujo el cambio de día o una observación ingresó antes de su corte UTC.',1;
SELECT @version AS id_version,@opcion AS id_opcion,CONVERT(date,@raizFecha) AS fecha_raiz,
 CONVERT(date,@hoy) AS dia_negocio,CONVERT(date,@diaSiguiente) AS dia_siguiente,
 @promo AS id_promocion INTO #Caso;
GO

-- Agregar en QA los miembros que corresponden al caso sintético.
:r .\database\lead_revision\instalacion_actualizada\04_POBLAR_MART_ACTUALIZADO.sql
:r .\database\lead_revision\instalacion_actualizada\VERIFICAR_CARGA_MART.sql

IF NOT EXISTS (SELECT 1 FROM dbo.fact_oportunidades_lead f JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo
                JOIN dbo.Dim_Canal d ON d.KeyCanal=f.KeyCanal
                JOIN #Caso c ON c.dia_negocio=t.id_fecha
                WHERE f.oportunidad_aceptada=1 AND f.oportunidad_cerrada_sin_acuerdo=1 AND d.id_canal=0)
 OR (SELECT COUNT(*) FROM dbo.fact_oportunidades_lead)<>1
 OR (SELECT COUNT(*) FROM dbo.fact_propuestas_aceptadas_lead)<>1
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_propuestas_aceptadas_lead f JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
                JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo JOIN #Caso c ON c.dia_negocio=t.id_fecha
                WHERE f.propuesta_aceptada=2 AND p.Origen='TEXTO')
 OR (SELECT COUNT(*) FROM dbo.fact_propuestas_rechazadas_lead)<>2
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead f JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo
                JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
                JOIN #Caso c ON c.fecha_raiz=t.id_fecha AND c.id_promocion=p.id_promocion
                WHERE f.propuesta_rechazada=1 AND f.propuesta_rechazada_economica=1)
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead f JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
                WHERE p.Origen='NO_ESPECIFICADO' AND f.propuesta_rechazada=1 AND f.propuesta_rechazada_economica=0)
 OR EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead f JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
            WHERE p.Origen IN('SIN_PROMOCION','DESCONOCIDO'))
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_alternativas_aceptadas_lead f JOIN dbo.Dim_Horario h ON h.KeyHorario=f.KeyHorarioPreferido
                JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo JOIN #Caso c ON c.dia_negocio=t.id_fecha
                WHERE h.TipoMiembro='NO_ESPECIFICADO' AND f.alternativa_aceptada=1)
 OR (SELECT COUNT(*) FROM dbo.fact_alternativas_rechazadas_lead)<>2
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_alternativas_rechazadas_lead f
                JOIN dbo.Dim_Horario hp ON hp.KeyHorario=f.KeyHorarioPreferido
                JOIN dbo.Dim_Horario ho ON ho.KeyHorario=f.KeyHorarioOfrecido
                WHERE f.alternativa_rechazada=1 AND f.alternativa_rechazada_incompatibilidad=1
                 AND hp.NumeroDiaSemana IS NULL AND hp.HoraInicio='09:00' AND hp.HoraFin='10:00'
                 AND ho.NumeroDiaSemana IS NOT NULL AND ho.Turno='QA')
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_alternativas_rechazadas_lead f JOIN dbo.Dim_MotivoRechazo m ON m.KeyMotivoRechazo=f.KeyMotivoRechazo
                JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo JOIN #Caso c ON c.dia_siguiente=t.id_fecha
                WHERE m.TipoMotivoRechazo='OTROS' AND f.alternativa_rechazada=1 AND f.alternativa_rechazada_incompatibilidad=0)
 THROW 54911,'Falló el grano o la asignación dimensional del caso QA.',1;
GO


-- Filas no vacias en hechos heredados para detectar una carga accidental de otras fases.
DECLARE @pt int=(SELECT KeyTiempo FROM dbo.Dim_Tiempo WHERE id_fecha=(SELECT dia_negocio FROM #Caso)),
 @ps int=(SELECT KeyServicio FROM dbo.Dim_Servicio WHERE id_servicio=(SELECT MIN(id_servicio) FROM [$(Origen)].dbo.Servicios)),
 @pz int=(SELECT KeySede FROM dbo.Dim_Sede WHERE id_sede=(SELECT MIN(id_sede) FROM [$(Origen)].dbo.Sedes)),
 @pp int=(SELECT KeyProfesional FROM dbo.Dim_Profesional WHERE id_profesional=(SELECT MIN(id_profesional) FROM [$(Origen)].dbo.Profesionales)),
 @pn int=(SELECT KeyNegociador FROM dbo.Dim_Negociador WHERE id_usuario=0),
 @pc int=(SELECT KeyCanal FROM dbo.Dim_Canal WHERE id_canal=0),@pas int,@cob int,@ate int;
INSERT dbo.Dim_Pasarela(MetodoPago) VALUES ('TEMP-PROTEGIDO'); SET @pas=SCOPE_IDENTITY();
INSERT dbo.Dim_Cobro(EstadoPago) VALUES ('TEMP-PROTEGIDO'); SET @cob=SCOPE_IDENTITY();
INSERT dbo.Dim_EstadoAtencion(EstadoFinal) VALUES ('TEMP-PROTEGIDO'); SET @ate=SCOPE_IDENTITY();
INSERT dbo.fact_negociacion_lead(KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyNegociador,negociacion_finalizada) VALUES (@pt,@pz,@ps,@pp,@pn,23);
INSERT dbo.fact_gestion_payer(KeyTiempo,KeySede,KeyServicio,KeyPasarela,KeyCobro,importe_total_cobro) VALUES (@pt,@pz,@ps,@pas,@cob,42.50);
INSERT dbo.fact_atencion_customer(KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyEstadoAtencion,atencion_realizada) VALUES (@pt,@pz,@ps,@pp,@ate,19);
INSERT dbo.fact_seguimiento_turned(KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyCanal,seguimiento_efectivo) VALUES (@pt,@pz,@ps,@pp,@pc,29);
IF (SELECT COUNT(*) FROM dbo.fact_captacion_buyer)<>3 OR (SELECT SUM(contacto_utilizable) FROM dbo.fact_captacion_buyer)<>2
 OR (SELECT SUM(conversion_lead) FROM dbo.fact_captacion_buyer)<>1 OR (SELECT COUNT(*) FROM dbo.fact_inversion_campana_buyer)<>2
 OR (SELECT SUM(monto_inversion) FROM dbo.fact_inversion_campana_buyer)<>130 OR (SELECT SUM(costo_atribuido_captacion) FROM dbo.fact_captacion_buyer)<>100
 THROW 55222,'No se respetaron conversion, consentimiento, costo o gasto sin contactos de BUYER.',1;
SELECT * INTO #Heredado0 FROM dbo.fact_negociacion_lead;
SELECT * INTO #Heredado1 FROM dbo.fact_gestion_payer;
SELECT * INTO #Heredado2 FROM dbo.fact_atencion_customer;
SELECT * INTO #Heredado3 FROM dbo.fact_seguimiento_turned;
SELECT * INTO #DimCargada0 FROM dbo.Dim_Tiempo;
SELECT * INTO #DimCargada1 FROM dbo.Dim_Servicio;
SELECT * INTO #DimCargada2 FROM dbo.Dim_Canal;
SELECT * INTO #DimCargada3 FROM dbo.Dim_Sede;
SELECT * INTO #DimCargada4 FROM dbo.Dim_Negociador;
SELECT * INTO #DimCargada5 FROM dbo.Dim_Profesional;
SELECT * INTO #DimCargada6 FROM dbo.Dim_Promocion;
SELECT * INTO #DimCargada7 FROM dbo.Dim_MotivoRechazo;
SELECT * INTO #DimCargada8 FROM dbo.Dim_Horario;
SELECT id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos INTO #BuyerAntes FROM dbo.fact_captacion_buyer;

-- La segunda carga debe conservar exactamente los mismos grupos.
SELECT * INTO #Antes1 FROM dbo.fact_oportunidades_lead;
SELECT * INTO #Antes2 FROM dbo.fact_propuestas_aceptadas_lead;
SELECT * INTO #Antes3 FROM dbo.fact_propuestas_rechazadas_lead;
SELECT * INTO #Antes4 FROM dbo.fact_alternativas_aceptadas_lead;
SELECT * INTO #Antes5 FROM dbo.fact_alternativas_rechazadas_lead;
GO
:r .\database\lead_revision\instalacion_actualizada\04_POBLAR_MART_ACTUALIZADO.sql
:r .\database\lead_revision\instalacion_actualizada\VERIFICAR_CARGA_MART.sql

IF EXISTS (SELECT * FROM #Antes1 EXCEPT SELECT * FROM dbo.fact_oportunidades_lead)
 OR EXISTS (SELECT * FROM dbo.fact_oportunidades_lead EXCEPT SELECT * FROM #Antes1)
 THROW 54913,'La reejecución cambió los grupos de F1.',1;
IF EXISTS (SELECT * FROM #Antes2 EXCEPT SELECT * FROM dbo.fact_propuestas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_aceptadas_lead EXCEPT SELECT * FROM #Antes2)
 THROW 54913,'La reejecución cambió los grupos de F2.',1;
IF EXISTS (SELECT * FROM #Antes3 EXCEPT SELECT * FROM dbo.fact_propuestas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_rechazadas_lead EXCEPT SELECT * FROM #Antes3)
 THROW 54913,'La reejecución cambió los grupos de F3.',1;
IF EXISTS (SELECT * FROM #Antes4 EXCEPT SELECT * FROM dbo.fact_alternativas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_aceptadas_lead EXCEPT SELECT * FROM #Antes4)
 THROW 54913,'La reejecución cambió los grupos de F4.',1;
IF EXISTS (SELECT * FROM #Antes5 EXCEPT SELECT * FROM dbo.fact_alternativas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_rechazadas_lead EXCEPT SELECT * FROM #Antes5)
 THROW 54913,'La reejecución cambió los grupos de F5.',1;


-- Reejecucion: preservar datos de hechos heredados y claves dimensionales.
IF EXISTS(SELECT * FROM #Heredado0 EXCEPT SELECT * FROM dbo.fact_negociacion_lead) OR EXISTS(SELECT * FROM dbo.fact_negociacion_lead EXCEPT SELECT * FROM #Heredado0) THROW 55223,'Se altero fact_negociacion_lead.',1;
IF EXISTS(SELECT * FROM #Heredado1 EXCEPT SELECT * FROM dbo.fact_gestion_payer) OR EXISTS(SELECT * FROM dbo.fact_gestion_payer EXCEPT SELECT * FROM #Heredado1) THROW 55223,'Se altero fact_gestion_payer.',1;
IF EXISTS(SELECT * FROM #Heredado2 EXCEPT SELECT * FROM dbo.fact_atencion_customer) OR EXISTS(SELECT * FROM dbo.fact_atencion_customer EXCEPT SELECT * FROM #Heredado2) THROW 55223,'Se altero fact_atencion_customer.',1;
IF EXISTS(SELECT * FROM #Heredado3 EXCEPT SELECT * FROM dbo.fact_seguimiento_turned) OR EXISTS(SELECT * FROM dbo.fact_seguimiento_turned EXCEPT SELECT * FROM #Heredado3) THROW 55223,'Se altero fact_seguimiento_turned.',1;
IF EXISTS(SELECT * FROM #DimCargada0 EXCEPT SELECT * FROM dbo.Dim_Tiempo) OR EXISTS(SELECT * FROM dbo.Dim_Tiempo EXCEPT SELECT * FROM #DimCargada0) THROW 55224,'Se alteraron claves o atributos de Dim_Tiempo.',1;
IF EXISTS(SELECT * FROM #DimCargada1 EXCEPT SELECT * FROM dbo.Dim_Servicio) OR EXISTS(SELECT * FROM dbo.Dim_Servicio EXCEPT SELECT * FROM #DimCargada1) THROW 55224,'Se alteraron claves o atributos de Dim_Servicio.',1;
IF EXISTS(SELECT * FROM #DimCargada2 EXCEPT SELECT * FROM dbo.Dim_Canal) OR EXISTS(SELECT * FROM dbo.Dim_Canal EXCEPT SELECT * FROM #DimCargada2) THROW 55224,'Se alteraron claves o atributos de Dim_Canal.',1;
IF EXISTS(SELECT * FROM #DimCargada3 EXCEPT SELECT * FROM dbo.Dim_Sede) OR EXISTS(SELECT * FROM dbo.Dim_Sede EXCEPT SELECT * FROM #DimCargada3) THROW 55224,'Se alteraron claves o atributos de Dim_Sede.',1;
IF EXISTS(SELECT * FROM #DimCargada4 EXCEPT SELECT * FROM dbo.Dim_Negociador) OR EXISTS(SELECT * FROM dbo.Dim_Negociador EXCEPT SELECT * FROM #DimCargada4) THROW 55224,'Se alteraron claves o atributos de Dim_Negociador.',1;
IF EXISTS(SELECT * FROM #DimCargada5 EXCEPT SELECT * FROM dbo.Dim_Profesional) OR EXISTS(SELECT * FROM dbo.Dim_Profesional EXCEPT SELECT * FROM #DimCargada5) THROW 55224,'Se alteraron claves o atributos de Dim_Profesional.',1;
IF EXISTS(SELECT * FROM #DimCargada6 EXCEPT SELECT * FROM dbo.Dim_Promocion) OR EXISTS(SELECT * FROM dbo.Dim_Promocion EXCEPT SELECT * FROM #DimCargada6) THROW 55224,'Se alteraron claves o atributos de Dim_Promocion.',1;
IF EXISTS(SELECT * FROM #DimCargada7 EXCEPT SELECT * FROM dbo.Dim_MotivoRechazo) OR EXISTS(SELECT * FROM dbo.Dim_MotivoRechazo EXCEPT SELECT * FROM #DimCargada7) THROW 55224,'Se alteraron claves o atributos de Dim_MotivoRechazo.',1;
IF EXISTS(SELECT * FROM #DimCargada8 EXCEPT SELECT * FROM dbo.Dim_Horario) OR EXISTS(SELECT * FROM dbo.Dim_Horario EXCEPT SELECT * FROM #DimCargada8) THROW 55224,'Se alteraron claves o atributos de Dim_Horario.',1;
IF EXISTS(SELECT * FROM #BuyerAntes EXCEPT SELECT id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos FROM dbo.fact_captacion_buyer) OR EXISTS(SELECT id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos FROM dbo.fact_captacion_buyer EXCEPT SELECT * FROM #BuyerAntes) THROW 55225,'Se alteraron medidas BUYER al repetir la carga.',1;

-- Reclasificar las mismas operaciones. El grupo anterior debe desaparecer.
UPDATE p SET estado='Aceptada',id_motivo_rechazo_lead=NULL
 FROM [$(Origen)].dbo.PropuestasEconomicasLead p JOIN #Caso c ON c.id_version=p.id_propuesta;
UPDATE o SET estado_respuesta='Aceptada',id_motivo_rechazo_lead=NULL
 FROM [$(Origen)].dbo.Opciones o JOIN #Caso c ON c.id_opcion=o.id_opcion;
GO
:r .\database\lead_revision\instalacion_actualizada\04_POBLAR_MART_ACTUALIZADO.sql
:r .\database\lead_revision\instalacion_actualizada\VERIFICAR_CARGA_MART.sql

IF (SELECT SUM(propuesta_aceptada) FROM dbo.fact_propuestas_aceptadas_lead)<>3
 OR (SELECT COUNT(*) FROM dbo.fact_propuestas_rechazadas_lead)<>1
 OR EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead WHERE propuesta_rechazada_economica<>0)
 OR (SELECT SUM(alternativa_aceptada) FROM dbo.fact_alternativas_aceptadas_lead)<>2
 OR (SELECT COUNT(*) FROM dbo.fact_alternativas_rechazadas_lead)<>1
 OR EXISTS (SELECT 1 FROM dbo.fact_alternativas_rechazadas_lead WHERE alternativa_rechazada_incompatibilidad<>0)
 THROW 54912,'La reclasificación dejó grupos obsoletos o duplicó operaciones.',1;

-- Reejecucion: preservar datos de hechos heredados y claves dimensionales.
IF EXISTS(SELECT * FROM #Heredado0 EXCEPT SELECT * FROM dbo.fact_negociacion_lead) OR EXISTS(SELECT * FROM dbo.fact_negociacion_lead EXCEPT SELECT * FROM #Heredado0) THROW 55223,'Se altero fact_negociacion_lead.',1;
IF EXISTS(SELECT * FROM #Heredado1 EXCEPT SELECT * FROM dbo.fact_gestion_payer) OR EXISTS(SELECT * FROM dbo.fact_gestion_payer EXCEPT SELECT * FROM #Heredado1) THROW 55223,'Se altero fact_gestion_payer.',1;
IF EXISTS(SELECT * FROM #Heredado2 EXCEPT SELECT * FROM dbo.fact_atencion_customer) OR EXISTS(SELECT * FROM dbo.fact_atencion_customer EXCEPT SELECT * FROM #Heredado2) THROW 55223,'Se altero fact_atencion_customer.',1;
IF EXISTS(SELECT * FROM #Heredado3 EXCEPT SELECT * FROM dbo.fact_seguimiento_turned) OR EXISTS(SELECT * FROM dbo.fact_seguimiento_turned EXCEPT SELECT * FROM #Heredado3) THROW 55223,'Se altero fact_seguimiento_turned.',1;
IF EXISTS(SELECT * FROM #DimCargada0 EXCEPT SELECT * FROM dbo.Dim_Tiempo) OR EXISTS(SELECT * FROM dbo.Dim_Tiempo EXCEPT SELECT * FROM #DimCargada0) THROW 55224,'Se alteraron claves o atributos de Dim_Tiempo.',1;
IF EXISTS(SELECT * FROM #DimCargada1 EXCEPT SELECT * FROM dbo.Dim_Servicio) OR EXISTS(SELECT * FROM dbo.Dim_Servicio EXCEPT SELECT * FROM #DimCargada1) THROW 55224,'Se alteraron claves o atributos de Dim_Servicio.',1;
IF EXISTS(SELECT * FROM #DimCargada2 EXCEPT SELECT * FROM dbo.Dim_Canal) OR EXISTS(SELECT * FROM dbo.Dim_Canal EXCEPT SELECT * FROM #DimCargada2) THROW 55224,'Se alteraron claves o atributos de Dim_Canal.',1;
IF EXISTS(SELECT * FROM #DimCargada3 EXCEPT SELECT * FROM dbo.Dim_Sede) OR EXISTS(SELECT * FROM dbo.Dim_Sede EXCEPT SELECT * FROM #DimCargada3) THROW 55224,'Se alteraron claves o atributos de Dim_Sede.',1;
IF EXISTS(SELECT * FROM #DimCargada4 EXCEPT SELECT * FROM dbo.Dim_Negociador) OR EXISTS(SELECT * FROM dbo.Dim_Negociador EXCEPT SELECT * FROM #DimCargada4) THROW 55224,'Se alteraron claves o atributos de Dim_Negociador.',1;
IF EXISTS(SELECT * FROM #DimCargada5 EXCEPT SELECT * FROM dbo.Dim_Profesional) OR EXISTS(SELECT * FROM dbo.Dim_Profesional EXCEPT SELECT * FROM #DimCargada5) THROW 55224,'Se alteraron claves o atributos de Dim_Profesional.',1;
IF EXISTS(SELECT * FROM #DimCargada6 EXCEPT SELECT * FROM dbo.Dim_Promocion) OR EXISTS(SELECT * FROM dbo.Dim_Promocion EXCEPT SELECT * FROM #DimCargada6) THROW 55224,'Se alteraron claves o atributos de Dim_Promocion.',1;
IF EXISTS(SELECT * FROM #DimCargada7 EXCEPT SELECT * FROM dbo.Dim_MotivoRechazo) OR EXISTS(SELECT * FROM dbo.Dim_MotivoRechazo EXCEPT SELECT * FROM #DimCargada7) THROW 55224,'Se alteraron claves o atributos de Dim_MotivoRechazo.',1;
IF EXISTS(SELECT * FROM #DimCargada8 EXCEPT SELECT * FROM dbo.Dim_Horario) OR EXISTS(SELECT * FROM dbo.Dim_Horario EXCEPT SELECT * FROM #DimCargada8) THROW 55224,'Se alteraron claves o atributos de Dim_Horario.',1;
IF EXISTS(SELECT * FROM #BuyerAntes EXCEPT SELECT id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos FROM dbo.fact_captacion_buyer) OR EXISTS(SELECT id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos FROM dbo.fact_captacion_buyer EXCEPT SELECT * FROM #BuyerAntes) THROW 55225,'Se alteraron medidas BUYER al repetir la carga.',1;

ROLLBACK TRANSACTION;
SELECT N'Casos sintéticos validados y revertidos' AS Resultado;
GO

IF EXISTS(SELECT * FROM #DimBase0 EXCEPT SELECT * FROM dbo.Dim_Tiempo) OR EXISTS(SELECT * FROM dbo.Dim_Tiempo EXCEPT SELECT * FROM #DimBase0) THROW 55226,'No se restauro Dim_Tiempo.',1;

IF EXISTS(SELECT * FROM #DimBase1 EXCEPT SELECT * FROM dbo.Dim_Servicio) OR EXISTS(SELECT * FROM dbo.Dim_Servicio EXCEPT SELECT * FROM #DimBase1) THROW 55226,'No se restauro Dim_Servicio.',1;

IF EXISTS(SELECT * FROM #DimBase2 EXCEPT SELECT * FROM dbo.Dim_Canal) OR EXISTS(SELECT * FROM dbo.Dim_Canal EXCEPT SELECT * FROM #DimBase2) THROW 55226,'No se restauro Dim_Canal.',1;

IF EXISTS(SELECT * FROM #DimBase3 EXCEPT SELECT * FROM dbo.Dim_Sede) OR EXISTS(SELECT * FROM dbo.Dim_Sede EXCEPT SELECT * FROM #DimBase3) THROW 55226,'No se restauro Dim_Sede.',1;

IF EXISTS(SELECT * FROM #DimBase4 EXCEPT SELECT * FROM dbo.Dim_Negociador) OR EXISTS(SELECT * FROM dbo.Dim_Negociador EXCEPT SELECT * FROM #DimBase4) THROW 55226,'No se restauro Dim_Negociador.',1;

IF EXISTS(SELECT * FROM #DimBase5 EXCEPT SELECT * FROM dbo.Dim_Profesional) OR EXISTS(SELECT * FROM dbo.Dim_Profesional EXCEPT SELECT * FROM #DimBase5) THROW 55226,'No se restauro Dim_Profesional.',1;

IF EXISTS(SELECT * FROM #DimBase6 EXCEPT SELECT * FROM dbo.Dim_Promocion) OR EXISTS(SELECT * FROM dbo.Dim_Promocion EXCEPT SELECT * FROM #DimBase6) THROW 55226,'No se restauro Dim_Promocion.',1;

IF EXISTS(SELECT * FROM #DimBase7 EXCEPT SELECT * FROM dbo.Dim_MotivoRechazo) OR EXISTS(SELECT * FROM dbo.Dim_MotivoRechazo EXCEPT SELECT * FROM #DimBase7) THROW 55226,'No se restauro Dim_MotivoRechazo.',1;

IF EXISTS(SELECT * FROM #DimBase8 EXCEPT SELECT * FROM dbo.Dim_Horario) OR EXISTS(SELECT * FROM dbo.Dim_Horario EXCEPT SELECT * FROM #DimBase8) THROW 55226,'No se restauro Dim_Horario.',1;
IF EXISTS(SELECT 1 FROM [$(Origen)].dbo.Personas) OR EXISTS(SELECT 1 FROM [$(Origen)].dbo.Servicios)
 OR EXISTS(SELECT 1 FROM [$(Origen)].dbo.CaptacionesBuyer) OR EXISTS(SELECT 1 FROM [$(Origen)].dbo.Solicitudes)
 OR EXISTS(SELECT 1 FROM [$(Origen)].dbo.EventosEtapa) OR EXISTS(SELECT 1 FROM [$(Origen)].dbo.GastosCampana)
 OR EXISTS(SELECT 1 FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id WHERE t.name LIKE 'fact[_]%' AND p.index_id IN(0,1) AND p.rows>0)
 THROW 55227,'Persistieron datos del ensayo.',1;
SELECT 'OK' resultado,'Carga no vacia, reejecucion, reclasificacion y preservacion; datos revertidos' comprobacion;
