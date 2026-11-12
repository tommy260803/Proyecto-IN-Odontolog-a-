-- NexoSalud: OLTP completa, instalacion NUEVA. Version de estructura LEAD 2026-11.
-- Fuentes: base BUYER de Daniel y esquema instalado/revisado de BUYER y LEAD.
-- Incluye 44 tablas y 20 modulos; excluye diagramas SSMS, datos privados y pilotos QA.
-- No es un parche para una base existente. No contiene :r ni depende de otros SQL.
-- Ejemplo desde la raiz (ajustar instancia y nombre; ambos nombres deben coincidir):
-- sqlcmd -S "SU_INSTANCIA" -E -C -I -b -f 65001 -d master -v BaseDatos=NexoSaludDB ConfirmarDestino=NexoSaludDB -i database/lead_revision/instalacion_actualizada/01_CREAR_OLTP_ACTUALIZADA.sql
-- Ejecutar con SQLCMD/SSMS en modo SQLCMD. Archivo UTF-8; conservar -f 65001.
-- Requiere SQL Server 2019/2022 y hora local del servidor UTC-05:00 (Lima).
-- Ante fallo: sqlcmd aborta y revierte la transaccion DDL; puede quedar la base vacia.
-- Revisar ese destino antes de continuar. Nunca restaura, borra ni reemplaza bases.
:ON ERROR EXIT
USE [master];
GO
SET NOCOUNT ON;
IF N'$(BaseDatos)'<>N'$(ConfirmarDestino)' OR N'$(BaseDatos)' NOT LIKE N'NexoSalud%'
 OR LEN(N'$(BaseDatos)')>128 OR N'$(BaseDatos)' COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9_]%'
 THROW 55001,'Destino no confirmado o nombre no permitido. Use NexoSalud y letras, numeros o guion bajo.',1;
IF DB_ID(N'$(BaseDatos)') IS NOT NULL
 THROW 55002,'La base ya existe. Este script solo instala desde cero y no reemplaza datos.',1;
IF TRY_CONVERT(int,SERVERPROPERTY('ProductMajorVersion'))<15
 THROW 55003,'Se requiere SQL Server 2019 o posterior compatible.',1;
IF DATEPART(TZOFFSET,SYSDATETIMEOFFSET())<>-300
 THROW 55004,'Configure la hora local del servidor en UTC-05:00 para las fechas de negocio de esta version.',1;
CREATE DATABASE [$(BaseDatos)] COLLATE Modern_Spanish_CI_AS;
GO
USE [$(BaseDatos)];
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
BEGIN TRANSACTION;
GO

-- 1. TABLAS: columnas, identidad y valores predeterminados; sin datos transaccionales.

CREATE TABLE [dbo].[AccesosPreReservaLead] (
    [hash_token] char(64) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_persona] int NOT NULL,
    [id_solicitud] int NOT NULL,
    [id_opcion] int NOT NULL,
    [huella] char(64) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [vence_utc] datetime2(3) NOT NULL,
    [creado_utc] datetime2(3) NOT NULL CONSTRAINT [DF__AccesosPr__cread__7908F585] DEFAULT (sysutcdatetime()),
    [id_usuario] int NULL
);
GO

CREATE TABLE [dbo].[Atenciones] (
    [id_atencion] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [id_reserva] int NOT NULL,
    [id_servicio] int NOT NULL,
    [id_profesional] int NOT NULL,
    [id_sede] int NOT NULL,
    [fecha_atencion] datetime2(7) NOT NULL,
    [fecha_inicio] datetime2(7) NULL,
    [fecha_fin] datetime2(7) NULL,
    [asistencia] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Atencione__asist__339FAB6E] DEFAULT ('Pendiente'),
    [estado_servicio] varchar(30) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Atencione__estad__3493CFA7] DEFAULT ('Programado'),
    [motivo_consulta] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [antecedentes] varchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [alergias] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [evaluacion] varchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [diagnostico_basico] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [procedimiento] varchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [procedimiento_realizado] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [observaciones] varchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [resultado] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [indicaciones_finales] varchar(500) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[CambiosOpcionLead] (
    [id_cambio] int IDENTITY(1,1) NOT NULL,
    [id_opcion] int NOT NULL,
    [fecha_cambio] datetime2(7) NOT NULL CONSTRAINT [DF_CambiosOpcionLead_Fecha] DEFAULT (sysdatetime()),
    [campo_modificado] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [motivo_cambio] varchar(300) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [tipo_motivo] varchar(30) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF_CambiosOpcionLead_Tipo] DEFAULT ('Otro'),
    [valor_anterior] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [valor_nuevo] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [es_pre_reserva_lead] bit NULL,
    [fecha_registro_utc_lead] datetime2(7) NULL CONSTRAINT [DF_CambiosOpcionLead_RegistroUTC] DEFAULT (sysutcdatetime())
);
GO

CREATE TABLE [dbo].[Campanas] (
    [id_campana] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(150) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [descripcion] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [id_fuente] int NULL,
    [id_canal] int NULL,
    [fecha_inicio] date NULL,
    [fecha_fin] date NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Campanas__activo__5070F446] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[Canales] (
    [id_canal] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Canales__activo__3B75D760] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[CaptacionesBuyer] (
    [id_captacion] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [fecha_captacion] datetime2(7) NOT NULL,
    [id_canal] int NULL,
    [id_fuente] int NULL,
    [id_campana] int NULL,
    [id_sede] int NULL,
    [id_servicio] int NULL,
    [motivo_consulta] nvarchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [estado_calidad] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [autoriza_contacto] bit NOT NULL CONSTRAINT [DF_CaptacionesBuyer_Autoriza] DEFAULT ((0)),
    [fecha_autorizacion] datetime2(7) NULL,
    [origen_datos] varchar(30) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_observacion] datetime2(7) NOT NULL CONSTRAINT [DF_CaptacionesBuyer_Observacion] DEFAULT (sysdatetime())
);
GO

CREATE TABLE [dbo].[ConfiguracionLeadRevision] (
    [version_codigo] varchar(30) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [auditoria_desde_utc] datetime2(7) NOT NULL CONSTRAINT [DF_ConfiguracionLeadRevision_Fecha] DEFAULT (sysutcdatetime()),
    [descripcion] nvarchar(300) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[DatosAcademicos] (
    [id_dato_academico] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [universidad] varchar(150) COLLATE Modern_Spanish_CI_AS NULL,
    [carrera] varchar(150) COLLATE Modern_Spanish_CI_AS NULL,
    [ciclo] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [aplica] bit NOT NULL CONSTRAINT [DF__DatosAcad__aplic__628FA481] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[DatosLaborales] (
    [id_dato_laboral] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [ocupacion] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [empresa] varchar(150) COLLATE Modern_Spanish_CI_AS NULL,
    [modalidad] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [disponibilidad] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [aplica] bit NOT NULL CONSTRAINT [DF__DatosLabo__aplic__66603565] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[DecisionesIA] (
    [id_decision] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NULL,
    [id_usuario] int NULL,
    [agente] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_hora] datetime2(7) NOT NULL CONSTRAINT [DF__Decisione__fecha__503BEA1C] DEFAULT (sysdatetime()),
    [entrada] varchar(MAX) COLLATE Modern_Spanish_CI_AS NULL,
    [regla_aplicada] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [decision] varchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [accion] varchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [requiere_revision] bit NOT NULL CONSTRAINT [DF__Decisione__requi__51300E55] DEFAULT ((0)),
    [resultado_revision] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [id_captacion] int NULL,
    [id_interaccion] int NULL
);
GO

CREATE TABLE [dbo].[Disponibilidad] (
    [id_disponibilidad] int IDENTITY(1,1) NOT NULL,
    [id_profesional] int NOT NULL,
    [id_sede] int NOT NULL,
    [fecha] date NOT NULL,
    [hora_inicio] time(7) NOT NULL,
    [hora_fin] time(7) NOT NULL,
    [estado] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Disponibi__estad__06CD04F7] DEFAULT ('Disponible')
);
GO

CREATE TABLE [dbo].[Etapas] (
    [id_etapa] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [descripcion] varchar(200) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[EventosEtapa] (
    [id_evento_etapa] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [etapa_origen] int NULL,
    [etapa_destino] int NOT NULL,
    [fecha_hora] datetime2(7) NOT NULL CONSTRAINT [DF__EventosEt__fecha__45BE5BA9] DEFAULT (sysdatetime()),
    [id_usuario] int NULL,
    [motivo] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [evidencia] varchar(500) COLLATE Modern_Spanish_CI_AS NULL,
    [id_captacion] int NULL,
    [id_solicitud] int NULL,
    [clave_operacion_buyer] varchar(80) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Fuentes] (
    [id_fuente] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [descripcion] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Fuentes__activo__3F466844] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[GastosCampana] (
    [id_gasto] int IDENTITY(1,1) NOT NULL,
    [id_campana] int NOT NULL,
    [fecha] date NOT NULL,
    [importe] decimal(10,2) NOT NULL,
    [descripcion] varchar(300) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[HistorialOpcionesLead] (
    [id_historial] bigint IDENTITY(1,1) NOT NULL,
    [id_opcion] int NOT NULL,
    [fecha_observacion_utc] datetime2(7) NOT NULL CONSTRAINT [DF_HistOpcionesLead_Fecha] DEFAULT (sysutcdatetime()),
    [accion] varchar(10) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_solicitud] int NOT NULL,
    [id_disponibilidad] int NOT NULL,
    [id_sede] int NOT NULL,
    [id_profesional] int NOT NULL,
    [fecha_disponibilidad] date NOT NULL,
    [hora_inicio] time(7) NOT NULL,
    [hora_fin] time(7) NOT NULL,
    [fecha_ofrecida] datetime2(7) NOT NULL,
    [precio_ofrecido] decimal(10,2) NOT NULL,
    [id_propuesta_lead] int NULL,
    [id_preferencia_lead] int NULL,
    [pref_fecha_lead] date NULL,
    [pref_dia_semana_lead] tinyint NULL,
    [pref_turno_lead] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [pref_hora_inicio_lead] time(7) NULL,
    [pref_hora_fin_lead] time(7) NULL,
    [ofr_turno_lead] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [estado_respuesta] varchar(20) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_respuesta] datetime2(7) NULL,
    [id_motivo_rechazo_lead] int NULL
);
GO

CREATE TABLE [dbo].[HistorialPropuestasLead] (
    [id_historial] bigint IDENTITY(1,1) NOT NULL,
    [id_propuesta] int NOT NULL,
    [fecha_observacion_utc] datetime2(7) NOT NULL CONSTRAINT [DF_HistPropuestasLead_Fecha] DEFAULT (sysutcdatetime()),
    [accion] varchar(10) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_propuesta_raiz] int NULL,
    [numero_version] smallint NOT NULL,
    [id_solicitud] int NOT NULL,
    [id_servicio] int NOT NULL,
    [fecha_presentacion] datetime2(7) NOT NULL,
    [precio_cotizado] decimal(10,2) NOT NULL,
    [id_promocion_lead] int NULL,
    [promocion_aplicada] varchar(150) COLLATE Modern_Spanish_CI_AS NULL,
    [estado] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_decision] datetime2(7) NULL,
    [id_motivo_rechazo_lead] int NULL,
    [id_sede_lead] int NULL
);
GO

CREATE TABLE [dbo].[HistorialSeguimientoOperativoLead] (
    [id_historial] bigint IDENTITY(1,1) NOT NULL,
    [id_solicitud] int NOT NULL,
    [estado] varchar(15) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [motivo] nvarchar(400) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [borrador] nvarchar(2000) COLLATE Modern_Spanish_CI_AS NULL,
    [revision] int NOT NULL,
    [registrado_utc] datetime2(3) NOT NULL CONSTRAINT [DF__Historial__regis__73501C2F] DEFAULT (sysutcdatetime())
);
GO

CREATE TABLE [dbo].[HistorialSolicitudesLead] (
    [id_historial] bigint IDENTITY(1,1) NOT NULL,
    [id_solicitud] int NOT NULL,
    [fecha_observacion_utc] datetime2(7) NOT NULL CONSTRAINT [DF_HistSolicitudesLead_Fecha] DEFAULT (sysutcdatetime()),
    [accion] varchar(10) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_solicitud] datetime2(7) NOT NULL,
    [id_servicio] int NULL,
    [id_negociador] int NULL,
    [id_canal_origen] int NULL,
    [id_sede_interes_lead] int NULL,
    [resultado_comercial_lead] varchar(25) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_decision_comercial_lead] datetime2(7) NULL,
    [valor_acordado_lead] decimal(14,2) NULL,
    [id_propuesta_aceptada_lead] int NULL,
    [fecha_ingreso_lead] datetime2(7) NULL
);
GO

CREATE TABLE [dbo].[HistorialVigenciaPropuestasLead] (
    [id_historial] bigint IDENTITY(1,1) NOT NULL,
    [id_propuesta] int NOT NULL,
    [fecha_observacion_utc] datetime2(7) NOT NULL CONSTRAINT [DF_HistVigenciaPropuestasLead_Fecha] DEFAULT (sysutcdatetime()),
    [accion] varchar(10) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_vigencia_hasta_utc_lead] datetime2(3) NULL
);
GO

CREATE TABLE [dbo].[Horarios] (
    [id_horario] int IDENTITY(1,1) NOT NULL,
    [dia_semana] tinyint NOT NULL,
    [hora_inicio] time(7) NOT NULL,
    [hora_fin] time(7) NOT NULL
);
GO

CREATE TABLE [dbo].[Incidencias] (
    [id_incidencia] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NULL,
    [id_pago] int NULL,
    [id_reserva] int NULL,
    [id_atencion] int NULL,
    [tipo] varchar(100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [descripcion] varchar(500) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [prioridad] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Incidenci__prior__55F4C372] DEFAULT ('Media'),
    [estado] varchar(30) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Incidenci__estad__56E8E7AB] DEFAULT ('Abierta'),
    [fecha_registro] datetime2(7) NOT NULL CONSTRAINT [DF__Incidenci__fecha__57DD0BE4] DEFAULT (sysdatetime()),
    [fecha_resolucion] datetime2(7) NULL,
    [id_usuario_responsable] int NULL
);
GO

CREATE TABLE [dbo].[Interacciones] (
    [id_interaccion] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [id_canal] int NULL,
    [id_fuente] int NULL,
    [id_usuario] int NULL,
    [fecha_hora] datetime2(7) NOT NULL CONSTRAINT [DF__Interacci__fecha__0D7A0286] DEFAULT (sysdatetime()),
    [tipo] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [mensaje] varchar(MAX) COLLATE Modern_Spanish_CI_AS NULL,
    [es_respuesta_util] bit NOT NULL CONSTRAINT [DF__Interacci__es_re__0E6E26BF] DEFAULT ((0)),
    [resultado] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [id_solicitud] int NULL
);
GO

CREATE TABLE [dbo].[Modalidades] (
    [id_modalidad] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL
);
GO

