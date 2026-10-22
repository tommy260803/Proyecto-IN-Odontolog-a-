# -*- coding: utf-8 -*-
import os
import re

# 1. Update backend/src/routes/report.routes.ts
backend_file = r'D:\Proyects\Proyecto-IN-Odontolog-a-\backend\src\routes\report.routes.ts'
with open(backend_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace getBuyerMatrix
buyer_old = re.search(r'// ── BUILDER: BUYER MATRIX.*?sourceMart: [^\n]+', content, re.DOTALL)
buyer_replacement = """// ── BUILDER: BUYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getBuyerMatrix(measure: string = 'contacto_registrado', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(fc.ContactosRegistrados)';
  let isCurrency = false;
  let metricTitle = 'contacto_registrado';

  switch (measure) {
    case 'contacto_utilizable':
    case 'contactos_utilizables':
      measureSQL = 'SUM(fc.ContactosUtilizables)';
      metricTitle = 'contacto_utilizable';
      break;
    case 'conversion_lead':
    case 'conversiones_lead':
      measureSQL = 'SUM(fc.ConversionesALead)';
      metricTitle = 'conversion_lead';
      break;
    case 'tiempo_conversion_dia':
    case 'tiempo_conversion':
      measureSQL = 'ROUND(AVG(CAST(fc.TiempoConversionDias AS FLOAT)), 1)';
      metricTitle = 'tiempo_conversion_dia';
      break;
    case 'costo_atribuido_captacion':
    case 'costo_atribuido':
      measureSQL = 'SUM(fc.CostoAtribuidoCaptacion)';
      metricTitle = 'costo_atribuido_captacion';
      isCurrency = true;
      break;
    case 'contacto_registrado':
    case 'contactos_registrados':
    default:
      measureSQL = 'SUM(fc.ContactosRegistrados)';
      metricTitle = 'contacto_registrado';
      break;
  }

  const filter = timeFilter('fc', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(f.TipoOrigen, 'Canal Digital') AS categoria,
      ISNULL(c.NombreCanal, 'General') AS item,
      ISNULL(s.Sede, 'Sede Principal') AS columna,
      ${measureSQL} AS valor
    FROM Fact_CaptacionBuyer fc
    LEFT JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
    LEFT JOIN Dim_Fuente f ON f.KeyFuente = fc.KeyFuente
    LEFT JOIN Dim_Sede s ON s.KeySede = fc.KeySede
    ${filter.sql}
    GROUP BY f.TipoOrigen, c.NombreCanal, s.Sede
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'BUYER',
    reportTitle: 'Resumen de captación',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Fuente de Atracción / Canal',
    superHeader: 'Sede Física',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency,
    sourceMart: 'NexoSalud_Mart.fact_captacion_buyer'"""

if buyer_old:
    content = content[:buyer_old.start()] + buyer_replacement + content[buyer_old.end():]
    print('BUYER matrix builder updated.')

# Replace getLeadMatrix
lead_old = re.search(r'// ── BUILDER: LEAD MATRIX.*?sourceMart: [^\n]+', content, re.DOTALL)
lead_replacement = """// ── BUILDER: LEAD MATRIX (DINÁMICO) ──────────────────────────────────────────
async function getLeadMatrix(measure: string = 'cohorte_evaluable', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(f.LeadsCohorteEvaluable)';
  let metricTitle = 'cohorte_evaluable';

  switch (measure) {
    case 'conversion_payer_14_dia':
    case 'leads_convertidos_14d':
      measureSQL = 'SUM(f.LeadsConvertidosPayer14Dias)';
      metricTitle = 'conversion_payer_14_dia';
      break;
    case 'solicitud_requiere_respuesta':
    case 'leads_requieren_resp':
      measureSQL = 'SUM(f.LeadsRequierenRespuesta)';
      metricTitle = 'solicitud_requiere_respuesta';
      break;
    case 'respuesta_util_15_min':
    case 'leads_resp_15m':
      measureSQL = 'SUM(f.LeadsRespuestaUtil15Min)';
      metricTitle = 'respuesta_util_15_min';
      break;
    case 'negociacion_finalizada':
    case 'leads_resultado_final':
      measureSQL = 'SUM(f.LeadsResultadoFinal)';
      metricTitle = 'negociacion_finalizada';
      break;
    case 'negociacion_abandonada':
    case 'leads_abandonados':
      measureSQL = 'SUM(f.LeadsAbandonados)';
      metricTitle = 'negociacion_abandonada';
      break;
    case 'cohorte_evaluable':
    case 'leads_cohorte':
    default:
      measureSQL = 'SUM(f.LeadsCohorteEvaluable)';
      metricTitle = 'cohorte_evaluable';
      break;
  }

  const filter = timeFilter('f', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(s.Sede, 'Sede Principal') AS categoria,
      ISNULL(n.NombreNegociador, 'Operador Asignado') AS item,
      ISNULL(serv.Categoria, 'Clínica Odontológica') AS columna,
      ${measureSQL} AS valor
    FROM Fact_NegociacionLead f
    LEFT JOIN Dim_Sede s ON s.KeySede = f.KeySede
    LEFT JOIN Dim_Negociador n ON n.KeyNegociador = f.KeyNegociador
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = f.KeyServicio
    ${filter.sql}
    GROUP BY s.KeySede, s.Sede, n.KeyNegociador, n.NombreNegociador, serv.Categoria
    ORDER BY s.KeySede ASC, n.KeyNegociador ASC
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'LEAD',
    reportTitle: 'Resumen de negociación',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Sede / Negociador',
    superHeader: 'Categoría del tratamiento',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.fact_negociacion_lead'"""

if lead_old:
    content = content[:lead_old.start()] + lead_replacement + content[lead_old.end():]
    print('LEAD matrix builder updated.')

# Replace getPayerMatrix
payer_old = re.search(r'// ── BUILDER: PAYER MATRIX.*?sourceMart: [^\n]+', content, re.DOTALL)
payer_replacement = """// ── BUILDER: PAYER MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getPayerMatrix(measure: string = 'pago_registrado', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(f.PagosRegistrados)';
  let metricTitle = 'pago_registrado';
  let isCurrency = false;

  switch (measure) {
    case 'pago_validado':
    case 'pagos_validados':
      measureSQL = 'SUM(f.PagosValidados)';
      metricTitle = 'pago_validado';
      break;
    case 'pago_rechazado':
    case 'pagos_rechazados':
      measureSQL = 'SUM(f.PagosRechazados)';
      metricTitle = 'pago_rechazado';
      break;
    case 'conversion_customer':
    case 'conversiones_customer':
      measureSQL = 'SUM(f.ConversionesACustomer)';
      metricTitle = 'conversion_customer';
      break;
    case 'costo_transaccion':
    case 'costo_transacciones':
      measureSQL = 'SUM(f.CostoTotalTransacciones)';
      metricTitle = 'costo_transaccion';
      isCurrency = true;
      break;
    case 'tiempo_validacion_minuto':
    case 'tiempo_validacion':
      measureSQL = 'ROUND(AVG(CAST(f.TiempoTotalValidacionMin AS FLOAT)), 1)';
      metricTitle = 'tiempo_validacion_minuto';
      break;
    case 'importe_total_cobro':
    case 'importe_total':
      measureSQL = 'SUM(f.ImporteTotalCobro)';
      metricTitle = 'importe_total_cobro';
      isCurrency = true;
      break;
    case 'pago_registrado':
    case 'pagos_registrados':
    default:
      measureSQL = 'SUM(f.PagosRegistrados)';
      metricTitle = 'pago_registrado';
      break;
  }

  const filter = timeFilter('f', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(p.TipoMedio, 'Bancarizado / Digital') AS categoria,
      ISNULL(p.MetodoPago, 'Canal General') AS item,
      ISNULL(c.EstadoPago, 'VALIDATED') AS columna,
      ${measureSQL} AS valor
    FROM Fact_GestionPayer f
    LEFT JOIN Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
    LEFT JOIN Dim_Cobro c ON c.KeyCobro = f.KeyCobro
    ${filter.sql}
    GROUP BY p.TipoMedio, p.MetodoPago, c.EstadoPago
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'PAYER',
    reportTitle: 'Resumen de recaudación',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Modalidad / Canal',
    superHeader: 'Estado del Pago',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency,
    sourceMart: 'NexoSalud_Mart.fact_gestion_payer'"""

if payer_old:
    content = content[:payer_old.start()] + payer_replacement + content[payer_old.end():]
    print('PAYER matrix builder updated.')

# Replace getCustomerMatrix
customer_old = re.search(r'// ── BUILDER: CUSTOMER MATRIX.*?sourceMart: [^\n]+', content, re.DOTALL)
customer_replacement = """// ── BUILDER: CUSTOMER MATRIX (DINÁMICO) ──────────────────────────────────────
async function getCustomerMatrix(measure: string = 'cita_evaluable', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(fa.CitasEvaluables)';
  let metricTitle = 'cita_evaluable';

  switch (measure) {
    case 'atencion_realizada':
    case 'atenciones_realizadas':
      measureSQL = 'SUM(fa.AtencionesRealizadas)';
      metricTitle = 'atencion_realizada';
      break;
    case 'cita_inasistencia':
    case 'citas_inasistencia':
      measureSQL = 'SUM(fa.CitasConInasistencia)';
      metricTitle = 'cita_inasistencia';
      break;
    case 'tiempo_sillon_dental_minuto':
    case 'tiempo_sillon':
      measureSQL = 'ROUND(AVG(CAST(fa.TiempoEnSillonDentalMin AS FLOAT)), 1)';
      metricTitle = 'tiempo_sillon_dental_minuto';
      break;
    case 'atencion_finalizada_conforme':
    case 'atenciones_conformes':
      measureSQL = 'SUM(fa.AtencionesFinalizadasConformes)';
      metricTitle = 'atencion_finalizada_conforme';
      break;
    case 'cita_evaluable':
    case 'citas_evaluables':
    default:
      measureSQL = 'SUM(fa.CitasEvaluables)';
      metricTitle = 'cita_evaluable';
      break;
  }

  const filter = timeFilter('fa', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(serv.Categoria, 'Clínica Odontológica') AS categoria,
      ISNULL(serv.ServicioOdontologico, 'Consulta General') AS item,
      ISNULL(s.Sede, 'Sede Principal') AS columna,
      ${measureSQL} AS valor
    FROM Fact_AtencionCustomer fa
    LEFT JOIN Dim_Sede s ON s.KeySede = fa.KeySede
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = fa.KeyServicio
    ${filter.sql}
    GROUP BY serv.Categoria, serv.ServicioOdontologico, s.Sede
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'CUSTOMER',
    reportTitle: 'Resumen de prestación clínica',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Categoría / Servicio',
    superHeader: 'Sede Clínica',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.fact_atencion_customer'"""

if customer_old:
    content = content[:customer_old.start()] + customer_replacement + content[customer_old.end():]
    print('CUSTOMER matrix builder updated.')

# Replace getTurnedMatrix
turned_old = re.search(r'// ── BUILDER: TURNED MATRIX.*?sourceMart: [^\n]+', content, re.DOTALL)
turned_replacement = """// ── BUILDER: TURNED MATRIX (DINÁMICO) ─────────────────────────────────────────
async function getTurnedMatrix(measure: string = 'seguimiento_registrado', range: PeriodRange = ALL_PERIODS): Promise<ExecutiveReportData> {
  let measureSQL = 'SUM(ft.SeguimientosRegistrados)';
  let metricTitle = 'seguimiento_registrado';

  switch (measure) {
    case 'seguimiento_efectivo':
    case 'seguimientos_efectivos':
      measureSQL = 'SUM(ft.SeguimientosEfectivos)';
      metricTitle = 'seguimiento_efectivo';
      break;
    case 'incidencia_reportada':
    case 'incidencias_reportadas':
      measureSQL = 'SUM(ft.IncidenciasReportadas)';
      metricTitle = 'incidencia_reportada';
      break;
    case 'incidencia_resuelta_24_hora':
    case 'incidencias_resueltas':
      measureSQL = 'SUM(ft.IncidenciasResueltas24h)';
      metricTitle = 'incidencia_resuelta_24_hora';
      break;
    case 'retorno_cohorte_90_dia':
    case 'retornos_cohorte':
    case 'retornos_90dias':
      measureSQL = 'SUM(ft.RetornosCohorte90Dias)';
      metricTitle = 'retorno_cohorte_90_dia';
      break;
    case 'paciente_elegible_retorno':
    case 'pacientes_elegibles':
      measureSQL = 'SUM(ft.PacientesElegiblesRetorno)';
      metricTitle = 'paciente_elegible_retorno';
      break;
    case 'seguimiento_registrado':
    case 'seguimientos_registrados':
    default:
      measureSQL = 'SUM(ft.SeguimientosRegistrados)';
      metricTitle = 'seguimiento_registrado';
      break;
  }

  const filter = timeFilter('ft', range);
  const rawData = await queryMart<{
    categoria: string;
    item: string;
    columna: string;
    valor: number;
  }>(`
    SELECT 
      ISNULL(serv.Categoria, 'Fidelización Postventa') AS categoria,
      ISNULL(serv.ServicioOdontologico, 'Control Odontológico') AS item,
      ISNULL(s.Sede, 'Sede Principal') AS columna,
      ${measureSQL} AS valor
    FROM Fact_SeguimientoTurned ft
    LEFT JOIN Dim_Sede s ON s.KeySede = ft.KeySede
    LEFT JOIN Dim_Servicio serv ON serv.KeyServicio = ft.KeyServicio
    ${filter.sql}
    GROUP BY serv.Categoria, serv.ServicioOdontologico, s.Sede
  `, filter.params);

  return buildDynamicMatrix(pivotRows(rawData), {
    stage: 'TURNED',
    reportTitle: 'Resumen de fidelización y retorno',
    period: range.label,
    periodKey: range.key,
    metric: metricTitle,
    rowHeader: 'Categoría / Servicio',
    superHeader: 'Sede Clínica',
    totalColumnName: 'Total',
    grandTotalLabel: 'Total general',
    isCurrency: false,
    sourceMart: 'NexoSalud_Mart.fact_seguimiento_turned'"""

if turned_old:
    content = content[:turned_old.start()] + turned_replacement + content[turned_old.end():]
    print('TURNED matrix builder updated.')

with open(backend_file, 'w', encoding='utf-8') as f:
    f.write(content)

print('Backend report.routes.ts updated successfully.')

# 2. Update frontend src/modules/reports/config/stages.ts
frontend_stages_file = r'D:\Proyects\Proyecto-IN-Odontolog-a-\src\modules\reports\config\stages.ts'
new_stages_content = """import { CreditCard, HeartHandshake, Stethoscope, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { ReportStage } from '@/shared/services/report.service';

export type MeasurePolarity = 'up' | 'down' | 'neutral';

export interface MeasureOption {
  value: string;
  label: string;
  unit: 'cant' | 'pen' | 'dias' | 'min';
  aggregation: 'sum' | 'avg';
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
    label: 'Captación',
    role: 'Buyer',
    description: 'Contactos atraídos por fuente, canal y sede.',
    icon: Users,
    defaultMeasure: 'contacto_registrado',
    measures: [
      { value: 'contacto_registrado', label: 'contacto_registrado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'contacto_utilizable', label: 'contacto_utilizable', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'conversion_lead', label: 'conversion_lead', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'tiempo_conversion_dia', label: 'tiempo_conversion_dia', unit: 'dias', aggregation: 'avg', polarity: 'down' },
      { value: 'costo_atribuido_captacion', label: 'costo_atribuido_captacion', unit: 'pen', aggregation: 'sum', polarity: 'down' },
    ],
  },
  {
    id: 'lead',
    index: '02',
    label: 'Negociación',
    role: 'Lead',
    description: 'Gestión comercial por sede, negociador y tratamiento.',
    icon: UserPlus,
    defaultMeasure: 'cohorte_evaluable',
    measures: [
      { value: 'cohorte_evaluable', label: 'cohorte_evaluable', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'conversion_payer_14_dia', label: 'conversion_payer_14_dia', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'solicitud_requiere_respuesta', label: 'solicitud_requiere_respuesta', unit: 'cant', aggregation: 'sum', polarity: 'neutral' },
      { value: 'respuesta_util_15_min', label: 'respuesta_util_15_min', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'negociacion_finalizada', label: 'negociacion_finalizada', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'negociacion_abandonada', label: 'negociacion_abandonada', unit: 'cant', aggregation: 'sum', polarity: 'down' },
    ],
  },
  {
    id: 'payer',
    index: '03',
    label: 'Recaudación',
    role: 'Payer',
    description: 'Cobros por modalidad, canal y estado del pago.',
    icon: CreditCard,
    defaultMeasure: 'pago_registrado',
    measures: [
      { value: 'pago_registrado', label: 'pago_registrado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'pago_validado', label: 'pago_validado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'pago_rechazado', label: 'pago_rechazado', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'conversion_customer', label: 'conversion_customer', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'costo_transaccion', label: 'costo_transaccion', unit: 'pen', aggregation: 'sum', polarity: 'down' },
      { value: 'tiempo_validacion_minuto', label: 'tiempo_validacion_minuto', unit: 'min', aggregation: 'avg', polarity: 'down' },
      { value: 'importe_total_cobro', label: 'importe_total_cobro', unit: 'pen', aggregation: 'sum', polarity: 'up' },
    ],
  },
  {
    id: 'customer',
    index: '04',
    label: 'Prestación clínica',
    role: 'Customer',
    description: 'Atenciones por categoría, servicio y sede clínica.',
    icon: Stethoscope,
    defaultMeasure: 'cita_evaluable',
    measures: [
      { value: 'cita_evaluable', label: 'cita_evaluable', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'atencion_realizada', label: 'atencion_realizada', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'cita_inasistencia', label: 'cita_inasistencia', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'tiempo_sillon_dental_minuto', label: 'tiempo_sillon_dental_minuto', unit: 'min', aggregation: 'avg', polarity: 'neutral' },
      { value: 'atencion_finalizada_conforme', label: 'atencion_finalizada_conforme', unit: 'cant', aggregation: 'sum', polarity: 'up' },
    ],
  },
  {
    id: 'turned',
    index: '05',
    label: 'Fidelización',
    role: 'Turned',
    description: 'Seguimiento postventa, incidencias y retorno de pacientes.',
    icon: HeartHandshake,
    defaultMeasure: 'seguimiento_registrado',
    measures: [
      { value: 'seguimiento_registrado', label: 'seguimiento_registrado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'seguimiento_efectivo', label: 'seguimiento_efectivo', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'incidencia_reportada', label: 'incidencia_reportada', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'incidencia_resuelta_24_hora', label: 'incidencia_resuelta_24_hora', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'retorno_cohorte_90_dia', label: 'retorno_cohorte_90_dia', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'paciente_elegible_retorno', label: 'paciente_elegible_retorno', unit: 'cant', aggregation: 'sum', polarity: 'neutral' },
    ],
  },
];

export const KPI_STAGES: StageConfig[] = STAGES.slice(0, 4);

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
  { id: 'all', label: 'Consolidado' },
];
"""

with open(frontend_stages_file, 'w', encoding='utf-8') as f:
    f.write(new_stages_content)

print('Frontend stages.ts updated successfully.')
