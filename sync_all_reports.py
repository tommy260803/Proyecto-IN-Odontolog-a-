# -*- coding: utf-8 -*-
import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import sys
import os
import shutil

sys.stdout.reconfigure(encoding='utf-8')

def style_table(table):
    for r_idx, row in enumerate(table.rows):
        trPr = row._tr.get_or_add_trPr()
        trPr.append(OxmlElement('w:cantSplit'))
        for c_idx, cell in enumerate(row.cells):
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = OxmlElement('w:tcBorders')
            for b_name in ['top', 'left', 'bottom', 'right']:
                b = OxmlElement(f'w:{b_name}')
                b.set(qn('w:val'), 'single')
                b.set(qn('w:sz'), '4')
                b.set(qn('w:space'), '0')
                b.set(qn('w:color'), 'D3D3D3')
                tcBorders.append(b)
            tcPr.append(tcBorders)
            if r_idx == 0:
                shd = OxmlElement('w:shd')
                shd.set(qn('w:val'), 'clear')
                shd.set(qn('w:color'), 'auto')
                shd.set(qn('w:fill'), 'F2F4F7')
                tcPr.append(shd)

# ==============================================================================
# 1. ACTUALIZAR ARCHIVO INFORME NEXOSALUD.DOCX
# ==============================================================================
doc_main_path = r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud.docx'
doc_main = docx.Document(doc_main_path)
print(f'Archivo Informe cargado: {len(doc_main.paragraphs)} párrafos, {len(doc_main.tables)} tablas')

