import type { GoogleGenAI } from '@google/genai';

/**
 * Intenciones admitidas para los mensajes entrantes de pacientes potenciales (Buyer).
 */
export type BuyerIntention = 'SOLICITA_RESERVA' | 'SOLO_CONSULTA' | 'AMBIGUA';

/**
 * Representación de un ítem del catálogo de servicios clínicos odontológicos.
 */
export interface ServiceCatalogItem {
  id_servicio: number;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  [key: string]: unknown;
}

/**
 * Registro de auditoría de cada intento de llamada al modelo/API.
 * No contiene claves ni credenciales en el mensaje de error.
 */
export interface BuyerClassificationAttempt {
  intento: number;
  duracion_ms: number;
  exitoso: boolean;
  error?: string;
}

/**
 * Resultado validado de la clasificación del mensaje Buyer.
 */
export interface BuyerClassificationResult {
  intencion: BuyerIntention;
  id_servicio: number | null;
  intentosRealizados: number;
  intentos_realizados: number;
  duracionTotalMs: number;
  duracion_total_ms: number;
  intentos: BuyerClassificationAttempt[];
}

/**
 * Opciones de configuración del clasificador Buyer.
 */
export interface BuyerClassifierOptions {
  apiKey?: string;
  modelName?: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  backoffFactor?: number;
  client?: GoogleGenAI;
}

/**
 * Definición de un caso de prueba sintético para evaluación del agente.
 */
export interface SyntheticBuyerTestCase {
  id: string;
  mensaje: string;
  intencionEsperada: BuyerIntention;
  idServicioEsperado: number | null;
  descripcion: string;
  categoriaPrueba?: 'reserva' | 'consulta' | 'ambigua' | 'negacion' | 'condicional' | 'malicioso';
}

/**
 * Estados del ciclo de vida de una evaluación de mensaje Buyer.
 */
export type BuyerEvaluationStatus = 'PENDIENTE' | 'COMPLETADA' | 'FALLIDA' | 'DESACTUALIZADA';

/**
 * Acciones resultantes de la evaluación del agente Buyer.
 */
export type BuyerEvaluationAction =
  | 'CONVERSION_LEAD'
  | 'SOLO_CONSULTA'
  | 'ACLARACION'
  | 'REINTENTO_PENDIENTE'
  | 'CONSERVA_ETAPA_POSTERIOR'
  | 'SOLICITUD_PENDIENTE_APERTURA'
  | 'REQUISITOS_INCOMPLETOS';

/**
 * Contexto conversacional persistente para interpretaciones en dos o más turnos.
 */
export interface BuyerClarificationContext {
  mensajeAnterior?: string | null;
  aclaracionPrevia?: string | null;
  idDecisionPrevia?: number | null;
  idInteraccionPrevia?: number | null;
  turno?: number;
}

/**
 * Estructura del resultado integral de evaluación y orquestación Buyer.
 */
export interface BuyerEvaluationOutcome {
  id_persona: number;
  id_captacion: number;
  id_interaccion: number;
  id_decision?: number;
  estado: BuyerEvaluationStatus;
  intencion: BuyerIntention | null;
  id_servicio: number | null;
  accion: BuyerEvaluationAction;
  etapa_final: string;
  id_solicitud?: number | null;
  id_evento_etapa?: number | null;
  ya_convertido?: boolean;
  aclaracion?: string | null;
  error?: string | null;
  historial_errores?: string[];
  intentosRealizados: number;
  intentos_realizados?: number;
  duracionTotalMs: number;
  duracion_total_ms?: number;
  entregaLeadEstado?: 'PENDIENTE' | 'CONFIRMADA' | 'NO_APLICA';
  contextoConversacional?: BuyerClarificationContext;
  contextFingerprint?: string | null;
  es_contexto_vigente?: boolean;
  es_mensaje_vigente?: boolean;
  discrepancia_horario?: {
    detectada: boolean;
    mensajeIndica?: string;
    preferenciaRegistrada?: string;
    detalle?: string;
  } | null;
}

/**
 * Resumen de la última evaluación IA persistida para visualización en fichas Buyer.
 */
export interface BuyerEvaluationSummary {
  id_decision: number | null;
  id_interaccion: number;
  id_interaccion_vigente?: number | null;
  es_mensaje_vigente?: boolean;
  es_contexto_vigente?: boolean;
  context_fingerprint?: string | null;
  current_context_fingerprint?: string | null;
  estado: BuyerEvaluationStatus;
  intencion: BuyerIntention | null;
  id_servicio: number | null;
  servicio_nombre?: string | null;
  accion: BuyerEvaluationAction;
  explicacion: string;
  fecha_hora: string;
  mensaje_evaluado?: string | null;
  mensaje_vigente?: string | null;
  discrepancia_horario?: {
    detectada: boolean;
    mensajeIndica?: string;
    preferenciaRegistrada?: string;
    detalle?: string;
  } | null;
  intentosRealizados?: number;
  duracionTotalMs?: number;
  error?: string | null;
  historial_errores?: string[];
}


