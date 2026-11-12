/* PROPUESTA QA PARCIAL. NO APLICADA. Revision 2026-11-12.
   Rama feature/buyer-orientacion-interactiva; HEAD 19613358530e899bfc68d5e6b3c33b6336ab9ce4.
   Fuente: ../../lead_revision/INSTALAR_LEAD_COMPLETO.sql, secciones B-G.
   No equivale a instalar LEAD-V2. Sin catalogos de datos, backfill, auditoria ni procedimientos.
   Revisar docs/agentes/REVISION_QA_BUYER_DANIEL.md antes de autorizar la ejecucion.
   Ejecutar ARCHIVO ENTERO en una sesion nueva. Un solo lote: no insertar GO ni ejecutar selecciones.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
DECLARE @transaccion_propia bit=0;
BEGIN TRY
-- Conectarse directamente a DANIELPC / NexoSalud_LeadEnsayoFinal. Sin USE ni GO.
IF ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2 <> N'DANIELPC'
 OR ISNULL(DB_NAME(),N'') COLLATE Latin1_General_100_BIN2 <> N'NexoSalud_LeadEnsayoFinal'
 THROW 54800, 'Destino incorrecto: se exige DANIELPC / NexoSalud_LeadEnsayoFinal.', 1;
IF ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION'),0) <> 1
 THROW 54801, 'Se requiere VIEW DEFINITION para no confundir objetos ocultos con ausentes.', 1;
DECLARE @Columnas TABLE(tabla sysname, columna sysname, tipo sysname, longitud int NULL, precision_esperada tinyint NULL, escala tinyint NULL, nullable bit, identidad bit, rol varchar(10));
INSERT @Columnas VALUES
 (N'Etapas',N'id_etapa',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Etapas',N'nombre',N'varchar',20,NULL,NULL,0,0,N'BASE'),
 (N'Etapas',N'descripcion',N'varchar',200,NULL,NULL,1,0,N'BASE'),
 (N'Canales',N'id_canal',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Canales',N'nombre',N'varchar',50,NULL,NULL,0,0,N'BASE'),
 (N'Canales',N'activo',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Fuentes',N'id_fuente',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Fuentes',N'nombre',N'varchar',100,NULL,NULL,0,0,N'BASE'),
 (N'Fuentes',N'descripcion',N'varchar',200,NULL,NULL,1,0,N'BASE'),
 (N'Fuentes',N'activo',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Usuarios',N'id_usuario',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Usuarios',N'nombres',N'varchar',50,NULL,NULL,0,0,N'BASE'),
 (N'Usuarios',N'apellidos',N'varchar',50,NULL,NULL,0,0,N'BASE'),
 (N'Usuarios',N'email',N'varchar',100,NULL,NULL,0,0,N'BASE'),
 (N'Usuarios',N'password_hash',N'varchar',255,NULL,NULL,0,0,N'BASE'),
 (N'Usuarios',N'id_rol',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Usuarios',N'activo',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Personas',N'id_persona',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Personas',N'nombres',N'varchar',50,NULL,NULL,0,0,N'BASE'),
 (N'Personas',N'apellidos',N'varchar',50,NULL,NULL,0,0,N'BASE'),
 (N'Personas',N'dni',N'char',8,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'email',N'varchar',100,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'numero',N'varchar',20,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'fecha_nacimiento',N'date',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'zona',N'varchar',100,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'tipo_persona',N'varchar',30,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'autoriza_contacto',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Personas',N'fecha_autorizacion',N'datetime2',NULL,NULL,7,1,0,N'BASE'),
 (N'Personas',N'estado_calidad',N'varchar',20,NULL,NULL,0,0,N'BASE'),
 (N'Personas',N'id_campana_origen',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'id_canal_origen',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Personas',N'id_etapa_actual',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Personas',N'fecha_registro',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'Personas',N'fecha_actualizacion',N'datetime2',NULL,NULL,7,1,0,N'BASE'),
 (N'DatosAcademicos',N'id_dato_academico',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'DatosAcademicos',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'DatosAcademicos',N'universidad',N'varchar',150,NULL,NULL,1,0,N'BASE'),
 (N'DatosAcademicos',N'carrera',N'varchar',150,NULL,NULL,1,0,N'BASE'),
 (N'DatosAcademicos',N'ciclo',N'varchar',30,NULL,NULL,1,0,N'BASE'),
 (N'DatosAcademicos',N'aplica',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'DatosLaborales',N'id_dato_laboral',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'DatosLaborales',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'DatosLaborales',N'ocupacion',N'varchar',100,NULL,NULL,1,0,N'BASE'),
 (N'DatosLaborales',N'empresa',N'varchar',150,NULL,NULL,1,0,N'BASE'),
 (N'DatosLaborales',N'modalidad',N'varchar',50,NULL,NULL,1,0,N'BASE'),
 (N'DatosLaborales',N'disponibilidad',N'varchar',200,NULL,NULL,1,0,N'BASE'),
 (N'DatosLaborales',N'aplica',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'id_salud_odonto',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'PersonaSaludOdontologica',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'ultima_visita_odontologica',N'varchar',50,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'motivo_consulta',N'varchar',100,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'tratamiento_previo',N'varchar',100,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'nivel_dolor',N'varchar',20,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'presenta_sensibilidad',N'varchar',10,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'sangrado_o_inflamacion',N'varchar',30,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'usa_aparato_o_protesis',N'varchar',30,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'condicion_atencion_especial',N'varchar',100,NULL,NULL,1,0,N'BASE'),
 (N'PersonaSaludOdontologica',N'fecha_registro',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'PersonaPreferencias',N'id_preferencia',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'PersonaPreferencias',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'PersonaPreferencias',N'id_canal',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'PersonaPreferencias',N'id_horario',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'PersonaPreferencias',N'id_modalidad',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'PersonaPreferencias',N'id_servicio_interes',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'PersonaPreferencias',N'sede_preferida',N'varchar',150,NULL,NULL,1,0,N'BASE'),
 (N'PersonaPreferencias',N'profesional_preferido',N'varchar',150,NULL,NULL,1,0,N'BASE'),
 (N'PersonaPreferencias',N'fecha_inicio',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'PersonaPreferencias',N'fecha_fin',N'datetime2',NULL,NULL,7,1,0,N'BASE'),
 (N'Servicios',N'id_servicio',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Servicios',N'nombre',N'varchar',100,NULL,NULL,0,0,N'BASE'),
 (N'Servicios',N'descripcion',N'varchar',300,NULL,NULL,1,0,N'BASE'),
 (N'Servicios',N'activo',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Sedes',N'id_sede',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Sedes',N'nombre',N'varchar',100,NULL,NULL,0,0,N'BASE'),
 (N'Sedes',N'direccion',N'varchar',200,NULL,NULL,0,0,N'BASE'),
 (N'Sedes',N'zona',N'varchar',100,NULL,NULL,1,0,N'BASE'),
 (N'Sedes',N'activo',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Disponibilidad',N'id_disponibilidad',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Disponibilidad',N'id_profesional',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Disponibilidad',N'id_sede',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Disponibilidad',N'fecha',N'date',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Disponibilidad',N'hora_inicio',N'time',NULL,NULL,7,0,0,N'BASE'),
 (N'Disponibilidad',N'hora_fin',N'time',NULL,NULL,7,0,0,N'BASE'),
 (N'Disponibilidad',N'estado',N'varchar',20,NULL,NULL,0,0,N'BASE'),
 (N'Interacciones',N'id_solicitud',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Interacciones',N'id_interaccion',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Interacciones',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Interacciones',N'id_canal',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Interacciones',N'id_fuente',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Interacciones',N'id_usuario',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Interacciones',N'fecha_hora',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'Interacciones',N'tipo',N'varchar',50,NULL,NULL,0,0,N'BASE'),
 (N'Interacciones',N'mensaje',N'varchar',-1,NULL,NULL,1,0,N'BASE'),
 (N'Interacciones',N'es_respuesta_util',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Interacciones',N'resultado',N'varchar',200,NULL,NULL,1,0,N'BASE'),
 (N'Solicitudes',N'id_negociador',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Solicitudes',N'id_canal_origen',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Solicitudes',N'id_sede_interes_lead',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Solicitudes',N'fecha_ingreso_lead',N'datetime2',NULL,NULL,7,1,0,N'ADICION'),
 (N'Solicitudes',N'archivada_lead_en',N'datetime2',NULL,NULL,7,1,0,N'ADICION'),
 (N'Solicitudes',N'resultado_comercial_lead',N'varchar',25,NULL,NULL,1,0,N'ADICION'),
 (N'Solicitudes',N'fecha_decision_comercial_lead',N'datetime2',NULL,NULL,7,1,0,N'ADICION'),
 (N'Solicitudes',N'valor_acordado_lead',N'decimal',NULL,14,2,1,0,N'ADICION'),
 (N'Solicitudes',N'id_propuesta_aceptada_lead',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Solicitudes',N'motivo_cierre_lead',N'varchar',400,NULL,NULL,1,0,N'ADICION'),
 (N'Solicitudes',N'fecha_proximo_seguimiento',N'datetime2',NULL,NULL,7,1,0,N'ADICION'),
 (N'Solicitudes',N'id_solicitud',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Solicitudes',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Solicitudes',N'id_servicio',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Solicitudes',N'fecha_solicitud',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'Solicitudes',N'motivo',N'varchar',200,NULL,NULL,1,0,N'BASE'),
 (N'Solicitudes',N'tipo_consulta',N'varchar',50,NULL,NULL,1,0,N'BASE'),
 (N'Solicitudes',N'prioridad',N'varchar',20,NULL,NULL,1,0,N'BASE'),
 (N'Solicitudes',N'estado',N'varchar',30,NULL,NULL,0,0,N'BASE'),
 (N'Solicitudes',N'fecha_primera_respuesta',N'datetime2',NULL,NULL,7,1,0,N'BASE'),
 (N'Solicitudes',N'fecha_cierre',N'datetime2',NULL,NULL,7,1,0,N'BASE'),
 (N'Opciones',N'archivada_lead_en',N'datetime2',NULL,NULL,7,1,0,N'ADICION'),
 (N'Opciones',N'estado_respuesta',N'varchar',20,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'fecha_respuesta',N'datetime2',NULL,NULL,7,1,0,N'ADICION'),
 (N'Opciones',N'id_propuesta_lead',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'id_preferencia_lead',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'id_motivo_rechazo_lead',N'int',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'pref_fecha_lead',N'date',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'pref_dia_semana_lead',N'tinyint',NULL,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'pref_turno_lead',N'varchar',30,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'pref_hora_inicio_lead',N'time',NULL,NULL,7,1,0,N'ADICION'),
 (N'Opciones',N'pref_hora_fin_lead',N'time',NULL,NULL,7,1,0,N'ADICION'),
 (N'Opciones',N'ofr_turno_lead',N'varchar',30,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'id_opcion',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Opciones',N'id_solicitud',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Opciones',N'id_disponibilidad',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Opciones',N'precio_ofrecido',N'decimal',NULL,10,2,0,0,N'BASE'),
 (N'Opciones',N'fecha_ofrecida',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'Opciones',N'seleccionada',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Reservas',N'id_reserva',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Reservas',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Reservas',N'id_solicitud',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Reservas',N'id_opcion',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Reservas',N'fecha_reserva',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'Reservas',N'estado',N'varchar',30,NULL,NULL,0,0,N'BASE'),
 (N'Reservas',N'fecha_vencimiento_bloqueo',N'datetime2',NULL,NULL,7,1,0,N'BASE'),
 (N'Reservas',N'confirmacion_explicita',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'Reservas',N'fecha_confirmacion',N'datetime2',NULL,NULL,7,1,0,N'BASE'),
 (N'EventosEtapa',N'id_evento_etapa',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'EventosEtapa',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'EventosEtapa',N'etapa_origen',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'EventosEtapa',N'etapa_destino',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'EventosEtapa',N'fecha_hora',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'EventosEtapa',N'id_usuario',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'EventosEtapa',N'motivo',N'varchar',300,NULL,NULL,1,0,N'BASE'),
 (N'EventosEtapa',N'evidencia',N'varchar',500,NULL,NULL,1,0,N'BASE'),
 (N'Campanas',N'id_campana',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'Campanas',N'nombre',N'varchar',150,NULL,NULL,0,0,N'BASE'),
 (N'Campanas',N'descripcion',N'varchar',300,NULL,NULL,1,0,N'BASE'),
 (N'Campanas',N'id_fuente',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Campanas',N'id_canal',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Campanas',N'fecha_inicio',N'date',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Campanas',N'fecha_fin',N'date',NULL,NULL,NULL,1,0,N'BASE'),
 (N'Campanas',N'activo',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'GastosCampana',N'id_gasto',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'GastosCampana',N'id_campana',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'GastosCampana',N'fecha',N'date',NULL,NULL,NULL,0,0,N'BASE'),
 (N'GastosCampana',N'importe',N'decimal',NULL,10,2,0,0,N'BASE'),
 (N'GastosCampana',N'descripcion',N'varchar',300,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'id_decision',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'DecisionesIA',N'id_persona',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'id_usuario',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'id_captacion',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'id_interaccion',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'agente',N'varchar',50,NULL,NULL,0,0,N'BASE'),
 (N'DecisionesIA',N'fecha_hora',N'datetime2',NULL,NULL,7,0,0,N'BASE'),
 (N'DecisionesIA',N'entrada',N'varchar',-1,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'regla_aplicada',N'varchar',300,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'decision',N'varchar',500,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'accion',N'varchar',500,NULL,NULL,1,0,N'BASE'),
 (N'DecisionesIA',N'requiere_revision',N'bit',NULL,NULL,NULL,0,0,N'BASE'),
 (N'DecisionesIA',N'resultado_revision',N'varchar',300,NULL,NULL,1,0,N'BASE'),
 (N'PromocionesLead',N'id_promocion',N'int',NULL,NULL,NULL,0,1,N'NUEVA'),
 (N'PromocionesLead',N'nombre',N'varchar',150,NULL,NULL,0,0,N'NUEVA'),
 (N'PromocionesLead',N'tipo_promocion',N'varchar',80,NULL,NULL,0,0,N'NUEVA'),
 (N'PromocionesLead',N'id_servicio',N'int',NULL,NULL,NULL,1,0,N'NUEVA'),
 (N'PromocionesLead',N'activo',N'bit',NULL,NULL,NULL,0,0,N'NUEVA'),
 (N'MotivosRechazoLead',N'id_motivo_rechazo',N'int',NULL,NULL,NULL,0,1,N'NUEVA'),
 (N'MotivosRechazoLead',N'codigo',N'varchar',60,NULL,NULL,0,0,N'NUEVA'),
 (N'MotivosRechazoLead',N'ambito',N'varchar',15,NULL,NULL,0,0,N'NUEVA'),
 (N'MotivosRechazoLead',N'categoria',N'varchar',20,NULL,NULL,0,0,N'NUEVA'),
 (N'MotivosRechazoLead',N'motivo',N'varchar',160,NULL,NULL,0,0,N'NUEVA'),
 (N'MotivosRechazoLead',N'activo',N'bit',NULL,NULL,NULL,0,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'id_propuesta',N'int',NULL,NULL,NULL,0,1,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'id_solicitud',N'int',NULL,NULL,NULL,0,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'id_servicio',N'int',NULL,NULL,NULL,0,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'id_sede_lead',N'int',NULL,NULL,NULL,1,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'id_propuesta_raiz',N'int',NULL,NULL,NULL,1,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'numero_version',N'smallint',NULL,NULL,NULL,0,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'precio_cotizado',N'decimal',NULL,10,2,0,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'promocion_aplicada',N'varchar',150,NULL,NULL,1,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'fecha_presentacion',N'datetime2',NULL,NULL,7,0,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'estado',N'varchar',20,NULL,NULL,0,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'fecha_decision',N'datetime2',NULL,NULL,7,1,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'id_promocion_lead',N'int',NULL,NULL,NULL,1,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'id_motivo_rechazo_lead',N'int',NULL,NULL,NULL,1,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'id_cambio',N'int',NULL,NULL,NULL,0,1,N'NUEVA'),
 (N'CambiosOpcionLead',N'id_opcion',N'int',NULL,NULL,NULL,0,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'fecha_cambio',N'datetime2',NULL,NULL,7,0,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'campo_modificado',N'varchar',50,NULL,NULL,0,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'motivo_cambio',N'varchar',300,NULL,NULL,0,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'tipo_motivo',N'varchar',30,NULL,NULL,0,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'valor_anterior',N'varchar',200,NULL,NULL,1,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'valor_nuevo',N'varchar',200,NULL,NULL,1,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'es_pre_reserva_lead',N'bit',NULL,NULL,NULL,1,0,N'NUEVA'),
 (N'CambiosOpcionLead',N'fecha_registro_utc_lead',N'datetime2',NULL,NULL,7,1,0,N'NUEVA'),
 (N'Solicitudes',N'clave_registro_web_lead',N'varchar',36,NULL,NULL,1,0,N'ADICION'),
 (N'Solicitudes',N'hash_registro_web_lead',N'char',64,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'motivo_rechazo',N'varchar',200,NULL,NULL,1,0,N'ADICION'),
 (N'Opciones',N'tipo_motivo_rechazo',N'varchar',30,NULL,NULL,1,0,N'ADICION'),
 (N'PropuestasEconomicasLead',N'motivo_rechazo',N'varchar',200,NULL,NULL,1,0,N'NUEVA'),
 (N'PropuestasEconomicasLead',N'tipo_motivo_rechazo',N'varchar',30,NULL,NULL,1,0,N'NUEVA'),
 (N'CaptacionesBuyer',N'id_captacion',N'int',NULL,NULL,NULL,0,1,N'BASE'),
 (N'CaptacionesBuyer',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'CaptacionesBuyer',N'id_servicio',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'EventosEtapa',N'id_captacion',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'EventosEtapa',N'id_solicitud',N'int',NULL,NULL,NULL,1,0,N'BASE'),
 (N'EventosEtapa',N'clave_operacion_buyer',N'varchar',80,NULL,NULL,1,0,N'BASE'),
 (N'EntradasAgenteLead',N'id_solicitud',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'EntradasAgenteLead',N'id_evento_etapa',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'EntradasAgenteLead',N'id_captacion',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'EntradasAgenteLead',N'id_persona',N'int',NULL,NULL,NULL,0,0,N'BASE'),
 (N'EntradasAgenteLead',N'fecha_registro_utc',N'datetime2',NULL,NULL,7,0,0,N'BASE');

DECLARE @FK TABLE(tabla sysname,nombre sysname,columna sysname,referencia sysname,columna_ref sysname,inline_original bit);
INSERT @FK VALUES
 (N'PromocionesLead',N'FK_PromocionesLead_Servicio',N'id_servicio',N'Servicios',N'id_servicio',1),
 (N'PropuestasEconomicasLead',N'FK_PropuestasLead_Solicitud',N'id_solicitud',N'Solicitudes',N'id_solicitud',1),
 (N'PropuestasEconomicasLead',N'FK_PropuestasLead_Servicio',N'id_servicio',N'Servicios',N'id_servicio',1),
 (N'PropuestasEconomicasLead',N'FK_PropuestasLead_Raiz',N'id_propuesta_raiz',N'PropuestasEconomicasLead',N'id_propuesta',1),
 (N'PropuestasEconomicasLead',N'FK_PropuestasLead_SedeLead',N'id_sede_lead',N'Sedes',N'id_sede',0),
 (N'PropuestasEconomicasLead',N'FK_PropuestasLead_PromocionLead',N'id_promocion_lead',N'PromocionesLead',N'id_promocion',0),
 (N'PropuestasEconomicasLead',N'FK_PropuestasLead_MotivoLead',N'id_motivo_rechazo_lead',N'MotivosRechazoLead',N'id_motivo_rechazo',0),
 (N'Solicitudes',N'FK_Solicitudes_Negociador',N'id_negociador',N'Usuarios',N'id_usuario',0),
 (N'Solicitudes',N'FK_Solicitudes_CanalOrigen',N'id_canal_origen',N'Canales',N'id_canal',0),
 (N'Solicitudes',N'FK_Solicitudes_SedeInteresLead',N'id_sede_interes_lead',N'Sedes',N'id_sede',0),
 (N'Solicitudes',N'FK_Solicitudes_PropuestaAceptadaLead',N'id_propuesta_aceptada_lead',N'PropuestasEconomicasLead',N'id_propuesta',0),
 (N'Opciones',N'FK_Opciones_PropuestaLead',N'id_propuesta_lead',N'PropuestasEconomicasLead',N'id_propuesta',0),
 (N'Opciones',N'FK_Opciones_PreferenciaLead',N'id_preferencia_lead',N'PersonaPreferencias',N'id_preferencia',0),
 (N'Opciones',N'FK_Opciones_MotivoLead',N'id_motivo_rechazo_lead',N'MotivosRechazoLead',N'id_motivo_rechazo',0),
 (N'CambiosOpcionLead',N'FK_CambiosOpcionLead_Opcion',N'id_opcion',N'Opciones',N'id_opcion',1),
 (N'Interacciones',N'FK_Interacciones_SolicitudLead',N'id_solicitud',N'Solicitudes',N'id_solicitud',0);

DECLARE @CK TABLE(tabla sysname,nombre sysname);
INSERT @CK VALUES
 (N'PromocionesLead',N'CK_PromocionesLead_Nombre'),
 (N'PromocionesLead',N'CK_PromocionesLead_Tipo'),
 (N'MotivosRechazoLead',N'CK_MotivosRechazoLead_Ambito'),
 (N'MotivosRechazoLead',N'CK_MotivosRechazoLead_Categoria'),
 (N'MotivosRechazoLead',N'CK_MotivosRechazoLead_Cruce'),
 (N'MotivosRechazoLead',N'CK_MotivosRechazoLead_Nombre'),
 (N'Solicitudes',N'CK_Solicitudes_ResultadoComercialLead'),
 (N'Solicitudes',N'CK_Solicitudes_ValorYFechaLead'),
 (N'PropuestasEconomicasLead',N'CK_PropuestasLead_Precio'),
 (N'PropuestasEconomicasLead',N'CK_PropuestasLead_Estado'),
 (N'PropuestasEconomicasLead',N'CK_PropuestasLead_Version'),
 (N'PropuestasEconomicasLead',N'CK_PropuestasLead_ArbolVersion'),
 (N'Opciones',N'CK_Opciones_PreferenciaHorarioLead'),
 (N'Opciones',N'CK_Opciones_SeleccionLead'),
 (N'Opciones',N'CK_Opciones_FechaRespuestaLead'),
 (N'CambiosOpcionLead',N'CK_CambiosOpcionLead_Tipo');

DECLARE @ClavesBase TABLE(tabla sysname,columna sysname);
INSERT @ClavesBase VALUES
 (N'Solicitudes',N'id_solicitud'),
 (N'Opciones',N'id_opcion'),
 (N'Servicios',N'id_servicio'),
 (N'Usuarios',N'id_usuario'),
 (N'Sedes',N'id_sede'),
 (N'Canales',N'id_canal'),
 (N'PersonaPreferencias',N'id_preferencia'),
 (N'Personas',N'id_persona'),
 (N'CaptacionesBuyer',N'id_captacion'),
 (N'EventosEtapa',N'id_evento_etapa');

DECLARE @ClavesSoporte TABLE(tabla sysname,columna sysname,primaria bit);
INSERT @ClavesSoporte VALUES
 (N'PromocionesLead',N'id_promocion',1),
 (N'MotivosRechazoLead',N'id_motivo_rechazo',1),
 (N'MotivosRechazoLead',N'codigo',0),
 (N'PropuestasEconomicasLead',N'id_propuesta',1),
 (N'CambiosOpcionLead',N'id_cambio',1);

DECLARE @Defaults TABLE(tabla sysname,columna sysname,expresion nvarchar(128));
INSERT @Defaults VALUES
 (N'PromocionesLead',N'activo',N'1'),
 (N'MotivosRechazoLead',N'activo',N'1'),
 (N'PropuestasEconomicasLead',N'numero_version',N'1'),
 (N'PropuestasEconomicasLead',N'fecha_presentacion',N'sysdatetime'),
 (N'PropuestasEconomicasLead',N'estado',N'''Pendiente'''),
 (N'CambiosOpcionLead',N'fecha_cambio',N'sysdatetime'),
 (N'CambiosOpcionLead',N'tipo_motivo',N'''Otro'''),
 (N'CambiosOpcionLead',N'fecha_registro_utc_lead',N'sysutcdatetime');

IF @@TRANCOUNT<>0 OR (@@OPTIONS & 2)=2
 THROW 54802, 'Se requiere sesion nueva, sin transaccion ni IMPLICIT_TRANSACTIONS.', 1;
IF ISNULL(CONVERT(nvarchar(60),DATABASEPROPERTYEX(DB_NAME(),'Updateability')),N'') <> N'READ_WRITE'
 THROW 54803, 'La copia QA debe permitir escritura.', 1;
IF EXISTS (SELECT 1 FROM @Columnas e
LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') AND c.name=e.columna
LEFT JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE (c.column_id IS NULL AND (e.rol='BASE' OR (e.rol='NUEVA' AND OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') IS NOT NULL)))
 OR (c.column_id IS NOT NULL AND (ty.name<>e.tipo OR c.is_nullable<>e.nullable OR c.is_identity<>e.identidad
  OR (e.longitud IS NOT NULL AND c.max_length<>e.longitud)
  OR (e.precision_esperada IS NOT NULL AND c.precision<>e.precision_esperada)
  OR (e.escala IS NOT NULL AND c.scale<>e.escala))))
 BEGIN
 SELECT e.*, c.name AS columna_actual, ty.name AS tipo_actual, c.max_length AS longitud_actual,
 c.precision AS precision_actual,c.scale AS escala_actual,c.is_nullable AS nullable_actual,c.is_identity AS identidad_actual,
 CASE WHEN c.column_id IS NULL THEN 'FALTA' ELSE 'DIFIERE' END AS estado
FROM @Columnas e
LEFT JOIN sys.tables t ON t.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U')
LEFT JOIN sys.columns c ON c.object_id=t.object_id AND c.name=e.columna
LEFT JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.column_id IS NULL OR ty.name<>e.tipo OR c.is_nullable<>e.nullable OR c.is_identity<>e.identidad
 OR (e.longitud IS NOT NULL AND c.max_length<>e.longitud)
 OR (e.precision_esperada IS NOT NULL AND c.precision<>e.precision_esperada)
 OR (e.escala IS NOT NULL AND c.scale<>e.escala) ORDER BY e.tabla,e.columna;
 THROW 54804, 'Prerrequisito ausente o columna incompatible. No se modifica ni reconcilia automaticamente.', 1;
 END;
IF OBJECT_ID('dbo.usp_ConvertirBuyerALead','P') IS NULL
 OR OBJECT_ID('dbo.v_DatosCaptacionBuyer','V') IS NULL
 OR OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead','P') IS NULL
 THROW 54805, 'Falta Buyer revisado o el contrato de entrada LEAD preexistente.', 1;
IF NOT EXISTS(SELECT 1 FROM dbo.Etapas WHERE nombre='BUYER') OR NOT EXISTS(SELECT 1 FROM dbo.Etapas WHERE nombre='LEAD')
 THROW 54806, 'Faltan etapas BUYER/LEAD. No se cargan catalogos.', 1;
IF EXISTS(SELECT 1 FROM @ClavesBase e WHERE NOT EXISTS (
 SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
 JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
 WHERE i.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') AND i.is_unique=1 AND i.has_filter=0
 AND i.is_disabled=0 AND ic.key_ordinal=1 AND c.name=e.columna
 AND (SELECT COUNT(*) FROM sys.index_columns k WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal>0)=1))
 THROW 54807, 'Falta una clave candidata simple requerida por las FK.', 1;
IF EXISTS (SELECT 1 FROM @FK e JOIN sys.foreign_keys f ON f.schema_id=SCHEMA_ID('dbo') AND f.name=e.nombre
 WHERE f.parent_object_id<>OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) OR f.referenced_object_id<>OBJECT_ID(N'dbo.'+QUOTENAME(e.referencia))
 OR f.is_disabled=1 OR f.is_not_trusted=1 OR f.delete_referential_action<>0 OR f.update_referential_action<>0
 OR (SELECT COUNT(*) FROM sys.foreign_key_columns fc WHERE fc.constraint_object_id=f.object_id)<>1
 OR NOT EXISTS(SELECT 1 FROM sys.foreign_key_columns fc
  JOIN sys.columns c ON c.object_id=fc.parent_object_id AND c.column_id=fc.parent_column_id
  JOIN sys.columns rc ON rc.object_id=fc.referenced_object_id AND rc.column_id=fc.referenced_column_id
  WHERE fc.constraint_object_id=f.object_id AND c.name=e.columna AND rc.name=e.columna_ref)) THROW 54808, 'Una FK preexistente difiere o no es confiable.', 1;
-- No se duplican relaciones equivalentes con un nombre distinto: reconciliar antes.
IF EXISTS(SELECT 1 FROM @FK e JOIN sys.foreign_keys f ON f.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla))
 JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=f.object_id
 JOIN sys.columns c ON c.object_id=fc.parent_object_id AND c.column_id=fc.parent_column_id
 JOIN sys.columns rc ON rc.object_id=fc.referenced_object_id AND rc.column_id=fc.referenced_column_id
 WHERE c.name=e.columna AND rc.name=e.columna_ref AND f.referenced_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.referencia)) AND f.name<>e.nombre)
 THROW 54809, 'Relacion equivalente con otro nombre: revisar antes de crear FK redundantes.', 1;
IF EXISTS(SELECT 1 FROM @CK e JOIN sys.objects o ON o.schema_id=SCHEMA_ID('dbo') AND o.name=e.nombre
 LEFT JOIN sys.check_constraints ck ON ck.object_id=o.object_id
 WHERE o.parent_object_id<>OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) OR ck.object_id IS NULL OR ck.is_disabled=1 OR ck.is_not_trusted=1)
 THROW 54810, 'CHECK preexistente colisiona o no es confiable.', 1;
-- Las tablas de soporte preexistentes deben estar completas; no se reparan fragmentos desconocidos.
IF EXISTS(SELECT 1 FROM @FK e WHERE e.inline_original=1 AND OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM sys.foreign_keys f WHERE f.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND f.name=e.nombre))
 THROW 54811, 'Tabla de soporte preexistente sin FK original. Reconciliar antes.', 1;
IF EXISTS(SELECT 1 FROM @CK e WHERE e.tabla IN ('PromocionesLead','MotivosRechazoLead','PropuestasEconomicasLead','CambiosOpcionLead')
 AND OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM sys.check_constraints ck WHERE ck.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND ck.name=e.nombre))
 THROW 54812, 'Tabla de soporte preexistente sin CHECK original. Reconciliar antes.', 1;
-- Dos indices unicos de las definiciones originales; verificar columnas y filtro.
IF EXISTS(SELECT 1 FROM (VALUES ('Solicitudes','UX_Solicitudes_RegistroWebLead','clave_registro_web_lead',NULL),
 ('PropuestasEconomicasLead','UX_PropuestasLead_RaizVersion','id_propuesta_raiz','numero_version')) e(tabla,nombre,col1,col2)
 JOIN sys.indexes i ON i.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND i.name=e.nombre
 WHERE i.is_unique<>1 OR i.is_disabled=1 OR i.has_filter<>1 OR i.type<>2
 OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(i.filter_definition,'[',''),']',''),'(',''),')',''),' ',''),CHAR(10),''))<>LOWER(e.col1+'ISNOTNULL')
 OR NOT EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
  WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=1 AND c.name=e.col1 AND ic.is_descending_key=0)
 OR (e.col2 IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
  WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=2 AND c.name=e.col2 AND ic.is_descending_key=0))
 OR (SELECT COUNT(*) FROM sys.index_columns ic WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0)<>CASE WHEN e.col2 IS NULL THEN 1 ELSE 2 END)
 THROW 54813, 'Indice unico preexistente incompatible.', 1;
IF EXISTS(SELECT 1 FROM @ClavesSoporte e WHERE OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
 JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
 WHERE i.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND i.is_unique=1 AND i.has_filter=0 AND i.is_disabled=0
 AND i.is_primary_key=e.primaria AND ic.key_ordinal=1 AND c.name=e.columna
 AND (SELECT COUNT(*) FROM sys.index_columns k WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal>0)=1))
 THROW 54814, 'Tabla de soporte sin PK o clave unica original.', 1;
-- Normalizacion limitada a defaults escalares simples (literales o funciones sin argumentos).
IF EXISTS(SELECT 1 FROM @Defaults e WHERE OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
 WHERE dc.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND c.name=e.columna
 AND REPLACE(REPLACE(REPLACE(dc.definition,'(',''),')',''),' ','') COLLATE Latin1_General_100_BIN2 = e.expresion COLLATE Latin1_General_100_BIN2))
 THROW 54815, 'Tabla de soporte sin default original o con default diferente.', 1;
IF COL_LENGTH('dbo.Interacciones','id_solicitud') IS NOT NULL
 EXEC sys.sp_executesql N'IF EXISTS(SELECT 1 FROM dbo.Interacciones i LEFT JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud
 WHERE i.id_solicitud IS NOT NULL AND s.id_solicitud IS NULL)
 THROW 54816, ''Interacciones contiene referencias huerfanas: no crear la FK ni modificar datos.'', 1;';

BEGIN TRANSACTION;
SET @transaccion_propia=1;
-- Compilacion en ambito inferior: los errores DDL alcanzan el CATCH externo.
-- Los indices, FK y CHECK sobre columnas nuevas ya usan EXEC en el original.
EXEC sys.sp_executesql N' -- B. Catalogos de motivos y promociones. No se cargan valores ficticios.
 IF OBJECT_ID(''dbo.PromocionesLead'',''U'') IS NULL
 CREATE TABLE dbo.PromocionesLead (
  id_promocion INT IDENTITY(1,1) CONSTRAINT PK_PromocionesLead PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  tipo_promocion VARCHAR(80) NOT NULL,
  id_servicio INT NULL CONSTRAINT FK_PromocionesLead_Servicio REFERENCES dbo.Servicios(id_servicio),
  activo BIT NOT NULL DEFAULT(1),
  CONSTRAINT CK_PromocionesLead_Nombre CHECK (LEN(LTRIM(RTRIM(nombre)))>0),
  CONSTRAINT CK_PromocionesLead_Tipo CHECK (LEN(LTRIM(RTRIM(tipo_promocion)))>0)
 );
 IF OBJECT_ID(''dbo.MotivosRechazoLead'',''U'') IS NULL
 CREATE TABLE dbo.MotivosRechazoLead (
  id_motivo_rechazo INT IDENTITY(1,1) CONSTRAINT PK_MotivosRechazoLead PRIMARY KEY,
  codigo VARCHAR(60) NOT NULL CONSTRAINT UQ_MotivosRechazoLead_Codigo UNIQUE,
  ambito VARCHAR(15) NOT NULL,
  categoria VARCHAR(20) NOT NULL,
  motivo VARCHAR(160) NOT NULL,
  activo BIT NOT NULL DEFAULT(1),
  CONSTRAINT CK_MotivosRechazoLead_Ambito CHECK(ambito IN (''PROPUESTA'',''ALTERNATIVA'')),
  CONSTRAINT CK_MotivosRechazoLead_Categoria CHECK(categoria IN (''ECONOMICO'',''INCOMPATIBILIDAD'',''OTROS'')),
  CONSTRAINT CK_MotivosRechazoLead_Cruce CHECK (
    (ambito=''PROPUESTA'' AND categoria IN (''ECONOMICO'',''OTROS'')) OR
    (ambito=''ALTERNATIVA'' AND categoria IN (''INCOMPATIBILIDAD'',''OTROS'')) ),
  CONSTRAINT CK_MotivosRechazoLead_Nombre CHECK(LEN(LTRIM(RTRIM(motivo)))>0)
 );

 IF COL_LENGTH(''dbo.Solicitudes'',''fecha_ingreso_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD fecha_ingreso_lead DATETIME2 NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''archivada_lead_en'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD archivada_lead_en DATETIME2 NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''archivada_lead_en'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD archivada_lead_en DATETIME2 NULL;'');

 IF COL_LENGTH(''dbo.Solicitudes'',''clave_registro_web_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD clave_registro_web_lead VARCHAR(36) NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''hash_registro_web_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD hash_registro_web_lead CHAR(64) NULL;'');
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=''UX_Solicitudes_RegistroWebLead''
    AND object_id=OBJECT_ID(''dbo.Solicitudes''))
  EXEC(N''CREATE UNIQUE INDEX UX_Solicitudes_RegistroWebLead ON dbo.Solicitudes(clave_registro_web_lead)
    WHERE clave_registro_web_lead IS NOT NULL;'');

 -- C. Solicitudes existentes. Se usan id_negociador e id_canal_origen del SQL del usuario.
 -- En la baseline Buyer esas dos columnas no estan: se agregan como NULL.
 IF COL_LENGTH(''dbo.Solicitudes'',''id_negociador'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD id_negociador INT NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''id_canal_origen'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD id_canal_origen INT NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''id_sede_interes_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD id_sede_interes_lead INT NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''resultado_comercial_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD resultado_comercial_lead VARCHAR(25) NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''fecha_decision_comercial_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD fecha_decision_comercial_lead DATETIME2 NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''valor_acordado_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD valor_acordado_lead DECIMAL(14,2) NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''id_propuesta_aceptada_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD id_propuesta_aceptada_lead INT NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''motivo_cierre_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD motivo_cierre_lead VARCHAR(400) NULL;'');
 IF COL_LENGTH(''dbo.Solicitudes'',''fecha_proximo_seguimiento'') IS NULL
  EXEC(N''ALTER TABLE dbo.Solicitudes ADD fecha_proximo_seguimiento DATETIME2 NULL;'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Solicitudes_Negociador'' AND parent_object_id=OBJECT_ID(''dbo.Solicitudes''))
  EXEC(N''ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_Negociador FOREIGN KEY(id_negociador) REFERENCES dbo.Usuarios(id_usuario);'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Solicitudes_CanalOrigen'' AND parent_object_id=OBJECT_ID(''dbo.Solicitudes''))
  EXEC(N''ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_CanalOrigen FOREIGN KEY(id_canal_origen) REFERENCES dbo.Canales(id_canal);'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Solicitudes_SedeInteresLead'' AND parent_object_id=OBJECT_ID(''dbo.Solicitudes''))
  EXEC(N''ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_SedeInteresLead FOREIGN KEY(id_sede_interes_lead) REFERENCES dbo.Sedes(id_sede);'');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=''CK_Solicitudes_ResultadoComercialLead'' AND parent_object_id=OBJECT_ID(''dbo.Solicitudes''))
  EXEC(N''ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT CK_Solicitudes_ResultadoComercialLead CHECK (
   (resultado_comercial_lead IS NULL AND fecha_decision_comercial_lead IS NULL AND valor_acordado_lead IS NULL AND id_propuesta_aceptada_lead IS NULL)
   OR (resultado_comercial_lead=''''PENDIENTE'''' AND fecha_decision_comercial_lead IS NULL AND valor_acordado_lead IS NULL AND id_propuesta_aceptada_lead IS NULL)
   OR (resultado_comercial_lead=''''ACEPTADA'''' AND fecha_decision_comercial_lead IS NOT NULL AND valor_acordado_lead IS NOT NULL AND id_propuesta_aceptada_lead IS NOT NULL AND motivo_cierre_lead IS NULL)
   OR (resultado_comercial_lead=''''CERRADA_SIN_ACUERDO'''' AND fecha_decision_comercial_lead IS NOT NULL AND valor_acordado_lead IS NULL AND id_propuesta_aceptada_lead IS NULL AND NULLIF(LTRIM(RTRIM(motivo_cierre_lead)),'''''''') IS NOT NULL)
  );'');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=''CK_Solicitudes_ValorYFechaLead'' AND parent_object_id=OBJECT_ID(''dbo.Solicitudes''))
  EXEC(N''ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT CK_Solicitudes_ValorYFechaLead CHECK (
   (valor_acordado_lead IS NULL OR valor_acordado_lead>=0) AND
   (fecha_decision_comercial_lead IS NULL OR fecha_decision_comercial_lead>=fecha_solicitud)
  );'');

 -- D. Propuestas: compatible con columnas del Init_OLTP_actualizada del usuario.
 -- Una propuesta LOGICA = raiz + versiones. No se cuentan filas/versiones directamente.
 IF OBJECT_ID(''dbo.PropuestasEconomicasLead'',''U'') IS NULL
 CREATE TABLE dbo.PropuestasEconomicasLead (
  id_propuesta INT IDENTITY(1,1) CONSTRAINT PK_PropuestasEconomicasLead PRIMARY KEY,
  id_solicitud INT NOT NULL CONSTRAINT FK_PropuestasLead_Solicitud REFERENCES dbo.Solicitudes(id_solicitud),
  id_servicio INT NOT NULL CONSTRAINT FK_PropuestasLead_Servicio REFERENCES dbo.Servicios(id_servicio),
  id_propuesta_raiz INT NULL,
  numero_version SMALLINT NOT NULL CONSTRAINT DF_PropuestasLead_Version DEFAULT 1,
  precio_cotizado DECIMAL(10,2) NOT NULL,
  promocion_aplicada VARCHAR(150) NULL,
  fecha_presentacion DATETIME2 NOT NULL CONSTRAINT DF_PropuestasLead_Presentacion DEFAULT SYSDATETIME(),
  estado VARCHAR(20) NOT NULL CONSTRAINT DF_PropuestasLead_Estado DEFAULT ''Pendiente'',
  fecha_decision DATETIME2 NULL,
  motivo_rechazo VARCHAR(200) NULL,
  tipo_motivo_rechazo VARCHAR(30) NULL,
  CONSTRAINT FK_PropuestasLead_Raiz FOREIGN KEY(id_propuesta_raiz) REFERENCES dbo.PropuestasEconomicasLead(id_propuesta),
  CONSTRAINT CK_PropuestasLead_Precio CHECK(precio_cotizado>=0),
  CONSTRAINT CK_PropuestasLead_Estado CHECK(estado IN (''Pendiente'',''Aceptada'',''Rechazada'')),
  CONSTRAINT CK_PropuestasLead_Version CHECK(numero_version>=1)
 );
 IF COL_LENGTH(''dbo.PropuestasEconomicasLead'',''id_propuesta_raiz'') IS NULL
  THROW 54011,''PropuestasEconomicasLead preexistente con esquema no compatible: requiere reconciliacion manual.'',1;
 IF COL_LENGTH(''dbo.PropuestasEconomicasLead'',''numero_version'') IS NULL
  THROW 54012,''Falta numero_version: revisar la migracion LEAD anterior antes de continuar.'',1;
 IF COL_LENGTH(''dbo.PropuestasEconomicasLead'',''id_sede_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.PropuestasEconomicasLead ADD id_sede_lead INT NULL CONSTRAINT FK_PropuestasLead_SedeLead REFERENCES dbo.Sedes(id_sede);'');
 IF COL_LENGTH(''dbo.PropuestasEconomicasLead'',''id_promocion_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.PropuestasEconomicasLead ADD id_promocion_lead INT NULL;'');
 IF COL_LENGTH(''dbo.PropuestasEconomicasLead'',''id_motivo_rechazo_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.PropuestasEconomicasLead ADD id_motivo_rechazo_lead INT NULL;'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_PropuestasLead_PromocionLead'' AND parent_object_id=OBJECT_ID(''dbo.PropuestasEconomicasLead''))
  EXEC(N''ALTER TABLE dbo.PropuestasEconomicasLead WITH CHECK ADD CONSTRAINT FK_PropuestasLead_PromocionLead FOREIGN KEY(id_promocion_lead) REFERENCES dbo.PromocionesLead(id_promocion);'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_PropuestasLead_MotivoLead'' AND parent_object_id=OBJECT_ID(''dbo.PropuestasEconomicasLead''))
  EXEC(N''ALTER TABLE dbo.PropuestasEconomicasLead WITH CHECK ADD CONSTRAINT FK_PropuestasLead_MotivoLead FOREIGN KEY(id_motivo_rechazo_lead) REFERENCES dbo.MotivosRechazoLead(id_motivo_rechazo);'');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=''CK_PropuestasLead_ArbolVersion'' AND parent_object_id=OBJECT_ID(''dbo.PropuestasEconomicasLead''))
  EXEC(N''ALTER TABLE dbo.PropuestasEconomicasLead WITH CHECK ADD CONSTRAINT CK_PropuestasLead_ArbolVersion CHECK (
   (id_propuesta_raiz IS NULL AND numero_version=1) OR
   (id_propuesta_raiz IS NOT NULL AND numero_version>1));'');
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=''UX_PropuestasLead_RaizVersion'' AND object_id=OBJECT_ID(''dbo.PropuestasEconomicasLead''))
  EXEC(N''CREATE UNIQUE INDEX UX_PropuestasLead_RaizVersion ON dbo.PropuestasEconomicasLead(id_propuesta_raiz,numero_version) WHERE id_propuesta_raiz IS NOT NULL;'');
 -- R1 asocia una propuesta concreta a su solicitud, sin cambiar el grano.
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Solicitudes_PropuestaAceptadaLead'' AND parent_object_id=OBJECT_ID(''dbo.Solicitudes''))
  EXEC(N''ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_PropuestaAceptadaLead FOREIGN KEY(id_propuesta_aceptada_lead) REFERENCES dbo.PropuestasEconomicasLead(id_propuesta);'');

 -- E. Opciones: conservar id_opcion y FK Reservas.id_opcion.
 IF COL_LENGTH(''dbo.Opciones'',''estado_respuesta'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD estado_respuesta VARCHAR(20) NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''fecha_respuesta'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD fecha_respuesta DATETIME2 NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''motivo_rechazo'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD motivo_rechazo VARCHAR(200) NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''tipo_motivo_rechazo'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD tipo_motivo_rechazo VARCHAR(30) NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''id_propuesta_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD id_propuesta_lead INT NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''id_preferencia_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD id_preferencia_lead INT NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''id_motivo_rechazo_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD id_motivo_rechazo_lead INT NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''pref_fecha_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD pref_fecha_lead DATE NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''pref_dia_semana_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD pref_dia_semana_lead TINYINT NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''pref_turno_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD pref_turno_lead VARCHAR(30) NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''pref_hora_inicio_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD pref_hora_inicio_lead TIME NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''pref_hora_fin_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD pref_hora_fin_lead TIME NULL;'');
 IF COL_LENGTH(''dbo.Opciones'',''ofr_turno_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.Opciones ADD ofr_turno_lead VARCHAR(30) NULL;'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Opciones_PropuestaLead'' AND parent_object_id=OBJECT_ID(''dbo.Opciones''))
  EXEC(N''ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT FK_Opciones_PropuestaLead FOREIGN KEY(id_propuesta_lead) REFERENCES dbo.PropuestasEconomicasLead(id_propuesta);'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Opciones_PreferenciaLead'' AND parent_object_id=OBJECT_ID(''dbo.Opciones''))
  EXEC(N''ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT FK_Opciones_PreferenciaLead FOREIGN KEY(id_preferencia_lead) REFERENCES dbo.PersonaPreferencias(id_preferencia);'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Opciones_MotivoLead'' AND parent_object_id=OBJECT_ID(''dbo.Opciones''))
  EXEC(N''ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT FK_Opciones_MotivoLead FOREIGN KEY(id_motivo_rechazo_lead) REFERENCES dbo.MotivosRechazoLead(id_motivo_rechazo);'');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=''CK_Opciones_PreferenciaHorarioLead'' AND parent_object_id=OBJECT_ID(''dbo.Opciones''))
  EXEC(N''ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT CK_Opciones_PreferenciaHorarioLead CHECK (
   (pref_dia_semana_lead IS NULL OR pref_dia_semana_lead BETWEEN 1 AND 7) AND
   ((pref_hora_inicio_lead IS NULL AND pref_hora_fin_lead IS NULL) OR
    (pref_hora_inicio_lead IS NOT NULL AND pref_hora_fin_lead IS NOT NULL AND pref_hora_inicio_lead<pref_hora_fin_lead))
  );'');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=''CK_Opciones_SeleccionLead'' AND parent_object_id=OBJECT_ID(''dbo.Opciones''))
  EXEC(N''ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT CK_Opciones_SeleccionLead CHECK (NOT(seleccionada=1 AND estado_respuesta=''''Rechazada''''));'');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=''CK_Opciones_FechaRespuestaLead'' AND parent_object_id=OBJECT_ID(''dbo.Opciones''))
  EXEC(N''ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT CK_Opciones_FechaRespuestaLead CHECK (fecha_respuesta IS NULL OR fecha_respuesta>=fecha_ofrecida);'');

 -- F. Bitacora de cambios de alternativa, 1 registro por evento de modificacion.
 IF OBJECT_ID(''dbo.CambiosOpcionLead'',''U'') IS NULL
 CREATE TABLE dbo.CambiosOpcionLead (
  id_cambio INT IDENTITY(1,1) CONSTRAINT PK_CambiosOpcionLead PRIMARY KEY,
  id_opcion INT NOT NULL CONSTRAINT FK_CambiosOpcionLead_Opcion REFERENCES dbo.Opciones(id_opcion),
  fecha_cambio DATETIME2 NOT NULL CONSTRAINT DF_CambiosOpcionLead_Fecha DEFAULT SYSDATETIME(),
  campo_modificado VARCHAR(50) NOT NULL,
  motivo_cambio VARCHAR(300) NOT NULL,
  tipo_motivo VARCHAR(30) NOT NULL CONSTRAINT DF_CambiosOpcionLead_Tipo DEFAULT ''Otro'',
  valor_anterior VARCHAR(200) NULL,
  valor_nuevo VARCHAR(200) NULL,
  CONSTRAINT CK_CambiosOpcionLead_Tipo CHECK(tipo_motivo IN (''Incompatibilidad'',''Preferencia'',''Otro''))
 );
 IF COL_LENGTH(''dbo.CambiosOpcionLead'',''es_pre_reserva_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.CambiosOpcionLead ADD es_pre_reserva_lead BIT NULL;'');
 IF COL_LENGTH(''dbo.CambiosOpcionLead'',''fecha_registro_utc_lead'') IS NULL
  EXEC(N''ALTER TABLE dbo.CambiosOpcionLead ADD fecha_registro_utc_lead DATETIME2(7) NULL CONSTRAINT DF_CambiosOpcionLead_RegistroUTC DEFAULT SYSUTCDATETIME();'');
 -- No marcamos historicos heredados como pre-reserva sin comprobarlos.

 -- G. Enlazar interacciones comerciales sin alterar historial Buyer.
 IF COL_LENGTH(''dbo.Interacciones'',''id_solicitud'') IS NULL
  EXEC(N''ALTER TABLE dbo.Interacciones ADD id_solicitud INT NULL;'');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=''FK_Interacciones_SolicitudLead'' AND parent_object_id=OBJECT_ID(''dbo.Interacciones''))
  EXEC(N''ALTER TABLE dbo.Interacciones WITH CHECK ADD CONSTRAINT FK_Interacciones_SolicitudLead FOREIGN KEY(id_solicitud) REFERENCES dbo.Solicitudes(id_solicitud);'');

';
IF EXISTS (SELECT 1 FROM @Columnas e
LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') AND c.name=e.columna
LEFT JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE (c.column_id IS NULL)
 OR (c.column_id IS NOT NULL AND (ty.name<>e.tipo OR c.is_nullable<>e.nullable OR c.is_identity<>e.identidad
  OR (e.longitud IS NOT NULL AND c.max_length<>e.longitud)
  OR (e.precision_esperada IS NOT NULL AND c.precision<>e.precision_esperada)
  OR (e.escala IS NOT NULL AND c.scale<>e.escala))))
 THROW 54820, 'El esquema final no coincide con el manifiesto. Revertir toda la actualizacion.', 1;
IF EXISTS (SELECT 1 FROM @FK e JOIN sys.foreign_keys f ON f.schema_id=SCHEMA_ID('dbo') AND f.name=e.nombre
 WHERE f.parent_object_id<>OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) OR f.referenced_object_id<>OBJECT_ID(N'dbo.'+QUOTENAME(e.referencia))
 OR f.is_disabled=1 OR f.is_not_trusted=1 OR f.delete_referential_action<>0 OR f.update_referential_action<>0
 OR (SELECT COUNT(*) FROM sys.foreign_key_columns fc WHERE fc.constraint_object_id=f.object_id)<>1
 OR NOT EXISTS(SELECT 1 FROM sys.foreign_key_columns fc
  JOIN sys.columns c ON c.object_id=fc.parent_object_id AND c.column_id=fc.parent_column_id
  JOIN sys.columns rc ON rc.object_id=fc.referenced_object_id AND rc.column_id=fc.referenced_column_id
  WHERE fc.constraint_object_id=f.object_id AND c.name=e.columna AND rc.name=e.columna_ref)) OR EXISTS(SELECT 1 FROM @FK e WHERE NOT EXISTS(SELECT 1 FROM sys.foreign_keys f
 WHERE f.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND f.name=e.nombre))
 THROW 54821, 'Falta una FK final o su definicion no es compatible.', 1;
IF EXISTS(SELECT 1 FROM @CK e WHERE NOT EXISTS(SELECT 1 FROM sys.check_constraints ck
 WHERE ck.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND ck.name=e.nombre AND ck.is_disabled=0 AND ck.is_not_trusted=0))
 THROW 54822, 'Falta un CHECK habilitado y confiable.', 1;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Solicitudes') AND name='UX_Solicitudes_RegistroWebLead')
 OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.PropuestasEconomicasLead') AND name='UX_PropuestasLead_RaizVersion')
 THROW 54823, 'Falta un indice unico requerido.', 1;
-- Dos indices unicos de las definiciones originales; verificar columnas y filtro.
IF EXISTS(SELECT 1 FROM (VALUES ('Solicitudes','UX_Solicitudes_RegistroWebLead','clave_registro_web_lead',NULL),
 ('PropuestasEconomicasLead','UX_PropuestasLead_RaizVersion','id_propuesta_raiz','numero_version')) e(tabla,nombre,col1,col2)
 JOIN sys.indexes i ON i.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND i.name=e.nombre
 WHERE i.is_unique<>1 OR i.is_disabled=1 OR i.has_filter<>1 OR i.type<>2
 OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(i.filter_definition,'[',''),']',''),'(',''),')',''),' ',''),CHAR(10),''))<>LOWER(e.col1+'ISNOTNULL')
 OR NOT EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
  WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=1 AND c.name=e.col1 AND ic.is_descending_key=0)
 OR (e.col2 IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
  WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=2 AND c.name=e.col2 AND ic.is_descending_key=0))
 OR (SELECT COUNT(*) FROM sys.index_columns ic WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0)<>CASE WHEN e.col2 IS NULL THEN 1 ELSE 2 END)
 THROW 54813, 'Indice unico preexistente incompatible.', 1;

IF EXISTS(SELECT 1 FROM @ClavesSoporte e WHERE OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
 JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
 WHERE i.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND i.is_unique=1 AND i.has_filter=0 AND i.is_disabled=0
 AND i.is_primary_key=e.primaria AND ic.key_ordinal=1 AND c.name=e.columna
 AND (SELECT COUNT(*) FROM sys.index_columns k WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal>0)=1))
 THROW 54814, 'Tabla de soporte sin PK o clave unica original.', 1;
-- Normalizacion limitada a defaults escalares simples (literales o funciones sin argumentos).
IF EXISTS(SELECT 1 FROM @Defaults e WHERE OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla),'U') IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
 WHERE dc.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND c.name=e.columna
 AND REPLACE(REPLACE(REPLACE(dc.definition,'(',''),')',''),' ','') COLLATE Latin1_General_100_BIN2 = e.expresion COLLATE Latin1_General_100_BIN2))
 THROW 54815, 'Tabla de soporte sin default original o con default diferente.', 1;

COMMIT TRANSACTION;
SET @transaccion_propia=0;
SELECT 'QA-BUYER-P2022-PARCIAL' AS actualizacion, 'DDL confirmado; validacion HTTP pendiente' AS resultado;
END TRY
BEGIN CATCH
 IF @transaccion_propia=1 AND XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