# Párrafos explicativos a actualizar
para_replacements = {
    'Las tres primeras medidas de la Figura 4': (
        "Las medidas base de la etapa BUYER en el hecho central fact_captacion_buyer se definen bajo el estándar "
        "SQL en snake_case y singular: contacto_registrado, contacto_utilizable, conversion_lead, "
        "tiempo_conversion_dia y costo_atribuido_captacion (Figura 4). Las tres primeras corresponden a medidas aditivas de "
        "conteo que se agregan mediante suma. La medida contacto_utilizable contabiliza con valor 1 aquellos "
        "registros que cumplen con datos mínimos válidos y consentimiento legal (Ley 29733) y 0 en caso contrario. "
        "En contraste, tiempo_conversion_dia representa el número de días transcurridos entre el registro y su "
        "conversión a LEAD, analizándose mediante promedio y dispersión en lugar de acumulación simple."
    ),
    'Costo atribuido de captación [S/.] representa': (
        "Por su parte, la medida costo_atribuido_captacion representa la fracción del gasto publicitario asignada "
        "proporcionalmente al contacto de acuerdo con su campaña, fuente o canal de origen, evitando duplicidades "
        "en el análisis financiero."
    ),
    'Medida Principal (Intersección): Contactos Registrados': (
        "Medida Principal (Intersección): contacto_registrado. Esta medida suma el número bruto de personas que "
        "interactuaron inicialmente a través de cada canal, sin aplicar aún filtros de calidad."
    ),
    'En el núcleo del modelo dimensional (Fact_NegociacionLead)': (
        "En el núcleo del modelo dimensional (fact_negociacion_lead), las medidas base se nombran limpiamente en minúsculas "
        "y singular (estilo snake_case) sin redundancias ni sufijos entre corchetes (Figura 13):\n"
        "• cohorte_evaluable: Total de prospectos calificados con ventana mínima de maduración cumplida (14 días).\n"
        "• conversion_payer_14_dia: Prospectos que completaron la aceptación de la propuesta y confirmaron su abono inicial dentro del SLA objetivo de 14 días.\n"
        "• solicitud_requiere_respuesta: Solicitudes de presupuesto y consultas comerciales entrantes por canales omnicanal.\n"
        "• respuesta_util_15_min: Prospectos que recibieron atención calificada en un tiempo máximo de 15 minutos hábiles.\n"
        "• negociacion_finalizada: Negociaciones concluidas formalmente (convertida, cerrada o abandonada).\n"
        "• negociacion_abandonada: Oportunidades comerciales descartadas o dadas de baja por desistimiento o falta de respuesta."
    ),
    'Medida Principal (Intersección): LEADs Convertidos a PAYER': (
        "Medida Principal (Intersección): conversion_payer_14_dia. Esta métrica contabiliza exclusivamente a los "
        "prospectos que concretaron un acuerdo y avanzaron a la etapa de pago dentro del SLA objetivo de dos semanas."
    ),
    'En la intersección de estas dimensiones se registran las medidas base aditivas': (
        "En la intersección de estas dimensiones se registran las medidas base aditivas del negocio bajo nomenclatura "
        "estándar snake_case: pago_registrado, pago_validado, pago_rechazado, conversion_customer, costo_transaccion "
        "y tiempo_validacion_minuto (Figura 22). Las cuatro primeras corresponden a medidas estrictamente aditivas "
        "de conteo. La medida pago_validado contabiliza con valor 1 cada transacción cuya conciliación contable ha sido "
        "confirmada exitosamente y 0 en caso contrario, permitiendo obtener el total acumulado mediante suma."
    ),
    'Por su parte, las medidas financieras Importe total de cobro': (
        "Por su parte, la medida costo_transaccion representa las comisiones retenidas por pasarelas bancarias y digitales. "
        "Finalmente, tiempo_validacion_minuto registra los minutos transcurridos entre el comprobante y su validación "
        "por tesorería, empleándose como dividendo base para calcular el tiempo promedio de validación."
    ),
    'Medida Principal (Intersección): Importe Total de Cobro': (
        "Medida Principal (Intersección): pago_registrado y pago_validado. Esta métrica cuantifica el flujo transaccional "
        "registrado y aprobado, permitiendo al área de tesorería evaluar los cobros conciliados, pendientes o fallidos."
    ),
    'Citas evaluables [Cant.]:': "cita_evaluable: Volumen total de citas programadas cuya fecha/hora ya ocurrió (universo base para C1 y C2).",
    'Atenciones realizadas [Cant.]:': "atencion_realizada: Citas donde el paciente se presentó en la clínica y se inició la consulta en sillón dental (asistencia = 'Asistió') (numerador base del KPI C1).",
    'Citas con inasistencia [Cant.]:': "cita_inasistencia: Citas formalizadas donde el usuario no acudió al establecimiento, es decir, No-show (asistencia = 'No asistió') (numerador base del KPI C2).",
    'Tiempo en sillón dental [Min.]:': "tiempo_sillon_dental_minuto: Duración real de la prestación en minutos efectivos calculados entre fecha_inicio y fecha_fin (insumo para el promedio del KPI C3).",
    'Atenciones finalizadas conformes [Cant.]:': "atencion_finalizada_conforme: Atenciones culminadas que cumplen con la totalidad de campos clínicos obligatorios (procedimiento_realizado e indicaciones_finales no nulos) (numerador base del KPI C4).",
    'Medida Principal (Intersección): Atenciones Realizadas': (
        "Medida Principal (Intersección): atencion_realizada. Esta métrica filtra y suma únicamente aquellas citas "
        "donde el paciente asistió físicamente y se prestó el acto asistencial, descartando ausentismos."
    ),
    'Medidas Atómicas y de Cohorte: La tabla proyecta las siguientes métricas': (
        "• Medidas Atómicas y de Cohorte: La tabla proyecta las siguientes métricas aditivas y semiaditivas en formato "
        "snake_case (Figura TURNED): (1) seguimiento_registrado (conteo base de contactos efectuados); (2) seguimiento_efectivo "
        "(contactos donde el paciente respondió y validó su condición); (3) incidencia_reportada (eventos donde se manifestó dolor, molestia "
        "o queja); (4) incidencia_resuelta_24_hora (problemas resueltos dentro del estándar de 24 horas); (5) retorno_cohorte_90_dia "
        "(pacientes con nueva cita o tratamiento dentro de 90 días); y (6) paciente_elegible_retorno (pacientes atendidos hace al menos 90 días respecto al corte analítico)."
    ),
    'Medida Principal (Intersección Matricial): Tasa de Retorno': (
        "• Medida Principal (Intersección Matricial): Tasa de Retorno [%] y seguimiento_efectivo."
    )
}

for marker, replacement in para_replacements.items():
    for p in doc_main.paragraphs:
        if marker.lower() in p.text.lower():
            p.text = replacement
            break

print('Párrafos narrativos de Archivo Informe actualizados a snake_case literal.')

