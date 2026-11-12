-- NexoSalud: estructura COMPLETA del Mart, instalacion NUEVA.
-- 17 dimensiones y 11 hechos; nueve dimensiones y cinco hechos corresponden a LEAD.
-- BUYER: captacion por persona de init_mart.sql e inversion por gasto del archivo 06 de Daniel.
-- Las otras tablas conservan la estructura inventariada. Sin datos ni procedimientos ETL.
-- No ejecutar init_mart.sql antes. No actualiza ni reemplaza bases existentes.
-- SQL Server 2019/2022. UTF-8. SQLCMD/SSMS en modo SQLCMD.
-- sqlcmd -S "SU_INSTANCIA" -E -C -I -b -f 65001 -d master -v BaseMart=NexoSalud_Mart ConfirmarDestino=NexoSalud_Mart -i database/lead_revision/instalacion_actualizada/02_CREAR_MART_ACTUALIZADO.sql
-- Sin dependencias :r ni referencia al servidor ANTHONY. La carga corresponde a la fase 4.
:ON ERROR EXIT
USE [master];
GO
SET NOCOUNT ON;
IF N'$(BaseMart)'<>N'$(ConfirmarDestino)' OR N'$(BaseMart)' NOT LIKE N'NexoSalud_Mart%'
 OR LEN(N'$(BaseMart)')>128 OR N'$(BaseMart)' COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9_]%'
 THROW 55101,'Destino Mart no confirmado o nombre no permitido.',1;
IF DB_ID(N'$(BaseMart)') IS NOT NULL
 THROW 55102,'La base ya existe. Este script solo crea un Mart nuevo.',1;
IF TRY_CONVERT(int,SERVERPROPERTY('ProductMajorVersion'))<15
 THROW 55103,'Se requiere SQL Server 2019 o posterior compatible.',1;
CREATE DATABASE [$(BaseMart)] COLLATE Modern_Spanish_CI_AS;
GO
USE [$(BaseMart)];
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
-- 1. DIMENSIONES Y HECHOS CONSERVADOS.

CREATE TABLE [dbo].[Dim_Canal] (
    [KeyCanal] int IDENTITY(1,1) NOT NULL,
    [id_canal] int NULL,
    [NombreCanal] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [TipoMedio] varchar(50) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Cobro] (
    [KeyCobro] int IDENTITY(1,1) NOT NULL,
    [EstadoPago] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [ComprobanteAdjunto] varchar(2) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_EstadoAtencion] (
    [KeyEstadoAtencion] int IDENTITY(1,1) NOT NULL,
    [EstadoFinal] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [Asistencia] varchar(50) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_EstadoRegistro] (
    [KeyEstadoRegistro] int IDENTITY(1,1) NOT NULL,
    [EstadoCalidad] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [AutorizacionContacto] varchar(2) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Fuente] (
    [KeyFuente] int IDENTITY(1,1) NOT NULL,
    [id_fuente] int NULL,
    [id_campana] int NULL,
    [TipoOrigen] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [Campana] varchar(150) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Hora] (
    [KeyHora] int IDENTITY(1,1) NOT NULL,
    [id_hora] int NOT NULL,
    [Turno] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [Hora] int NULL,
    [Minuto] int NULL
);
GO

CREATE TABLE [dbo].[Dim_Horario] (
    [KeyHorario] int IDENTITY(1,1) NOT NULL,
    [TipoMiembro] varchar(16) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [NumeroDiaSemana] tinyint NULL,
    [DiaSemana] AS (CONVERT([nvarchar](10),case [NumeroDiaSemana] when (1) then N'Lunes' when (2) then N'Martes' when (3) then N'Miércoles' when (4) then N'Jueves' when (5) then N'Viernes' when (6) then N'Sábado' when (7) then N'Domingo'  end)) PERSISTED,
    [Turno] nvarchar(30) COLLATE Modern_Spanish_CI_AS NULL,
    [HoraInicio] time(7) NULL,
    [HoraFin] time(7) NULL,
    [IntervaloHorario] AS (case when [HoraInicio] IS NOT NULL AND [HoraFin] IS NOT NULL then (CONVERT([varchar](16),[HoraInicio])+'–')+CONVERT([varchar](16),[HoraFin])  end)
);
GO

CREATE TABLE [dbo].[Dim_MotivoRechazo] (
    [KeyMotivoRechazo] int IDENTITY(1,1) NOT NULL,
    [id_motivo_rechazo] int NULL,
    [Codigo] varchar(60) COLLATE Modern_Spanish_CI_AS NULL,
    [Ambito] varchar(15) COLLATE Modern_Spanish_CI_AS NULL,
    [TipoMotivoRechazo] varchar(20) COLLATE Modern_Spanish_CI_AS NULL,
    [MotivoRechazo] nvarchar(160) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [Activo] bit NULL
);
GO

