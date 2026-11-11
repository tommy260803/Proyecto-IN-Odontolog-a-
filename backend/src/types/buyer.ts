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
  intentos_realizados: number;
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
export type BuyerEvaluationStatus = 'PENDIENTE' | 'COMPLETADA' | 'FALLIDA';

/**
 * Acciones resultantes de la evaluación del agente Buyer.
 */
export type BuyerEvaluationAction =
  | 'CONVERSION_LEAD'
  | 'SOLO_CONSULTA'
  | 'ACLARACION'
  | 'REINTENTO_PENDIENTE'
  | 'CONSERVA_ETAPA_POSTERIOR'
  | 'REQUISITOS_INCOMPLETOS';

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
  intentos_realizados?: number;
  duracion_total_ms?: number;
}