CREATE TABLE [dbo].[MotivosRechazoLead] (
    [id_motivo_rechazo] int IDENTITY(1,1) NOT NULL,
    [codigo] varchar(60) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [ambito] varchar(15) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [categoria] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [motivo] varchar(160) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__MotivosRe__activ__11158940] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[Opciones] (
    [id_opcion] int IDENTITY(1,1) NOT NULL,
    [id_solicitud] int NOT NULL,
    [id_disponibilidad] int NOT NULL,
    [precio_ofrecido] decimal(10,2) NOT NULL,
    [fecha_ofrecida] datetime2(7) NOT NULL CONSTRAINT [DF__Opciones__fecha___1BC821DD] DEFAULT (sysdatetime()),
    [seleccionada] bit NOT NULL CONSTRAINT [DF__Opciones__selecc__1CBC4616] DEFAULT ((0)),
    [archivada_lead_en] datetime2(7) NULL,
    [estado_respuesta] varchar(20) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_respuesta] datetime2(7) NULL,
    [motivo_rechazo] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [tipo_motivo_rechazo] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [id_propuesta_lead] int NULL,
    [id_preferencia_lead] int NULL,
    [id_motivo_rechazo_lead] int NULL,
    [pref_fecha_lead] date NULL,
    [pref_dia_semana_lead] tinyint NULL,
    [pref_turno_lead] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [pref_hora_inicio_lead] time(7) NULL,
    [pref_hora_fin_lead] time(7) NULL,
    [ofr_turno_lead] varchar(30) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Pagos] (
    [id_pago] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [id_reserva] int NOT NULL,
    [referencia_pago] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [importe] decimal(10,2) NOT NULL,
    [canal_pago] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_registro] datetime2(7) NOT NULL CONSTRAINT [DF__Pagos__fecha_reg__2B0A656D] DEFAULT (sysdatetime()),
    [fecha_validacion] datetime2(7) NULL,
    [estado] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Pagos__estado__2BFE89A6] DEFAULT ('Pendiente'),
    [comprobante] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [validado_por] int NULL,
    [observaciones] varchar(300) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[PersonaPreferencias] (
    [id_preferencia] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [id_canal] int NULL,
    [id_horario] int NULL,
    [id_modalidad] int NULL,
    [id_servicio_interes] int NULL,
    [sede_preferida] varchar(150) COLLATE Modern_Spanish_CI_AS NULL,
    [profesional_preferido] varchar(150) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_inicio] datetime2(7) NOT NULL CONSTRAINT [DF__PersonaPr__fecha__6E01572D] DEFAULT (sysdatetime()),
    [fecha_fin] datetime2(7) NULL
);
GO

CREATE TABLE [dbo].[Personas] (
    [id_persona] int IDENTITY(1,1) NOT NULL,
    [nombres] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [apellidos] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [dni] char(8) COLLATE Modern_Spanish_CI_AS NULL,
    [email] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [numero] varchar(20) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_nacimiento] date NULL,
    [zona] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [tipo_persona] varchar(30) COLLATE Modern_Spanish_CI_AS NULL CONSTRAINT [DF__Personas__tipo_p__59063A47] DEFAULT ('Adulto General'),
    [autoriza_contacto] bit NOT NULL CONSTRAINT [DF__Personas__autori__59FA5E80] DEFAULT ((0)),
    [fecha_autorizacion] datetime2(7) NULL,
    [estado_calidad] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Personas__estado__5AEE82B9] DEFAULT ('Valido'),
    [id_campana_origen] int NULL,
    [id_canal_origen] int NULL,
    [id_etapa_actual] int NOT NULL,
    [fecha_registro] datetime2(7) NOT NULL CONSTRAINT [DF__Personas__fecha___5BE2A6F2] DEFAULT (sysdatetime()),
    [fecha_actualizacion] datetime2(7) NULL
);
GO

CREATE TABLE [dbo].[PersonaSaludOdontologica] (
    [id_salud_odonto] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [ultima_visita_odontologica] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [motivo_consulta] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [tratamiento_previo] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [nivel_dolor] varchar(20) COLLATE Modern_Spanish_CI_AS NULL,
    [presenta_sensibilidad] varchar(10) COLLATE Modern_Spanish_CI_AS NULL,
    [sangrado_o_inflamacion] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [usa_aparato_o_protesis] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [condicion_atencion_especial] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_registro] datetime2(7) NOT NULL CONSTRAINT [DF__PersonaSa__fecha__6A30C649] DEFAULT (sysdatetime())
);
GO

CREATE TABLE [dbo].[Profesionales] (
    [id_profesional] int IDENTITY(1,1) NOT NULL,
    [nombres] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [apellidos] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [numero_colegiatura] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [especialidad] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Profesion__activ__7D439ABD] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[ProfesionalServicio] (
    [id_profesional] int NOT NULL,
    [id_servicio] int NOT NULL
);
GO

CREATE TABLE [dbo].[PromocionesLead] (
    [id_promocion] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(150) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [tipo_promocion] varchar(80) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_servicio] int NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Promocion__activ__0B5CAFEA] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[PropuestasEconomicasLead] (
    [id_propuesta] int IDENTITY(1,1) NOT NULL,
    [id_solicitud] int NOT NULL,
    [id_servicio] int NOT NULL,
    [id_propuesta_raiz] int NULL,
    [numero_version] smallint NOT NULL CONSTRAINT [DF_PropuestasLead_Version] DEFAULT ((1)),
    [precio_cotizado] decimal(10,2) NOT NULL,
    [promocion_aplicada] varchar(150) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_presentacion] datetime2(7) NOT NULL CONSTRAINT [DF_PropuestasLead_Presentacion] DEFAULT (sysdatetime()),
    [estado] varchar(20) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF_PropuestasLead_Estado] DEFAULT ('Pendiente'),
    [fecha_decision] datetime2(7) NULL,
    [motivo_rechazo] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [tipo_motivo_rechazo] varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [id_sede_lead] int NULL,
    [id_promocion_lead] int NULL,
    [id_motivo_rechazo_lead] int NULL,
    [fecha_vigencia_hasta_utc_lead] datetime2(3) NULL
);
GO

CREATE TABLE [dbo].[Reservas] (
    [id_reserva] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [id_solicitud] int NOT NULL,
    [id_opcion] int NOT NULL,
    [fecha_reserva] datetime2(7) NOT NULL CONSTRAINT [DF__Reservas__fecha___22751F6C] DEFAULT (sysdatetime()),
    [estado] varchar(30) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Reservas__estado__236943A5] DEFAULT ('Pendiente'),
    [fecha_vencimiento_bloqueo] datetime2(7) NULL,
    [confirmacion_explicita] bit NOT NULL CONSTRAINT [DF__Reservas__confir__245D67DE] DEFAULT ((0)),
    [fecha_confirmacion] datetime2(7) NULL
);
GO

CREATE TABLE [dbo].[Roles] (
    [id_rol] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL
);
GO

CREATE TABLE [dbo].[Sedes] (
    [id_sede] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [direccion] varchar(200) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [zona] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Sedes__activo__00200768] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[SeguimientoOperativoLead] (
    [id_solicitud] int NOT NULL,
    [estado] varchar(15) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [motivo] nvarchar(400) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [borrador] nvarchar(2000) COLLATE Modern_Spanish_CI_AS NULL,
    [clave_envio] uniqueidentifier NULL,
    [id_externo] nvarchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [ultimo_envio_utc] datetime2(3) NULL,
    [actualizado_utc] datetime2(3) NOT NULL CONSTRAINT [DF__Seguimien__actua__6E8B6712] DEFAULT (sysutcdatetime()),
    [revision] int NOT NULL CONSTRAINT [DF__Seguimien__revis__6F7F8B4B] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[Seguimientos] (
    [id_seguimiento] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [id_atencion] int NOT NULL,
    [id_usuario] int NULL,
    [fecha_hora] datetime2(7) NOT NULL CONSTRAINT [DF__Seguimien__fecha__3E1D39E1] DEFAULT (sysdatetime()),
    [canal] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [tipo] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [resultado] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [satisfaccion] tinyint NULL,
    [incidencia] bit NOT NULL CONSTRAINT [DF__Seguimien__incid__3F115E1A] DEFAULT ((0)),
    [observaciones] varchar(500) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Servicios] (
    [id_servicio] int IDENTITY(1,1) NOT NULL,
    [nombre] varchar(100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [descripcion] varchar(300) COLLATE Modern_Spanish_CI_AS NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Servicios__activ__5629CD9C] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[Solicitudes] (
    [id_solicitud] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NOT NULL,
    [id_servicio] int NULL,
    [fecha_solicitud] datetime2(7) NOT NULL CONSTRAINT [DF__Solicitud__fecha__151B244E] DEFAULT (sysdatetime()),
    [motivo] varchar(200) COLLATE Modern_Spanish_CI_AS NULL,
    [tipo_consulta] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [prioridad] varchar(20) COLLATE Modern_Spanish_CI_AS NULL,
    [estado] varchar(30) COLLATE Modern_Spanish_CI_AS NOT NULL CONSTRAINT [DF__Solicitud__estad__160F4887] DEFAULT ('Abierta'),
    [fecha_primera_respuesta] datetime2(7) NULL,
    [fecha_cierre] datetime2(7) NULL,
    [fecha_ingreso_lead] datetime2(7) NULL,
    [archivada_lead_en] datetime2(7) NULL,
    [clave_registro_web_lead] varchar(36) COLLATE Modern_Spanish_CI_AS NULL,
    [hash_registro_web_lead] char(64) COLLATE Modern_Spanish_CI_AS NULL,
    [id_negociador] int NULL,
    [id_canal_origen] int NULL,
    [id_sede_interes_lead] int NULL,
    [resultado_comercial_lead] varchar(25) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_decision_comercial_lead] datetime2(7) NULL,
    [valor_acordado_lead] decimal(14,2) NULL,
    [id_propuesta_aceptada_lead] int NULL,
    [motivo_cierre_lead] varchar(400) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_proximo_seguimiento] datetime2(7) NULL
);
GO

CREATE TABLE [dbo].[Tarifas] (
    [id_tarifa] int IDENTITY(1,1) NOT NULL,
    [id_servicio] int NOT NULL,
    [precio] decimal(10,2) NOT NULL,
    [fecha_inicio] datetime2(7) NOT NULL CONSTRAINT [DF__Tarifas__fecha_i__76969D2E] DEFAULT (sysdatetime()),
    [fecha_fin] datetime2(7) NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Tarifas__activo__778AC167] DEFAULT ((1))
);
GO

CREATE TABLE [dbo].[TraspasosPayerLead] (
    [id_solicitud] int NOT NULL,
    [id_persona] int NOT NULL,
    [id_opcion] int NOT NULL,
    [id_propuesta] int NOT NULL,
    [id_reserva] int NOT NULL,
    [id_evento] int NOT NULL,
    [clave_operacion] varchar(80) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [huella] char(64) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [origen] varchar(15) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [evidencia] nvarchar(300) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_usuario] int NULL,
    [autoriza_contacto] bit NOT NULL,
    [confirmado_utc] datetime2(3) NOT NULL CONSTRAINT [DF__Traspasos__confi__075714DC] DEFAULT (sysutcdatetime())
);
GO

CREATE TABLE [dbo].[Usuarios] (
    [id_usuario] int IDENTITY(1,1) NOT NULL,
    [nombres] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [apellidos] varchar(50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [email] varchar(100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [password_hash] varchar(255) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_rol] int NOT NULL,
    [activo] bit NOT NULL CONSTRAINT [DF__Usuarios__activo__4CA06362] DEFAULT ((1))
);
GO

-- 2. CLAVES PRIMARIAS, UNICAS E INDICES.

ALTER TABLE [dbo].[AccesosPreReservaLead] ADD CONSTRAINT [PK_AccesosPreReservaLead] PRIMARY KEY CLUSTERED ([hash_token] ASC);
GO

ALTER TABLE [dbo].[Atenciones] ADD CONSTRAINT [PK__Atencion__D0A40236A7436A60] PRIMARY KEY CLUSTERED ([id_atencion] ASC);
GO

ALTER TABLE [dbo].[CambiosOpcionLead] ADD CONSTRAINT [PK_CambiosOpcionLead] PRIMARY KEY CLUSTERED ([id_cambio] ASC);
GO

ALTER TABLE [dbo].[Campanas] ADD CONSTRAINT [PK__Campanas__CAA2C8F7FE202607] PRIMARY KEY CLUSTERED ([id_campana] ASC);
GO

ALTER TABLE [dbo].[Canales] ADD CONSTRAINT [PK__Canales__D4C01CC8E2D87FB8] PRIMARY KEY CLUSTERED ([id_canal] ASC);
GO

ALTER TABLE [dbo].[Canales] ADD CONSTRAINT [UQ__Canales__72AFBCC6C6563DD6] UNIQUE NONCLUSTERED ([nombre] ASC);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] ADD CONSTRAINT [PK_CaptacionesBuyer] PRIMARY KEY CLUSTERED ([id_captacion] ASC);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] ADD CONSTRAINT [UQ_CaptacionesBuyer_Persona] UNIQUE NONCLUSTERED ([id_persona] ASC);
GO

ALTER TABLE [dbo].[ConfiguracionLeadRevision] ADD CONSTRAINT [PK_ConfiguracionLeadRevision] PRIMARY KEY CLUSTERED ([version_codigo] ASC);
GO

ALTER TABLE [dbo].[DatosAcademicos] ADD CONSTRAINT [PK__DatosAca__AB51D48422C453A4] PRIMARY KEY CLUSTERED ([id_dato_academico] ASC);
GO

ALTER TABLE [dbo].[DatosLaborales] ADD CONSTRAINT [PK__DatosLab__4AE42FC17074DA5A] PRIMARY KEY CLUSTERED ([id_dato_laboral] ASC);
GO

ALTER TABLE [dbo].[DecisionesIA] ADD CONSTRAINT [PK__Decision__47709B06EEB26DF8] PRIMARY KEY CLUSTERED ([id_decision] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_Disponibilidad_Fecha_Estado] ON [dbo].[Disponibilidad] ([fecha] ASC, [estado] ASC);
GO

ALTER TABLE [dbo].[Disponibilidad] ADD CONSTRAINT [PK__Disponib__319B171B266AFE98] PRIMARY KEY CLUSTERED ([id_disponibilidad] ASC);
GO

ALTER TABLE [dbo].[Etapas] ADD CONSTRAINT [PK__Etapas__9927D0E8D96E4FE9] PRIMARY KEY CLUSTERED ([id_etapa] ASC);
GO

ALTER TABLE [dbo].[Etapas] ADD CONSTRAINT [UQ__Etapas__72AFBCC62314C0BB] UNIQUE NONCLUSTERED ([nombre] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_EventosEtapa_Persona_Fecha] ON [dbo].[EventosEtapa] ([id_persona] ASC, [fecha_hora] ASC);
GO

ALTER TABLE [dbo].[EventosEtapa] ADD CONSTRAINT [PK__EventosE__D60E70193356C959] PRIMARY KEY CLUSTERED ([id_evento_etapa] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_EventosEtapa_OperacionBuyer] ON [dbo].[EventosEtapa] ([clave_operacion_buyer] ASC) WHERE ([clave_operacion_buyer] IS NOT NULL);
GO

ALTER TABLE [dbo].[Fuentes] ADD CONSTRAINT [PK__Fuentes__D899AF3DC7B203F2] PRIMARY KEY CLUSTERED ([id_fuente] ASC);
GO

ALTER TABLE [dbo].[Fuentes] ADD CONSTRAINT [UQ__Fuentes__72AFBCC6C7EA0508] UNIQUE NONCLUSTERED ([nombre] ASC);
GO

ALTER TABLE [dbo].[GastosCampana] ADD CONSTRAINT [PK__GastosCa__ECB8FB8088F7936F] PRIMARY KEY CLUSTERED ([id_gasto] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_HistOpcionesLead_IdFecha] ON [dbo].[HistorialOpcionesLead] ([id_opcion] ASC, [fecha_observacion_utc] DESC, [id_historial] DESC);
GO