CREATE TABLE [dbo].[Dim_Negociador] (
    [KeyNegociador] int IDENTITY(1,1) NOT NULL,
    [id_usuario] int NULL,
    [NombreNegociador] varchar(100) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Pagador] (
    [KeyPagador] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NULL,
    [Ocupacion] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [RangoEdad] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [EstadoCivil] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [NivelIngreso] varchar(50) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Pasarela] (
    [KeyPasarela] int IDENTITY(1,1) NOT NULL,
    [MetodoPago] varchar(50) COLLATE Modern_Spanish_CI_AS NULL,
    [EntidadFinanciera] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [TipoMedio] varchar(50) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Profesional] (
    [KeyProfesional] int IDENTITY(1,1) NOT NULL,
    [id_profesional] int NULL,
    [Odontologo] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [EspecialidadPrincipal] varchar(100) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Promocion] (
    [KeyPromocion] int IDENTITY(1,1) NOT NULL,
    [id_promocion] int NULL,
    [Origen] varchar(16) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [PromocionAplicada] nvarchar(150) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [TipoPromocion] nvarchar(80) COLLATE Modern_Spanish_CI_AS NULL,
    [id_servicio] int NULL,
    [Activo] bit NULL
);
GO

CREATE TABLE [dbo].[Dim_Sede] (
    [KeySede] int IDENTITY(1,1) NOT NULL,
    [id_sede] int NULL,
    [Sede] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [Distrito] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [Zona] varchar(100) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Servicio] (
    [KeyServicio] int IDENTITY(1,1) NOT NULL,
    [id_servicio] int NULL,
    [ServicioOdontologico] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [Categoria] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [Procedimiento] varchar(100) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[Dim_Tiempo] (
    [KeyTiempo] int NOT NULL,
    [id_fecha] date NOT NULL,
    [Anio] int NOT NULL,
    [Trimestre] int NOT NULL,
    [Mes] int NOT NULL,
    [Dia] int NOT NULL
);
GO

CREATE TABLE [dbo].[Dim_TipoPersona] (
    [KeyTipoPersona] int IDENTITY(1,1) NOT NULL,
    [id_persona] int NULL,
    [Ocupacion] varchar(100) COLLATE Modern_Spanish_CI_AS NULL,
    [RangoEdad] varchar(50) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[fact_alternativas_aceptadas_lead] (
    [KeyTiempo] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeySede] int NOT NULL,
    [KeyProfesional] int NOT NULL,
    [KeyHorarioPreferido] int NOT NULL,
    [KeyHorarioOfrecido] int NOT NULL,
    [alternativa_aceptada] bigint NOT NULL
);
GO

CREATE TABLE [dbo].[fact_alternativas_rechazadas_lead] (
    [KeyTiempo] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeySede] int NOT NULL,
    [KeyProfesional] int NOT NULL,
    [KeyHorarioPreferido] int NOT NULL,
    [KeyHorarioOfrecido] int NOT NULL,
    [KeyMotivoRechazo] int NOT NULL,
    [alternativa_rechazada] bigint NOT NULL,
    [alternativa_rechazada_incompatibilidad] bigint NOT NULL
);
GO

CREATE TABLE [dbo].[fact_atencion_customer] (
    [KeyTiempo] int NOT NULL,
    [KeyHora] int NULL,
    [KeySede] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeyProfesional] int NOT NULL,
    [KeyEstadoAtencion] int NOT NULL,
    [cita_evaluable] int NULL CONSTRAINT [DF__fact_aten__cita___02FC7413] DEFAULT ((0)),
    [atencion_realizada] int NULL CONSTRAINT [DF__fact_aten__atenc__03F0984C] DEFAULT ((0)),
    [cita_inasistencia] int NULL CONSTRAINT [DF__fact_aten__cita___04E4BC85] DEFAULT ((0)),
    [tiempo_sillon_dental_minuto] int NULL CONSTRAINT [DF__fact_aten__tiemp__05D8E0BE] DEFAULT ((0)),
    [atencion_finalizada_conforme] int NULL CONSTRAINT [DF__fact_aten__atenc__06CD04F7] DEFAULT ((0))
);
GO

CREATE TABLE [dbo].[fact_gestion_payer] (
    [KeyTiempo] int NOT NULL,
    [KeyHora] int NULL,
    [KeySede] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeyFuente] int NULL,
    [KeyPasarela] int NOT NULL,
    [KeyPagador] int NULL,
    [KeyCobro] int NOT NULL,
    [pago_registrado] int NULL CONSTRAINT [DF__fact_gest__pago___74AE54BC] DEFAULT ((0)),
    [pago_validado] int NULL CONSTRAINT [DF__fact_gest__pago___75A278F5] DEFAULT ((0)),
    [pago_rechazado] int NULL CONSTRAINT [DF__fact_gest__pago___76969D2E] DEFAULT ((0)),
    [conversion_customer] int NULL CONSTRAINT [DF__fact_gest__conve__778AC167] DEFAULT ((0)),
    [importe_total_cobro] decimal(12,2) NULL CONSTRAINT [DF__fact_gest__impor__787EE5A0] DEFAULT ((0.00)),
    [costo_transaccion] decimal(10,2) NULL CONSTRAINT [DF__fact_gest__costo__797309D9] DEFAULT ((0.00)),
    [tiempo_validacion_minuto] int NULL CONSTRAINT [DF__fact_gest__tiemp__7A672E12] DEFAULT ((0))
);
GO