# -------------------------------------------------------------
# ACTUALIZAR TABLA 4 (BUYER)
# -------------------------------------------------------------
t4 = doc_main.tables[4]
t4_data = [
    ["Elemento", "B1. Conversión BUYER → LEAD en 14 días", "B2. Contactos utilizables", "B3. Costo por LEAD atribuible"],
    ["Descripción", "Mide qué proporción de los contactos utilizables se convierte formalmente en LEAD dentro de los primeros 14 días desde su registro.", "Mide qué proporción de los contactos captados cumple las condiciones de calidad y consentimiento legal (Ley 29733) para ser utilizables.", "Mide el costo promedio de captación publicitaria necesario para generar un nuevo LEAD atribuible a campañas."],
    ["Medidas base (fact_captacion_buyer)", "conversion_lead\ncontacto_utilizable\ntiempo_conversion_dia", "contacto_utilizable\ncontacto_registrado", "costo_atribuido_captacion\nconversion_lead"],
    ["Fórmula KPI", "(conversion_lead con tiempo_conversion_dia ≤ 14 / contacto_utilizable) × 100", "(contacto_utilizable / contacto_registrado) × 100", "costo_atribuido_captacion / conversion_lead"],
    ["Tablas BD (OLTP & Mart)", "Personas, EventosEtapa\nNexoSalud_Mart.dbo.fact_captacion_buyer", "Personas\nNexoSalud_Mart.dbo.fact_captacion_buyer", "GastosCampana, Campanas\nNexoSalud_Mart.dbo.fact_captacion_buyer"],
    ["Dimensiones de análisis", "dim_tiempo, dim_sede, dim_servicio, dim_canal, dim_tipo_persona, dim_fuente, dim_estado_registro", "dim_tiempo, dim_canal, dim_tipo_persona, dim_fuente, dim_estado_registro", "dim_tiempo, dim_sede, dim_servicio, dim_canal, dim_fuente"],
    ["Periodicidad", "Cálculo diario (ventana 14d);\nrevisión semanal y consolidación mensual", "Cálculo diario;\nrevisión semanal y consolidación mensual", "Revisión semanal y consolidación mensual"],
    ["Semáforo", "Verde ≥ 20 %;\námbar ≥ 10 % y < 20 %;\nrojo < 10 %", "Verde ≥ 80 %;\námbar ≥ 60 % y < 80 %;\nrojo < 60 %", "Verde ≤ S/ 50;\námbar > S/ 50 y ≤ S/ 100;\nrojo > S/ 100"]
]
for r_idx, row in enumerate(t4_data):
    for c_idx, val in enumerate(row):
        t4.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t4.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t4)
print('Tabla 4 (BUYER) sincronizada.')

# -------------------------------------------------------------
# ACTUALIZAR TABLA 6 (LEAD)
# -------------------------------------------------------------
t6 = doc_main.tables[6]
t6_data = [
    ["Elemento", "L1. Conversión LEAD → PAYER en ≤ 14 días", "L2. Primera respuesta útil en ≤ 15 minutos hábiles", "L3. Tasa de abandono de negociaciones"],
    ["Descripción", "Mide la proporción de negociaciones evaluables que validan una reserva con abono dentro de los primeros 14 días.", "Mide la proporción de prospectos que reciben su primera respuesta comercial calificada dentro del SLA de 15 minutos hábiles.", "Mide la proporción de negociaciones formalmente finalizadas cuyo resultado es abandonado o desestimado."],
    ["Medidas base (fact_negociacion_lead)", "conversion_payer_14_dia\ncohorte_evaluable", "respuesta_util_15_min\nsolicitud_requiere_respuesta", "negociacion_abandonada\nnegociacion_finalizada"],
    ["Fórmula KPI", "(conversion_payer_14_dia / cohorte_evaluable) × 100", "(respuesta_util_15_min / solicitud_requiere_respuesta) × 100", "(negociacion_abandonada / negociacion_finalizada) × 100"],
    ["Tablas BD (OLTP & Mart)", "Solicitudes, Pagos, EventosEtapa\nNexoSalud_Mart.dbo.fact_negociacion_lead", "Solicitudes, Interacciones\nNexoSalud_Mart.dbo.fact_negociacion_lead", "Solicitudes, EventosEtapa\nNexoSalud_Mart.dbo.fact_negociacion_lead"],
    ["Dimensiones de análisis", "dim_tiempo, dim_sede, dim_servicio, dim_negociador, dim_profesional", "dim_tiempo, dim_sede, dim_servicio, dim_negociador", "dim_tiempo, dim_sede, dim_servicio, dim_negociador"],
    ["Periodicidad", "Cálculo diario sobre cohortes maduras;\nrevisión semanal y mensual", "Cálculo continuo en tiempo real;\nrevisión diaria y semanal", "Cálculo diario;\nrevisión semanal y mensual"],
    ["Semáforo", "Verde ≥ 30 %;\námbar ≥ 15 % y < 30 %;\nrojo < 15 %", "Verde ≥ 80 %;\námbar ≥ 50 % y < 80 %;\nrojo < 50 %", "Verde ≤ 15 %;\námbar > 15 % y ≤ 30 %;\nrojo > 30 %"]
]
for r_idx, row in enumerate(t6_data):
    for c_idx, val in enumerate(row):
        t6.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t6.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t6)
print('Tabla 6 (LEAD) sincronizada con cohorte_evaluable, conversion_payer_14_dia, etc.')

