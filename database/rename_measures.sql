USE [NexoSalud_Mart];
GO

-- Buyer
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_CaptacionBuyer') AND name = 'ContactosRegistrados')
    EXEC sp_rename 'dbo.Fact_CaptacionBuyer.ContactosRegistrados', 'contacto_registrado', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_CaptacionBuyer') AND name = 'ContactosUtilizables')
    EXEC sp_rename 'dbo.Fact_CaptacionBuyer.ContactosUtilizables', 'contacto_utilizable', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_CaptacionBuyer') AND name = 'ConversionesALead')
    EXEC sp_rename 'dbo.Fact_CaptacionBuyer.ConversionesALead', 'conversion_lead', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_CaptacionBuyer') AND name = 'TiempoConversionDias')
    EXEC sp_rename 'dbo.Fact_CaptacionBuyer.TiempoConversionDias', 'tiempo_conversion_dia', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_CaptacionBuyer') AND name = 'CostoAtribuidoCaptacion')
    EXEC sp_rename 'dbo.Fact_CaptacionBuyer.CostoAtribuidoCaptacion', 'costo_atribuido_captacion', 'COLUMN';

-- Lead
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_NegociacionLead') AND name = 'LeadsCohorteEvaluable')
    EXEC sp_rename 'dbo.Fact_NegociacionLead.LeadsCohorteEvaluable', 'cohorte_evaluable', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_NegociacionLead') AND name = 'LeadsConvertidosPayer14Dias')
    EXEC sp_rename 'dbo.Fact_NegociacionLead.LeadsConvertidosPayer14Dias', 'conversion_payer_14_dia', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_NegociacionLead') AND name = 'LeadsRequierenRespuesta')
    EXEC sp_rename 'dbo.Fact_NegociacionLead.LeadsRequierenRespuesta', 'solicitud_requiere_respuesta', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_NegociacionLead') AND name = 'LeadsRespuestaUtil15Min')
    EXEC sp_rename 'dbo.Fact_NegociacionLead.LeadsRespuestaUtil15Min', 'respuesta_util_15_min', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_NegociacionLead') AND name = 'LeadsResultadoFinal')
    EXEC sp_rename 'dbo.Fact_NegociacionLead.LeadsResultadoFinal', 'negociacion_finalizada', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_NegociacionLead') AND name = 'LeadsAbandonados')
    EXEC sp_rename 'dbo.Fact_NegociacionLead.LeadsAbandonados', 'negociacion_abandonada', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_NegociacionLead') AND name = 'LeadsEnNegociacion')
    EXEC sp_rename 'dbo.Fact_NegociacionLead.LeadsEnNegociacion', 'leads_en_negociacion', 'COLUMN';

-- Payer
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_GestionPayer') AND name = 'PagosRegistrados')
    EXEC sp_rename 'dbo.Fact_GestionPayer.PagosRegistrados', 'pago_registrado', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_GestionPayer') AND name = 'PagosValidados')
    EXEC sp_rename 'dbo.Fact_GestionPayer.PagosValidados', 'pago_validado', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_GestionPayer') AND name = 'PagosRechazados')
    EXEC sp_rename 'dbo.Fact_GestionPayer.PagosRechazados', 'pago_rechazado', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_GestionPayer') AND name = 'ConversionesACustomer')
    EXEC sp_rename 'dbo.Fact_GestionPayer.ConversionesACustomer', 'conversion_customer', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_GestionPayer') AND name = 'ImporteTotalCobro')
    EXEC sp_rename 'dbo.Fact_GestionPayer.ImporteTotalCobro', 'importe_total_cobro', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_GestionPayer') AND name = 'CostoTotalTransacciones')
    EXEC sp_rename 'dbo.Fact_GestionPayer.CostoTotalTransacciones', 'costo_transaccion', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_GestionPayer') AND name = 'TiempoTotalValidacionMin')
    EXEC sp_rename 'dbo.Fact_GestionPayer.TiempoTotalValidacionMin', 'tiempo_validacion_minuto', 'COLUMN';

-- Customer
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_AtencionCustomer') AND name = 'CitasEvaluables')
    EXEC sp_rename 'dbo.Fact_AtencionCustomer.CitasEvaluables', 'cita_evaluable', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_AtencionCustomer') AND name = 'AtencionesRealizadas')
    EXEC sp_rename 'dbo.Fact_AtencionCustomer.AtencionesRealizadas', 'atencion_realizada', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_AtencionCustomer') AND name = 'CitasConInasistencia')
    EXEC sp_rename 'dbo.Fact_AtencionCustomer.CitasConInasistencia', 'cita_inasistencia', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_AtencionCustomer') AND name = 'TiempoEnSillonDentalMin')
    EXEC sp_rename 'dbo.Fact_AtencionCustomer.TiempoEnSillonDentalMin', 'tiempo_sillon_dental_minuto', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_AtencionCustomer') AND name = 'AtencionesFinalizadasConformes')
    EXEC sp_rename 'dbo.Fact_AtencionCustomer.AtencionesFinalizadasConformes', 'atencion_finalizada_conforme', 'COLUMN';

-- Turned
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_SeguimientoTurned') AND name = 'SeguimientosRegistrados')
    EXEC sp_rename 'dbo.Fact_SeguimientoTurned.SeguimientosRegistrados', 'seguimiento_registrado', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_SeguimientoTurned') AND name = 'SeguimientosEfectivos')
    EXEC sp_rename 'dbo.Fact_SeguimientoTurned.SeguimientosEfectivos', 'seguimiento_efectivo', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_SeguimientoTurned') AND name = 'IncidenciasReportadas')
    EXEC sp_rename 'dbo.Fact_SeguimientoTurned.IncidenciasReportadas', 'incidencia_reportada', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_SeguimientoTurned') AND name = 'IncidenciasResueltas24h')
    EXEC sp_rename 'dbo.Fact_SeguimientoTurned.IncidenciasResueltas24h', 'incidencia_resuelta_24_hora', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_SeguimientoTurned') AND name = 'RetornosCohorte90Dias')
    EXEC sp_rename 'dbo.Fact_SeguimientoTurned.RetornosCohorte90Dias', 'retorno_cohorte_90_dia', 'COLUMN';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Fact_SeguimientoTurned') AND name = 'PacientesElegiblesRetorno')
    EXEC sp_rename 'dbo.Fact_SeguimientoTurned.PacientesElegiblesRetorno', 'paciente_elegible_retorno', 'COLUMN';
GO