ALTER TABLE [dbo].[HistorialOpcionesLead] ADD CONSTRAINT [PK_HistorialOpcionesLead] PRIMARY KEY CLUSTERED ([id_historial] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_HistPropuestasLead_IdFecha] ON [dbo].[HistorialPropuestasLead] ([id_propuesta] ASC, [fecha_observacion_utc] DESC, [id_historial] DESC);
GO

ALTER TABLE [dbo].[HistorialPropuestasLead] ADD CONSTRAINT [PK_HistorialPropuestasLead] PRIMARY KEY CLUSTERED ([id_historial] ASC);
GO

ALTER TABLE [dbo].[HistorialSeguimientoOperativoLead] ADD CONSTRAINT [PK__Historia__76E6C50298D077B2] PRIMARY KEY CLUSTERED ([id_historial] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_HistSolicitudesLead_IdFecha] ON [dbo].[HistorialSolicitudesLead] ([id_solicitud] ASC, [fecha_observacion_utc] DESC, [id_historial] DESC);
GO

ALTER TABLE [dbo].[HistorialSolicitudesLead] ADD CONSTRAINT [PK_HistorialSolicitudesLead] PRIMARY KEY CLUSTERED ([id_historial] ASC);
GO

ALTER TABLE [dbo].[HistorialVigenciaPropuestasLead] ADD CONSTRAINT [PK_HistVigenciaPropuestasLead] PRIMARY KEY CLUSTERED ([id_historial] ASC);
GO

ALTER TABLE [dbo].[Horarios] ADD CONSTRAINT [PK__Horarios__C5836D69BC6A9B38] PRIMARY KEY CLUSTERED ([id_horario] ASC);
GO

ALTER TABLE [dbo].[Incidencias] ADD CONSTRAINT [PK__Incidenc__D7757E7646A6B4F6] PRIMARY KEY CLUSTERED ([id_incidencia] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_Interacciones_Persona_Fecha] ON [dbo].[Interacciones] ([id_persona] ASC, [fecha_hora] ASC);
GO

ALTER TABLE [dbo].[Interacciones] ADD CONSTRAINT [PK__Interacc__0152426C5CDCAF38] PRIMARY KEY CLUSTERED ([id_interaccion] ASC);
GO

ALTER TABLE [dbo].[Modalidades] ADD CONSTRAINT [PK__Modalida__C4D7F072C7856CF8] PRIMARY KEY CLUSTERED ([id_modalidad] ASC);
GO

ALTER TABLE [dbo].[Modalidades] ADD CONSTRAINT [UQ__Modalida__72AFBCC62EA34C2D] UNIQUE NONCLUSTERED ([nombre] ASC);
GO

ALTER TABLE [dbo].[MotivosRechazoLead] ADD CONSTRAINT [PK_MotivosRechazoLead] PRIMARY KEY CLUSTERED ([id_motivo_rechazo] ASC);
GO

ALTER TABLE [dbo].[MotivosRechazoLead] ADD CONSTRAINT [UQ_MotivosRechazoLead_Codigo] UNIQUE NONCLUSTERED ([codigo] ASC);
GO

ALTER TABLE [dbo].[Opciones] ADD CONSTRAINT [PK__Opciones__EFAF425820D9044A] PRIMARY KEY CLUSTERED ([id_opcion] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_Pagos_Estado_Fecha] ON [dbo].[Pagos] ([estado] ASC, [fecha_registro] ASC);
GO

ALTER TABLE [dbo].[Pagos] ADD CONSTRAINT [PK__Pagos__0941B074526E9D31] PRIMARY KEY CLUSTERED ([id_pago] ASC);
GO

ALTER TABLE [dbo].[PersonaPreferencias] ADD CONSTRAINT [PK__PersonaP__185BEDEBECF6B274] PRIMARY KEY CLUSTERED ([id_preferencia] ASC);
GO

ALTER TABLE [dbo].[Personas] ADD CONSTRAINT [PK__Personas__228148B0D111A8D5] PRIMARY KEY CLUSTERED ([id_persona] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_Personas_DNI_NotNull] ON [dbo].[Personas] ([dni] ASC) WHERE ([dni] IS NOT NULL);
GO

ALTER TABLE [dbo].[PersonaSaludOdontologica] ADD CONSTRAINT [PK__PersonaS__8E02910E638F3065] PRIMARY KEY CLUSTERED ([id_salud_odonto] ASC);
GO

ALTER TABLE [dbo].[Profesionales] ADD CONSTRAINT [PK__Profesio__F6DC93F213CB237F] PRIMARY KEY CLUSTERED ([id_profesional] ASC);
GO

ALTER TABLE [dbo].[ProfesionalServicio] ADD CONSTRAINT [PK__Profesio__2021940FE534EF07] PRIMARY KEY CLUSTERED ([id_profesional] ASC, [id_servicio] ASC);
GO

ALTER TABLE [dbo].[PromocionesLead] ADD CONSTRAINT [PK_PromocionesLead] PRIMARY KEY CLUSTERED ([id_promocion] ASC);
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] ADD CONSTRAINT [PK_PropuestasEconomicasLead] PRIMARY KEY CLUSTERED ([id_propuesta] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_PropuestasLead_RaizVersion] ON [dbo].[PropuestasEconomicasLead] ([id_propuesta_raiz] ASC, [numero_version] ASC) WHERE ([id_propuesta_raiz] IS NOT NULL);
GO

CREATE NONCLUSTERED INDEX [IX_Reservas_Fecha_Estado] ON [dbo].[Reservas] ([fecha_reserva] ASC, [estado] ASC);
GO

ALTER TABLE [dbo].[Reservas] ADD CONSTRAINT [PK__Reservas__423CBE5D4AE78491] PRIMARY KEY CLUSTERED ([id_reserva] ASC);
GO

ALTER TABLE [dbo].[Roles] ADD CONSTRAINT [PK__Roles__6ABCB5E0E1703D72] PRIMARY KEY CLUSTERED ([id_rol] ASC);
GO

ALTER TABLE [dbo].[Roles] ADD CONSTRAINT [UQ__Roles__72AFBCC6EDB8E428] UNIQUE NONCLUSTERED ([nombre] ASC);
GO

ALTER TABLE [dbo].[Sedes] ADD CONSTRAINT [PK__Sedes__D693504B64ADAC5B] PRIMARY KEY CLUSTERED ([id_sede] ASC);
GO

ALTER TABLE [dbo].[SeguimientoOperativoLead] ADD CONSTRAINT [PK__Seguimie__5C0C31F3ED115672] PRIMARY KEY CLUSTERED ([id_solicitud] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_SeguimientoLead_Clave] ON [dbo].[SeguimientoOperativoLead] ([clave_envio] ASC) WHERE ([clave_envio] IS NOT NULL);
GO

ALTER TABLE [dbo].[Seguimientos] ADD CONSTRAINT [PK__Seguimie__127E9A1A17465FEB] PRIMARY KEY CLUSTERED ([id_seguimiento] ASC);
GO

ALTER TABLE [dbo].[Servicios] ADD CONSTRAINT [PK__Servicio__6FD07FDC3FFDED45] PRIMARY KEY CLUSTERED ([id_servicio] ASC);
GO

ALTER TABLE [dbo].[Servicios] ADD CONSTRAINT [UQ__Servicio__72AFBCC6AF6670D5] UNIQUE NONCLUSTERED ([nombre] ASC);
GO

CREATE NONCLUSTERED INDEX [IX_Solicitudes_Persona_Fecha] ON [dbo].[Solicitudes] ([id_persona] ASC, [fecha_solicitud] ASC);
GO

ALTER TABLE [dbo].[Solicitudes] ADD CONSTRAINT [PK__Solicitu__5C0C31F3261F23CB] PRIMARY KEY CLUSTERED ([id_solicitud] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_Solicitudes_RegistroWebLead] ON [dbo].[Solicitudes] ([clave_registro_web_lead] ASC) WHERE ([clave_registro_web_lead] IS NOT NULL);
GO

ALTER TABLE [dbo].[Tarifas] ADD CONSTRAINT [PK__Tarifas__747D03891A9DC02F] PRIMARY KEY CLUSTERED ([id_tarifa] ASC);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] ADD CONSTRAINT [PK_TraspasosPayerLead] PRIMARY KEY CLUSTERED ([id_solicitud] ASC);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] ADD CONSTRAINT [UQ_TraspasosLead_Clave] UNIQUE NONCLUSTERED ([clave_operacion] ASC);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] ADD CONSTRAINT [UQ_TraspasosLead_Evento] UNIQUE NONCLUSTERED ([id_evento] ASC);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] ADD CONSTRAINT [UQ_TraspasosLead_Reserva] UNIQUE NONCLUSTERED ([id_reserva] ASC);
GO

ALTER TABLE [dbo].[Usuarios] ADD CONSTRAINT [PK__Usuarios__4E3E04ADFA0DFC56] PRIMARY KEY CLUSTERED ([id_usuario] ASC);
GO

ALTER TABLE [dbo].[Usuarios] ADD CONSTRAINT [UQ__Usuarios__AB6E6164E95E0612] UNIQUE NONCLUSTERED ([email] ASC);
GO

-- 3. RESTRICCIONES DE NEGOCIO Y RELACIONES, CON VALIDACION HABILITADA.

ALTER TABLE [dbo].[Atenciones] WITH CHECK ADD CONSTRAINT [CK_Atenciones_Asistencia] CHECK ([asistencia]='No asistió' OR [asistencia]='Asistió' OR [asistencia]='Pendiente');
GO

ALTER TABLE [dbo].[Atenciones] WITH CHECK ADD CONSTRAINT [CK_Atenciones_Estado] CHECK ([estado_servicio]='Cancelado' OR [estado_servicio]='Realizado' OR [estado_servicio]='En proceso' OR [estado_servicio]='Programado');
GO

ALTER TABLE [dbo].[CambiosOpcionLead] WITH CHECK ADD CONSTRAINT [CK_CambiosOpcionLead_Tipo] CHECK ([tipo_motivo]='Otro' OR [tipo_motivo]='Preferencia' OR [tipo_motivo]='Incompatibilidad');
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [CK_CaptacionesBuyer_Calidad] CHECK ([estado_calidad]='Rechazado' OR [estado_calidad]='Duplicado' OR [estado_calidad]='Incompleto' OR [estado_calidad]='Valido');
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [CK_CaptacionesBuyer_Origen] CHECK ([origen_datos]='HISTORICO_OBSERVADO' OR [origen_datos]='REGISTRO_DIRECTO');
GO

ALTER TABLE [dbo].[Disponibilidad] WITH CHECK ADD CONSTRAINT [CK_Disponibilidad_Estado] CHECK ([estado]='Ocupado' OR [estado]='Bloqueado' OR [estado]='Disponible');
GO

ALTER TABLE [dbo].[Disponibilidad] WITH CHECK ADD CONSTRAINT [CK_Disponibilidad_Hora] CHECK ([hora_inicio]<[hora_fin]);
GO

ALTER TABLE [dbo].[GastosCampana] WITH CHECK ADD CONSTRAINT [CK_GastosCampana_Importe] CHECK ([importe]>=(0));
GO

ALTER TABLE [dbo].[HistorialOpcionesLead] WITH CHECK ADD CONSTRAINT [CK_HistOpcionesLead_Accion] CHECK ([accion]='DELETE' OR [accion]='UPDATE' OR [accion]='INSERT' OR [accion]='BASELINE');
GO

ALTER TABLE [dbo].[HistorialPropuestasLead] WITH CHECK ADD CONSTRAINT [CK_HistPropuestasLead_Accion] CHECK ([accion]='DELETE' OR [accion]='UPDATE' OR [accion]='INSERT' OR [accion]='BASELINE');
GO

ALTER TABLE [dbo].[HistorialSolicitudesLead] WITH CHECK ADD CONSTRAINT [CK_HistSolicitudesLead_Accion] CHECK ([accion]='DELETE' OR [accion]='UPDATE' OR [accion]='INSERT' OR [accion]='BASELINE');
GO

ALTER TABLE [dbo].[HistorialVigenciaPropuestasLead] WITH CHECK ADD CONSTRAINT [CK_HistVigenciaPropuestasLead_Accion] CHECK ([accion]='DELETE' OR [accion]='UPDATE' OR [accion]='INSERT' OR [accion]='BASELINE');
GO

ALTER TABLE [dbo].[Horarios] WITH CHECK ADD CONSTRAINT [CK_Horarios_Dia] CHECK ([dia_semana]>=(1) AND [dia_semana]<=(7));
GO

ALTER TABLE [dbo].[Horarios] WITH CHECK ADD CONSTRAINT [CK_Horarios_Hora] CHECK ([hora_inicio]<[hora_fin]);
GO

ALTER TABLE [dbo].[Incidencias] WITH CHECK ADD CONSTRAINT [CK_Incidencias_Estado] CHECK ([estado]='Cerrada' OR [estado]='Resuelta' OR [estado]='En proceso' OR [estado]='Abierta');
GO

ALTER TABLE [dbo].[Incidencias] WITH CHECK ADD CONSTRAINT [CK_Incidencias_Prioridad] CHECK ([prioridad]='Crítica' OR [prioridad]='Alta' OR [prioridad]='Media' OR [prioridad]='Baja');
GO

ALTER TABLE [dbo].[MotivosRechazoLead] WITH CHECK ADD CONSTRAINT [CK_MotivosRechazoLead_Ambito] CHECK ([ambito]='ALTERNATIVA' OR [ambito]='PROPUESTA');
GO

ALTER TABLE [dbo].[MotivosRechazoLead] WITH CHECK ADD CONSTRAINT [CK_MotivosRechazoLead_Categoria] CHECK ([categoria]='OTROS' OR [categoria]='INCOMPATIBILIDAD' OR [categoria]='ECONOMICO');
GO

ALTER TABLE [dbo].[MotivosRechazoLead] WITH CHECK ADD CONSTRAINT [CK_MotivosRechazoLead_Cruce] CHECK ([ambito]='PROPUESTA' AND ([categoria]='OTROS' OR [categoria]='ECONOMICO') OR [ambito]='ALTERNATIVA' AND ([categoria]='OTROS' OR [categoria]='INCOMPATIBILIDAD'));
GO

ALTER TABLE [dbo].[MotivosRechazoLead] WITH CHECK ADD CONSTRAINT [CK_MotivosRechazoLead_Nombre] CHECK (len(ltrim(rtrim([motivo])))>(0));
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [CK_Opciones_FechaRespuestaLead] CHECK ([fecha_respuesta] IS NULL OR [fecha_respuesta]>=[fecha_ofrecida]);
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [CK_Opciones_Precio] CHECK ([precio_ofrecido]>=(0));
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [CK_Opciones_PreferenciaHorarioLead] CHECK (([pref_dia_semana_lead] IS NULL OR [pref_dia_semana_lead]>=(1) AND [pref_dia_semana_lead]<=(7)) AND ([pref_hora_inicio_lead] IS NULL AND [pref_hora_fin_lead] IS NULL OR [pref_hora_inicio_lead] IS NOT NULL AND [pref_hora_fin_lead] IS NOT NULL AND [pref_hora_inicio_lead]<[pref_hora_fin_lead]));
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [CK_Opciones_SeleccionLead] CHECK (NOT ([seleccionada]=(1) AND [estado_respuesta]='Rechazada'));
GO

ALTER TABLE [dbo].[Pagos] WITH CHECK ADD CONSTRAINT [CK_Pagos_Estado] CHECK ([estado]='Revertido' OR [estado]='Fallido' OR [estado]='Confirmado' OR [estado]='Pendiente');
GO

