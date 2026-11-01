-- REVISION BUYER / BASE: archivos originales de Semana 9.
-- Solo crear desde cero en una instancia/copia de pruebas.
-- Para bases existentes usar migracion_buyer.sql; no repetir CREATE de tablas OLTP.
-- No ejecutar simultaneamente el syncBuyer antiguo del backend.

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'NexoSaludDB')
BEGIN
    CREATE DATABASE NexoSaludDB;
END;
GO
USE NexoSaludDB;
GO

CREATE TABLE Etapas (
    id_etapa        INT IDENTITY(1,1) PRIMARY KEY,
    nombre          VARCHAR(20) NOT NULL UNIQUE,
    descripcion     VARCHAR(200) NULL
);
GO


INSERT INTO Etapas (nombre, descripcion)
VALUES
('BUYER', 'Contacto identificable con autorización de contacto'),
('LEAD', 'Persona con intención administrativa concreta'),
('PAYER', 'Persona con pago inicial validado'),
('CUSTOMER', 'Persona que recibe el servicio'),
('TURNED', 'Servicio finalizado y gestión postventa');
GO


CREATE TABLE Canales (
    id_canal        INT IDENTITY(1,1) PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE,
    activo          BIT NOT NULL DEFAULT 1
);
GO


INSERT INTO Canales (nombre)
VALUES
('WhatsApp'),
('Facebook'),
('Instagram'),
('Página Web'),
('Formulario Web'),
('Llamada'),
('Correo Electrónico');
GO


CREATE TABLE Fuentes (
    id_fuente       INT IDENTITY(1,1) PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL UNIQUE,
    descripcion     VARCHAR(200) NULL,
    activo          BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE Horarios (
    id_horario      INT IDENTITY(1,1) PRIMARY KEY,
    dia_semana      TINYINT NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,

    CONSTRAINT CK_Horarios_Dia CHECK (dia_semana BETWEEN 1 AND 7),

    CONSTRAINT CK_Horarios_Hora CHECK (hora_inicio < hora_fin)
);
GO

CREATE TABLE Modalidades (
    id_modalidad    INT IDENTITY(1,1) PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE
);
GO


INSERT INTO Modalidades (nombre)
VALUES
('Presencial'),
('Virtual');
GO


CREATE TABLE Roles (
    id_rol          INT IDENTITY(1,1) PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE
);
GO


INSERT INTO Roles (nombre)
VALUES
('Administrador'),
('Marketing'),
('Negociador'),
('Cobranza'),
('Soporte'),
('PostVenta');
GO


CREATE TABLE Usuarios (
    id_usuario      INT IDENTITY(1,1) PRIMARY KEY,
    nombres         VARCHAR(50) NOT NULL,
    apellidos       VARCHAR(50) NOT NULL,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    id_rol          INT NOT NULL,
    activo          BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (id_rol) REFERENCES Roles(id_rol)
);
GO

CREATE TABLE Campanas (
    id_campana      INT IDENTITY(1,1) PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     VARCHAR(300) NULL,

    id_fuente       INT NULL,
    id_canal        INT NULL,

    fecha_inicio    DATE NULL,
    fecha_fin       DATE NULL,

    activo          BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Campanas_Fuente FOREIGN KEY (id_fuente) REFERENCES Fuentes(id_fuente),
    CONSTRAINT FK_Campanas_Canal FOREIGN KEY (id_canal) REFERENCES Canales(id_canal)
);
GO

CREATE TABLE Servicios (
    id_servicio     INT IDENTITY(1,1) PRIMARY KEY,

    nombre          VARCHAR(100) NOT NULL UNIQUE,
    descripcion     VARCHAR(300) NULL,

    activo          BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE Personas (
    id_persona          INT IDENTITY(1,1) PRIMARY KEY,

    nombres             VARCHAR(50) NOT NULL,
    apellidos           VARCHAR(50) NOT NULL,

    dni                 CHAR(8) NULL,
    email               VARCHAR(100) NULL,
    numero              VARCHAR(20) NULL,

    fecha_nacimiento    DATE NULL,
    zona                VARCHAR(100) NULL,
    tipo_persona        VARCHAR(30) NULL DEFAULT 'Adulto General',

    autoriza_contacto   BIT NOT NULL DEFAULT 0,
    fecha_autorizacion  DATETIME2 NULL,
    estado_calidad      VARCHAR(20) NOT NULL DEFAULT 'Valido',

    id_campana_origen   INT NULL,
    id_canal_origen     INT NULL,
    id_etapa_actual     INT NOT NULL,

    fecha_registro      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_Personas_Etapa FOREIGN KEY (id_etapa_actual) REFERENCES Etapas(id_etapa),
    CONSTRAINT FK_Personas_Campana FOREIGN KEY (id_campana_origen) REFERENCES Campanas(id_campana),
    CONSTRAINT FK_Personas_Canal FOREIGN KEY (id_canal_origen) REFERENCES Canales(id_canal),
    CONSTRAINT CK_Personas_Calidad CHECK (estado_calidad IN ('Valido', 'Incompleto', 'Duplicado', 'Rechazado'))
);
GO

CREATE UNIQUE NONCLUSTERED INDEX UQ_Personas_DNI_NotNull
ON Personas(dni)
WHERE dni IS NOT NULL;
GO

CREATE TABLE DatosAcademicos (
    id_dato_academico INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,

    universidad     VARCHAR(150) NULL,
    carrera         VARCHAR(150) NULL,
    ciclo           VARCHAR(30) NULL,

    aplica          BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_DatosAcademicos_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona)
);
GO

CREATE TABLE DatosLaborales (
    id_dato_laboral INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,

    ocupacion       VARCHAR(100) NULL,
    empresa         VARCHAR(150) NULL,
    modalidad       VARCHAR(50) NULL,
    disponibilidad  VARCHAR(200) NULL,

    aplica BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_DatosLaborales_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona)
);
GO

