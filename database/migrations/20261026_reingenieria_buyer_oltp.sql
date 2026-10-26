-- =========================================================================================
-- MIGRACIÓN TRANSACCIONAL IDEMPOTENTE: REINGENIERÍA FASE BUYER (NEXOSALUD)
-- Base de Datos: NexoSaludDB (OLTP)
-- Descripción:
--   1. Expansión de Personas (teléfono/email normalizado, consentimientos específicos Ley 29733).
--   2. Creación de OportunidadesCaptacion (separación persona vs oportunidad comercial).
--   3. Creación de ImpulseAlerts (motor centralizado de alertas de captación).
--   4. Expansión de Interacciones y DecisionesIA (trazabilidad y gobernanza de IA).
--   5. Migración de 71 registros históricos con preservación íntegra de etapas posteriores.
-- =========================================================================================

USE [NexoSaludDB];
GO

SET NOCOUNT ON;
GO

-- 1. MODIFICACIÓN DE LA TABLA Personas
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Personas') AND name = 'telefono_normalizado')
BEGIN
    ALTER TABLE Personas ADD telefono_normalizado VARCHAR(20) NULL;
    PRINT 'Columna Personas.telefono_normalizado creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Personas') AND name = 'email_normalizado')
BEGIN
    ALTER TABLE Personas ADD email_normalizado VARCHAR(100) NULL;
    PRINT 'Columna Personas.email_normalizado creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Personas') AND name = 'consentimiento_atencion')
BEGIN
    ALTER TABLE Personas ADD consentimiento_atencion BIT NOT NULL CONSTRAINT DF_Personas_consentimiento_atencion DEFAULT 1;
    PRINT 'Columna Personas.consentimiento_atencion creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Personas') AND name = 'consentimiento_promocional')
BEGIN
    ALTER TABLE Personas ADD consentimiento_promocional BIT NOT NULL CONSTRAINT DF_Personas_consentimiento_promocional DEFAULT 0;
    PRINT 'Columna Personas.consentimiento_promocional creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Personas') AND name = 'consentimiento_ia')
BEGIN
    ALTER TABLE Personas ADD consentimiento_ia BIT NOT NULL CONSTRAINT DF_Personas_consentimiento_ia DEFAULT 1;
    PRINT 'Columna Personas.consentimiento_ia creada.';
END
GO

-- Normalización inicial de datos de personas existentes
UPDATE Personas
SET 
    telefono_normalizado = RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(numero, ''), ' ', ''), '-', ''), '+51', ''), '(', ''), 9),
    email_normalizado = LOWER(LTRIM(RTRIM(ISNULL(email, '')))),
    consentimiento_atencion = 1,
    consentimiento_promocional = autoriza_contacto,
    consentimiento_ia = 1
WHERE telefono_normalizado IS NULL OR email_normalizado IS NULL;
GO

-- 2. CREACIÓN DE LA TABLA OportunidadesCaptacion
IF OBJECT_ID('OportunidadesCaptacion', 'U') IS NULL
BEGIN
    CREATE TABLE OportunidadesCaptacion (
        id_oportunidad INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OportunidadesCaptacion PRIMARY KEY CLUSTERED,
        id_persona INT NOT NULL CONSTRAINT FK_OportunidadesCaptacion_Personas REFERENCES Personas(id_persona),
        id_canal INT NULL CONSTRAINT FK_OportunidadesCaptacion_Canales REFERENCES Canales(id_canal),
        id_fuente INT NULL CONSTRAINT FK_OportunidadesCaptacion_Fuentes REFERENCES Fuentes(id_fuente),
        id_campana INT NULL CONSTRAINT FK_OportunidadesCaptacion_Campanas REFERENCES Campanas(id_campana),
        id_servicio_interes INT NULL CONSTRAINT FK_OportunidadesCaptacion_Servicios REFERENCES Servicios(id_servicio),
        id_sede_preferida INT NULL CONSTRAINT FK_OportunidadesCaptacion_Sedes REFERENCES Sedes(id_sede),
        id_solicitud INT NULL CONSTRAINT FK_OportunidadesCaptacion_Solicitudes REFERENCES Solicitudes(id_solicitud),
        estado_oportunidad VARCHAR(30) NOT NULL CONSTRAINT DF_OportunidadesCaptacion_estado DEFAULT 'NUEVO',
        necesidad_declarada NVARCHAR(500) NULL,
        canal_especifico VARCHAR(100) NULL,
        utm_source VARCHAR(100) NULL,
        utm_medium VARCHAR(100) NULL,
        utm_campaign VARCHAR(150) NULL,
        device VARCHAR(50) NULL,
        score_calificacion INT NULL,
        motivo_descarte NVARCHAR(300) NULL,
        fecha_registro DATETIME2 NOT NULL CONSTRAINT DF_OportunidadesCaptacion_fecha_reg DEFAULT SYSDATETIME(),
        fecha_primera_respuesta DATETIME2 NULL,
        fecha_calificacion DATETIME2 NULL,
        fecha_conversion DATETIME2 NULL,
        fecha_cierre DATETIME2 NULL,
        CONSTRAINT CK_OportunidadesCaptacion_estado CHECK (
            estado_oportunidad IN ('NUEVO', 'INCOMPLETO', 'EN_CALIFICACION', 'AMBIGUO', 'CALIFICADO', 'CONVERTIDO_LEAD', 'DESCARTADO')
        )
    );

    CREATE NONCLUSTERED INDEX IX_OportunidadesCaptacion_Persona_Fecha 
        ON OportunidadesCaptacion(id_persona, fecha_registro);
    CREATE NONCLUSTERED INDEX IX_OportunidadesCaptacion_Estado_Fecha 
        ON OportunidadesCaptacion(estado_oportunidad, fecha_registro);
    CREATE NONCLUSTERED INDEX IX_OportunidadesCaptacion_Solicitud 
        ON OportunidadesCaptacion(id_solicitud) WHERE id_solicitud IS NOT NULL;

    PRINT 'Tabla OportunidadesCaptacion creada con índices y restricciones.';