ALTER TABLE [dbo].[Pagos] WITH CHECK ADD CONSTRAINT [CK_Pagos_Importe] CHECK ([importe]>=(0));
GO

ALTER TABLE [dbo].[PersonaPreferencias] WITH CHECK ADD CONSTRAINT [CK_Preferencias_Fechas] CHECK ([fecha_fin] IS NULL OR [fecha_fin]>[fecha_inicio]);
GO

ALTER TABLE [dbo].[Personas] WITH CHECK ADD CONSTRAINT [CK_Personas_Calidad] CHECK ([estado_calidad]='Rechazado' OR [estado_calidad]='Duplicado' OR [estado_calidad]='Incompleto' OR [estado_calidad]='Valido');
GO

ALTER TABLE [dbo].[PromocionesLead] WITH CHECK ADD CONSTRAINT [CK_PromocionesLead_Nombre] CHECK (len(ltrim(rtrim([nombre])))>(0));
GO

ALTER TABLE [dbo].[PromocionesLead] WITH CHECK ADD CONSTRAINT [CK_PromocionesLead_Tipo] CHECK (len(ltrim(rtrim([tipo_promocion])))>(0));
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [CK_PropuestasLead_ArbolVersion] CHECK ([id_propuesta_raiz] IS NULL AND [numero_version]=(1) OR [id_propuesta_raiz] IS NOT NULL AND [numero_version]>(1));
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [CK_PropuestasLead_Estado] CHECK ([estado]='Rechazada' OR [estado]='Aceptada' OR [estado]='Pendiente');
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [CK_PropuestasLead_Precio] CHECK ([precio_cotizado]>=(0));
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [CK_PropuestasLead_Version] CHECK ([numero_version]>=(1));
GO

ALTER TABLE [dbo].[Reservas] WITH CHECK ADD CONSTRAINT [CK_Reservas_Estado] CHECK ([estado]='Vencida' OR [estado]='No asistió' OR [estado]='Cancelada' OR [estado]='Atendida' OR [estado]='Confirmada' OR [estado]='Bloqueada' OR [estado]='Pendiente');
GO

ALTER TABLE [dbo].[SeguimientoOperativoLead] WITH CHECK ADD CONSTRAINT [CK__Seguimien__estad__6D9742D9] CHECK ([estado]='FALLIDO' OR [estado]='ENVIADO' OR [estado]='PREPARADO' OR [estado]='CANCELADO' OR [estado]='PAUSADO' OR [estado]='PROGRAMADO');
GO

ALTER TABLE [dbo].[Seguimientos] WITH CHECK ADD CONSTRAINT [CK_Seguimientos_Satisfaccion] CHECK ([satisfaccion] IS NULL OR [satisfaccion]>=(1) AND [satisfaccion]<=(5));
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [CK_Solicitudes_Estado] CHECK ([estado]='Abandonada' OR [estado]='Cerrada' OR [estado]='Convertida' OR [estado]='En negociación' OR [estado]='Abierta');
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [CK_Solicitudes_ResultadoComercialLead] CHECK ([resultado_comercial_lead] IS NULL AND [fecha_decision_comercial_lead] IS NULL AND [valor_acordado_lead] IS NULL AND [id_propuesta_aceptada_lead] IS NULL OR [resultado_comercial_lead]='PENDIENTE' AND [fecha_decision_comercial_lead] IS NULL AND [valor_acordado_lead] IS NULL AND [id_propuesta_aceptada_lead] IS NULL OR [resultado_comercial_lead]='ACEPTADA' AND [fecha_decision_comercial_lead] IS NOT NULL AND [valor_acordado_lead] IS NOT NULL AND [id_propuesta_aceptada_lead] IS NOT NULL AND [motivo_cierre_lead] IS NULL OR [resultado_comercial_lead]='CERRADA_SIN_ACUERDO' AND [fecha_decision_comercial_lead] IS NOT NULL AND [valor_acordado_lead] IS NULL AND [id_propuesta_aceptada_lead] IS NULL AND nullif(ltrim(rtrim([motivo_cierre_lead])),'') IS NOT NULL);
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [CK_Solicitudes_ValorYFechaLead] CHECK (([valor_acordado_lead] IS NULL OR [valor_acordado_lead]>=(0)) AND ([fecha_decision_comercial_lead] IS NULL OR [fecha_decision_comercial_lead]>=[fecha_solicitud]));
GO

ALTER TABLE [dbo].[Tarifas] WITH CHECK ADD CONSTRAINT [CK_Tarifas_Fechas] CHECK ([fecha_fin] IS NULL OR [fecha_fin]>[fecha_inicio]);
GO

ALTER TABLE [dbo].[Tarifas] WITH CHECK ADD CONSTRAINT [CK_Tarifas_Precio] CHECK ([precio]>=(0));
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [CK__Traspasos__orige__056ECC6A] CHECK ([origen]='PACIENTE' OR [origen]='ASESOR');
GO

ALTER TABLE [dbo].[AccesosPreReservaLead] WITH CHECK ADD CONSTRAINT [FK__AccesosPr__id_op__7814D14C] FOREIGN KEY ([id_opcion]) REFERENCES [dbo].[Opciones] ([id_opcion]);
GO