# -------------------------------------------------------------
# ACTUALIZAR TABLA 8 (PAYER)
# -------------------------------------------------------------
t8 = doc_main.tables[8]
t8_data = [
    ["Elemento", "P1. Pagos Validados", "P2. Tiempo Promedio de Validación", "P3. Pagos Rechazados", "P4. Conversión PAYER → CUSTOMER"],
    ["Descripción", "Mide la eficacia de la tesorería en conciliar y aprobar exitosamente los pagos recibidos.", "Mide la agilidad del proceso de verificación bancaria entre el comprobante y su aprobación.", "Mide la proporción de pagos inválidos, erróneos o fallidos sobre el total recibido.", "Mide la proporción de abonos registrados que logran sentar efectivamente al paciente en sillón dental."],
    ["Medidas base (fact_gestion_payer)", "pago_validado\npago_registrado", "tiempo_validacion_minuto\npago_validado", "pago_rechazado\npago_registrado", "conversion_customer\npago_registrado"],
    ["Fórmula KPI", "(pago_validado / pago_registrado) × 100", "tiempo_validacion_minuto / pago_validado", "(pago_rechazado / pago_registrado) × 100", "(conversion_customer / pago_registrado) × 100"],
    ["Tablas BD (OLTP & Mart)", "Pagos\nNexoSalud_Mart.dbo.fact_gestion_payer", "Pagos\nNexoSalud_Mart.dbo.fact_gestion_payer", "Pagos\nNexoSalud_Mart.dbo.fact_gestion_payer", "Pagos, Reservas, EventosEtapa\nNexoSalud_Mart.dbo.fact_gestion_payer"],
    ["Dimensiones de análisis", "dim_fecha, dim_hora, dim_sede, dim_pasarela, dim_cobro", "dim_fecha, dim_hora, dim_sede, dim_pasarela, dim_pagador", "dim_fecha, dim_hora, dim_sede, dim_pasarela, dim_cobro", "dim_fecha, dim_hora, dim_sede, dim_servicio, dim_cobro"],
    ["Periodicidad", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo continuo;\nrevisión diaria y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario sobre cohortes;\nrevisión semanal y mensual"],
    ["Semáforo", "Verde ≥ 80 %;\námbar ≥ 60 % y < 80 %;\nrojo < 60 %", "Verde ≤ 60 min;\námbar > 60 y ≤ 120 min;\nrojo > 120 min", "Verde ≤ 5 %;\námbar > 5 % y ≤ 10 %;\nrojo > 10 %", "Verde ≥ 90 %;\námbar ≥ 75 % y < 90 %;\nrojo < 75 %"]
]
for r_idx, row in enumerate(t8_data):
    for c_idx, val in enumerate(row):
        t8.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t8.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t8)
print('Tabla 8 (PAYER) sincronizada.')

# -------------------------------------------------------------
# ACTUALIZAR TABLA 11 (CUSTOMER)
# -------------------------------------------------------------
t11 = doc_main.tables[11]
t11_data = [
    ["Elemento", "C1. Asistencia Efectiva en Sillón", "C2. Tasa de No-Show (Ausentismo)", "C3. Tiempo Promedio en Sillón Dental", "C4. Conformidad Asistencial"],
    ["Descripción", "Mide la proporción de citas agendadas que se convierten en atenciones médicas efectivas en consultorio.", "Mide la proporción de pacientes que no asisten a su consulta odontológica programada.", "Mide la duración promedio que el paciente permanece en el sillón dental durante el procedimiento.", "Mide la proporción de atenciones clínicas culminadas que cuentan con historia clínica y ficha completa."],
    ["Medidas base (fact_atencion_customer)", "atencion_realizada\ncita_evaluable", "cita_inasistencia\ncita_evaluable", "tiempo_sillon_dental_minuto\natencion_realizada", "atencion_finalizada_conforme\natencion_realizada"],
    ["Fórmula KPI", "(atencion_realizada / cita_evaluable) × 100", "(cita_inasistencia / cita_evaluable) × 100", "tiempo_sillon_dental_minuto / atencion_realizada", "(atencion_finalizada_conforme / atencion_realizada) × 100"],
    ["Tablas BD (OLTP & Mart)", "Atenciones\nNexoSalud_Mart.dbo.fact_atencion_customer", "Atenciones\nNexoSalud_Mart.dbo.fact_atencion_customer", "Atenciones\nNexoSalud_Mart.dbo.fact_atencion_customer", "Atenciones\nNexoSalud_Mart.dbo.fact_atencion_customer"],
    ["Dimensiones de análisis", "dim_tiempo, dim_sede, dim_servicio, dim_profesional, dim_estado_atencion", "dim_tiempo, dim_sede, dim_servicio, dim_profesional, dim_estado_atencion", "dim_tiempo, dim_sede, dim_servicio, dim_profesional", "dim_tiempo, dim_sede, dim_servicio, dim_profesional"],
    ["Periodicidad", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nauditoría clínica mensual"],
    ["Semáforo", "Verde ≥ 80 %;\námbar ≥ 65 % y < 80 %;\nrojo < 65 %", "Verde ≤ 10 %;\námbar > 10 % y ≤ 20 %;\nrojo > 20 %", "Verde: ± 10 min de duración objetivo;\námbar: ± 15 min;\nrojo: > 20 min", "Verde ≥ 95 %;\námbar ≥ 85 % y < 95 %;\nrojo < 85 %"]
]
for r_idx, row in enumerate(t11_data):
    for c_idx, val in enumerate(row):
        t11.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t11.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t11)