CREATE TABLE [dbo].[fact_negociacion_lead] (
    [KeyTiempo] int NOT NULL,
    [KeySede] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeyProfesional] int NOT NULL,
    [KeyNegociador] int NOT NULL,
    [cohorte_evaluable] int NULL CONSTRAINT [DF__fact_nego__cohor__6477ECF3] DEFAULT ((0)),
    [conversion_payer_14_dia] int NULL CONSTRAINT [DF__fact_nego__conve__656C112C] DEFAULT ((0)),
    [solicitud_requiere_respuesta] int NULL CONSTRAINT [DF__fact_nego__solic__66603565] DEFAULT ((0)),
    [respuesta_util_15_min] int NULL CONSTRAINT [DF__fact_nego__respu__6754599E] DEFAULT ((0)),
    [negociacion_finalizada] int NULL CONSTRAINT [DF__fact_nego__negoc__68487DD7] DEFAULT ((0)),
    [negociacion_abandonada] int NULL CONSTRAINT [DF__fact_nego__negoc__693CA210] DEFAULT ((0)),
    [leads_en_negociacion] int NULL CONSTRAINT [DF__fact_nego__leads__6A30C649] DEFAULT ((0))
);
GO

CREATE TABLE [dbo].[fact_oportunidades_lead] (
    [KeyTiempo] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeyCanal] int NOT NULL,
    [KeySede] int NOT NULL,
    [KeyNegociador] int NOT NULL,
    [oportunidad_aceptada] bigint NOT NULL,
    [oportunidad_cerrada_sin_acuerdo] bigint NOT NULL
);
GO

CREATE TABLE [dbo].[fact_propuestas_aceptadas_lead] (
    [KeyTiempo] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeyPromocion] int NOT NULL,
    [propuesta_aceptada] bigint NOT NULL
);
GO

CREATE TABLE [dbo].[fact_propuestas_rechazadas_lead] (
    [KeyTiempo] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeyPromocion] int NOT NULL,
    [KeyMotivoRechazo] int NOT NULL,
    [propuesta_rechazada] bigint NOT NULL,
    [propuesta_rechazada_economica] bigint NOT NULL
);
GO

CREATE TABLE [dbo].[fact_seguimiento_turned] (
    [KeyTiempo] int NOT NULL,
    [KeySede] int NOT NULL,
    [KeyServicio] int NOT NULL,
    [KeyProfesional] int NOT NULL,
    [KeyCanal] int NOT NULL,
    [seguimiento_registrado] int NULL CONSTRAINT [DF__fact_segu__segui__0E6E26BF] DEFAULT ((0)),
    [seguimiento_efectivo] int NULL CONSTRAINT [DF__fact_segu__segui__0F624AF8] DEFAULT ((0)),
    [incidencia_reportada] int NULL CONSTRAINT [DF__fact_segu__incid__10566F31] DEFAULT ((0)),
    [incidencia_resuelta_24_hora] int NULL CONSTRAINT [DF__fact_segu__incid__114A936A] DEFAULT ((0)),
    [retorno_cohorte_90_dia] int NULL CONSTRAINT [DF__fact_segu__retor__123EB7A3] DEFAULT ((0)),
    [paciente_elegible_retorno] int NULL CONSTRAINT [DF__fact_segu__pacie__1332DBDC] DEFAULT ((0))
);
GO

-- 2. CLAVES E INDICES CONSERVADOS.

ALTER TABLE [dbo].[Dim_Canal] ADD CONSTRAINT [PK__Dim_Cana__40EB45C56D7A35D9] PRIMARY KEY CLUSTERED ([KeyCanal] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_Lead_Canal_Origen] ON [dbo].[Dim_Canal] ([id_canal] ASC) WHERE ([id_canal] IS NOT NULL);
GO

ALTER TABLE [dbo].[Dim_Cobro] ADD CONSTRAINT [PK__Dim_Cobr__E76E525276537E77] PRIMARY KEY CLUSTERED ([KeyCobro] ASC);
GO

ALTER TABLE [dbo].[Dim_EstadoAtencion] ADD CONSTRAINT [PK__Dim_Esta__5E88E6F6E9178261] PRIMARY KEY CLUSTERED ([KeyEstadoAtencion] ASC);
GO

ALTER TABLE [dbo].[Dim_EstadoRegistro] ADD CONSTRAINT [PK__Dim_Esta__B6D625B9D8853211] PRIMARY KEY CLUSTERED ([KeyEstadoRegistro] ASC);
GO

ALTER TABLE [dbo].[Dim_Fuente] ADD CONSTRAINT [PK__Dim_Fuen__0B9B0EC577B060A0] PRIMARY KEY CLUSTERED ([KeyFuente] ASC);
GO

ALTER TABLE [dbo].[Dim_Hora] ADD CONSTRAINT [PK__Dim_Hora__BDEB6219E6BAE68F] PRIMARY KEY CLUSTERED ([KeyHora] ASC);
GO