ALTER TABLE [dbo].[AccesosPreReservaLead] WITH CHECK ADD CONSTRAINT [FK__AccesosPr__id_pe__762C88DA] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[AccesosPreReservaLead] WITH CHECK ADD CONSTRAINT [FK__AccesosPr__id_so__7720AD13] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[AccesosPreReservaLead] WITH CHECK ADD CONSTRAINT [FK__AccesosPr__id_us__79FD19BE] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[Atenciones] WITH CHECK ADD CONSTRAINT [FK_Atenciones_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[Atenciones] WITH CHECK ADD CONSTRAINT [FK_Atenciones_Profesional] FOREIGN KEY ([id_profesional]) REFERENCES [dbo].[Profesionales] ([id_profesional]);
GO

ALTER TABLE [dbo].[Atenciones] WITH CHECK ADD CONSTRAINT [FK_Atenciones_Reserva] FOREIGN KEY ([id_reserva]) REFERENCES [dbo].[Reservas] ([id_reserva]);
GO

ALTER TABLE [dbo].[Atenciones] WITH CHECK ADD CONSTRAINT [FK_Atenciones_Sede] FOREIGN KEY ([id_sede]) REFERENCES [dbo].[Sedes] ([id_sede]);
GO

ALTER TABLE [dbo].[Atenciones] WITH CHECK ADD CONSTRAINT [FK_Atenciones_Servicio] FOREIGN KEY ([id_servicio]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[CambiosOpcionLead] WITH CHECK ADD CONSTRAINT [FK_CambiosOpcionLead_Opcion] FOREIGN KEY ([id_opcion]) REFERENCES [dbo].[Opciones] ([id_opcion]);
GO

ALTER TABLE [dbo].[Campanas] WITH CHECK ADD CONSTRAINT [FK_Campanas_Canal] FOREIGN KEY ([id_canal]) REFERENCES [dbo].[Canales] ([id_canal]);
GO

ALTER TABLE [dbo].[Campanas] WITH CHECK ADD CONSTRAINT [FK_Campanas_Fuente] FOREIGN KEY ([id_fuente]) REFERENCES [dbo].[Fuentes] ([id_fuente]);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [FK__Captacion__id_ca__76619304] FOREIGN KEY ([id_canal]) REFERENCES [dbo].[Canales] ([id_canal]);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [FK__Captacion__id_ca__7849DB76] FOREIGN KEY ([id_campana]) REFERENCES [dbo].[Campanas] ([id_campana]);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [FK__Captacion__id_fu__7755B73D] FOREIGN KEY ([id_fuente]) REFERENCES [dbo].[Fuentes] ([id_fuente]);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [FK__Captacion__id_se__793DFFAF] FOREIGN KEY ([id_sede]) REFERENCES [dbo].[Sedes] ([id_sede]);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [FK__Captacion__id_se__7A3223E8] FOREIGN KEY ([id_servicio]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[CaptacionesBuyer] WITH CHECK ADD CONSTRAINT [FK_CaptacionesBuyer_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[DatosAcademicos] WITH CHECK ADD CONSTRAINT [FK_DatosAcademicos_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[DatosLaborales] WITH CHECK ADD CONSTRAINT [FK_DatosLaborales_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[DecisionesIA] WITH CHECK ADD CONSTRAINT [FK_DecisionesIA_CaptacionBuyer] FOREIGN KEY ([id_captacion]) REFERENCES [dbo].[CaptacionesBuyer] ([id_captacion]);
GO

ALTER TABLE [dbo].[DecisionesIA] WITH CHECK ADD CONSTRAINT [FK_DecisionesIA_InteraccionBuyer] FOREIGN KEY ([id_interaccion]) REFERENCES [dbo].[Interacciones] ([id_interaccion]);
GO

ALTER TABLE [dbo].[DecisionesIA] WITH CHECK ADD CONSTRAINT [FK_DecisionesIA_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[DecisionesIA] WITH CHECK ADD CONSTRAINT [FK_DecisionesIA_Usuario] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[Disponibilidad] WITH CHECK ADD CONSTRAINT [FK_Disponibilidad_Profesional] FOREIGN KEY ([id_profesional]) REFERENCES [dbo].[Profesionales] ([id_profesional]);
GO

ALTER TABLE [dbo].[Disponibilidad] WITH CHECK ADD CONSTRAINT [FK_Disponibilidad_Sede] FOREIGN KEY ([id_sede]) REFERENCES [dbo].[Sedes] ([id_sede]);
GO

ALTER TABLE [dbo].[EventosEtapa] WITH CHECK ADD CONSTRAINT [FK_EventosEtapa_CaptacionBuyer] FOREIGN KEY ([id_captacion]) REFERENCES [dbo].[CaptacionesBuyer] ([id_captacion]);
GO

ALTER TABLE [dbo].[EventosEtapa] WITH CHECK ADD CONSTRAINT [FK_EventosEtapa_Destino] FOREIGN KEY ([etapa_destino]) REFERENCES [dbo].[Etapas] ([id_etapa]);
GO

ALTER TABLE [dbo].[EventosEtapa] WITH CHECK ADD CONSTRAINT [FK_EventosEtapa_Origen] FOREIGN KEY ([etapa_origen]) REFERENCES [dbo].[Etapas] ([id_etapa]);
GO

ALTER TABLE [dbo].[EventosEtapa] WITH CHECK ADD CONSTRAINT [FK_EventosEtapa_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[EventosEtapa] WITH CHECK ADD CONSTRAINT [FK_EventosEtapa_SolicitudBuyer] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[EventosEtapa] WITH CHECK ADD CONSTRAINT [FK_EventosEtapa_Usuario] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[GastosCampana] WITH CHECK ADD CONSTRAINT [FK_GastosCampana_Campana] FOREIGN KEY ([id_campana]) REFERENCES [dbo].[Campanas] ([id_campana]);
GO

ALTER TABLE [dbo].[HistorialOpcionesLead] WITH CHECK ADD CONSTRAINT [FK_HistOpcionesLead_Motivo] FOREIGN KEY ([id_motivo_rechazo_lead]) REFERENCES [dbo].[MotivosRechazoLead] ([id_motivo_rechazo]);
GO

ALTER TABLE [dbo].[HistorialPropuestasLead] WITH CHECK ADD CONSTRAINT [FK_HistPropuestasLead_Motivo] FOREIGN KEY ([id_motivo_rechazo_lead]) REFERENCES [dbo].[MotivosRechazoLead] ([id_motivo_rechazo]);
GO

ALTER TABLE [dbo].[HistorialSeguimientoOperativoLead] WITH CHECK ADD CONSTRAINT [FK__Historial__id_so__725BF7F6] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[Incidencias] WITH CHECK ADD CONSTRAINT [FK_Incidencias_Atencion] FOREIGN KEY ([id_atencion]) REFERENCES [dbo].[Atenciones] ([id_atencion]);
GO

ALTER TABLE [dbo].[Incidencias] WITH CHECK ADD CONSTRAINT [FK_Incidencias_Pago] FOREIGN KEY ([id_pago]) REFERENCES [dbo].[Pagos] ([id_pago]);
GO

ALTER TABLE [dbo].[Incidencias] WITH CHECK ADD CONSTRAINT [FK_Incidencias_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[Incidencias] WITH CHECK ADD CONSTRAINT [FK_Incidencias_Reserva] FOREIGN KEY ([id_reserva]) REFERENCES [dbo].[Reservas] ([id_reserva]);
GO

ALTER TABLE [dbo].[Incidencias] WITH CHECK ADD CONSTRAINT [FK_Incidencias_Usuario] FOREIGN KEY ([id_usuario_responsable]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[Interacciones] WITH CHECK ADD CONSTRAINT [FK_Interacciones_Canal] FOREIGN KEY ([id_canal]) REFERENCES [dbo].[Canales] ([id_canal]);
GO

ALTER TABLE [dbo].[Interacciones] WITH CHECK ADD CONSTRAINT [FK_Interacciones_Fuente] FOREIGN KEY ([id_fuente]) REFERENCES [dbo].[Fuentes] ([id_fuente]);
GO

ALTER TABLE [dbo].[Interacciones] WITH CHECK ADD CONSTRAINT [FK_Interacciones_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[Interacciones] WITH CHECK ADD CONSTRAINT [FK_Interacciones_SolicitudLead] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[Interacciones] WITH CHECK ADD CONSTRAINT [FK_Interacciones_Usuario] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [FK_Opciones_Disponibilidad] FOREIGN KEY ([id_disponibilidad]) REFERENCES [dbo].[Disponibilidad] ([id_disponibilidad]);
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [FK_Opciones_MotivoLead] FOREIGN KEY ([id_motivo_rechazo_lead]) REFERENCES [dbo].[MotivosRechazoLead] ([id_motivo_rechazo]);
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [FK_Opciones_PreferenciaLead] FOREIGN KEY ([id_preferencia_lead]) REFERENCES [dbo].[PersonaPreferencias] ([id_preferencia]);
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [FK_Opciones_PropuestaLead] FOREIGN KEY ([id_propuesta_lead]) REFERENCES [dbo].[PropuestasEconomicasLead] ([id_propuesta]);
GO

ALTER TABLE [dbo].[Opciones] WITH CHECK ADD CONSTRAINT [FK_Opciones_Solicitud] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[Pagos] WITH CHECK ADD CONSTRAINT [FK_Pagos_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[Pagos] WITH CHECK ADD CONSTRAINT [FK_Pagos_Reserva] FOREIGN KEY ([id_reserva]) REFERENCES [dbo].[Reservas] ([id_reserva]);
GO

ALTER TABLE [dbo].[Pagos] WITH CHECK ADD CONSTRAINT [FK_Pagos_Usuario] FOREIGN KEY ([validado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[PersonaPreferencias] WITH CHECK ADD CONSTRAINT [FK_Preferencias_Canal] FOREIGN KEY ([id_canal]) REFERENCES [dbo].[Canales] ([id_canal]);
GO

ALTER TABLE [dbo].[PersonaPreferencias] WITH CHECK ADD CONSTRAINT [FK_Preferencias_Horario] FOREIGN KEY ([id_horario]) REFERENCES [dbo].[Horarios] ([id_horario]);
GO

ALTER TABLE [dbo].[PersonaPreferencias] WITH CHECK ADD CONSTRAINT [FK_Preferencias_Modalidad] FOREIGN KEY ([id_modalidad]) REFERENCES [dbo].[Modalidades] ([id_modalidad]);
GO

ALTER TABLE [dbo].[PersonaPreferencias] WITH CHECK ADD CONSTRAINT [FK_Preferencias_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[PersonaPreferencias] WITH CHECK ADD CONSTRAINT [FK_Preferencias_Servicio] FOREIGN KEY ([id_servicio_interes]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[Personas] WITH CHECK ADD CONSTRAINT [FK_Personas_Campana] FOREIGN KEY ([id_campana_origen]) REFERENCES [dbo].[Campanas] ([id_campana]);
GO

ALTER TABLE [dbo].[Personas] WITH CHECK ADD CONSTRAINT [FK_Personas_Canal] FOREIGN KEY ([id_canal_origen]) REFERENCES [dbo].[Canales] ([id_canal]);
GO

ALTER TABLE [dbo].[Personas] WITH CHECK ADD CONSTRAINT [FK_Personas_Etapa] FOREIGN KEY ([id_etapa_actual]) REFERENCES [dbo].[Etapas] ([id_etapa]);
GO

ALTER TABLE [dbo].[PersonaSaludOdontologica] WITH CHECK ADD CONSTRAINT [FK_PersonaSaludOdonto_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[ProfesionalServicio] WITH CHECK ADD CONSTRAINT [FK_ProfesionalServicio_Profesional] FOREIGN KEY ([id_profesional]) REFERENCES [dbo].[Profesionales] ([id_profesional]);
GO

ALTER TABLE [dbo].[ProfesionalServicio] WITH CHECK ADD CONSTRAINT [FK_ProfesionalServicio_Servicio] FOREIGN KEY ([id_servicio]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[PromocionesLead] WITH CHECK ADD CONSTRAINT [FK_PromocionesLead_Servicio] FOREIGN KEY ([id_servicio]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [FK__Propuesta__id_se__251C81ED] FOREIGN KEY ([id_sede_lead]) REFERENCES [dbo].[Sedes] ([id_sede]);
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [FK_PropuestasLead_MotivoLead] FOREIGN KEY ([id_motivo_rechazo_lead]) REFERENCES [dbo].[MotivosRechazoLead] ([id_motivo_rechazo]);
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [FK_PropuestasLead_PromocionLead] FOREIGN KEY ([id_promocion_lead]) REFERENCES [dbo].[PromocionesLead] ([id_promocion]);
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [FK_PropuestasLead_Raiz] FOREIGN KEY ([id_propuesta_raiz]) REFERENCES [dbo].[PropuestasEconomicasLead] ([id_propuesta]);
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [FK_PropuestasLead_Servicio] FOREIGN KEY ([id_servicio]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[PropuestasEconomicasLead] WITH CHECK ADD CONSTRAINT [FK_PropuestasLead_Solicitud] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[Reservas] WITH CHECK ADD CONSTRAINT [FK_Reservas_Opcion] FOREIGN KEY ([id_opcion]) REFERENCES [dbo].[Opciones] ([id_opcion]);
GO

ALTER TABLE [dbo].[Reservas] WITH CHECK ADD CONSTRAINT [FK_Reservas_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[Reservas] WITH CHECK ADD CONSTRAINT [FK_Reservas_Solicitud] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[SeguimientoOperativoLead] WITH CHECK ADD CONSTRAINT [FK__Seguimien__id_so__6CA31EA0] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[Seguimientos] WITH CHECK ADD CONSTRAINT [FK_Seguimientos_Atencion] FOREIGN KEY ([id_atencion]) REFERENCES [dbo].[Atenciones] ([id_atencion]);
GO

ALTER TABLE [dbo].[Seguimientos] WITH CHECK ADD CONSTRAINT [FK_Seguimientos_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[Seguimientos] WITH CHECK ADD CONSTRAINT [FK_Seguimientos_Usuario] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [FK_Solicitudes_CanalOrigen] FOREIGN KEY ([id_canal_origen]) REFERENCES [dbo].[Canales] ([id_canal]);
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [FK_Solicitudes_Negociador] FOREIGN KEY ([id_negociador]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [FK_Solicitudes_Persona] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [FK_Solicitudes_PropuestaAceptadaLead] FOREIGN KEY ([id_propuesta_aceptada_lead]) REFERENCES [dbo].[PropuestasEconomicasLead] ([id_propuesta]);
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [FK_Solicitudes_SedeInteresLead] FOREIGN KEY ([id_sede_interes_lead]) REFERENCES [dbo].[Sedes] ([id_sede]);
GO

ALTER TABLE [dbo].[Solicitudes] WITH CHECK ADD CONSTRAINT [FK_Solicitudes_Servicio] FOREIGN KEY ([id_servicio]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[Tarifas] WITH CHECK ADD CONSTRAINT [FK_Tarifas_Servicio] FOREIGN KEY ([id_servicio]) REFERENCES [dbo].[Servicios] ([id_servicio]);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [FK__Traspasos__id_ev__047AA831] FOREIGN KEY ([id_evento]) REFERENCES [dbo].[EventosEtapa] ([id_evento_etapa]);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [FK__Traspasos__id_op__019E3B86] FOREIGN KEY ([id_opcion]) REFERENCES [dbo].[Opciones] ([id_opcion]);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [FK__Traspasos__id_pe__00AA174D] FOREIGN KEY ([id_persona]) REFERENCES [dbo].[Personas] ([id_persona]);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [FK__Traspasos__id_pr__02925FBF] FOREIGN KEY ([id_propuesta]) REFERENCES [dbo].[PropuestasEconomicasLead] ([id_propuesta]);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [FK__Traspasos__id_re__038683F8] FOREIGN KEY ([id_reserva]) REFERENCES [dbo].[Reservas] ([id_reserva]);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [FK__Traspasos__id_so__7FB5F314] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[Solicitudes] ([id_solicitud]);
GO

ALTER TABLE [dbo].[TraspasosPayerLead] WITH CHECK ADD CONSTRAINT [FK__Traspasos__id_us__0662F0A3] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuarios] ([id_usuario]);
GO

ALTER TABLE [dbo].[Usuarios] WITH CHECK ADD CONSTRAINT [FK_Usuarios_Roles] FOREIGN KEY ([id_rol]) REFERENCES [dbo].[Roles] ([id_rol]);
GO

-- 4. MODULOS EXISTENTES APROBADOS. No se agregan nuevas funciones ni reglas.

CREATE FUNCTION dbo.fn_Lead_Alternativas_Corte(@corte_utc DATETIME2(7))
RETURNS TABLE AS RETURN
SELECT h.id_opcion,h.id_solicitud,h.fecha_ofrecida,h.id_disponibilidad,
 h.id_sede,h.id_profesional,h.fecha_disponibilidad,h.hora_inicio,h.hora_fin,
 h.pref_fecha_lead,h.pref_dia_semana_lead,h.pref_turno_lead,
 h.pref_hora_inicio_lead,h.pref_hora_fin_lead,h.ofr_turno_lead,
 h.estado_respuesta,h.fecha_respuesta,h.id_motivo_rechazo_lead,
 m.categoria AS categoria_motivo,
 CAST(CASE WHEN h.estado_respuesta='Aceptada' THEN 1 ELSE 0 END AS INT) alternativa_aceptada,
 CAST(CASE WHEN h.estado_respuesta='Rechazada' THEN 1 ELSE 0 END AS INT) alternativa_rechazada,
 CAST(CASE WHEN h.estado_respuesta='Rechazada' AND m.categoria='INCOMPATIBILIDAD' THEN 1 ELSE 0 END AS INT) alternativa_rechazada_incompatibilidad
FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY a.id_opcion
 ORDER BY a.fecha_observacion_utc DESC,a.id_historial DESC) rn
 FROM dbo.HistorialOpcionesLead a WHERE a.fecha_observacion_utc<=@corte_utc) h
LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=h.id_motivo_rechazo_lead
WHERE h.rn=1 AND h.accion<>'DELETE';
GO

CREATE FUNCTION dbo.fn_Lead_Oportunidades_Corte(@corte_utc DATETIME2(7))
RETURNS TABLE AS RETURN
SELECT h.id_solicitud,COALESCE(conversion.fecha_hora,h.fecha_ingreso_lead) AS fecha_solicitud,
 h.id_servicio,h.id_negociador,COALESCE(h.id_canal_origen,conversion.id_canal) AS id_canal_origen,
 COALESCE(conversion.id_fuente,origen.id_fuente) AS id_fuente,h.id_sede_interes_lead,h.resultado_comercial_lead,h.valor_acordado_lead,
 h.fecha_decision_comercial_lead,h.id_propuesta_aceptada_lead,
 CAST(CASE WHEN h.resultado_comercial_lead='ACEPTADA' THEN 1 ELSE 0 END AS INT) AS oportunidad_aceptada,
 CAST(CASE WHEN h.resultado_comercial_lead='CERRADA_SIN_ACUERDO' THEN 1 ELSE 0 END AS INT) AS oportunidad_cerrada_sin_acuerdo
FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY a.id_solicitud
 ORDER BY a.fecha_observacion_utc DESC,a.id_historial DESC) rn
 FROM dbo.HistorialSolicitudesLead a WHERE a.fecha_observacion_utc<=@corte_utc) h
OUTER APPLY (
 SELECT TOP (1) e.fecha_hora,c.id_canal,COALESCE(c.id_fuente,ca.id_fuente) AS id_fuente
 FROM dbo.EventosEtapa e
 JOIN dbo.CaptacionesBuyer c ON c.id_captacion=e.id_captacion
 LEFT JOIN dbo.Campanas ca ON ca.id_campana=c.id_campana
 JOIN dbo.Etapas b ON b.id_etapa=e.etapa_origen AND b.nombre='BUYER'
 JOIN dbo.Etapas l ON l.id_etapa=e.etapa_destino AND l.nombre='LEAD'
 WHERE e.id_solicitud=h.id_solicitud AND DATEADD(MINUTE,-DATEPART(TZOFFSET,SYSDATETIMEOFFSET()),e.fecha_hora)<=@corte_utc
 ORDER BY e.fecha_hora,e.id_evento_etapa
) conversion
OUTER APPLY (
 SELECT TOP (1) i.id_fuente FROM dbo.Interacciones i
 WHERE i.id_solicitud=h.id_solicitud AND i.id_fuente IS NOT NULL
   AND DATEADD(MINUTE,-DATEPART(TZOFFSET,SYSDATETIMEOFFSET()),i.fecha_hora)<=@corte_utc
 ORDER BY i.fecha_hora,i.id_interaccion
) origen
WHERE h.rn=1 AND h.accion<>'DELETE' AND COALESCE(conversion.fecha_hora,h.fecha_ingreso_lead) IS NOT NULL;
GO

CREATE FUNCTION dbo.fn_Lead_Propuestas_Corte(@corte_utc DATETIME2(7))
RETURNS TABLE AS RETURN
SELECT v.id_propuesta_logica,v.id_propuesta AS id_version_vigente,
 v.id_solicitud,v.id_servicio,v.id_sede_lead,v.fecha_presentacion_raiz AS fecha_presentacion,
 v.precio_cotizado,v.id_promocion_lead,v.promocion_aplicada,
 v.estado,v.fecha_decision,v.id_motivo_rechazo_lead,m.categoria AS categoria_motivo,
 CAST(CASE WHEN v.estado='Aceptada' THEN 1 ELSE 0 END AS INT) propuesta_aceptada,
 CAST(CASE WHEN v.estado='Rechazada' THEN 1 ELSE 0 END AS INT) propuesta_rechazada,
 CAST(CASE WHEN v.estado='Rechazada' AND m.categoria='ECONOMICO' THEN 1 ELSE 0 END AS INT) propuesta_rechazada_economica
FROM (
 SELECT z.*,
  MAX(CASE WHEN z.id_propuesta_raiz IS NULL THEN z.fecha_presentacion END)
    OVER(PARTITION BY z.id_propuesta_logica) AS fecha_presentacion_raiz,
  ROW_NUMBER() OVER(PARTITION BY z.id_propuesta_logica
    ORDER BY z.numero_version DESC,z.id_propuesta DESC) AS numero_orden
 FROM (
  SELECT h.*,COALESCE(h.id_propuesta_raiz,h.id_propuesta) AS id_propuesta_logica
  FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY a.id_propuesta
        ORDER BY a.fecha_observacion_utc DESC,a.id_historial DESC) AS rn
    FROM dbo.HistorialPropuestasLead a WHERE a.fecha_observacion_utc<=@corte_utc) h
  WHERE h.rn=1 AND h.accion<>'DELETE'
 ) z
) v
LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=v.id_motivo_rechazo_lead
WHERE v.numero_orden=1 AND v.fecha_presentacion_raiz IS NOT NULL;
GO

CREATE TRIGGER dbo.trg_Lead_Disponibilidad_InmutableOfertada
ON dbo.Disponibilidad AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id_disponibilidad=i.id_disponibilidad
  WHERE (i.fecha<>d.fecha OR i.hora_inicio<>d.hora_inicio OR i.hora_fin<>d.hora_fin
    OR i.id_sede<>d.id_sede OR i.id_profesional<>d.id_profesional)
  AND EXISTS(SELECT 1 FROM dbo.Opciones o WHERE o.id_disponibilidad=i.id_disponibilidad))
  THROW 54141,'No cambiar fecha/hora/sede/profesional de disponibilidad ya ofertada.',1;
END;
GO

CREATE TRIGGER dbo.trg_Lead_Interacciones_Solicitud
ON dbo.Interacciones AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud
   WHERE i.id_persona<>s.id_persona)
  THROW 54151,'Interaccion vinculada a solicitud de otra persona.',1;
END;
GO

CREATE TRIGGER dbo.trg_Lead_Motivos_ClasificacionInmutable
ON dbo.MotivosRechazoLead AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id_motivo_rechazo=i.id_motivo_rechazo
   WHERE (i.ambito<>d.ambito OR i.categoria<>d.categoria) AND
    (EXISTS(SELECT 1 FROM dbo.HistorialPropuestasLead hp WHERE hp.id_motivo_rechazo_lead=i.id_motivo_rechazo)
     OR EXISTS(SELECT 1 FROM dbo.HistorialOpcionesLead ho WHERE ho.id_motivo_rechazo_lead=i.id_motivo_rechazo)
     OR EXISTS(SELECT 1 FROM dbo.PropuestasEconomicasLead p WHERE p.id_motivo_rechazo_lead=i.id_motivo_rechazo)
     OR EXISTS(SELECT 1 FROM dbo.Opciones o WHERE o.id_motivo_rechazo_lead=i.id_motivo_rechazo)))
  THROW 54161,'No reclasificar motivos ya utilizados: alteraria KPI historicos.',1;
END;
GO

CREATE TRIGGER dbo.trg_Lead_Opciones_ValidarAuditar
ON dbo.Opciones AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_opcion=i.id_opcion
  WHERE i.id_solicitud<>d.id_solicitud)
  THROW 54136,'La alternativa no puede reasignarse a otra solicitud.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.PropuestasEconomicasLead p ON p.id_propuesta=i.id_propuesta_lead
  WHERE p.id_solicitud<>i.id_solicitud)
  THROW 54131,'La propuesta no corresponde a la solicitud de la alternativa.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.PersonaPreferencias pp ON pp.id_preferencia=i.id_preferencia_lead
  JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud WHERE pp.id_persona<>s.id_persona)
  THROW 54132,'La preferencia es de otra persona.',1;
 IF EXISTS (SELECT 1 FROM inserted i LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=i.id_motivo_rechazo_lead
  WHERE i.estado_respuesta='Rechazada' AND
   (m.id_motivo_rechazo IS NULL OR m.ambito<>'ALTERNATIVA' OR
    i.fecha_respuesta IS NULL OR i.fecha_respuesta<i.fecha_ofrecida))
  THROW 54133,'Alternativa rechazada requiere fecha y motivo tipificado de ALTERNATIVA.',1;
 IF EXISTS (SELECT 1 FROM inserted i WHERE
    (i.estado_respuesta='Pendiente' AND (i.fecha_respuesta IS NOT NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado_respuesta='Aceptada' AND (i.fecha_respuesta IS NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado_respuesta IS NOT NULL AND i.estado_respuesta NOT IN ('Pendiente','Aceptada','Rechazada'))
 OR (i.seleccionada=1 AND i.estado_respuesta='Rechazada')
 OR (i.fecha_respuesta IS NOT NULL AND i.fecha_respuesta<i.fecha_ofrecida))
  THROW 54134,'Estado de respuesta, seleccion, fecha o motivo de alternativa inconsistentes.',1;
 -- Evitar alterar alternativas que ya tienen reserva, incluso si esta cancelada.
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_opcion=i.id_opcion
  WHERE (i.id_disponibilidad<>d.id_disponibilidad OR i.precio_ofrecido<>d.precio_ofrecido
   OR ISNULL(i.id_preferencia_lead,0)<>ISNULL(d.id_preferencia_lead,0)
   OR ISNULL(i.pref_fecha_lead,'19000101')<>ISNULL(d.pref_fecha_lead,'19000101')
   OR ISNULL(i.pref_dia_semana_lead,0)<>ISNULL(d.pref_dia_semana_lead,0)
   OR ISNULL(i.pref_turno_lead,'')<>ISNULL(d.pref_turno_lead,'')
   OR ISNULL(i.pref_hora_inicio_lead,'00:00')<>ISNULL(d.pref_hora_inicio_lead,'00:00')
   OR ISNULL(i.pref_hora_fin_lead,'00:00')<>ISNULL(d.pref_hora_fin_lead,'00:00')
   OR ISNULL(i.ofr_turno_lead,'')<>ISNULL(d.ofr_turno_lead,''))
   AND EXISTS (SELECT 1 FROM dbo.Reservas r WHERE r.id_opcion=i.id_opcion))
  THROW 54135,'No editar alternativa despues de reservar: usar flujo de reprogramacion.',1;
 -- Un UPDATE comercial cuenta UN cambio, aun si cambia mas de un atributo.
 INSERT dbo.CambiosOpcionLead(id_opcion,campo_modificado,motivo_cambio,tipo_motivo,
  valor_anterior,valor_nuevo,es_pre_reserva_lead,fecha_registro_utc_lead)
 SELECT i.id_opcion,'CAMBIO_COMERCIAL','Modificacion detectada; causa no declarada por backend','Otro',
  CONCAT('slot=',d.id_disponibilidad,';precio=',d.precio_ofrecido),
  CONCAT('slot=',i.id_disponibilidad,';precio=',i.precio_ofrecido),1,SYSUTCDATETIME()
 FROM inserted i JOIN deleted d ON d.id_opcion=i.id_opcion
 WHERE i.id_disponibilidad<>d.id_disponibilidad OR i.precio_ofrecido<>d.precio_ofrecido
   OR ISNULL(i.id_preferencia_lead,0)<>ISNULL(d.id_preferencia_lead,0)
   OR ISNULL(i.pref_fecha_lead,'19000101')<>ISNULL(d.pref_fecha_lead,'19000101')
   OR ISNULL(i.pref_dia_semana_lead,0)<>ISNULL(d.pref_dia_semana_lead,0)
   OR ISNULL(i.pref_turno_lead,'')<>ISNULL(d.pref_turno_lead,'')
   OR ISNULL(i.pref_hora_inicio_lead,'00:00')<>ISNULL(d.pref_hora_inicio_lead,'00:00')
   OR ISNULL(i.pref_hora_fin_lead,'00:00')<>ISNULL(d.pref_hora_fin_lead,'00:00')
   OR ISNULL(i.ofr_turno_lead,'')<>ISNULL(d.ofr_turno_lead,'');
 INSERT dbo.HistorialOpcionesLead
 (id_opcion,accion,id_solicitud,id_disponibilidad,id_sede,id_profesional,fecha_disponibilidad,
  hora_inicio,hora_fin,fecha_ofrecida,precio_ofrecido,id_propuesta_lead,id_preferencia_lead,
  pref_fecha_lead,pref_dia_semana_lead,pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,
  ofr_turno_lead,estado_respuesta,fecha_respuesta,id_motivo_rechazo_lead)
 SELECT i.id_opcion,CASE WHEN d.id_opcion IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
  i.id_solicitud,i.id_disponibilidad,v.id_sede,v.id_profesional,v.fecha,v.hora_inicio,v.hora_fin,
  i.fecha_ofrecida,i.precio_ofrecido,i.id_propuesta_lead,i.id_preferencia_lead,
  i.pref_fecha_lead,i.pref_dia_semana_lead,i.pref_turno_lead,i.pref_hora_inicio_lead,i.pref_hora_fin_lead,
  i.ofr_turno_lead,i.estado_respuesta,i.fecha_respuesta,i.id_motivo_rechazo_lead
 FROM inserted i LEFT JOIN deleted d ON d.id_opcion=i.id_opcion
 JOIN dbo.Disponibilidad v ON v.id_disponibilidad=i.id_disponibilidad;
 INSERT dbo.HistorialOpcionesLead
 (id_opcion,accion,id_solicitud,id_disponibilidad,id_sede,id_profesional,fecha_disponibilidad,
  hora_inicio,hora_fin,fecha_ofrecida,precio_ofrecido,id_propuesta_lead,id_preferencia_lead,
  pref_fecha_lead,pref_dia_semana_lead,pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,
  ofr_turno_lead,estado_respuesta,fecha_respuesta,id_motivo_rechazo_lead)
 SELECT d.id_opcion,'DELETE',d.id_solicitud,d.id_disponibilidad,v.id_sede,v.id_profesional,v.fecha,v.hora_inicio,v.hora_fin,
  d.fecha_ofrecida,d.precio_ofrecido,d.id_propuesta_lead,d.id_preferencia_lead,d.pref_fecha_lead,d.pref_dia_semana_lead,
  d.pref_turno_lead,d.pref_hora_inicio_lead,d.pref_hora_fin_lead,d.ofr_turno_lead,d.estado_respuesta,
  d.fecha_respuesta,d.id_motivo_rechazo_lead
 FROM deleted d LEFT JOIN inserted i ON i.id_opcion=d.id_opcion
 JOIN dbo.Disponibilidad v ON v.id_disponibilidad=d.id_disponibilidad
 WHERE i.id_opcion IS NULL;
END;
GO

CREATE TRIGGER dbo.trg_Lead_Propuestas_ValidarAuditar
ON dbo.PropuestasEconomicasLead AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 -- Mantener inmutables identidad, raiz, numero de version y solicitud en una edicion.
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_propuesta=i.id_propuesta
  WHERE i.id_solicitud<>d.id_solicitud OR i.id_servicio<>d.id_servicio OR
        i.numero_version<>d.numero_version OR i.fecha_presentacion<>d.fecha_presentacion OR
        ISNULL(i.id_propuesta_raiz,0)<>ISNULL(d.id_propuesta_raiz,0))
  THROW 54120,'No se puede cambiar identidad/raiz/solicitud de una version existente.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_propuesta=i.id_propuesta
  WHERE i.precio_cotizado<>d.precio_cotizado OR
     ISNULL(i.id_promocion_lead,0)<>ISNULL(d.id_promocion_lead,0) OR
     ISNULL(i.promocion_aplicada,'')<>ISNULL(d.promocion_aplicada,''))
  THROW 54130,'Para cambiar precio/promocion crear nueva version, no modificar version existente.',1;

 IF EXISTS (SELECT 1 FROM inserted i
  LEFT JOIN dbo.PropuestasEconomicasLead r ON r.id_propuesta=i.id_propuesta_raiz
  WHERE i.id_propuesta_raiz IS NOT NULL AND
    (r.id_propuesta IS NULL OR r.id_propuesta_raiz IS NOT NULL OR
     r.id_solicitud<>i.id_solicitud OR r.id_servicio<>i.id_servicio OR
     r.numero_version<>1 OR r.id_propuesta=i.id_propuesta))
  THROW 54121,'Version de propuesta con raiz invalida o de otra solicitud/tratamiento.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud
  WHERE s.id_servicio IS NOT NULL AND s.id_servicio<>i.id_servicio)
  THROW 54127,'Tratamiento de propuesta incompatible con solicitud.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.PromocionesLead pr ON pr.id_promocion=i.id_promocion_lead
  WHERE pr.id_servicio IS NOT NULL AND pr.id_servicio<>i.id_servicio)
  THROW 54128,'Promocion no corresponde al tratamiento de la propuesta.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.Solicitudes s ON s.id_propuesta_aceptada_lead=i.id_propuesta
  WHERE s.resultado_comercial_lead='ACEPTADA' AND
     (i.estado<>'Aceptada' OR i.precio_cotizado<>s.valor_acordado_lead))
  THROW 54129,'No invalidar una propuesta ligada a un acuerdo aceptado.',1;
 IF EXISTS (SELECT 1 FROM inserted i
  LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=i.id_motivo_rechazo_lead
  WHERE i.estado='Rechazada' AND (m.id_motivo_rechazo IS NULL OR m.ambito<>'PROPUESTA'
          OR i.fecha_decision IS NULL OR i.fecha_decision<i.fecha_presentacion))
  THROW 54122,'Rechazo de propuesta requiere fecha y motivo tipificado de PROPUESTA.',1;
 IF EXISTS (SELECT 1 FROM inserted i WHERE
    (i.estado='Pendiente' AND (i.fecha_decision IS NOT NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado='Aceptada' AND (i.fecha_decision IS NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado NOT IN ('Pendiente','Aceptada','Rechazada'))
 OR (i.fecha_decision IS NOT NULL AND i.fecha_decision<i.fecha_presentacion))
  THROW 54123,'Estado, fecha de decision y motivo de propuesta inconsistentes.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=i.id_motivo_rechazo_lead
   WHERE m.ambito<>'PROPUESTA') THROW 54124,'Motivo no corresponde a una propuesta.',1;
 -- Una version posterior requiere una version anterior REAL (sin saltos).
 IF EXISTS (SELECT 1 FROM inserted i WHERE i.id_propuesta_raiz IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.PropuestasEconomicasLead p
   WHERE p.numero_version=i.numero_version-1 AND
    (p.id_propuesta_raiz=i.id_propuesta_raiz OR
     (i.numero_version=2 AND p.id_propuesta=i.id_propuesta_raiz AND p.id_propuesta_raiz IS NULL))))
  THROW 54125,'No se admite saltar numeros de version ni raiz inexistente.',1;
 -- No crear nuevas versiones sobre una propuesta ya vinculada a acuerdo final.
 IF EXISTS (SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id_propuesta=i.id_propuesta
  JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud
  WHERE d.id_propuesta IS NULL AND i.id_propuesta_raiz IS NOT NULL
        AND s.resultado_comercial_lead='ACEPTADA')
  THROW 54126,'No crear otra version despues del acuerdo comercial definitivo.',1;
 INSERT dbo.HistorialPropuestasLead
 (id_propuesta,accion,id_propuesta_raiz,numero_version,id_solicitud,id_servicio,
  fecha_presentacion,precio_cotizado,id_promocion_lead,promocion_aplicada,estado,fecha_decision,id_motivo_rechazo_lead,id_sede_lead)
 SELECT i.id_propuesta,CASE WHEN d.id_propuesta IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
  i.id_propuesta_raiz,i.numero_version,i.id_solicitud,i.id_servicio,i.fecha_presentacion,
  i.precio_cotizado,i.id_promocion_lead,i.promocion_aplicada,i.estado,i.fecha_decision,i.id_motivo_rechazo_lead,i.id_sede_lead
 FROM inserted i LEFT JOIN deleted d ON d.id_propuesta=i.id_propuesta;
 INSERT dbo.HistorialPropuestasLead
 (id_propuesta,accion,id_propuesta_raiz,numero_version,id_solicitud,id_servicio,
  fecha_presentacion,precio_cotizado,id_promocion_lead,promocion_aplicada,estado,fecha_decision,id_motivo_rechazo_lead,id_sede_lead)
 SELECT d.id_propuesta,'DELETE',d.id_propuesta_raiz,d.numero_version,d.id_solicitud,d.id_servicio,d.fecha_presentacion,
  d.precio_cotizado,d.id_promocion_lead,d.promocion_aplicada,d.estado,d.fecha_decision,d.id_motivo_rechazo_lead,d.id_sede_lead
 FROM deleted d LEFT JOIN inserted i ON i.id_propuesta=d.id_propuesta WHERE i.id_propuesta IS NULL;
END;
GO

CREATE TRIGGER dbo.trg_Lead_Solicitudes_Auditar
ON dbo.Solicitudes AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 -- Un acuerdo comercial solo puede usar una propuesta aceptada de la MISMA solicitud,
 -- sin deducirlo de reservas ni pagos. Comparar precio exactamente a 2 decimales.
 IF EXISTS(
  SELECT 1 FROM inserted i
  LEFT JOIN dbo.PropuestasEconomicasLead p ON p.id_propuesta=i.id_propuesta_aceptada_lead
  WHERE i.resultado_comercial_lead='ACEPTADA' AND
   (p.id_propuesta IS NULL OR p.id_solicitud<>i.id_solicitud OR
    p.estado<>'Aceptada' OR p.precio_cotizado<>i.valor_acordado_lead OR
    (i.id_servicio IS NOT NULL AND i.id_servicio<>p.id_servicio))
 ) THROW 54111,'Acuerdo sin propuesta aceptada consistente de la misma solicitud y precio.',1;
 INSERT dbo.HistorialSolicitudesLead
 (id_solicitud,accion,fecha_solicitud,id_servicio,id_negociador,id_canal_origen,id_sede_interes_lead,
  resultado_comercial_lead,fecha_decision_comercial_lead,valor_acordado_lead,id_propuesta_aceptada_lead,fecha_ingreso_lead)
 SELECT i.id_solicitud,CASE WHEN d.id_solicitud IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
  i.fecha_solicitud,i.id_servicio,i.id_negociador,i.id_canal_origen,i.id_sede_interes_lead,
  i.resultado_comercial_lead,i.fecha_decision_comercial_lead,i.valor_acordado_lead,i.id_propuesta_aceptada_lead,i.fecha_ingreso_lead
 FROM inserted i LEFT JOIN deleted d ON d.id_solicitud=i.id_solicitud;
 INSERT dbo.HistorialSolicitudesLead
 (id_solicitud,accion,fecha_solicitud,id_servicio,id_negociador,id_canal_origen,id_sede_interes_lead,
  resultado_comercial_lead,fecha_decision_comercial_lead,valor_acordado_lead,id_propuesta_aceptada_lead,fecha_ingreso_lead)
 SELECT d.id_solicitud,'DELETE',d.fecha_solicitud,d.id_servicio,d.id_negociador,d.id_canal_origen,d.id_sede_interes_lead,
  d.resultado_comercial_lead,d.fecha_decision_comercial_lead,d.valor_acordado_lead,d.id_propuesta_aceptada_lead,d.fecha_ingreso_lead
 FROM deleted d LEFT JOIN inserted i ON i.id_solicitud=d.id_solicitud WHERE i.id_solicitud IS NULL;
END;
GO

CREATE TRIGGER dbo.trg_Lead_VigenciaPropuestas_Auditar
ON dbo.PropuestasEconomicasLead AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  -- Una cotización ya emitida conserva su vencimiento; para cambiarlo se crea versión.
  IF EXISTS (
    SELECT 1 FROM inserted i
    JOIN deleted d ON d.id_propuesta=i.id_propuesta
    WHERE ISNULL(i.fecha_vigencia_hasta_utc_lead, CONVERT(datetime2(3),'19000101'))
       <> ISNULL(d.fecha_vigencia_hasta_utc_lead, CONVERT(datetime2(3),'19000101'))
  )
    THROW 54201,'No se puede cambiar el vencimiento de una versión existente; crea una nueva versión.',1;

  IF EXISTS (SELECT 1 FROM inserted WHERE fecha_vigencia_hasta_utc_lead IS NOT NULL
             AND fecha_vigencia_hasta_utc_lead<=SYSUTCDATETIME())
    THROW 54202,'La vigencia de una propuesta nueva debe estar en el futuro UTC.',1;

  INSERT dbo.HistorialVigenciaPropuestasLead
    (id_propuesta,accion,fecha_vigencia_hasta_utc_lead)
  SELECT i.id_propuesta,CASE WHEN d.id_propuesta IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
         i.fecha_vigencia_hasta_utc_lead
  FROM inserted i LEFT JOIN deleted d ON d.id_propuesta=i.id_propuesta;

  INSERT dbo.HistorialVigenciaPropuestasLead
    (id_propuesta,accion,fecha_vigencia_hasta_utc_lead)
  SELECT d.id_propuesta,'DELETE',d.fecha_vigencia_hasta_utc_lead
  FROM deleted d LEFT JOIN inserted i ON i.id_propuesta=d.id_propuesta
  WHERE i.id_propuesta IS NULL;
END;
GO

CREATE PROCEDURE dbo.usp_Lead_PresentarAlternativa
 @id_solicitud INT,@id_disponibilidad INT,@precio_ofrecido DECIMAL(10,2),
 @id_propuesta_lead INT=NULL,@id_preferencia_lead INT=NULL,
 @pref_fecha DATE=NULL,@pref_dia TINYINT=NULL,@pref_turno VARCHAR(30)=NULL,
 @pref_hora_inicio TIME=NULL,@pref_hora_fin TIME=NULL,@ofr_turno VARCHAR(30),
 @id_opcion INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @ofr_turno IS NULL OR LEN(LTRIM(RTRIM(@ofr_turno)))=0
  THROW 54301,'Indicar turno ofrecido; la clasificacion no se adivina por la hora.',1;
 IF @precio_ofrecido<0 THROW 54302,'Precio negativo.',1;
 IF @pref_dia IS NOT NULL AND @pref_dia NOT BETWEEN 1 AND 7
  THROW 54303,'Dia preferido fuera del rango 1..7.',1;
 IF (@pref_hora_inicio IS NULL AND @pref_hora_fin IS NOT NULL)
  OR (@pref_hora_inicio IS NOT NULL AND @pref_hora_fin IS NULL)
  OR (@pref_hora_inicio IS NOT NULL AND @pref_hora_inicio>=@pref_hora_fin)
  THROW 54304,'Intervalo preferido incompleto o invalido.',1;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @persona INT,@servicio INT,@id_horario INT,@dia_horario TINYINT,@hora_ini TIME,@hora_fin TIME;
 SELECT @persona=id_persona,@servicio=id_servicio FROM dbo.Solicitudes WITH (HOLDLOCK)
 WHERE id_solicitud=@id_solicitud;
 IF @persona IS NULL THROW 54305,'Solicitud inexistente.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Disponibilidad d WHERE d.id_disponibilidad=@id_disponibilidad AND d.estado='Disponible'
    AND d.fecha>=CAST(SYSDATETIME() AS DATE))
  THROW 54306,'Disponibilidad no vigente o no disponible.',1;
 IF @id_preferencia_lead IS NOT NULL
 BEGIN
  SELECT @id_horario=pp.id_horario FROM dbo.PersonaPreferencias pp
  WHERE pp.id_preferencia=@id_preferencia_lead AND pp.id_persona=@persona;
  IF @@ROWCOUNT<>1 THROW 54307,'Preferencia no pertenece al paciente.',1;
  SELECT @dia_horario=dia_semana,@hora_ini=hora_inicio,@hora_fin=hora_fin
  FROM dbo.Horarios WHERE id_horario=@id_horario;
 END;
 SET @pref_dia=COALESCE(@pref_dia,@dia_horario,
  CAST(CASE WHEN @pref_fecha IS NULL THEN NULL ELSE
    ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),@pref_fecha)%7+7)%7)+1 END AS TINYINT));
 SET @pref_hora_inicio=COALESCE(@pref_hora_inicio,@hora_ini);
 SET @pref_hora_fin=COALESCE(@pref_hora_fin,@hora_fin);
 IF @pref_fecha IS NOT NULL AND @pref_dia IS NOT NULL AND
   ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),@pref_fecha)%7+7)%7)+1<>@pref_dia
  THROW 54308,'La fecha preferida no coincide con el dia de semana.',1;
 IF @id_propuesta_lead IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM dbo.PropuestasEconomicasLead p
   WHERE p.id_propuesta=@id_propuesta_lead AND p.id_solicitud=@id_solicitud
     AND p.precio_cotizado=@precio_ofrecido)
  THROW 54309,'La propuesta y su precio no corresponden a esta solicitud.',1;
 INSERT dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,
  seleccionada,estado_respuesta,id_propuesta_lead,id_preferencia_lead,pref_fecha_lead,
  pref_dia_semana_lead,pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,ofr_turno_lead)
 VALUES(@id_solicitud,@id_disponibilidad,@precio_ofrecido,SYSDATETIME(),0,'Pendiente',
  @id_propuesta_lead,@id_preferencia_lead,@pref_fecha,@pref_dia,@pref_turno,
  @pref_hora_inicio,@pref_hora_fin,@ofr_turno);
 SET @id_opcion=CONVERT(INT,SCOPE_IDENTITY());
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
END;
GO