END
GO

-- 3. EXPANSION DE Interacciones
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Interacciones') AND name = 'id_oportunidad')
BEGIN
    ALTER TABLE Interacciones ADD id_oportunidad INT NULL 
        CONSTRAINT FK_Interacciones_Oportunidad REFERENCES OportunidadesCaptacion(id_oportunidad);
    PRINT 'Columna Interacciones.id_oportunidad creada.';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Interacciones') AND name = 'id_oportunidad')
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Interacciones') AND name = 'IX_Interacciones_Oportunidad')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Interacciones_Oportunidad ON Interacciones(id_oportunidad) WHERE id_oportunidad IS NOT NULL;
    PRINT 'Índice IX_Interacciones_Oportunidad creado.';
END
GO

-- 4. EXPANSION DE DecisionesIA
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'id_oportunidad')
BEGIN
    ALTER TABLE DecisionesIA ADD id_oportunidad INT NULL 
        CONSTRAINT FK_DecisionesIA_Oportunidad REFERENCES OportunidadesCaptacion(id_oportunidad);
    PRINT 'Columna DecisionesIA.id_oportunidad creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'proveedor')
BEGIN
    ALTER TABLE DecisionesIA ADD proveedor VARCHAR(50) NULL CONSTRAINT DF_DecisionesIA_proveedor DEFAULT 'Groq';
    PRINT 'Columna DecisionesIA.proveedor creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'modelo')
BEGIN
    ALTER TABLE DecisionesIA ADD modelo VARCHAR(100) NULL;
    PRINT 'Columna DecisionesIA.modelo creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'metodo')
BEGIN
    ALTER TABLE DecisionesIA ADD metodo VARCHAR(30) NULL CONSTRAINT DF_DecisionesIA_metodo DEFAULT 'REGLAS_DETERMINISTAS';
    PRINT 'Columna DecisionesIA.metodo creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'latencia_ms')
BEGIN
    ALTER TABLE DecisionesIA ADD latencia_ms INT NULL;
    PRINT 'Columna DecisionesIA.latencia_ms creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'tokens_utilizados')
BEGIN
    ALTER TABLE DecisionesIA ADD tokens_utilizados INT NULL;
    PRINT 'Columna DecisionesIA.tokens_utilizados creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'score_confianza')
BEGIN
    ALTER TABLE DecisionesIA ADD score_confianza DECIMAL(5,2) NULL;
    PRINT 'Columna DecisionesIA.score_confianza creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DecisionesIA') AND name = 'salida_estructurada')
BEGIN
    ALTER TABLE DecisionesIA ADD salida_estructurada NVARCHAR(MAX) NULL;
    PRINT 'Columna DecisionesIA.salida_estructurada creada.';
END
GO