ALTER TABLE [dbo].[Dim_Horario] ADD CONSTRAINT [PK_DimHorario] PRIMARY KEY CLUSTERED ([KeyHorario] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_DimHorario_Grano] ON [dbo].[Dim_Horario] ([TipoMiembro] ASC, [NumeroDiaSemana] ASC, [Turno] ASC, [HoraInicio] ASC, [HoraFin] ASC);
GO

ALTER TABLE [dbo].[Dim_MotivoRechazo] ADD CONSTRAINT [PK_DimMotivoRechazo] PRIMARY KEY CLUSTERED ([KeyMotivoRechazo] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_DimMotivoRechazo_Origen] ON [dbo].[Dim_MotivoRechazo] ([id_motivo_rechazo] ASC) WHERE ([id_motivo_rechazo] IS NOT NULL);
GO

ALTER TABLE [dbo].[Dim_Negociador] ADD CONSTRAINT [PK__Dim_Nego__7D336A34432C5861] PRIMARY KEY CLUSTERED ([KeyNegociador] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_Lead_Negociador_Origen] ON [dbo].[Dim_Negociador] ([id_usuario] ASC) WHERE ([id_usuario] IS NOT NULL);
GO

ALTER TABLE [dbo].[Dim_Pagador] ADD CONSTRAINT [PK__Dim_Paga__496BD06695C88264] PRIMARY KEY CLUSTERED ([KeyPagador] ASC);
GO

ALTER TABLE [dbo].[Dim_Pasarela] ADD CONSTRAINT [PK__Dim_Pasa__7EE059F578E757A2] PRIMARY KEY CLUSTERED ([KeyPasarela] ASC);
GO

ALTER TABLE [dbo].[Dim_Profesional] ADD CONSTRAINT [PK__Dim_Prof__E6C73575D88D9134] PRIMARY KEY CLUSTERED ([KeyProfesional] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_Lead_Profesional_Origen] ON [dbo].[Dim_Profesional] ([id_profesional] ASC) WHERE ([id_profesional] IS NOT NULL);
GO

ALTER TABLE [dbo].[Dim_Promocion] ADD CONSTRAINT [PK_DimPromocion] PRIMARY KEY CLUSTERED ([KeyPromocion] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_DimPromocion_Catalogo] ON [dbo].[Dim_Promocion] ([id_promocion] ASC) WHERE ([id_promocion] IS NOT NULL);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_DimPromocion_Texto] ON [dbo].[Dim_Promocion] ([PromocionAplicada] ASC) WHERE ([Origen]='TEXTO');
GO

ALTER TABLE [dbo].[Dim_Sede] ADD CONSTRAINT [PK__Dim_Sede__A0923C524A24881F] PRIMARY KEY CLUSTERED ([KeySede] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_Lead_Sede_Origen] ON [dbo].[Dim_Sede] ([id_sede] ASC) WHERE ([id_sede] IS NOT NULL);
GO

ALTER TABLE [dbo].[Dim_Servicio] ADD CONSTRAINT [PK__Dim_Serv__E9EE0A4652F11B29] PRIMARY KEY CLUSTERED ([KeyServicio] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_Lead_Servicio_Origen] ON [dbo].[Dim_Servicio] ([id_servicio] ASC) WHERE ([id_servicio] IS NOT NULL);
GO

ALTER TABLE [dbo].[Dim_Tiempo] ADD CONSTRAINT [PK__Dim_Tiem__AA3B4A79D3D97C4F] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_Lead_Tiempo_Fecha] ON [dbo].[Dim_Tiempo] ([id_fecha] ASC);
GO

ALTER TABLE [dbo].[Dim_TipoPersona] ADD CONSTRAINT [PK__Dim_Tipo__7BC4EF617868CF14] PRIMARY KEY CLUSTERED ([KeyTipoPersona] ASC);
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] ADD CONSTRAINT [PK_fact_alternativas_aceptadas_lead] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeyServicio] ASC, [KeySede] ASC, [KeyProfesional] ASC, [KeyHorarioPreferido] ASC, [KeyHorarioOfrecido] ASC);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] ADD CONSTRAINT [PK_fact_alternativas_rechazadas_lead] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeyServicio] ASC, [KeySede] ASC, [KeyProfesional] ASC, [KeyHorarioPreferido] ASC, [KeyHorarioOfrecido] ASC, [KeyMotivoRechazo] ASC);
GO

ALTER TABLE [dbo].[fact_atencion_customer] ADD CONSTRAINT [PK_Fact_AtencionCustomer] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeySede] ASC, [KeyServicio] ASC, [KeyProfesional] ASC, [KeyEstadoAtencion] ASC);
GO

ALTER TABLE [dbo].[fact_gestion_payer] ADD CONSTRAINT [PK_Fact_GestionPayer] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeyPasarela] ASC, [KeyCobro] ASC, [KeySede] ASC, [KeyServicio] ASC);
GO

ALTER TABLE [dbo].[fact_negociacion_lead] ADD CONSTRAINT [PK_Fact_NegociacionLead] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeySede] ASC, [KeyServicio] ASC, [KeyProfesional] ASC, [KeyNegociador] ASC);
GO