CREATE VIEW dbo.v_DatosCaptacionBuyer AS
SELECT c.id_captacion,c.id_persona,c.fecha_captacion,c.id_canal,COALESCE(c.id_fuente,ca.id_fuente) AS id_fuente,
       c.id_campana,c.id_sede,c.id_servicio,c.estado_calidad,c.autoriza_contacto,
       c.origen_datos,ev.id_evento_etapa AS id_evento_conversion,
       ev.fecha_hora AS fecha_conversion,
       contacto_registrado=1,
       contacto_utilizable=CASE WHEN c.estado_calidad='Valido' AND c.autoriza_contacto=1
           AND NULLIF(LTRIM(RTRIM(p.nombres)),'') IS NOT NULL
           AND NULLIF(LTRIM(RTRIM(p.apellidos)),'') IS NOT NULL
           AND (NULLIF(LTRIM(RTRIM(p.numero)),'') IS NOT NULL
                OR NULLIF(LTRIM(RTRIM(p.email)),'') IS NOT NULL)
           THEN 1 ELSE 0 END
FROM dbo.CaptacionesBuyer c
JOIN dbo.Personas p ON p.id_persona=c.id_persona
LEFT JOIN dbo.Campanas ca ON ca.id_campana=c.id_campana
OUTER APPLY (
    SELECT TOP (1) e.id_evento_etapa,e.fecha_hora
    FROM dbo.EventosEtapa e
    JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen AND eo.nombre='BUYER'
    JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino AND ed.nombre='LEAD'
    WHERE e.id_persona=c.id_persona AND e.fecha_hora>=c.fecha_captacion
      AND (e.id_captacion=c.id_captacion OR e.id_captacion IS NULL)
    ORDER BY e.fecha_hora,e.id_evento_etapa
) ev;
GO

