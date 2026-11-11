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