CREATE TABLE PersonaSaludOdontologica (
    id_salud_odonto             INT IDENTITY(1,1) PRIMARY KEY,
    id_persona                  INT NOT NULL,

    ultima_visita_odontologica  VARCHAR(50) NULL,
    motivo_consulta             VARCHAR(100) NULL,
    tratamiento_previo          VARCHAR(100) NULL,
    nivel_dolor                 VARCHAR(20) NULL,
    presenta_sensibilidad       VARCHAR(10) NULL,
    sangrado_o_inflamacion      VARCHAR(30) NULL,
    usa_aparato_o_protesis      VARCHAR(30) NULL,
    condicion_atencion_especial VARCHAR(100) NULL,

    fecha_registro              DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_PersonaSaludOdonto_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona)
);
GO

CREATE TABLE PersonaPreferencias (
    id_preferencia      INT IDENTITY(1,1) PRIMARY KEY,

    id_persona          INT NOT NULL,
    id_canal            INT NULL,
    id_horario          INT NULL,
    id_modalidad        INT NULL,
    id_servicio_interes INT NULL,

    sede_preferida      VARCHAR(150) NULL,
    profesional_preferido VARCHAR(150) NULL,

    fecha_inicio        DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_fin           DATETIME2 NULL,

    CONSTRAINT FK_Preferencias_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),
    CONSTRAINT FK_Preferencias_Canal  FOREIGN KEY (id_canal) REFERENCES Canales(id_canal),
    CONSTRAINT FK_Preferencias_Horario  FOREIGN KEY (id_horario) REFERENCES Horarios(id_horario),
    CONSTRAINT FK_Preferencias_Modalidad FOREIGN KEY (id_modalidad)  REFERENCES Modalidades(id_modalidad),
    CONSTRAINT FK_Preferencias_Servicio FOREIGN KEY (id_servicio_interes) REFERENCES Servicios(id_servicio),
    CONSTRAINT CK_Preferencias_Fechas CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);