-- Vista heredada instalada, conservada por compatibilidad; no usada por el ETL LEAD.

CREATE VIEW dbo.v_DatosDimTiempo AS
SELECT DISTINCT
    Anio = YEAR(p.fecha_registro),
    SEMESTRE = DATENAME(YY, p.fecha_registro) + '-S' + IIF(DATEPART(qq, p.fecha_registro) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, p.fecha_registro) + '-T' + CAST(DATEPART(qq, p.fecha_registro) AS VARCHAR(2)),
    MES = DATENAME(MM, p.fecha_registro),
    DiaSemana = DATENAME(dw, p.fecha_registro),
    Dia = DAY(p.fecha_registro),
    idfecha = CAST(p.fecha_registro AS DATE)
FROM dbo.Personas p
WHERE p.fecha_registro IS NOT NULL
UNION
SELECT DISTINCT
    Anio = YEAR(s.fecha_solicitud),
    SEMESTRE = DATENAME(YY, s.fecha_solicitud) + '-S' + IIF(DATEPART(qq, s.fecha_solicitud) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, s.fecha_solicitud) + '-T' + CAST(DATEPART(qq, s.fecha_solicitud) AS VARCHAR(2)),
    MES = DATENAME(MM, s.fecha_solicitud),
    DiaSemana = DATENAME(dw, s.fecha_solicitud),
    Dia = DAY(s.fecha_solicitud),
    idfecha = CAST(s.fecha_solicitud AS DATE)
FROM dbo.Solicitudes s
WHERE s.fecha_solicitud IS NOT NULL
UNION
SELECT DISTINCT
    Anio = YEAR(r.fecha_reserva),
    SEMESTRE = DATENAME(YY, r.fecha_reserva) + '-S' + IIF(DATEPART(qq, r.fecha_reserva) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, r.fecha_reserva) + '-T' + CAST(DATEPART(qq, r.fecha_reserva) AS VARCHAR(2)),
    MES = DATENAME(MM, r.fecha_reserva),
    DiaSemana = DATENAME(dw, r.fecha_reserva),
    Dia = DAY(r.fecha_reserva),
    idfecha = CAST(r.fecha_reserva AS DATE)
FROM dbo.Reservas r
WHERE r.fecha_reserva IS NOT NULL
UNION
SELECT DISTINCT
    Anio = YEAR(pg.fecha_registro),
    SEMESTRE = DATENAME(YY, pg.fecha_registro) + '-S' + IIF(DATEPART(qq, pg.fecha_registro) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, pg.fecha_registro) + '-T' + CAST(DATEPART(qq, pg.fecha_registro) AS VARCHAR(2)),
    MES = DATENAME(MM, pg.fecha_registro),
    DiaSemana = DATENAME(dw, pg.fecha_registro),
    Dia = DAY(pg.fecha_registro),
    idfecha = CAST(pg.fecha_registro AS DATE)
FROM dbo.Pagos pg
WHERE pg.fecha_registro IS NOT NULL
UNION
SELECT DISTINCT
    Anio = YEAR(a.fecha_atencion),
    SEMESTRE = DATENAME(YY, a.fecha_atencion) + '-S' + IIF(DATEPART(qq, a.fecha_atencion) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, a.fecha_atencion) + '-T' + CAST(DATEPART(qq, a.fecha_atencion) AS VARCHAR(2)),
    MES = DATENAME(MM, a.fecha_atencion),
    DiaSemana = DATENAME(dw, a.fecha_atencion),
    Dia = DAY(a.fecha_atencion),
    idfecha = CAST(a.fecha_atencion AS DATE)
FROM dbo.Atenciones a
WHERE a.fecha_atencion IS NOT NULL
UNION
SELECT DISTINCT
    Anio = YEAR(seg.fecha_hora),
    SEMESTRE = DATENAME(YY, seg.fecha_hora) + '-S' + IIF(DATEPART(qq, seg.fecha_hora) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, seg.fecha_hora) + '-T' + CAST(DATEPART(qq, seg.fecha_hora) AS VARCHAR(2)),
    MES = DATENAME(MM, seg.fecha_hora),
    DiaSemana = DATENAME(dw, seg.fecha_hora),
    Dia = DAY(seg.fecha_hora),
    idfecha = CAST(seg.fecha_hora AS DATE)
FROM dbo.Seguimientos seg
WHERE seg.fecha_hora IS NOT NULL;
GO

CREATE PROCEDURE dbo.usp_ConvertirBuyerALead
    @id_captacion INT,
    @id_servicio INT,
    @motivo NVARCHAR(200),
    @id_usuario INT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @persona INT,@buyer INT,@lead INT,@actual INT,@solicitud INT,
                @evento INT,@fecha DATETIME2=SYSDATETIME(),@captacion DATETIME2;
        SELECT @persona=c.id_persona,@captacion=c.fecha_captacion
        FROM dbo.CaptacionesBuyer c WITH (UPDLOCK,HOLDLOCK)
        WHERE c.id_captacion=@id_captacion;
        IF @persona IS NULL THROW 51001,'Captacion inexistente.',1;
        IF @captacion>@fecha THROW 51008,'La captacion tiene fecha futura.',1;
        SELECT @buyer=id_etapa FROM dbo.Etapas WHERE nombre='BUYER';
        SELECT @lead=id_etapa FROM dbo.Etapas WHERE nombre='LEAD';
        IF @buyer IS NULL OR @lead IS NULL THROW 51002,'Faltan etapas BUYER/LEAD.',1;
        SELECT TOP (1) @evento=id_evento_etapa,@solicitud=id_solicitud
        FROM dbo.EventosEtapa WHERE id_persona=@persona
          AND etapa_origen=@buyer AND etapa_destino=@lead
          AND fecha_hora>=@captacion AND fecha_hora<=@fecha
          AND (id_captacion=@id_captacion OR id_captacion IS NULL)
        ORDER BY fecha_hora,id_evento_etapa;
        IF @evento IS NOT NULL
        BEGIN
            COMMIT;
            SELECT @evento AS id_evento_etapa,@solicitud AS id_solicitud,1 AS ya_convertido;
            RETURN;
        END;
        SELECT @actual=id_etapa_actual FROM dbo.Personas WITH (UPDLOCK,HOLDLOCK)
        WHERE id_persona=@persona;
        IF @actual<>@buyer THROW 51003,'La persona no esta en BUYER; no retroceder fases.',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.v_DatosCaptacionBuyer
                       WHERE id_captacion=@id_captacion AND contacto_utilizable=1)
            THROW 51004,'Captacion sin datos minimos o autorizacion verificable.',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Personas WHERE id_persona=@persona
                       AND autoriza_contacto=1 AND estado_calidad='Valido')
            THROW 51005,'Autorizacion revocada o calidad actual no valida.',1;
        IF NULLIF(LTRIM(RTRIM(@motivo)),'') IS NULL
            THROW 51006,'Se requiere motivo de intencion concreta.',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Servicios WHERE id_servicio=@id_servicio AND activo=1)
            THROW 51007,'Servicio no valido.',1;
        INSERT dbo.Solicitudes (id_persona,id_servicio,motivo,estado,fecha_solicitud)
        VALUES (@persona,@id_servicio,@motivo,'Abierta',@fecha);
        SET @solicitud=SCOPE_IDENTITY();
        INSERT dbo.EventosEtapa
            (id_persona,etapa_origen,etapa_destino,fecha_hora,id_usuario,motivo,evidencia,
             id_captacion,id_solicitud,clave_operacion_buyer)
        VALUES (@persona,@buyer,@lead,@fecha,@id_usuario,@motivo,
                'Conversion validada desde captacion inicial',@id_captacion,@solicitud,
                'BUYER_LEAD:'+CAST(@id_captacion AS VARCHAR(20)));
        SET @evento=SCOPE_IDENTITY();
        UPDATE dbo.Personas SET id_etapa_actual=@lead,fecha_actualizacion=@fecha
        WHERE id_persona=@persona;
        COMMIT;
        SELECT @evento AS id_evento_etapa,@solicitud AS id_solicitud,0 AS ya_convertido;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