ALTER TABLE [dbo].[fact_oportunidades_lead] ADD CONSTRAINT [PK_fact_oportunidades_lead] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeyServicio] ASC, [KeyCanal] ASC, [KeySede] ASC, [KeyNegociador] ASC);
GO

ALTER TABLE [dbo].[fact_propuestas_aceptadas_lead] ADD CONSTRAINT [PK_fact_propuestas_aceptadas_lead] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeyServicio] ASC, [KeyPromocion] ASC);
GO

ALTER TABLE [dbo].[fact_propuestas_rechazadas_lead] ADD CONSTRAINT [PK_fact_propuestas_rechazadas_lead] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeyServicio] ASC, [KeyPromocion] ASC, [KeyMotivoRechazo] ASC);
GO

ALTER TABLE [dbo].[fact_seguimiento_turned] ADD CONSTRAINT [PK_Fact_SeguimientoTurned] PRIMARY KEY CLUSTERED ([KeyTiempo] ASC, [KeySede] ASC, [KeyServicio] ASC, [KeyProfesional] ASC, [KeyCanal] ASC);
GO

-- 3. CHECK Y RELACIONES CONSERVADOS; INCLUYE LAS 25 FK LEAD.

ALTER TABLE [dbo].[Dim_Horario] WITH CHECK ADD CONSTRAINT [CK_DimHorario_Dia] CHECK ([NumeroDiaSemana] IS NULL OR [NumeroDiaSemana]>=(1) AND [NumeroDiaSemana]<=(7));
GO

ALTER TABLE [dbo].[Dim_Horario] WITH CHECK ADD CONSTRAINT [CK_DimHorario_Intervalo] CHECK ([HoraInicio] IS NULL AND [HoraFin] IS NULL OR [HoraInicio] IS NOT NULL AND [HoraFin] IS NOT NULL AND [HoraInicio]<[HoraFin]);
GO

ALTER TABLE [dbo].[Dim_Horario] WITH CHECK ADD CONSTRAINT [CK_DimHorario_Miembro] CHECK ([TipoMiembro]='OBSERVADO' AND ([NumeroDiaSemana] IS NOT NULL OR [Turno] IS NOT NULL OR [HoraInicio] IS NOT NULL) OR ([TipoMiembro]='NO_APLICA' OR [TipoMiembro]='NO_ESPECIFICADO' OR [TipoMiembro]='DESCONOCIDO') AND [NumeroDiaSemana] IS NULL AND [Turno] IS NULL AND [HoraInicio] IS NULL);
GO

ALTER TABLE [dbo].[Dim_MotivoRechazo] WITH CHECK ADD CONSTRAINT [CK_DimMotivoRechazo_Clasificacion] CHECK ([id_motivo_rechazo] IS NULL AND [Ambito] IS NULL AND [TipoMotivoRechazo] IS NULL OR [id_motivo_rechazo] IS NOT NULL AND [Ambito] IS NOT NULL AND [TipoMotivoRechazo] IS NOT NULL AND ([Ambito]='PROPUESTA' AND ([TipoMotivoRechazo]='OTROS' OR [TipoMotivoRechazo]='ECONOMICO') OR [Ambito]='ALTERNATIVA' AND ([TipoMotivoRechazo]='OTROS' OR [TipoMotivoRechazo]='INCOMPATIBILIDAD')));
GO

ALTER TABLE [dbo].[Dim_Promocion] WITH CHECK ADD CONSTRAINT [CK_DimPromocion_Origen] CHECK ([Origen]='CATALOGO' AND [id_promocion] IS NOT NULL AND [id_promocion]>(0) OR ([Origen]='NO_APLICA' OR [Origen]='NO_ESPECIFICADO' OR [Origen]='DESCONOCIDO' OR [Origen]='SIN_PROMOCION' OR [Origen]='TEXTO') AND [id_promocion] IS NULL);
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [CK_fact_alternativas_aceptadas_lead_medidas] CHECK ([alternativa_aceptada]>=(0) AND [alternativa_aceptada]>(0));
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [CK_fact_alternativas_rechazadas_lead_medidas] CHECK ([alternativa_rechazada]>=(0) AND [alternativa_rechazada_incompatibilidad]>=(0) AND [alternativa_rechazada_incompatibilidad]<=[alternativa_rechazada] AND [alternativa_rechazada]>(0));
GO

ALTER TABLE [dbo].[fact_oportunidades_lead] WITH CHECK ADD CONSTRAINT [CK_fact_oportunidades_lead_medidas] CHECK ([oportunidad_aceptada]>=(0) AND [oportunidad_cerrada_sin_acuerdo]>=(0) AND ([oportunidad_aceptada]+[oportunidad_cerrada_sin_acuerdo])>(0));
GO