GO


INSERT INTO Servicios (nombre, descripcion)
VALUES
('Evaluación odontológica', 'Evaluación odontológica inicial'),
('Limpieza dental', 'Servicio de limpieza dental'),
('Profilaxis', 'Servicio de profilaxis'),
('Fluorización', 'Aplicación preventiva de flúor'),
('Restauración dental', 'Restauración dental básica'),
('Control odontológico', 'Control y seguimiento odontológico');
GO


CREATE TABLE Tarifas (
    id_tarifa       INT IDENTITY(1,1) PRIMARY KEY,

    id_servicio     INT NOT NULL,

    precio          DECIMAL(10,2) NOT NULL,
    fecha_inicio    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_fin       DATETIME2 NULL,

    activo          BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Tarifas_Servicio FOREIGN KEY (id_servicio) REFERENCES Servicios(id_servicio),

    CONSTRAINT CK_Tarifas_Precio CHECK (precio >= 0),

    CONSTRAINT CK_Tarifas_Fechas CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);
GO

CREATE TABLE Profesionales (
    id_profesional  INT IDENTITY(1,1) PRIMARY KEY,

    nombres         VARCHAR(50) NOT NULL,
    apellidos       VARCHAR(50) NOT NULL,

    numero_colegiatura VARCHAR(50) NULL,
    especialidad    VARCHAR(100) NULL,

    activo          BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE Sedes (
    id_sede         INT IDENTITY(1,1) PRIMARY KEY,

    nombre          VARCHAR(100) NOT NULL,
    direccion       VARCHAR(200) NOT NULL,
    zona            VARCHAR(100) NULL,

    activo          BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE ProfesionalServicio (
    id_profesional  INT NOT NULL,
    id_servicio     INT NOT NULL,

    PRIMARY KEY (id_profesional, id_servicio),

    CONSTRAINT FK_ProfesionalServicio_Profesional  FOREIGN KEY (id_profesional)  REFERENCES Profesionales(id_profesional),

    CONSTRAINT FK_ProfesionalServicio_Servicio  FOREIGN KEY (id_servicio) REFERENCES Servicios(id_servicio)
);
GO

CREATE TABLE Disponibilidad (
    id_disponibilidad INT IDENTITY(1,1) PRIMARY KEY,

    id_profesional  INT NOT NULL,
    id_sede         INT NOT NULL,

    fecha           DATE NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,

    estado          VARCHAR(20) NOT NULL DEFAULT 'Disponible',

    CONSTRAINT FK_Disponibilidad_Profesional  FOREIGN KEY (id_profesional) REFERENCES Profesionales(id_profesional),

    CONSTRAINT FK_Disponibilidad_Sede FOREIGN KEY (id_sede)  REFERENCES Sedes(id_sede),

    CONSTRAINT CK_Disponibilidad_Estado CHECK (estado IN ('Disponible', 'Bloqueado', 'Ocupado')),

    CONSTRAINT CK_Disponibilidad_Hora  CHECK (hora_inicio < hora_fin)
);
GO

CREATE TABLE Interacciones (
    id_interaccion  INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,
    id_canal        INT NULL,
    id_fuente       INT NULL,
    id_usuario      INT NULL,

    fecha_hora      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    tipo            VARCHAR(50) NOT NULL,
    mensaje         VARCHAR(MAX) NULL,

    es_respuesta_util BIT NOT NULL DEFAULT 0,

    resultado       VARCHAR(200) NULL,

    CONSTRAINT FK_Interacciones_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),

    CONSTRAINT FK_Interacciones_Canal FOREIGN KEY (id_canal) REFERENCES Canales(id_canal),

    CONSTRAINT FK_Interacciones_Fuente FOREIGN KEY (id_fuente) REFERENCES Fuentes(id_fuente),

    CONSTRAINT FK_Interacciones_Usuario FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
);
GO

CREATE TABLE Solicitudes (
    id_solicitud    INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,
    id_servicio     INT NULL,

    fecha_solicitud DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    motivo          VARCHAR(200) NULL,

    tipo_consulta   VARCHAR(50) NULL,

    prioridad       VARCHAR(20) NULL,

    estado          VARCHAR(30) NOT NULL DEFAULT 'Abierta',

    fecha_primera_respuesta DATETIME2 NULL,

    fecha_cierre    DATETIME2 NULL,

    CONSTRAINT FK_Solicitudes_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),

    CONSTRAINT FK_Solicitudes_Servicio FOREIGN KEY (id_servicio) REFERENCES Servicios(id_servicio),

    CONSTRAINT CK_Solicitudes_Estado CHECK (  estado IN ( 'Abierta','En negociación','Convertida','Cerrada','Abandonada'))
);
GO