CREATE PROCEDURE dbo.usp_Lead_ReporteR1
 @periodo_inicio DATE,@periodo_fin_exclusivo DATE,
 @corte_utc DATETIME2(7)=NULL,@id_servicio INT=NULL,@id_canal INT=NULL,
 @id_sede INT=NULL,@id_negociador INT=NULL,@id_fuente INT=NULL,@desglosar_canal BIT=0
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @c DATETIME2(7)=COALESCE(@corte_utc,SYSUTCDATETIME());
 IF @periodo_inicio>=@periodo_fin_exclusivo THROW 54211,'Periodo invalido.',1;
 IF @c<(SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2')
  THROW 54212,'No existe auditoria LEAD suficiente para esa fecha de corte.',1;
 SELECT CAST(GROUPING(sv.nombre) AS BIT) AS EsTotal,
  DATEFROMPARTS(YEAR(o.fecha_solicitud),MONTH(o.fecha_solicitud),1) AS Mes,
  CASE WHEN @desglosar_canal=1 THEN o.id_canal_origen END AS IdCanal,
  CASE WHEN GROUPING(sv.nombre)=1 THEN 'TOTAL' ELSE COALESCE(sv.nombre,'Sin tratamiento') END AS Tratamiento,
  COUNT_BIG(*) AS Ingresadas,
  COALESCE(SUM(o.oportunidad_aceptada),0) AS Aceptadas,
  COALESCE(SUM(o.oportunidad_cerrada_sin_acuerdo),0) AS CerradasSinAcuerdo,
  SUM(CASE WHEN o.resultado_comercial_lead='PENDIENTE' THEN 1 ELSE 0 END) AS Pendientes,
  SUM(CASE WHEN o.resultado_comercial_lead IS NULL THEN 1 ELSE 0 END) AS SinResultadoDocumentado,
  CAST(100.0*SUM(o.oportunidad_aceptada)/NULLIF(SUM(o.oportunidad_aceptada+o.oportunidad_cerrada_sin_acuerdo),0) AS DECIMAL(8,2)) AS AceptacionPorcentaje,
  CAST(COALESCE(SUM(CASE WHEN o.oportunidad_aceptada=1 THEN o.valor_acordado_lead ELSE 0 END),0) AS DECIMAL(18,2)) AS ValorAcordadoSoles
 FROM dbo.fn_Lead_Oportunidades_Corte(@c) o
 LEFT JOIN dbo.Servicios sv ON sv.id_servicio=o.id_servicio
 WHERE o.fecha_solicitud>=@periodo_inicio AND o.fecha_solicitud<@periodo_fin_exclusivo
   AND (@id_servicio IS NULL OR o.id_servicio=@id_servicio)
   AND (@id_canal IS NULL OR o.id_canal_origen=@id_canal)
   AND (@id_sede IS NULL OR o.id_sede_interes_lead=@id_sede)
   AND (@id_negociador IS NULL OR o.id_negociador=@id_negociador)
   AND (@id_fuente IS NULL OR o.id_fuente=@id_fuente)
 GROUP BY GROUPING SETS ((DATEFROMPARTS(YEAR(o.fecha_solicitud),MONTH(o.fecha_solicitud),1),
    CASE WHEN @desglosar_canal=1 THEN o.id_canal_origen END,sv.nombre),())
 ORDER BY EsTotal,Mes,Tratamiento;
END;
GO

CREATE PROCEDURE dbo.usp_Lead_ReporteR2
 @periodo_inicio DATE,@periodo_fin_exclusivo DATE,
 @corte_utc DATETIME2(7)=NULL,@id_servicio INT=NULL,@con_promocion BIT=NULL,@id_sede INT=NULL,
 @precio_min DECIMAL(10,2)=NULL,@precio_max DECIMAL(10,2)=NULL,
 @id_promocion INT=NULL,@id_motivo INT=NULL,@seccion VARCHAR(10)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @c DATETIME2(7)=COALESCE(@corte_utc,SYSUTCDATETIME());
 IF @periodo_inicio>=@periodo_fin_exclusivo THROW 54221,'Periodo invalido.',1;
 IF @c<(SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2')
  THROW 54222,'No hay auditoria LEAD suficiente para ese corte.',1;
 IF @seccion IS NULL OR @seccion='detalle'
 SELECT p.id_propuesta_logica,p.id_version_vigente,p.fecha_presentacion,
  sv.nombre AS Tratamiento,p.id_sede_lead,p.precio_cotizado AS PrecioCotizado,
  CAST(CASE WHEN p.id_promocion_lead IS NOT NULL OR NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS ConPromocion,
  COALESCE(pr.nombre,NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),''),'Sin promocion') AS PromocionAplicada,
  p.estado AS Resultado,m.motivo AS MotivoRechazo
 FROM dbo.fn_Lead_Propuestas_Corte(@c) p
 LEFT JOIN dbo.Servicios sv ON sv.id_servicio=p.id_servicio
 LEFT JOIN dbo.PromocionesLead pr ON pr.id_promocion=p.id_promocion_lead
 LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=p.id_motivo_rechazo_lead
 WHERE p.fecha_presentacion>=@periodo_inicio AND p.fecha_presentacion<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR p.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR p.id_sede_lead=@id_sede)
  AND (@precio_min IS NULL OR p.precio_cotizado>=@precio_min)
  AND (@precio_max IS NULL OR p.precio_cotizado<=@precio_max)
  AND (@id_promocion IS NULL OR p.id_promocion_lead=@id_promocion)
  AND (@con_promocion IS NULL OR
   (@con_promocion=1 AND (p.id_promocion_lead IS NOT NULL OR NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NOT NULL)) OR
   (@con_promocion=0 AND p.id_promocion_lead IS NULL AND NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NULL))
  AND (@id_motivo IS NULL OR p.id_motivo_rechazo_lead=@id_motivo)
 ORDER BY p.fecha_presentacion,p.id_propuesta_logica;
 IF @seccion IS NULL OR @seccion='resumen'
 SELECT COUNT_BIG(*) AS Presentadas,
  COALESCE(SUM(p.propuesta_aceptada),0) AS Aceptadas,
  COALESCE(SUM(p.propuesta_rechazada),0) AS Rechazadas,
  COALESCE(SUM(CASE WHEN p.estado='Pendiente' THEN 1 ELSE 0 END),0) AS Pendientes,
  COALESCE(SUM(p.propuesta_rechazada_economica),0) AS RechazosEconomicos,
  CAST(100.0*SUM(p.propuesta_aceptada)/NULLIF(SUM(p.propuesta_aceptada+p.propuesta_rechazada),0) AS DECIMAL(8,2)) AS AceptacionPorcentaje,
  CAST(AVG(CAST(p.precio_cotizado AS DECIMAL(18,4))) AS DECIMAL(18,2)) AS PrecioPromedio,
  CAST(100.0*SUM(p.propuesta_rechazada_economica)/NULLIF(SUM(p.propuesta_aceptada+p.propuesta_rechazada),0) AS DECIMAL(8,2)) AS L2Porcentaje
 FROM dbo.fn_Lead_Propuestas_Corte(@c) p
 WHERE p.fecha_presentacion>=@periodo_inicio AND p.fecha_presentacion<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR p.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR p.id_sede_lead=@id_sede)
  AND (@precio_min IS NULL OR p.precio_cotizado>=@precio_min)
  AND (@precio_max IS NULL OR p.precio_cotizado<=@precio_max)
  AND (@id_promocion IS NULL OR p.id_promocion_lead=@id_promocion)
  AND (@con_promocion IS NULL OR
   (@con_promocion=1 AND (p.id_promocion_lead IS NOT NULL OR NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NOT NULL)) OR
   (@con_promocion=0 AND p.id_promocion_lead IS NULL AND NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NULL));
END;
GO

CREATE PROCEDURE dbo.usp_Lead_ReporteR3
 @periodo_inicio DATE,@periodo_fin_exclusivo DATE,
 @corte_utc DATETIME2(7)=NULL,@id_servicio INT=NULL,
 @id_sede INT=NULL,@id_profesional INT=NULL,
 @pref_dia TINYINT=NULL,@pref_turno VARCHAR(30)=NULL,
 @ofr_dia TINYINT=NULL,@ofr_turno VARCHAR(30)=NULL,@id_motivo INT=NULL,@seccion VARCHAR(10)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @c DATETIME2(7)=COALESCE(@corte_utc,SYSUTCDATETIME());
 IF @periodo_inicio>=@periodo_fin_exclusivo THROW 54231,'Periodo invalido.',1;
 IF @c<(SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2')
  THROW 54232,'No hay auditoria LEAD suficiente para ese corte.',1;
 IF @seccion IS NULL OR @seccion='detalle'
 SELECT a.id_solicitud,a.id_opcion,a.fecha_ofrecida,a.id_sede,a.id_profesional,s.id_servicio,
  a.pref_fecha_lead,a.pref_dia_semana_lead,a.pref_turno_lead,
  a.pref_hora_inicio_lead,a.pref_hora_fin_lead,
  a.fecha_disponibilidad AS FechaAtencionOfrecida,
  ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),a.fecha_disponibilidad)%7+7)%7)+1 AS DiaOfrecido,
  a.ofr_turno_lead,a.hora_inicio AS HoraInicioOfrecida,a.hora_fin AS HoraFinOfrecida,
  a.estado_respuesta AS Resultado,m.motivo AS MotivoRechazo,
  (SELECT COUNT_BIG(*) FROM dbo.CambiosOpcionLead c WHERE c.id_opcion=a.id_opcion
   AND c.es_pre_reserva_lead=1 AND c.fecha_registro_utc_lead<=@c) AS NumeroCambios
 FROM dbo.fn_Lead_Alternativas_Corte(@c) a
 JOIN dbo.fn_Lead_Oportunidades_Corte(@c) s ON s.id_solicitud=a.id_solicitud
 LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=a.id_motivo_rechazo_lead
 WHERE a.fecha_ofrecida>=@periodo_inicio AND a.fecha_ofrecida<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR s.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR a.id_sede=@id_sede)
  AND (@id_profesional IS NULL OR a.id_profesional=@id_profesional)
  AND (@pref_dia IS NULL OR a.pref_dia_semana_lead=@pref_dia)
  AND (@pref_turno IS NULL OR a.pref_turno_lead=@pref_turno)
  AND (@ofr_dia IS NULL OR ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),a.fecha_disponibilidad)%7+7)%7)+1=@ofr_dia)
  AND (@ofr_turno IS NULL OR a.ofr_turno_lead=@ofr_turno)
  AND (@id_motivo IS NULL OR a.id_motivo_rechazo_lead=@id_motivo)
 ORDER BY a.fecha_ofrecida,a.id_opcion;
 IF @seccion IS NULL OR @seccion='resumen'
 SELECT COUNT_BIG(*) AS Presentadas,
  COALESCE(SUM(a.alternativa_aceptada),0) AS Aceptadas,
  COALESCE(SUM(a.alternativa_rechazada),0) AS Rechazadas,
  COALESCE(SUM(CASE WHEN a.estado_respuesta='Pendiente' THEN 1 ELSE 0 END),0) AS Pendientes,
  COALESCE(SUM(CASE WHEN cambios.id_cambio IS NOT NULL THEN 1 ELSE 0 END),0) AS Modificadas,
  COALESCE(SUM(a.alternativa_rechazada_incompatibilidad),0) AS RechazadasIncompatibilidad,
  CAST(100.0*SUM(a.alternativa_rechazada_incompatibilidad)/NULLIF(SUM(a.alternativa_aceptada+a.alternativa_rechazada),0) AS DECIMAL(8,2)) AS L3Porcentaje
 FROM dbo.fn_Lead_Alternativas_Corte(@c) a
 JOIN dbo.fn_Lead_Oportunidades_Corte(@c) s ON s.id_solicitud=a.id_solicitud
 OUTER APPLY (SELECT TOP (1) c.id_cambio FROM dbo.CambiosOpcionLead c
  WHERE c.id_opcion=a.id_opcion AND c.es_pre_reserva_lead=1 AND c.fecha_registro_utc_lead<=@c
  ORDER BY c.id_cambio DESC) cambios
 WHERE a.fecha_ofrecida>=@periodo_inicio AND a.fecha_ofrecida<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR s.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR a.id_sede=@id_sede)
  AND (@id_profesional IS NULL OR a.id_profesional=@id_profesional)
  AND (@pref_dia IS NULL OR a.pref_dia_semana_lead=@pref_dia)
  AND (@pref_turno IS NULL OR a.pref_turno_lead=@pref_turno)
  AND (@ofr_dia IS NULL OR ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),a.fecha_disponibilidad)%7+7)%7)+1=@ofr_dia)
  AND (@ofr_turno IS NULL OR a.ofr_turno_lead=@ofr_turno);
END;
GO

CREATE VIEW dbo.v_OrigenMedidasAlternativaLead AS
SELECT * FROM dbo.fn_Lead_Alternativas_Corte('9999-12-31T23:59:59.9999999');
GO

CREATE VIEW dbo.v_OrigenMedidasOportunidadLead AS
SELECT * FROM dbo.fn_Lead_Oportunidades_Corte('9999-12-31T23:59:59.9999999');
GO

CREATE VIEW dbo.v_OrigenMedidasPropuestaLead AS
SELECT * FROM dbo.fn_Lead_Propuestas_Corte('9999-12-31T23:59:59.9999999');
GO

-- 5. CATALOGOS ESTRUCTURALES. Sin personas, usuarios, servicios de ejemplo o reservas.
INSERT dbo.Etapas(nombre) VALUES ('BUYER'),('LEAD'),('PAYER'),('CUSTOMER'),('TURNED');
INSERT dbo.Roles(nombre) VALUES ('Administrador'),('Marketing'),('Negociador'),('Cobranza'),('Soporte'),('PostVenta');
INSERT dbo.Modalidades(nombre) VALUES ('Presencial'),('Virtual');
INSERT dbo.Canales(nombre) VALUES ('WhatsApp'),('Facebook'),('Instagram'),('Página Web'),('Formulario Web'),('Llamada'),('Correo Electrónico');
INSERT dbo.ConfiguracionLeadRevision(version_codigo,descripcion)
 VALUES ('LEAD-V2',N'Inicio de auditoria de esta instalacion; sin reconstruccion artificial del pasado');
EXEC sys.sp_addextendedproperty @name=N'NexoSaludPaquete',@value=N'LEAD-OLTP-2026-11';
GO
-- 6. CONTROLES ANTES DE CONFIRMAR LA INSTALACION.
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>44
 THROW 55005,'Cantidad inesperada de tablas de aplicacion.',1;
IF (SELECT COUNT(*) FROM sys.foreign_keys)<>94
 OR EXISTS (SELECT 1 FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
 OR EXISTS (SELECT 1 FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1)
 THROW 55006,'Relaciones o restricciones incompletas.',1;
IF (SELECT COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.is_ms_shipped=0)<>20
 THROW 55007,'No quedaron instalados los 20 modulos requeridos.',1;
IF @@TRANCOUNT<>1 THROW 55008,'Estado de transaccion inesperado.',1;
COMMIT TRANSACTION;
SELECT DB_NAME() base_instalada,44 tablas,94 relaciones,SYSUTCDATETIME() confirmado_utc;
GO