ALTER TABLE [dbo].[fact_propuestas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [CK_fact_propuestas_aceptadas_lead_medidas] CHECK ([propuesta_aceptada]>=(0) AND [propuesta_aceptada]>(0));
GO

ALTER TABLE [dbo].[fact_propuestas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [CK_fact_propuestas_rechazadas_lead_medidas] CHECK ([propuesta_rechazada]>=(0) AND [propuesta_rechazada_economica]>=(0) AND [propuesta_rechazada_economica]<=[propuesta_rechazada] AND [propuesta_rechazada]>(0));
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_aceptadas_lead_HorarioOfrecido] FOREIGN KEY ([KeyHorarioOfrecido]) REFERENCES [dbo].[Dim_Horario] ([KeyHorario]);
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_aceptadas_lead_HorarioPreferido] FOREIGN KEY ([KeyHorarioPreferido]) REFERENCES [dbo].[Dim_Horario] ([KeyHorario]);
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_aceptadas_lead_Profesional] FOREIGN KEY ([KeyProfesional]) REFERENCES [dbo].[Dim_Profesional] ([KeyProfesional]);
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_aceptadas_lead_Sede] FOREIGN KEY ([KeySede]) REFERENCES [dbo].[Dim_Sede] ([KeySede]);
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_aceptadas_lead_Servicio] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_alternativas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_aceptadas_lead_Tiempo] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_rechazadas_lead_HorarioOfrecido] FOREIGN KEY ([KeyHorarioOfrecido]) REFERENCES [dbo].[Dim_Horario] ([KeyHorario]);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_rechazadas_lead_HorarioPreferido] FOREIGN KEY ([KeyHorarioPreferido]) REFERENCES [dbo].[Dim_Horario] ([KeyHorario]);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_rechazadas_lead_MotivoRechazo] FOREIGN KEY ([KeyMotivoRechazo]) REFERENCES [dbo].[Dim_MotivoRechazo] ([KeyMotivoRechazo]);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_rechazadas_lead_Profesional] FOREIGN KEY ([KeyProfesional]) REFERENCES [dbo].[Dim_Profesional] ([KeyProfesional]);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_rechazadas_lead_Sede] FOREIGN KEY ([KeySede]) REFERENCES [dbo].[Dim_Sede] ([KeySede]);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_rechazadas_lead_Servicio] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_alternativas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_alternativas_rechazadas_lead_Tiempo] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_atencion_customer] WITH CHECK ADD CONSTRAINT [FK__fact_aten__KeyEs__02084FDA] FOREIGN KEY ([KeyEstadoAtencion]) REFERENCES [dbo].[Dim_EstadoAtencion] ([KeyEstadoAtencion]);
GO

ALTER TABLE [dbo].[fact_atencion_customer] WITH CHECK ADD CONSTRAINT [FK__fact_aten__KeyHo__7E37BEF6] FOREIGN KEY ([KeyHora]) REFERENCES [dbo].[Dim_Hora] ([KeyHora]);
GO

ALTER TABLE [dbo].[fact_atencion_customer] WITH CHECK ADD CONSTRAINT [FK__fact_aten__KeyPr__01142BA1] FOREIGN KEY ([KeyProfesional]) REFERENCES [dbo].[Dim_Profesional] ([KeyProfesional]);
GO

ALTER TABLE [dbo].[fact_atencion_customer] WITH CHECK ADD CONSTRAINT [FK__fact_aten__KeySe__00200768] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_atencion_customer] WITH CHECK ADD CONSTRAINT [FK__fact_aten__KeySe__7F2BE32F] FOREIGN KEY ([KeySede]) REFERENCES [dbo].[Dim_Sede] ([KeySede]);
GO

ALTER TABLE [dbo].[fact_atencion_customer] WITH CHECK ADD CONSTRAINT [FK__fact_aten__KeyTi__7D439ABD] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeyCo__73BA3083] FOREIGN KEY ([KeyCobro]) REFERENCES [dbo].[Dim_Cobro] ([KeyCobro]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeyFu__70DDC3D8] FOREIGN KEY ([KeyFuente]) REFERENCES [dbo].[Dim_Fuente] ([KeyFuente]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeyHo__6E01572D] FOREIGN KEY ([KeyHora]) REFERENCES [dbo].[Dim_Hora] ([KeyHora]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeyPa__71D1E811] FOREIGN KEY ([KeyPasarela]) REFERENCES [dbo].[Dim_Pasarela] ([KeyPasarela]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeyPa__72C60C4A] FOREIGN KEY ([KeyPagador]) REFERENCES [dbo].[Dim_Pagador] ([KeyPagador]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeySe__6EF57B66] FOREIGN KEY ([KeySede]) REFERENCES [dbo].[Dim_Sede] ([KeySede]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeySe__6FE99F9F] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_gestion_payer] WITH CHECK ADD CONSTRAINT [FK__fact_gest__KeyTi__6D0D32F4] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_negociacion_lead] WITH CHECK ADD CONSTRAINT [FK__fact_nego__KeyNe__6383C8BA] FOREIGN KEY ([KeyNegociador]) REFERENCES [dbo].[Dim_Negociador] ([KeyNegociador]);
GO