CREATE TABLE Opciones (
    id_opcion       INT IDENTITY(1,1) PRIMARY KEY,

    id_solicitud        INT NOT NULL,
    id_disponibilidad   INT NOT NULL,

    precio_ofrecido DECIMAL(10,2) NOT NULL,

    fecha_ofrecida  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    seleccionada    BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_Opciones_Solicitud FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(id_solicitud),

    CONSTRAINT FK_Opciones_Disponibilidad FOREIGN KEY (id_disponibilidad) REFERENCES Disponibilidad(id_disponibilidad),

    CONSTRAINT CK_Opciones_Precio CHECK (precio_ofrecido >= 0)
);
GO

CREATE TABLE Reservas (
    id_reserva      INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,
    id_solicitud    INT NOT NULL,
    id_opcion       INT NOT NULL,

    fecha_reserva   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    estado          VARCHAR(30) NOT NULL DEFAULT 'Pendiente',

    fecha_vencimiento_bloqueo   DATETIME2 NULL,

    confirmacion_explicita      BIT NOT NULL DEFAULT 0,
    fecha_confirmacion          DATETIME2 NULL,

    CONSTRAINT FK_Reservas_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),

    CONSTRAINT FK_Reservas_Solicitud FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(id_solicitud),

    CONSTRAINT FK_Reservas_Opcion  FOREIGN KEY (id_opcion) REFERENCES Opciones(id_opcion),

    CONSTRAINT CK_Reservas_Estado CHECK ( estado IN ('Pendiente', 'Bloqueada', 'Confirmada', 'Atendida','Cancelada','No asistió', 'Vencida' ))
);
GO

CREATE TABLE Pagos (
    id_pago         INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,
    id_reserva      INT NOT NULL,

    referencia_pago VARCHAR(100) NULL,

    importe         DECIMAL(10,2) NOT NULL,

    canal_pago      VARCHAR(50) NULL,

    fecha_registro  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    fecha_validacion DATETIME2 NULL,

    estado          VARCHAR(20) NOT NULL DEFAULT 'Pendiente',

    comprobante     VARCHAR(300) NULL,

    validado_por    INT NULL,

    observaciones   VARCHAR(300) NULL,

    CONSTRAINT FK_Pagos_Persona FOREIGN KEY (id_persona)
        REFERENCES Personas(id_persona),

    CONSTRAINT FK_Pagos_Reserva FOREIGN KEY (id_reserva) REFERENCES Reservas(id_reserva),

    CONSTRAINT FK_Pagos_Usuario FOREIGN KEY (validado_por) REFERENCES Usuarios(id_usuario),

    CONSTRAINT CK_Pagos_Importe CHECK (importe >= 0),

    CONSTRAINT CK_Pagos_Estado CHECK (estado IN ('Pendiente','Confirmado','Fallido','Revertido' ))
);
GO