print('Tabla 11 (CUSTOMER) sincronizada.')

# -------------------------------------------------------------
# ACTUALIZAR TABLA 14 (TURNED)
# -------------------------------------------------------------
t14 = doc_main.tables[14]
t14_data = [
    ["Código", "Nombre del Indicador", "Fórmula Matemática / Algoritmo", "Unidad", "Semáforo y Umbrales", "Sentido", "Fuente de Datos"],
    ["T1", "Cobertura de Contacto Post-Atención 48h", "(seguimiento_efectivo / seguimiento_registrado) × 100", "%", "Verde: >= 90%\nÁmbar: 75% - 89.9%\nRojo: < 75%", "Maximizar", "NexoSalud_Mart.dbo.fact_seguimiento_turned (seguimiento_efectivo / seguimiento_registrado)"],
    ["T2", "Resolución Oportuna de Incidencias Clínicas (≤ 24h)", "(incidencia_resuelta_24_hora / incidencia_reportada) × 100", "%", "Verde: >= 85%\nÁmbar: 70% - 84.9%\nRojo: < 70%", "Maximizar", "NexoSalud_Mart.dbo.fact_seguimiento_turned (incidencia_resuelta_24_hora / incidencia_reportada)"],
    ["T3", "Tasa de Retorno y Recompra Odontológica (90d)", "(retorno_cohorte_90_dia / paciente_elegible_retorno) × 100", "%", "Verde: >= 35%\nÁmbar: 20% - 34.9%\nRojo: < 20%", "Maximizar", "NexoSalud_Mart.dbo.fact_seguimiento_turned (retorno_cohorte_90_dia / paciente_elegible_retorno)"],
    ["T4", "Efectividad de Activación Preventiva", "(paciente_elegible_retorno / seguimiento_efectivo) × 100", "%", "Verde: >= 60%\nÁmbar: 40% - 59.9%\nRojo: < 40%", "Maximizar", "NexoSalud_Mart.dbo.fact_seguimiento_turned (paciente_elegible_retorno / seguimiento_efectivo)"]
]
for r_idx, row in enumerate(t14_data):
    for c_idx, val in enumerate(row):
        t14.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t14.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t14)
print('Tabla 14 (TURNED) sincronizada.')

# -------------------------------------------------------------
# ACTUALIZAR TABLA 16 (CATÁLOGO DIMENSIONAL Y HECHOS)
# -------------------------------------------------------------
t16 = doc_main.tables[16]
fact_rows = {
    8: ("fact_captacion_buyer", "Tabla de Hechos (P0)", "1 persona registrada / cohorte", "dim_tiempo, dim_sede, dim_canal, dim_servicio, dim_fuente, dim_tipo_persona, dim_estado_registro", "Medir volumen de nuevos prospectos, conversión y costo atribuido"),
    9: ("fact_negociacion_lead", "Tabla de Hechos (P0)", "1 negociación comercial", "dim_tiempo, dim_sede, dim_servicio, dim_negociador, dim_profesional", "Evaluar velocidad de primera respuesta útil, conversión a PAYER y tasa de abandono"),
    10: ("fact_gestion_payer", "Tabla de Hechos (P0)", "1 pago individual (id_pago)", "dim_fecha, dim_hora, dim_sede, dim_pasarela, dim_pagador, dim_fuente, dim_cobro, dim_servicio", "Segregar pagos validados, rechazados, conversiones y tiempos de validación"),
    11: ("fact_atencion_customer", "Tabla de Hechos (P0)", "1 reserva / cita atendida", "dim_tiempo, dim_hora, dim_sede, dim_servicio, dim_profesional, dim_estado_atencion", "Controlar productividad de sillón, asistencia efectiva y conformidad clínica"),
    12: ("fact_seguimiento_turned", "Tabla de Hechos (P1)", "1 seguimiento postventa", "dim_tiempo, dim_sede, dim_servicio, dim_profesional, dim_canal", "Medir cobertura de contacto 48h, resolución de incidencias en ≤24h y retornos a 90d")
}
for r_idx, row_vals in fact_rows.items():
    if r_idx < len(t16.rows):
        for c_idx, val in enumerate(row_vals):
            t16.cell(r_idx, c_idx).text = val
            if c_idx == 0:
                for p in t16.cell(r_idx, c_idx).paragraphs:
                    for run in p.runs:
                        run.bold = True