ALTER TABLE [dbo].[fact_negociacion_lead] WITH CHECK ADD CONSTRAINT [FK__fact_nego__KeyPr__628FA481] FOREIGN KEY ([KeyProfesional]) REFERENCES [dbo].[Dim_Profesional] ([KeyProfesional]);
GO

ALTER TABLE [dbo].[fact_negociacion_lead] WITH CHECK ADD CONSTRAINT [FK__fact_nego__KeySe__60A75C0F] FOREIGN KEY ([KeySede]) REFERENCES [dbo].[Dim_Sede] ([KeySede]);
GO

ALTER TABLE [dbo].[fact_negociacion_lead] WITH CHECK ADD CONSTRAINT [FK__fact_nego__KeySe__619B8048] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_negociacion_lead] WITH CHECK ADD CONSTRAINT [FK__fact_nego__KeyTi__5FB337D6] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_oportunidades_lead] WITH CHECK ADD CONSTRAINT [FK_fact_oportunidades_lead_Canal] FOREIGN KEY ([KeyCanal]) REFERENCES [dbo].[Dim_Canal] ([KeyCanal]);
GO

ALTER TABLE [dbo].[fact_oportunidades_lead] WITH CHECK ADD CONSTRAINT [FK_fact_oportunidades_lead_Negociador] FOREIGN KEY ([KeyNegociador]) REFERENCES [dbo].[Dim_Negociador] ([KeyNegociador]);
GO

ALTER TABLE [dbo].[fact_oportunidades_lead] WITH CHECK ADD CONSTRAINT [FK_fact_oportunidades_lead_Sede] FOREIGN KEY ([KeySede]) REFERENCES [dbo].[Dim_Sede] ([KeySede]);
GO

ALTER TABLE [dbo].[fact_oportunidades_lead] WITH CHECK ADD CONSTRAINT [FK_fact_oportunidades_lead_Servicio] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_oportunidades_lead] WITH CHECK ADD CONSTRAINT [FK_fact_oportunidades_lead_Tiempo] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_propuestas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_propuestas_aceptadas_lead_Promocion] FOREIGN KEY ([KeyPromocion]) REFERENCES [dbo].[Dim_Promocion] ([KeyPromocion]);
GO

ALTER TABLE [dbo].[fact_propuestas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_propuestas_aceptadas_lead_Servicio] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_propuestas_aceptadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_propuestas_aceptadas_lead_Tiempo] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_propuestas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_propuestas_rechazadas_lead_MotivoRechazo] FOREIGN KEY ([KeyMotivoRechazo]) REFERENCES [dbo].[Dim_MotivoRechazo] ([KeyMotivoRechazo]);
GO

ALTER TABLE [dbo].[fact_propuestas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_propuestas_rechazadas_lead_Promocion] FOREIGN KEY ([KeyPromocion]) REFERENCES [dbo].[Dim_Promocion] ([KeyPromocion]);
GO

ALTER TABLE [dbo].[fact_propuestas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_propuestas_rechazadas_lead_Servicio] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_propuestas_rechazadas_lead] WITH CHECK ADD CONSTRAINT [FK_fact_propuestas_rechazadas_lead_Tiempo] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

ALTER TABLE [dbo].[fact_seguimiento_turned] WITH CHECK ADD CONSTRAINT [FK__fact_segu__KeyCa__0D7A0286] FOREIGN KEY ([KeyCanal]) REFERENCES [dbo].[Dim_Canal] ([KeyCanal]);
GO

ALTER TABLE [dbo].[fact_seguimiento_turned] WITH CHECK ADD CONSTRAINT [FK__fact_segu__KeyPr__0C85DE4D] FOREIGN KEY ([KeyProfesional]) REFERENCES [dbo].[Dim_Profesional] ([KeyProfesional]);
GO

ALTER TABLE [dbo].[fact_seguimiento_turned] WITH CHECK ADD CONSTRAINT [FK__fact_segu__KeySe__0A9D95DB] FOREIGN KEY ([KeySede]) REFERENCES [dbo].[Dim_Sede] ([KeySede]);
GO

ALTER TABLE [dbo].[fact_seguimiento_turned] WITH CHECK ADD CONSTRAINT [FK__fact_segu__KeySe__0B91BA14] FOREIGN KEY ([KeyServicio]) REFERENCES [dbo].[Dim_Servicio] ([KeyServicio]);
GO

ALTER TABLE [dbo].[fact_seguimiento_turned] WITH CHECK ADD CONSTRAINT [FK__fact_segu__KeyTi__09A971A2] FOREIGN KEY ([KeyTiempo]) REFERENCES [dbo].[Dim_Tiempo] ([KeyTiempo]);
GO

-- 4. BUYER: DDL DE SU ENTREGA PUBLICADA; SIN CAMBIAR GRANO NI MEDIDAS.