CREATE TABLE Atenciones (
    id_atencion          INT IDENTITY(1,1) PRIMARY KEY,

    id_persona           INT NOT NULL,
    id_reserva           INT NOT NULL,
    id_servicio          INT NOT NULL,

    id_profesional       INT NOT NULL,
    id_sede              INT NOT NULL,

    fecha_atencion       DATETIME2 NOT NULL,
    fecha_inicio         DATETIME2 NULL,
    fecha_fin            DATETIME2 NULL,

    asistencia           VARCHAR(20) NOT NULL DEFAULT 'Pendiente',

    estado_servicio      VARCHAR(30) NOT NULL DEFAULT 'Programado',

    motivo_consulta      VARCHAR(300) NULL,
    antecedentes         VARCHAR(500) NULL,
    alergias             VARCHAR(300) NULL,
    evaluacion           VARCHAR(500) NULL,
    diagnostico_basico   VARCHAR(200) NULL,
    procedimiento        VARCHAR(500) NULL,
    procedimiento_realizado VARCHAR(200) NULL,
    observaciones        VARCHAR(500) NULL,

    resultado            VARCHAR(200) NULL,

    indicaciones_finales VARCHAR(500) NULL,

    CONSTRAINT FK_Atenciones_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),

    CONSTRAINT FK_Atenciones_Reserva FOREIGN KEY (id_reserva) REFERENCES Reservas(id_reserva),

    CONSTRAINT FK_Atenciones_Servicio FOREIGN KEY (id_servicio) REFERENCES Servicios(id_servicio),

    CONSTRAINT FK_Atenciones_Profesional FOREIGN KEY (id_profesional) REFERENCES Profesionales(id_profesional),

    CONSTRAINT FK_Atenciones_Sede FOREIGN KEY (id_sede) REFERENCES Sedes(id_sede),

    CONSTRAINT CK_Atenciones_Asistencia CHECK ( asistencia IN ( 'Pendiente', 'Asistió', 'No asistió' ) ),

    CONSTRAINT CK_Atenciones_Estado  CHECK ( estado_servicio IN ( 'Programado', 'En proceso', 'Realizado', 'Cancelado' ) )
);
GO

CREATE TABLE Seguimientos (
    id_seguimiento  INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,
    id_atencion     INT NOT NULL,
    id_usuario      INT NULL,

    fecha_hora      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    canal           VARCHAR(50) NULL,

    tipo            VARCHAR(50) NOT NULL,

    resultado       VARCHAR(200) NULL,

    satisfaccion    TINYINT NULL,

    incidencia      BIT NOT NULL DEFAULT 0,

    observaciones   VARCHAR(500) NULL,

    CONSTRAINT FK_Seguimientos_Persona FOREIGN KEY (id_persona)  REFERENCES Personas(id_persona),

    CONSTRAINT FK_Seguimientos_Atencion FOREIGN KEY (id_atencion) REFERENCES Atenciones(id_atencion),

    CONSTRAINT FK_Seguimientos_Usuario FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario),

    CONSTRAINT CK_Seguimientos_Satisfaccion CHECK (satisfaccion IS NULL OR satisfaccion BETWEEN 1 AND 5 )
);
GO

CREATE TABLE EventosEtapa (
    id_evento_etapa INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NOT NULL,

    etapa_origen    INT NULL,
    etapa_destino   INT NOT NULL,

    fecha_hora      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    id_usuario      INT NULL,

    motivo          VARCHAR(300) NULL,
    evidencia       VARCHAR(500) NULL,

    CONSTRAINT FK_EventosEtapa_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),

    CONSTRAINT FK_EventosEtapa_Origen FOREIGN KEY (etapa_origen) REFERENCES Etapas(id_etapa),

    CONSTRAINT FK_EventosEtapa_Destino FOREIGN KEY (etapa_destino) REFERENCES Etapas(id_etapa),

    CONSTRAINT FK_EventosEtapa_Usuario FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
);
GO

