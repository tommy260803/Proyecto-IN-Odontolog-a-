import { CreditCard, HeartHandshake, Stethoscope, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { ReportStage } from '@/shared/services/report.service';

export type MeasurePolarity = 'up' | 'down' | 'neutral';

export interface MeasureOption {
  value: string;
  label: string;
  unit: 'cant' | 'pen' | 'dias' | 'min';
  aggregation: 'sum' | 'avg' | 'ratio';
  polarity: MeasurePolarity;
}

export interface StageConfig {
  id: ReportStage;
  index: string;
  label: string;
  role: string;
  description: string;
  icon: LucideIcon;
  defaultMeasure: string;
  measures: MeasureOption[];
}

export const UNIT_LABEL: Record<MeasureOption['unit'], string> = {
  cant: 'Cantidad',
  pen: 'Soles (S/)',
  dias: 'Días promedio',
  min: 'Minutos promedio',
};

export const STAGES: StageConfig[] = [
  {
    id: 'buyer',
    index: '01',
    label: 'Prospectos Web',
    role: 'Prospectos Web',
    description: 'Contactos y solicitudes registradas por canal de adquisición y sede clínica.',
    icon: Users,
    defaultMeasure: 'contacto_registrado',
    measures: [
      { value: 'contacto_registrado', label: 'Contactos Registrados', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'contacto_utilizable', label: 'Contactos Válidos', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'conversion_lead', label: 'Pase a Cotización', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'tiempo_conversion_dia', label: 'Tiempo de Conversión (Días)', unit: 'dias', aggregation: 'avg', polarity: 'down' },
      { value: 'costo_atribuido_captacion', label: 'Costo de Captación Atribuido (S/)', unit: 'pen', aggregation: 'sum', polarity: 'down' },
      { value: 'monto_inversion', label: 'Inversión en Pauta (S/)', unit: 'pen', aggregation: 'sum', polarity: 'down' },
      { value: 'costo_por_lead', label: 'Costo por Prospecto - CPL (S/)', unit: 'pen', aggregation: 'ratio', polarity: 'down' },
    ],
  },
  {
    id: 'lead',
    index: '02',
    label: 'Cotizaciones & Citas',
    role: 'Cotizaciones',
    description: 'Presupuestos presentados, citas coordinadas y negociación comercial.',
    icon: UserPlus,
    defaultMeasure: 'cohorte_evaluable',
    measures: [
      { value: 'cohorte_evaluable', label: 'Cotizaciones Evaluadas', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'conversion_payer_14_dia', label: 'Aceptadas y Pagadas (<14d)', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'solicitud_requiere_respuesta', label: 'Solicitudes por Responder', unit: 'cant', aggregation: 'sum', polarity: 'neutral' },
      { value: 'respuesta_util_15_min', label: 'Respuesta Rápida (<15 min)', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'negociacion_finalizada', label: 'Negociaciones Aceptadas', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'negociacion_abandonada', label: 'Cotizaciones Descartadas', unit: 'cant', aggregation: 'sum', polarity: 'down' },
    ],
  },
  {
    id: 'payer',
    index: '03',
    label: 'Caja & Cobranzas',
    role: 'Caja & Cobranzas',
    description: 'Recaudación, validación de pagos y conciliación de comprobantes.',
    icon: CreditCard,
    defaultMeasure: 'pago_registrado',
    measures: [
      { value: 'pago_registrado', label: 'Pagos Registrados', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'pago_validado', label: 'Pagos Validados', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'pago_rechazado', label: 'Pagos Observados o Rechazados', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'conversion_customer', label: 'Pase a Atención Clínica', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'costo_transaccion', label: 'Costo por Transacción (S/)', unit: 'pen', aggregation: 'sum', polarity: 'down' },
      { value: 'tiempo_validacion_minuto', label: 'Tiempo de Validación en Caja (min)', unit: 'min', aggregation: 'avg', polarity: 'down' },
      { value: 'importe_total_cobro', label: 'Monto Total Recaudado (S/)', unit: 'pen', aggregation: 'sum', polarity: 'up' },
    ],
  },
  {
    id: 'customer',
    index: '04',
    label: 'Atención Clínica',
    role: 'Atención Clínica',
    description: 'Procedimientos odontológicos en sillón dental, cumplimiento y altas.',
    icon: Stethoscope,
    defaultMeasure: 'cita_evaluable',
    measures: [
      { value: 'cita_evaluable', label: 'Citas Programadas', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'atencion_realizada', label: 'Tratamientos Realizados', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'cita_inasistencia', label: 'Inasistencias (No-Show)', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'tiempo_sillon_dental_minuto', label: 'Tiempo en Sillón Dental (min)', unit: 'min', aggregation: 'avg', polarity: 'neutral' },
      { value: 'atencion_finalizada_conforme', label: 'Tratamientos Conformes de Alta', unit: 'cant', aggregation: 'sum', polarity: 'up' },
    ],
  },
  {
    id: 'turned',
    index: '05',
    label: 'Fidelización & Retorno',
    role: 'Fidelización',
    description: 'Controles postventa, encuestas de satisfacción, recall preventivo y retorno.',
    icon: HeartHandshake,
    defaultMeasure: 'seguimiento_registrado',
    measures: [
      { value: 'seguimiento_registrado', label: 'Seguimientos Registrados', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'seguimiento_efectivo', label: 'Contactos Efectivos', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'incidencia_reportada', label: 'Incidencias Reportadas', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'incidencia_resuelta_24_hora', label: 'Incidencias Resueltas (<24h)', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'retorno_cohorte_90_dia', label: 'Retorno de Pacientes (>90d)', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'paciente_elegible_retorno', label: 'Pacientes Aptos para Recall', unit: 'cant', aggregation: 'sum', polarity: 'neutral' },
    ],
  },
];

export const KPI_STAGES: StageConfig[] = STAGES.filter((s) => s.id !== 'lead');

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<ReportStage, StageConfig>;

const LEGACY_MEASURE_MAP: Record<string, string> = {
  contactos_registrados: 'contacto_registrado',
  contactos_utilizables: 'contacto_utilizable',
  conversiones_lead: 'conversion_lead',
  tiempo_conversion: 'tiempo_conversion_dia',
  costo_atribuido: 'costo_atribuido_captacion',
  leads_cohorte: 'cohorte_evaluable',
  leads_convertidos_14d: 'conversion_payer_14_dia',
  leads_requieren_resp: 'solicitud_requiere_respuesta',
  leads_resp_15m: 'respuesta_util_15_min',
  leads_resultado_final: 'negociacion_finalizada',
  leads_abandonados: 'negociacion_abandonada',
  pagos_registrados: 'pago_registrado',
  pagos_validados: 'pago_validado',
  pagos_rechazados: 'pago_rechazado',
  conversiones_customer: 'conversion_customer',
  costo_transacciones: 'costo_transaccion',
  tiempo_validacion: 'tiempo_validacion_minuto',
  importe_total: 'importe_total_cobro',
  citas_evaluables: 'cita_evaluable',
  atenciones_realizadas: 'atencion_realizada',
  citas_inasistencia: 'cita_inasistencia',
  tiempo_sillon: 'tiempo_sillon_dental_minuto',
  atenciones_conformes: 'atencion_finalizada_conforme',
  seguimientos_registrados: 'seguimiento_registrado',
  seguimientos_efectivos: 'seguimiento_efectivo',
  incidencias_reportadas: 'incidencia_reportada',
  incidencias_resueltas: 'incidencia_resuelta_24_hora',
  retornos_cohorte: 'retorno_cohorte_90_dia',
  retornos_90dias: 'retorno_cohorte_90_dia',
  pacientes_elegibles: 'paciente_elegible_retorno',
};

export function getMeasure(stage: ReportStage, value: string): MeasureOption {
  const cfg = STAGE_BY_ID[stage];
  const normalizedValue = LEGACY_MEASURE_MAP[value] || value;
  return cfg.measures.find((m) => m.value === normalizedValue) ?? cfg.measures[0];
}

export type ReportView = ReportStage | 'all';

export const VIEW_OPTIONS: Array<{ id: ReportView; label: string }> = [
  ...STAGES.map((s) => ({ id: s.id as ReportView, label: s.label })),
  { id: 'all', label: 'Consolidado General' },
];