style_table(t16)
print('Tabla 16 (Catálogo Data Mart) sincronizada con fact_*.')

# -------------------------------------------------------------
# ACTUALIZAR TABLA 17 (24 KPIS)
# -------------------------------------------------------------
t17 = doc_main.tables[17]
kpi_formulas = {
    1: "(conversion_lead con tiempo_conversion_dia ≤ 14d / contacto_utilizable) × 100",
    2: "(contacto_utilizable / contacto_registrado) × 100",
    3: "costo_atribuido_captacion / conversion_lead",
    4: "(conversion_payer_14_dia / cohorte_evaluable) × 100",
    5: "(respuesta_util_15_min / solicitud_requiere_respuesta) × 100",
    6: "(opcion_seleccionada / total_opcion_ofrecida) × 100",
    7: "(negociacion_abandonada / negociacion_finalizada) × 100",
    8: "(pago_validado / pago_registrado) × 100",
    9: "tiempo_validacion_minuto / pago_validado",
    10: "(pago_rechazado / pago_registrado) × 100",
    11: "(pago_validado / meta_mensual) × 100",
    12: "(atencion_realizada / cita_evaluable) × 100",
    13: "(cita_inasistencia / cita_evaluable) × 100",
    14: "(atencion_puntual / atencion_realizada) × 100",
    15: "(atencion_finalizada_conforme / atencion_realizada) × 100",
    16: "(seguimiento_efectivo / seguimiento_registrado) × 100",
    17: "(control_preventivo_realizado / paciente_indicacion_clinica) × 100",
    18: "(incidencia_resuelta_24_hora / incidencia_reportada) × 100",
    19: "(retorno_cohorte_90_dia / paciente_elegible_retorno) × 100",
    20: "SUM(pago_validado × importe)",
    21: "SUM(atencion_finalizada_conforme × tarifa_servicio)",
    22: "total_recaudado / atencion_realizada",
    23: "((nuevo_cliente_mes_t - nuevo_cliente_mes_t_1) / nuevo_cliente_mes_t_1) × 100"
}
for row_idx, form in kpi_formulas.items():
    if row_idx < len(t17.rows):
        t17.cell(row_idx, 3).text = form

style_table(t17)
print('Tabla 17 (24 KPIs) sincronizada.')

doc_main.save(doc_main_path)
print(f'Documento principal actualizado exitosamente en: {doc_main_path}')

# Sincronizar copia _HOMOLOGADO
homo_path = r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud_HOMOLOGADO.docx'
shutil.copy2(doc_main_path, homo_path)
print(f'Copia sincronizada en: {homo_path}')

# ==============================================================================
# 2. ACTUALIZAR ARCHIVO ANEXOS INFORME.DOCX (ANEXO C)
# ==============================================================================
doc_anexos_path = r'D:\Proyects\nexosalud-docs\Contexto\Archivo Anexos Informe.docx'
doc_anexos = docx.Document(doc_anexos_path)
print(f'\nArchivo Anexos cargado: {len(doc_anexos.paragraphs)} párrafos')

# Buscamos donde empieza "2. CREACIÓN DE TABLAS DE HECHOS"
fact_start_idx = None
for i, p in enumerate(doc_anexos.paragraphs):
    if '2. CREACIÓN DE TABLAS DE HECHOS (FACT TABLES)' in p.text:
        fact_start_idx = i
        break