CREATE TABLE GastosCampana (
    id_gasto        INT IDENTITY(1,1) PRIMARY KEY,

    id_campana      INT NOT NULL,

    fecha           DATE NOT NULL,
    importe         DECIMAL(10,2) NOT NULL,

    descripcion     VARCHAR(300) NULL,

    CONSTRAINT FK_GastosCampana_Campana FOREIGN KEY (id_campana) REFERENCES Campanas(id_campana),
    CONSTRAINT CK_GastosCampana_Importe CHECK (importe >= 0)
);
GO

CREATE TABLE DecisionesIA (
    id_decision     INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NULL,
    id_usuario      INT NULL,

    agente          VARCHAR(50) NOT NULL,

    fecha_hora      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    entrada         VARCHAR(MAX) NULL,
    regla_aplicada  VARCHAR(300) NULL,
    decision        VARCHAR(500) NULL,
    accion          VARCHAR(500) NULL,

    requiere_revision   BIT NOT NULL DEFAULT 0,
    resultado_revision  VARCHAR(300) NULL,

    CONSTRAINT FK_DecisionesIA_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),
    CONSTRAINT FK_DecisionesIA_Usuario FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
);
GO

CREATE TABLE Incidencias (
    id_incidencia   INT IDENTITY(1,1) PRIMARY KEY,

    id_persona      INT NULL,
    id_pago         INT NULL,
    id_reserva      INT NULL,
    id_atencion     INT NULL,

    tipo            VARCHAR(100) NOT NULL,
    descripcion     VARCHAR(500) NOT NULL,

    prioridad       VARCHAR(20) NOT NULL DEFAULT 'Media',

    estado          VARCHAR(30) NOT NULL DEFAULT 'Abierta',

    fecha_registro      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_resolucion    DATETIME2 NULL,

    id_usuario_responsable INT NULL,

    CONSTRAINT FK_Incidencias_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona),
    CONSTRAINT FK_Incidencias_Pago FOREIGN KEY (id_pago) REFERENCES Pagos(id_pago),
    CONSTRAINT FK_Incidencias_Reserva FOREIGN KEY (id_reserva) REFERENCES Reservas(id_reserva),
    CONSTRAINT FK_Incidencias_Atencion FOREIGN KEY (id_atencion) REFERENCES Atenciones(id_atencion),
    CONSTRAINT FK_Incidencias_Usuario FOREIGN KEY (id_usuario_responsable)  REFERENCES Usuarios(id_usuario),
    CONSTRAINT CK_Incidencias_Prioridad CHECK ( prioridad IN ('Baja', 'Media', 'Alta', 'Crítica')),
    CONSTRAINT CK_Incidencias_Estado CHECK ( estado IN ('Abierta', 'En proceso', 'Resuelta', 'Cerrada'))
);
GO

-- índices

CREATE INDEX IX_Interacciones_Persona_Fecha ON Interacciones(id_persona, fecha_hora);
GO
CREATE INDEX IX_Solicitudes_Persona_Fecha ON Solicitudes(id_persona, fecha_solicitud);
GO
CREATE INDEX IX_Reservas_Fecha_Estado ON Reservas(fecha_reserva, estado);
GO
CREATE INDEX IX_Pagos_Estado_Fecha ON Pagos(estado, fecha_registro);
GO
CREATE INDEX IX_EventosEtapa_Persona_Fecha ON EventosEtapa(id_persona, fecha_hora);
GO
CREATE INDEX IX_Disponibilidad_Fecha_Estado ON Disponibilidad(fecha, estado);
GO

