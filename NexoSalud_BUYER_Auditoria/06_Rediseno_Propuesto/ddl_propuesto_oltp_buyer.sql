-- ============================================================================
-- SCRIPT DDL PROPUESTO: AJUSTES TRANSACCIONALES OLTP PARA FASE BUYER
-- Sistema: NexoSalud (Clínica Odontológica)
-- Base de Datos: NexoSaludDB
-- Estado: PROPUESTA DE REDISEÑO (NO APLICAR EN ETAPA DE AUDITORÍA)
-- ============================================================================

USE NexoSaludDB;
GO

-- 1. CREACIÓN DE LA ENTIDAD OPORTUNIDADES DE CAPTACIÓN (BUYER)
IF OBJECT_ID('dbo.OportunidadesCaptacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OportunidadesCaptacion (
        id_oportunidad          INT IDENTITY(1,1) PRIMARY KEY,
        id_persona              INT NOT NULL,
        id_canal                INT NOT NULL,
        id_fuente               INT NOT NULL,
        id_campana              INT NULL,
        id_servicio_interes     INT NULL,
        id_sede_preferida       INT NULL,
        
        estado_oportunidad      VARCHAR(30) NOT NULL DEFAULT 'NUEVO',
        motivo_consulta         VARCHAR(300) NOT NULL,
        franja_horaria_pref     VARCHAR(50) NULL,
        lead_score              TINYINT NULL DEFAULT 0,
        
        fecha_captacion         DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_primera_respuesta DATETIME2 NULL,
        fecha_calificacion      DATETIME2 NULL,
        fecha_conversion        DATETIME2 NULL,
        fecha_cierre            DATETIME2 NULL,
        motivo_descarte         VARCHAR(200) NULL,
        
        id_usuario_asignado     INT NULL,
        id_solicitud_lead       INT NULL, -- Vincula a Solicitudes tras convertir
        
        CONSTRAINT FK_Oportunidades_Persona FOREIGN KEY (id_persona) REFERENCES dbo.Personas(id_persona),
        CONSTRAINT FK_Oportunidades_Canal FOREIGN KEY (id_canal) REFERENCES dbo.Canales(id_canal),
        CONSTRAINT FK_Oportunidades_Fuente FOREIGN KEY (id_fuente) REFERENCES dbo.Fuentes(id_fuente),
        CONSTRAINT FK_Oportunidades_Campana FOREIGN KEY (id_campana) REFERENCES dbo.Campanas(id_campana),
        CONSTRAINT FK_Oportunidades_Servicio FOREIGN KEY (id_servicio_interes) REFERENCES dbo.Servicios(id_servicio),
        CONSTRAINT FK_Oportunidades_Sede FOREIGN KEY (id_sede_preferida) REFERENCES dbo.Sedes(id_sede),
        CONSTRAINT FK_Oportunidades_Usuario FOREIGN KEY (id_usuario_asignado) REFERENCES dbo.Usuarios(id_usuario),
        CONSTRAINT FK_Oportunidades_Solicitud FOREIGN KEY (id_solicitud_lead) REFERENCES dbo.Solicitudes(id_solicitud),
        CONSTRAINT CK_Oportunidades_Estado CHECK (estado_oportunidad IN ('NUEVO', 'INCOMPLETO', 'EN_CALIFICACION', 'AMBIGUO', 'CALIFICADO', 'CONVERTIDO_LEAD', 'DESCARTADO'))
    );

    CREATE INDEX IX_Oportunidades_Persona ON dbo.OportunidadesCaptacion(id_persona);
    CREATE INDEX IX_Oportunidades_FechaCaptacion ON dbo.OportunidadesCaptacion(fecha_captacion);
    CREATE INDEX IX_Oportunidades_Estado ON dbo.OportunidadesCaptacion(estado_oportunidad);
    PRINT 'Tabla OportunidadesCaptacion creada exitosamente.';
END
GO

-- 2. AMPLIACIÓN DE CAMPOS DE AUDITORÍA EN DECISIONES_IA (SI REQUERIDO)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DecisionesIA') AND name = 'modelo_llm')
BEGIN
    ALTER TABLE dbo.DecisionesIA
    ADD modelo_llm VARCHAR(50) NULL DEFAULT 'llama-3.3-70b-versatile',
        tokens_consumidos INT NULL DEFAULT 0,
        latencia_ms INT NULL DEFAULT 0,
        id_oportunidad INT NULL CONSTRAINT FK_DecisionesIA_Oportunidad REFERENCES dbo.OportunidadesCaptacion(id_oportunidad);
    
    PRINT 'Columnas de trazabilidad técnica añadidas a DecisionesIA.';
END
GO