-- Fuente: database/buyer_revision/semana9/init_mart.sql
CREATE TABLE dbo.fact_captacion_buyer (
    id_persona INT NOT NULL CONSTRAINT PK_FactBuyer_Atomico PRIMARY KEY,
    id_captacion INT NOT NULL CONSTRAINT UQ_FactBuyer_Captacion UNIQUE,
    KeyTiempo INT NOT NULL REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeyTiempoConversion INT NULL REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeySede INT NOT NULL REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT NOT NULL REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyCanal INT NOT NULL REFERENCES dbo.Dim_Canal(KeyCanal),
    KeyFuente INT NOT NULL REFERENCES dbo.Dim_Fuente(KeyFuente),
    KeyTipoPersona INT NOT NULL REFERENCES dbo.Dim_TipoPersona(KeyTipoPersona),
    KeyEstadoRegistro INT NOT NULL REFERENCES dbo.Dim_EstadoRegistro(KeyEstadoRegistro),
    contacto_registrado INT NOT NULL CONSTRAINT CK_FactBuyer_Registrado CHECK (contacto_registrado=1),
    contacto_utilizable INT NOT NULL CONSTRAINT CK_FactBuyer_Utilizable CHECK (contacto_utilizable IN (0,1)),
    conversion_lead INT NOT NULL CONSTRAINT CK_FactBuyer_Conversion CHECK (conversion_lead IN (0,1)),
    tiempo_conversion_dia DECIMAL(18,6) NULL,
    costo_atribuido_captacion DECIMAL(14,2) NULL,
    fecha_captacion DATETIME2 NOT NULL,
    fecha_conversion DATETIME2 NULL,
    id_evento_conversion INT NULL,
    origen_datos VARCHAR(30) NOT NULL,
    fecha_corte_etl DATETIME2 NOT NULL,
    CONSTRAINT CK_FactBuyer_Evidencia CHECK (
        (conversion_lead=0 AND fecha_conversion IS NULL AND id_evento_conversion IS NULL
         AND tiempo_conversion_dia IS NULL AND KeyTiempoConversion IS NULL)
        OR (conversion_lead=1 AND fecha_conversion IS NOT NULL
            AND tiempo_conversion_dia IS NOT NULL AND fecha_conversion>=fecha_captacion
            AND id_evento_conversion IS NOT NULL AND tiempo_conversion_dia>=0
            AND KeyTiempoConversion IS NOT NULL)
    )
);
GO

-- Fuente: database/buyer_revision/semana9/06_segunda_tabla_hecho_inversion_buyer.sql
CREATE TABLE dbo.fact_inversion_campana_buyer (
        id_gasto INT NOT NULL CONSTRAINT PK_FactInversionCampana PRIMARY KEY,
        KeyTiempo INT NOT NULL CONSTRAINT FK_FactInversion_Tiempo REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyFuente INT NOT NULL CONSTRAINT FK_FactInversion_Fuente REFERENCES dbo.Dim_Fuente(KeyFuente),
        KeyCanal INT NOT NULL CONSTRAINT FK_FactInversion_Canal REFERENCES dbo.Dim_Canal(KeyCanal),
        monto_inversion DECIMAL(14,2) NOT NULL CONSTRAINT CK_FactInversion_MontoPositivo CHECK (monto_inversion >= 0),
        impresiones INT NULL,
        clics INT NULL,
        fecha_gasto DATE NOT NULL,
        descripcion_gasto NVARCHAR(255) NULL,
        origen_datos VARCHAR(30) NOT NULL CONSTRAINT DF_FactInversion_Origen DEFAULT 'OLTP_GASTOS_CAMPANA',
        fecha_corte_etl DATETIME2 NOT NULL CONSTRAINT DF_FactInversion_ETL DEFAULT SYSDATETIME()
    );
GO

-- 5. VALIDACION DE ESTRUCTURA. La poblacion de miembros/medidas se ejecuta despues.
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>28
 OR (SELECT COUNT(*) FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.is_ms_shipped=0)<>195
 THROW 55104,'Cantidad inesperada de tablas o columnas del Mart.',1;
IF (SELECT COUNT(*) FROM sys.foreign_keys)<>60
 OR EXISTS (SELECT 1 FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
 OR EXISTS (SELECT 1 FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1)
 THROW 55105,'Relaciones o restricciones incompletas.',1;
IF (SELECT COUNT(*) FROM sys.foreign_keys WHERE OBJECT_NAME(parent_object_id) IN
 ('fact_oportunidades_lead','fact_propuestas_aceptadas_lead','fact_propuestas_rechazadas_lead',
  'fact_alternativas_aceptadas_lead','fact_alternativas_rechazadas_lead'))<>25
 THROW 55106,'No estan las 25 relaciones de los cinco hechos LEAD.',1;
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE 'Dim[_]%')<>17
 OR (SELECT COUNT(*) FROM sys.tables WHERE name LIKE 'fact[_]%')<>11
 THROW 55107,'Cantidad inesperada de dimensiones o hechos.',1;
EXEC sys.sp_addextendedproperty @name=N'NexoSaludPaquete',@value=N'LEAD-MART-2026-11-BUYER-REVISADO';
IF @@TRANCOUNT<>1 THROW 55108,'Estado de transaccion inesperado.',1;
COMMIT TRANSACTION;
SELECT DB_NAME() mart_instalado,17 dimensiones,11 hechos,25 relaciones_lead,SYSUTCDATETIME() confirmado_utc;
GO