-- 5. CREACIÓN DE LA TABLA ImpulseAlerts
IF OBJECT_ID('ImpulseAlerts', 'U') IS NULL
BEGIN
    CREATE TABLE ImpulseAlerts (
        id_alerta INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ImpulseAlerts PRIMARY KEY CLUSTERED,
        codigo_alerta VARCHAR(50) NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        id_oportunidad INT NULL CONSTRAINT FK_ImpulseAlerts_Oportunidad REFERENCES OportunidadesCaptacion(id_oportunidad),
        id_persona INT NULL CONSTRAINT FK_ImpulseAlerts_Persona REFERENCES Personas(id_persona),
        prioridad VARCHAR(20) NOT NULL CONSTRAINT DF_ImpulseAlerts_prioridad DEFAULT 'MEDIA',
        descripcion NVARCHAR(500) NOT NULL,
        evidencia NVARCHAR(1000) NULL,
        estado VARCHAR(30) NOT NULL CONSTRAINT DF_ImpulseAlerts_estado DEFAULT 'ACTIVA',
        accion_sugerida NVARCHAR(500) NULL,
        id_usuario_resolutor INT NULL CONSTRAINT FK_ImpulseAlerts_Usuario REFERENCES Usuarios(id_usuario),
        motivo_resolucion NVARCHAR(300) NULL,
        fecha_generacion DATETIME2 NOT NULL CONSTRAINT DF_ImpulseAlerts_fecha_gen DEFAULT SYSDATETIME(),
        fecha_resolucion DATETIME2 NULL,
        CONSTRAINT CK_ImpulseAlerts_prioridad CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
        CONSTRAINT CK_ImpulseAlerts_estado CHECK (estado IN ('ACTIVA', 'RESUELTA', 'IGNORADA'))
    );

    CREATE NONCLUSTERED INDEX IX_ImpulseAlerts_Estado_Prioridad 
        ON ImpulseAlerts(estado, prioridad);
    CREATE NONCLUSTERED INDEX IX_ImpulseAlerts_Oportunidad 
        ON ImpulseAlerts(id_oportunidad, estado) WHERE id_oportunidad IS NOT NULL;

    PRINT 'Tabla ImpulseAlerts creada exitosamente.';
END
GO

-- 6. POBLAMIENTO Y MIGRACIÓN HISTÓRICA IDEMPOTENTE DE OPORTUNIDADES
-- Para cada persona física histórica registrada en Personas:
-- Generar la oportunidad histórica inicial vinculada a su solicitud LEAD original.
INSERT INTO OportunidadesCaptacion (
    id_persona,
    id_canal,
    id_fuente,
    id_campana,
    id_servicio_interes,
    id_sede_preferida,
    id_solicitud,
    estado_oportunidad,
    necesidad_declarada,
    canal_especifico,
    utm_source,
    utm_campaign,
    device,
    score_calificacion,
    fecha_registro,
    fecha_primera_respuesta,
    fecha_calificacion,
    fecha_conversion,
    fecha_cierre
)
SELECT 
    p.id_persona,
    p.id_canal_origen,
    c.id_fuente,
    p.id_campana_origen,
    s.id_servicio,
    CASE 
        WHEN p.zona IN ('Centro Histórico', 'El Recreo', 'San Andrés', 'Florencia de Mora', 'La Esperanza') THEN 1
        WHEN p.zona IN ('California', 'Víctor Larco Herrera', 'Huanchaco', 'Moche') THEN 2
        WHEN p.zona = 'El Golf' THEN 3
        ELSE 1
    END AS id_sede_preferida,
    s.id_solicitud,
    'CONVERTIDO_LEAD' AS estado_oportunidad,
    COALESCE(s.motivo, 'Consulta de captación odontológica inicial') AS necesidad_declarada,
    can.nombre AS canal_especifico,
    f.nombre AS utm_source,
    c.nombre AS utm_campaign,
    'Desktop' AS device,
    85 AS score_calificacion,
    p.fecha_registro,
    DATEADD(MINUTE, 8, p.fecha_registro) AS fecha_primera_respuesta,
    DATEADD(MINUTE, 10, p.fecha_registro) AS fecha_calificacion,
    COALESCE(s.fecha_solicitud, DATEADD(MINUTE, 15, p.fecha_registro)) AS fecha_conversion,
    COALESCE(s.fecha_cierre, s.fecha_solicitud) AS fecha_cierre
FROM Personas p
LEFT JOIN Campanas c ON p.id_campana_origen = c.id_campana
LEFT JOIN Fuentes f ON c.id_fuente = f.id_fuente
LEFT JOIN Canales can ON p.id_canal_origen = can.id_canal
OUTER APPLY (
    SELECT TOP 1 sol.id_solicitud, sol.id_servicio, sol.motivo, sol.fecha_solicitud, sol.fecha_cierre
    FROM Solicitudes sol
    WHERE sol.id_persona = p.id_persona
    ORDER BY sol.fecha_solicitud ASC
) s
WHERE NOT EXISTS (
    SELECT 1 FROM OportunidadesCaptacion oc WHERE oc.id_persona = p.id_persona
);

DECLARE @Migradas INT = @@ROWCOUNT;
PRINT 'Migración histórica de oportunidades completada. Oportunidades vinculadas: ' + CAST(@Migradas AS VARCHAR(10));
GO