if fact_start_idx is not None:
    print(f'Bloque de Fact Tables en Anexo C encontrado en P{fact_start_idx}')
    
    # Reemplazamos todos los párrafos desde fact_start_idx hasta el final con el script DDL exacto y actualizado
    # Primero vaciamos los párrafos existentes desde fact_start_idx+1
    ddl_fact_script = """-- ====================================================================
-- 2. CREACIÓN DE TABLAS DE HECHOS (FACT TABLES - ESTÁNDAR SNAKE_CASE)
-- ====================================================================

-- Hecho: CAPTACIÓN BUYER
CREATE TABLE fact_captacion_buyer (
    key_tiempo INT FOREIGN KEY REFERENCES Dim_Tiempo(KeyTiempo),
    key_sede INT FOREIGN KEY REFERENCES Dim_Sede(KeySede),
    key_servicio INT FOREIGN KEY REFERENCES Dim_Servicio(KeyServicio),
    key_canal INT FOREIGN KEY REFERENCES Dim_Canal(KeyCanal),
    key_fuente INT FOREIGN KEY REFERENCES Dim_Fuente(KeyFuente),
    key_tipo_persona INT FOREIGN KEY REFERENCES Dim_TipoPersona(KeyTipoPersona),
    key_estado_registro INT FOREIGN KEY REFERENCES Dim_EstadoRegistro(KeyEstadoRegistro),
    
    -- Medidas Atómicas (Homologadas con Figura 4)
    contacto_registrado INT DEFAULT 0,
    contacto_utilizable INT DEFAULT 0,
    conversion_lead INT DEFAULT 0,
    tiempo_conversion_dia INT DEFAULT 0,
    costo_atribuido_captacion DECIMAL(10,2) DEFAULT 0.00
);
GO

-- Hecho: NEGOCIACIÓN LEAD
CREATE TABLE fact_negociacion_lead (
    key_tiempo INT FOREIGN KEY REFERENCES Dim_Tiempo(KeyTiempo),
    key_sede INT FOREIGN KEY REFERENCES Dim_Sede(KeySede),
    key_servicio INT FOREIGN KEY REFERENCES Dim_Servicio(KeyServicio),
    key_profesional INT FOREIGN KEY REFERENCES Dim_Profesional(KeyProfesional),
    key_negociador INT FOREIGN KEY REFERENCES Dim_Negociador(KeyNegociador),
    
    -- Medidas Atómicas (Homologadas con Figura 13)
    cohorte_evaluable INT DEFAULT 0,
    conversion_payer_14_dia INT DEFAULT 0,
    solicitud_requiere_respuesta INT DEFAULT 0,
    respuesta_util_15_min INT DEFAULT 0,
    negociacion_finalizada INT DEFAULT 0,
    negociacion_abandonada INT DEFAULT 0
);
GO

-- Hecho: GESTIÓN PAYER
CREATE TABLE fact_gestion_payer (
    key_tiempo INT FOREIGN KEY REFERENCES Dim_Tiempo(KeyTiempo),
    key_hora INT FOREIGN KEY REFERENCES Dim_Hora(KeyHora),
    key_sede INT FOREIGN KEY REFERENCES Dim_Sede(KeySede),
    key_servicio INT FOREIGN KEY REFERENCES Dim_Servicio(KeyServicio),
    key_fuente INT FOREIGN KEY REFERENCES Dim_Fuente(KeyFuente),
    key_pasarela INT FOREIGN KEY REFERENCES Dim_Pasarela(KeyPasarela),
    key_pagador INT FOREIGN KEY REFERENCES Dim_Pagador(KeyPagador),
    key_cobro INT FOREIGN KEY REFERENCES Dim_Cobro(KeyCobro),
    
    -- Medidas Atómicas (Homologadas con Figura 22)
    pago_registrado INT DEFAULT 0,
    pago_validado INT DEFAULT 0,
    pago_rechazado INT DEFAULT 0,
    conversion_customer INT DEFAULT 0,
    costo_transaccion DECIMAL(10,2) DEFAULT 0.00,
    tiempo_validacion_minuto INT DEFAULT 0
);
GO

-- Hecho: ATENCIÓN CUSTOMER
CREATE TABLE fact_atencion_customer (
    key_tiempo INT FOREIGN KEY REFERENCES Dim_Tiempo(KeyTiempo),
    key_hora INT FOREIGN KEY REFERENCES Dim_Hora(KeyHora),
    key_sede INT FOREIGN KEY REFERENCES Dim_Sede(KeySede),
    key_servicio INT FOREIGN KEY REFERENCES Dim_Servicio(KeyServicio),
    key_profesional INT FOREIGN KEY REFERENCES Dim_Profesional(KeyProfesional),
    key_estado_atencion INT FOREIGN KEY REFERENCES Dim_EstadoAtencion(KeyEstadoAtencion),
    
    -- Medidas Atómicas (Homologadas con Figura 30)
    cita_evaluable INT DEFAULT 0,
    atencion_realizada INT DEFAULT 0,
    cita_inasistencia INT DEFAULT 0,
    tiempo_sillon_dental_minuto INT DEFAULT 0,
    atencion_finalizada_conforme INT DEFAULT 0
);
GO

-- Hecho: SEGUIMIENTO Y FIDELIZACIÓN TURNED
CREATE TABLE fact_seguimiento_turned (
    key_tiempo INT FOREIGN KEY REFERENCES Dim_Tiempo(KeyTiempo),
    key_sede INT FOREIGN KEY REFERENCES Dim_Sede(KeySede),
    key_servicio INT FOREIGN KEY REFERENCES Dim_Servicio(KeyServicio),
    key_profesional INT FOREIGN KEY REFERENCES Dim_Profesional(KeyProfesional),
    key_canal INT FOREIGN KEY REFERENCES Dim_Canal(KeyCanal),
    
    -- Medidas Atómicas (Homologadas con Figura TURNED)
    seguimiento_registrado INT DEFAULT 0,
    seguimiento_efectivo INT DEFAULT 0,
    incidencia_reportada INT DEFAULT 0,
    incidencia_resuelta_24_hora INT DEFAULT 0,
    retorno_cohorte_90_dia INT DEFAULT 0,
    paciente_elegible_retorno INT DEFAULT 0
);
GO

-- ====================================================================
-- 3. VISTAS DIMENSIONALES ESTÁNDAR PARA REPORTING ANALÍTICO
-- ====================================================================

CREATE OR ALTER VIEW v_fact_captacion_buyer AS
SELECT 
    KeyTiempo AS key_tiempo, KeySede AS key_sede, KeyServicio AS key_servicio,
    KeyCanal AS key_canal, KeyFuente AS key_fuente, KeyTipoPersona AS key_tipo_persona,
    KeyEstadoRegistro AS key_estado_registro,
    ContactosRegistrados AS contacto_registrado,
    ContactosUtilizables AS contacto_utilizable,
    ConversionesALead AS conversion_lead,
    TiempoConversionDias AS tiempo_conversion_dia,
    CostoAtribuidoCaptacion AS costo_atribuido_captacion
FROM Fact_CaptacionBuyer;
GO

CREATE OR ALTER VIEW v_fact_negociacion_lead AS
SELECT 
    KeyTiempo AS key_tiempo, KeySede AS key_sede, KeyServicio AS key_servicio,
    KeyProfesional AS key_profesional, KeyNegociador AS key_negociador,
    LeadsCohorteEvaluable AS cohorte_evaluable,
    LeadsConvertidosPayer14Dias AS conversion_payer_14_dia,
    LeadsRequierenRespuesta AS solicitud_requiere_respuesta,
    LeadsRespuestaUtil15Min AS respuesta_util_15_min,
    LeadsResultadoFinal AS negociacion_finalizada,
    LeadsAbandonados AS negociacion_abandonada
FROM Fact_NegociacionLead;
GO

CREATE OR ALTER VIEW v_fact_gestion_payer AS
SELECT 
    KeyTiempo AS key_tiempo, KeyHora AS key_hora, KeySede AS key_sede,
    KeyServicio AS key_servicio, KeyFuente AS key_fuente, KeyPasarela AS key_pasarela,
    KeyPagador AS key_pagador, KeyCobro AS key_cobro,
    PagosRegistrados AS pago_registrado,
    PagosValidados AS pago_validado,
    PagosRechazados AS pago_rechazado,
    ConversionesACustomer AS conversion_customer,
    CostoTotalTransacciones AS costo_transaccion,
    TiempoTotalValidacionMin AS tiempo_validacion_minuto
FROM Fact_GestionPayer;
GO

CREATE OR ALTER VIEW v_fact_atencion_customer AS
SELECT 
    KeyTiempo AS key_tiempo, KeyHora AS key_hora, KeySede AS key_sede,
    KeyServicio AS key_servicio, KeyProfesional AS key_profesional,
    KeyEstadoAtencion AS key_estado_atencion,
    CitasEvaluables AS cita_evaluable,
    AtencionesRealizadas AS atencion_realizada,
    CitasConInasistencia AS cita_inasistencia,
    TiempoEnSillonDentalMin AS tiempo_sillon_dental_minuto,
    AtencionesFinalizadasConformes AS atencion_finalizada_conforme
FROM Fact_AtencionCustomer;
GO

CREATE OR ALTER VIEW v_fact_seguimiento_turned AS
SELECT 
    KeyTiempo AS key_tiempo, KeySede AS key_sede, KeyServicio AS key_servicio,
    KeyProfesional AS key_profesional, KeyCanal AS key_canal,
    SeguimientosRegistrados AS seguimiento_registrado,
    SeguimientosEfectivos AS seguimiento_efectivo,
    IncidenciasReportadas AS incidencia_reportada,
    IncidenciasResueltas24h AS incidencia_resuelta_24_hora,
    RetornosCohorte90Dias AS retorno_cohorte_90_dia,
    PacientesElegiblesRetorno AS paciente_elegible_retorno
FROM Fact_SeguimientoTurned;
GO
"""
    # Remove existing paragraphs from fact_start_idx
    total_p = len(doc_anexos.paragraphs)
    # We clear text of paragraphs from fact_start_idx to the end
    lines = ddl_fact_script.strip().split('\n')
    
    # Overwrite and append
    p_curr = fact_start_idx
    for line in lines:
        if p_curr < total_p:
            doc_anexos.paragraphs[p_curr].text = line
            p_curr += 1
        else:
            doc_anexos.add_paragraph(line)
            p_curr += 1
            
    # If there are remaining old paragraphs past p_curr, clear them
    while p_curr < total_p:
        doc_anexos.paragraphs[p_curr].text = ""
        p_curr += 1

    doc_anexos.save(doc_anexos_path)
    print(f'Archivo Anexos Informe actualizado con éxito en: {doc_anexos_path}')
