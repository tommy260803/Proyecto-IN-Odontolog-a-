/* PROPUESTA QA PARCIAL. NO APLICADA. Revision 2026-11-12.
   Rama feature/buyer-orientacion-interactiva; HEAD 19613358530e899bfc68d5e6b3c33b6336ab9ce4.
   Fuente: ../../lead_revision/INSTALAR_LEAD_COMPLETO.sql, secciones B-G.
   No equivale a instalar LEAD-V2. Sin catalogos de datos, backfill, auditoria ni procedimientos.
   Revisar docs/agentes/REVISION_QA_BUYER_DANIEL.md antes de autorizar la ejecucion.
   Ejecutar ARCHIVO ENTERO en una sesion nueva. Un solo lote: no insertar GO ni ejecutar selecciones.
*/
SET NOCOUNT ON;
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

SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) AS servidor,DB_NAME() AS base_efectiva,SYSUTCDATETIME() AS fecha_utc;
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
SELECT e.tabla,e.nombre,e.columna,e.referencia,e.columna_ref,f.is_disabled,f.is_not_trusted,
 OBJECT_NAME(f.parent_object_id) tabla_real,OBJECT_NAME(f.referenced_object_id) referencia_real
FROM @FK e LEFT JOIN sys.foreign_keys f ON f.schema_id=SCHEMA_ID('dbo') AND f.name=e.nombre ORDER BY e.tabla,e.nombre;
SELECT e.tabla,e.nombre,ck.definition,ck.is_disabled,ck.is_not_trusted
FROM @CK e LEFT JOIN sys.check_constraints ck ON ck.parent_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(e.tabla)) AND ck.name=e.nombre ORDER BY e.tabla,e.nombre;
SELECT t.name tabla,c.name columna,dc.name,dc.definition FROM sys.default_constraints dc
 JOIN sys.tables t ON t.object_id=dc.parent_object_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=dc.parent_column_id
 WHERE t.name IN ('PromocionesLead','MotivosRechazoLead','PropuestasEconomicasLead','CambiosOpcionLead') ORDER BY t.name,c.name;
SELECT t.name tabla,i.name,i.is_primary_key,i.is_unique,i.is_disabled,i.filter_definition,c.name columna,ic.key_ordinal
FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
 JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE t.name IN ('Solicitudes','Opciones','PromocionesLead','MotivosRechazoLead','PropuestasEconomicasLead','CambiosOpcionLead') ORDER BY t.name,i.name,ic.key_ordinal;
SELECT (SELECT COUNT_BIG(*) FROM dbo.Personas) Personas,(SELECT COUNT_BIG(*) FROM dbo.Solicitudes) Solicitudes,
 (SELECT COUNT_BIG(*) FROM dbo.Opciones) Opciones,(SELECT COUNT_BIG(*) FROM dbo.Interacciones) Interacciones;
-- Presencia NO implica instalacion completa ni compatibilidad de los procedimientos.
SELECT e.nombre,o.type_desc,CASE WHEN o.object_id IS NULL THEN 'FALTA' ELSE 'EXISTE' END estado
FROM (VALUES ('ConfiguracionLeadRevision'),('HistorialSolicitudesLead'),('HistorialPropuestasLead'),('HistorialOpcionesLead'),
 ('EntradasAgenteLead'),('usp_ConvertirBuyerALead'),('usp_RegistrarEntradaAgenteLead'),('usp_Lead_PresentarAlternativa'),
 ('usp_Lead_ReporteR1'),('usp_Lead_ReporteR2'),('usp_Lead_ReporteR3')) e(nombre)
LEFT JOIN sys.objects o ON o.schema_id=SCHEMA_ID('dbo') AND o.name=e.nombre;
IF COL_LENGTH('dbo.Interacciones','id_solicitud') IS NOT NULL
 EXEC sys.sp_executesql N'SELECT COUNT_BIG(*) interacciones_con_solicitud,
 COALESCE(SUM(CONVERT(bigint,CASE WHEN s.id_solicitud IS NULL THEN 1 ELSE 0 END)),0) referencias_huerfanas,
 COALESCE(SUM(CONVERT(bigint,CASE WHEN s.id_persona<>i.id_persona THEN 1 ELSE 0 END)),0) persona_distinta
 FROM dbo.Interacciones i LEFT JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud WHERE i.id_solicitud IS NOT NULL;';
SELECT o.name procedimiento,p.parameter_id,p.name parametro,TYPE_NAME(p.user_type_id) tipo,p.max_length,p.is_output
FROM sys.objects o JOIN sys.parameters p ON p.object_id=o.object_id
WHERE o.schema_id=SCHEMA_ID('dbo') AND o.name IN ('usp_ConvertirBuyerALead','usp_RegistrarEntradaAgenteLead')
ORDER BY o.name,p.parameter_id;
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

-- Proyecciones sin datos personales; se compilan SOLO despues de comprobar el manifiesto.
EXEC sys.sp_executesql N'SELECT TOP (0) id_negociador,id_canal_origen,id_sede_interes_lead,fecha_ingreso_lead,
 archivada_lead_en,resultado_comercial_lead,fecha_decision_comercial_lead,valor_acordado_lead,
 id_propuesta_aceptada_lead,motivo_cierre_lead,fecha_proximo_seguimiento FROM dbo.Solicitudes;
 SELECT TOP (0) * FROM dbo.Opciones;
 SELECT TOP (0) * FROM dbo.PromocionesLead;
 SELECT TOP (0) * FROM dbo.MotivosRechazoLead;
 SELECT TOP (0) * FROM dbo.PropuestasEconomicasLead;
 SELECT TOP (0) * FROM dbo.CambiosOpcionLead;';
SELECT 'CATALOGO PARCIAL VERIFICADO; FALTAN GET LISTADO/FICHA Y VALIDACION DE DATOS' resultado;