-- EXTENSION BUYER: una captacion inicial por persona, sin cambiar otras fases.
-- Los historicos sin evidencia de sede/servicio permanecen NULL.
USE NexoSaludDB;
GO
IF OBJECT_ID('dbo.CaptacionesBuyer','U') IS NULL
CREATE TABLE dbo.CaptacionesBuyer (
    id_captacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CaptacionesBuyer PRIMARY KEY,
    id_persona INT NOT NULL,
    fecha_captacion DATETIME2 NOT NULL,
    id_canal INT NULL REFERENCES dbo.Canales(id_canal),
    id_fuente INT NULL REFERENCES dbo.Fuentes(id_fuente),
    id_campana INT NULL REFERENCES dbo.Campanas(id_campana),
    id_sede INT NULL REFERENCES dbo.Sedes(id_sede),
    id_servicio INT NULL REFERENCES dbo.Servicios(id_servicio),
    motivo_consulta NVARCHAR(500) NULL,
    estado_calidad VARCHAR(20) NOT NULL,
    autoriza_contacto BIT NOT NULL CONSTRAINT DF_CaptacionesBuyer_Autoriza DEFAULT 0,
    fecha_autorizacion DATETIME2 NULL,
    origen_datos VARCHAR(30) NOT NULL,
    fecha_observacion DATETIME2 NOT NULL CONSTRAINT DF_CaptacionesBuyer_Observacion DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_CaptacionesBuyer_Persona UNIQUE (id_persona),
    CONSTRAINT FK_CaptacionesBuyer_Persona FOREIGN KEY (id_persona) REFERENCES dbo.Personas(id_persona),
    CONSTRAINT CK_CaptacionesBuyer_Calidad CHECK
        (estado_calidad IN ('Valido','Incompleto','Duplicado','Rechazado')),
    CONSTRAINT CK_CaptacionesBuyer_Origen CHECK
        (origen_datos IN ('REGISTRO_DIRECTO','HISTORICO_OBSERVADO'))
);
GO
IF COL_LENGTH('dbo.EventosEtapa','id_captacion') IS NULL
    ALTER TABLE dbo.EventosEtapa ADD id_captacion INT NULL
        CONSTRAINT FK_EventosEtapa_CaptacionBuyer REFERENCES dbo.CaptacionesBuyer(id_captacion);
GO
IF COL_LENGTH('dbo.EventosEtapa','id_solicitud') IS NULL
    ALTER TABLE dbo.EventosEtapa ADD id_solicitud INT NULL
        CONSTRAINT FK_EventosEtapa_SolicitudBuyer REFERENCES dbo.Solicitudes(id_solicitud);
GO
IF COL_LENGTH('dbo.EventosEtapa','clave_operacion_buyer') IS NULL
    ALTER TABLE dbo.EventosEtapa ADD clave_operacion_buyer VARCHAR(80) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.EventosEtapa')
               AND name='UQ_EventosEtapa_OperacionBuyer')
    CREATE UNIQUE INDEX UQ_EventosEtapa_OperacionBuyer
    ON dbo.EventosEtapa(clave_operacion_buyer) WHERE clave_operacion_buyer IS NOT NULL;
GO
-- Campos opcionales para enlazar las recomendaciones futuras del agente.
IF COL_LENGTH('dbo.DecisionesIA','id_captacion') IS NULL
    ALTER TABLE dbo.DecisionesIA ADD id_captacion INT NULL
        CONSTRAINT FK_DecisionesIA_CaptacionBuyer REFERENCES dbo.CaptacionesBuyer(id_captacion);
GO
IF COL_LENGTH('dbo.DecisionesIA','id_interaccion') IS NULL
    ALTER TABLE dbo.DecisionesIA ADD id_interaccion INT NULL
        CONSTRAINT FK_DecisionesIA_InteraccionBuyer REFERENCES dbo.Interacciones(id_interaccion);
GO
-- Consulta de preparacion: no usa Solicitudes ni etapa actual para convertir.
CREATE OR ALTER VIEW dbo.v_DatosCaptacionBuyer AS
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
-- Operacion futura del backend: escritura atomica y reintentos idempotentes.
-- No la invoca automaticamente el ETL ni concede autorizacion.
CREATE OR ALTER PROCEDURE dbo.usp_ConvertirBuyerALead
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
