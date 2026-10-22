# -*- coding: utf-8 -*-
import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import sys
import os
import shutil

sys.stdout.reconfigure(encoding='utf-8')

target_path = r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud.docx'
doc = docx.Document(target_path)
print(f'Document loaded: {len(doc.paragraphs)} paragraphs, {len(doc.tables)} tables')

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

# -------------------------------------------------------------
# 1. ACTUALIZAR PÁRRAFOS EXPLICATIVOS A SNAKE_CASE Y SINGULAR
# -------------------------------------------------------------
para_updates = {
    121: (
        "Las medidas base de la etapa BUYER en el hecho central fact_captacion_buyer se definen bajo el estándar "
        "SQL en snake_case y singular: contacto_registrado, contacto_utilizable, conversion_lead, "
        "tiempo_conversion_dia y costo_atribuido_captacion. Las tres primeras corresponden a medidas aditivas de "
        "conteo que se agregan mediante suma. La medida contacto_utilizable contabiliza con valor 1 aquellos "
        "registros que cumplen con datos mínimos válidos y consentimiento legal (Ley 29733) y 0 en caso contrario. "
        "En contraste, tiempo_conversion_dia representa el número de días transcurridos entre el registro y su "
        "conversión a LEAD, analizándose mediante promedio y dispersión en lugar de acumulación simple."
    ),
    122: (
        "Por su parte, la medida costo_atribuido_captacion representa la fracción del gasto publicitario asignada "
        "proporcionalmente al contacto de acuerdo con su campaña, fuente o canal de origen, evitando duplicidades "
        "en el análisis financiero."
    ),
    152: (
        "Medida Principal (Intersección): contacto_registrado. Esta medida suma el número bruto de personas que "
        "interactuaron inicialmente a través de cada canal, sin aplicar aún filtros de calidad."
    ),
    207: (
        "En el núcleo del modelo dimensional (fact_negociacion_lead), las medidas base se nombran en minúsculas y "
        "singular (estilo snake_case) sin sufijos entre corchetes (Figura 13):\n"
        "• lead_cohorte_evaluable: Total de prospectos calificados con ventana mínima de maduración cumplida (14 días).\n"
        "• lead_convertido_payer_14_dia: Prospectos que completaron la reserva con abono dentro del SLA objetivo de 14 días.\n"
        "• lead_requiere_respuesta: Solicitudes de presupuesto y consultas comerciales entrantes por canales omnicanal.\n"
        "• lead_respuesta_util_15_min: Prospectos con atención útil en un tiempo máximo de 15 minutos hábiles.\n"
        "• lead_resultado_final: Negociaciones concluidas formalmente (convertida, cerrada o abandonada).\n"
        "• lead_abandonado: Oportunidades comerciales descartadas o inactivas sin respuesta."
    ),
    251: (
        "Medida Principal (Intersección): lead_convertido_payer_14_dia. Esta métrica contabiliza exclusivamente a los "
        "prospectos que concretaron un acuerdo y avanzaron a la etapa de pago dentro del SLA objetivo de dos semanas."
    ),
    294: (
        "En la intersección de estas dimensiones se registran las medidas base aditivas del negocio bajo nomenclatura "
        "estándar snake_case: pago_registrado, pago_validado, pago_rechazado, conversion_customer, importe_total_cobro, "
        "costo_transaccion y tiempo_validacion_minuto. Las cuatro primeras corresponden a medidas estrictamente "
        "aditivas de conteo. La medida pago_validado contabiliza con valor 1 cada transacción cuya conciliación contable "
        "ha sido confirmada exitosamente y 0 en caso contrario, permitiendo obtener el total acumulado mediante suma."
    ),
    295: (
        "Por su parte, las medidas financieras importe_total_cobro y costo_transaccion representan montos monetarios "
        "acumulables que reflejan la recaudación bruta ingresada y las comisiones de pasarelas, respectivamente. "
        "Finalmente, tiempo_validacion_minuto registra los minutos transcurridos entre el comprobante y su validación "
        "por tesorería, empleándose como dividendo base para calcular el tiempo promedio de validación."
    ),
    330: (
        "Medida Principal (Intersección): importe_total_cobro. Esta medida suma el valor monetario de todas las "
        "transacciones registradas, permitiendo al área de tesorería evaluar los fondos aprobados, pendientes o fallidos."
    ),
    380: "cita_evaluable: Volumen total de citas programadas cuya fecha/hora ya ocurrió (universo base para C1 y C2).",
    381: "atencion_realizada: Citas donde el paciente se presentó en la clínica y se inició la consulta en sillón dental (asistencia = 'Asistió') (numerador base del KPI C1).",
    382: "cita_inasistencia: Citas formalizadas donde el usuario no acudió al establecimiento, es decir, No-show (asistencia = 'No asistió') (numerador base del KPI C2).",
    383: "tiempo_sillon_dental_minuto: Duración real de la prestación en minutos efectivos calculados entre fecha_inicio y fecha_fin (insumo para el promedio del KPI C3).",
    384: "atencion_finalizada_conforme: Atenciones culminadas que cumplen con la totalidad de campos clínicos obligatorios (procedimiento_realizado e indicaciones_finales no nulos) (numerador base del KPI C4).",
    412: (
        "Medida Principal (Intersección): atencion_realizada. Esta métrica filtra y suma únicamente aquellas citas "
        "donde el paciente asistió físicamente y se prestó el acto asistencial, descartando ausentismos."
    ),
    451: (
        "• Medidas Atómicas y de Cohorte: La tabla proyecta las siguientes métricas aditivas y semiaditivas en formato "
        "snake_case: (1) seguimiento_registrado (conteo base de contactos efectuados); (2) seguimiento_efectivo (contactos "
        "donde el paciente respondió y validó su condición); (3) incidencia_reportada (eventos donde se manifestó dolor, molestia "
        "o queja); (4) incidencia_resuelta_24_hora (problemas resueltos dentro del estándar de 24 horas); (5) retorno_cohorte_90_dia "
        "(pacientes con nueva cita o tratamiento dentro de 90 días); y (6) paciente_elegible_retorno (pacientes atendidos hace al menos 90 días)."
    ),
    468: "• Medida Principal (Intersección Matricial): Tasa de Retorno [%] y seguimiento_efectivo."
}

for p_idx, new_text in para_updates.items():
    if p_idx < len(doc.paragraphs):
        doc.paragraphs[p_idx].text = new_text

print('Párrafos del informe actualizados a estándar snake_case y singular.')

# -------------------------------------------------------------
# 2. ACTUALIZAR TABLA 4 (BUYER)
# -------------------------------------------------------------
t4 = doc.tables[4]
t4_data = [
    ["Elemento", "B1. Conversión BUYER → LEAD en 14 días", "B2. Contactos utilizables", "B3. Costo por LEAD atribuible"],
    ["Descripción", "Mide qué proporción de los contactos utilizables se convierte formalmente en LEAD dentro de los primeros 14 días desde su registro.", "Mide qué proporción de los contactos captados cumple las condiciones de calidad y consentimiento legal (Ley 29733) para ser utilizables.", "Mide el costo promedio de captación publicitaria necesario para generar un nuevo LEAD atribuible a campañas."],
    ["Medidas base (fact_captacion_buyer)", "conversion_lead\ncontacto_utilizable\ntiempo_conversion_dia", "contacto_utilizable\ncontacto_registrado", "costo_atribuido_captacion\nconversion_lead"],
    ["Fórmula KPI", "(conversion_lead con tiempo_conversion_dia ≤ 14 / contacto_utilizable) × 100", "(contacto_utilizable / contacto_registrado) × 100", "costo_atribuido_captacion / conversion_lead"],
    ["Tablas BD (OLTP & Mart)", "Personas, EventosEtapa\nNexoSalud_Mart.dbo.fact_captacion_buyer", "Personas\nNexoSalud_Mart.dbo.fact_captacion_buyer", "GastosCampana, Campanas\nNexoSalud_Mart.dbo.fact_captacion_buyer"],
    ["Dimensiones de análisis", "dim_tiempo, dim_sede, dim_servicio, dim_canal, dim_tipo_persona, dim_fuente", "dim_tiempo, dim_canal, dim_tipo_persona, dim_fuente, dim_estado_registro", "dim_tiempo, dim_sede, dim_servicio, dim_canal, dim_fuente"],
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
print('Tabla 4 (BUYER) homologada en snake_case.')

# -------------------------------------------------------------
# 3. ACTUALIZAR TABLA 6 (LEAD)
# -------------------------------------------------------------
t6 = doc.tables[6]
t6_data = [
    ["Elemento", "L1. Conversión LEAD → PAYER en ≤ 14 días", "L2. Primera respuesta útil en ≤ 15 minutos hábiles", "L3. Tasa de abandono de negociaciones"],
    ["Descripción", "Mide la proporción de LEADs evaluables que validan una reserva con abono dentro de los primeros 14 días de negociación.", "Mide la proporción de prospectos que reciben su primera respuesta comercial calificada dentro del SLA de 15 minutos hábiles.", "Mide la proporción de negociaciones LEAD finalizadas cuyo resultado es Abandonado o desestimado."],
    ["Medidas base (fact_negociacion_lead)", "lead_convertido_payer_14_dia\nlead_cohorte_evaluable", "lead_respuesta_util_15_min\nlead_requiere_respuesta", "lead_abandonado\nlead_resultado_final"],
    ["Fórmula KPI", "(lead_convertido_payer_14_dia / lead_cohorte_evaluable) × 100", "(lead_respuesta_util_15_min / lead_requiere_respuesta) × 100", "(lead_abandonado / lead_resultado_final) × 100"],
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
print('Tabla 6 (LEAD) homologada en snake_case.')

# -------------------------------------------------------------
# 4. ACTUALIZAR TABLA 8 (PAYER)
# -------------------------------------------------------------
t8 = doc.tables[8]
t8_data = [
    ["Elemento", "P1. Pagos Validados", "P2. Tiempo Promedio de Validación", "P3. Pagos Rechazados", "P4. Conversión PAYER → CUSTOMER"],
    ["Descripción", "Mide la eficacia de la tesorería en conciliar y aprobar exitosamente los pagos recibidos.", "Mide la agilidad del proceso de verificación bancaria entre el pago del usuario y su aprobación.", "Mide la proporción de pagos o comprobantes inválidos, erróneos o fallidos sobre el total recibido.", "Mide la proporción de abonos registrados que logran sentar efectivamente al paciente en sillón dental."],
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
print('Tabla 8 (PAYER) homologada en snake_case.')

# -------------------------------------------------------------
# 5. ACTUALIZAR TABLA 11 (CUSTOMER)
# -------------------------------------------------------------
t11 = doc.tables[11]
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
print('Tabla 11 (CUSTOMER) homologada en snake_case.')

# -------------------------------------------------------------
# 6. ACTUALIZAR TABLA 14 (TURNED)
# -------------------------------------------------------------
t14 = doc.tables[14]
t14_data = [
    ["Código", "Nombre del Indicador", "Fórmula Matemática / Algoritmo", "Unidad", "Semáforo y Umbrales", "Sentido", "Fuente de Datos"],
    ["T1", "Cobertura de Contacto Post-Atención 48h", "(seguimiento_efectivo / seguimiento_registrado) × 100", "%", "Verde: >= 90%\nÁmbar: 75% - 89.9%\nRojo: < 75%", "Maximizar", "NexoSalud_Mart.dbo.v_fact_seguimiento_turned (seguimiento_efectivo / seguimiento_registrado)"],
    ["T2", "Resolución Oportuna de Incidencias Clínicas (≤ 24h)", "(incidencia_resuelta_24_hora / incidencia_reportada) × 100", "%", "Verde: >= 85%\nÁmbar: 70% - 84.9%\nRojo: < 70%", "Maximizar", "NexoSalud_Mart.dbo.v_fact_seguimiento_turned (incidencia_resuelta_24_hora / incidencia_reportada)"],
    ["T3", "Tasa de Retorno y Recompra Odontológica (90d)", "(retorno_cohorte_90_dia / paciente_elegible_retorno) × 100", "%", "Verde: >= 35%\nÁmbar: 20% - 34.9%\nRojo: < 20%", "Maximizar", "NexoSalud_Mart.dbo.v_fact_seguimiento_turned (retorno_cohorte_90_dia / paciente_elegible_retorno)"],
    ["T4", "Efectividad de Activación Preventiva", "(paciente_elegible_retorno / seguimiento_efectivo) × 100", "%", "Verde: >= 60%\nÁmbar: 40% - 59.9%\nRojo: < 40%", "Maximizar", "NexoSalud_Mart.dbo.v_fact_seguimiento_turned (paciente_elegible_retorno / seguimiento_efectivo)"]
]
for r_idx, row in enumerate(t14_data):
    for c_idx, val in enumerate(row):
        t14.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t14.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t14)
print('Tabla 14 (TURNED) homologada en snake_case.')

# -------------------------------------------------------------
# 7. ACTUALIZAR TABLA 17 (24 KPIs)
# -------------------------------------------------------------
t17 = doc.tables[17]
kpi_formulas = {
    1: "(conversion_lead con tiempo_conversion_dia ≤ 14d / contacto_utilizable) × 100",
    2: "(contacto_utilizable / contacto_registrado) × 100",
    3: "costo_atribuido_captacion / conversion_lead",
    4: "(lead_convertido_payer_14_dia / lead_cohorte_evaluable) × 100",
    5: "(lead_respuesta_util_15_min / lead_requiere_respuesta) × 100",
    6: "(opcion_seleccionada / total_opcion_ofrecida) × 100",
    7: "(lead_abandonado / lead_resultado_final) × 100",
    8: "(pago_validado / pago_registrado) × 100",
    9: "tiempo_validacion_minuto / pago_validado",
    10: "(pago_rechazado / pago_registrado) × 100",
    11: "(importe_total_cobro / meta_mensual) × 100",
    12: "(atencion_realizada / cita_evaluable) × 100",
    13: "(cita_inasistencia / cita_evaluable) × 100",
    14: "(atencion_puntual / atencion_realizada) × 100",
    15: "(atencion_finalizada_conforme / atencion_realizada) × 100",
    16: "(seguimiento_efectivo / seguimiento_registrado) × 100",
    17: "(control_preventivo_realizado / paciente_indicacion_clinica) × 100",
    18: "(incidencia_resuelta_24_hora / incidencia_reportada) × 100",
    19: "(retorno_cohorte_90_dia / paciente_elegible_retorno) × 100",
    20: "SUM(importe_total_cobro con estado validado)",
    21: "SUM(atencion_finalizada_conforme × tarifa_servicio)",
    22: "importe_total_cobro / atencion_realizada",
    23: "((nuevo_cliente_mes_t - nuevo_cliente_mes_t_1) / nuevo_cliente_mes_t_1) × 100"
}

for row_idx, form in kpi_formulas.items():
    if row_idx < len(t17.rows):
        t17.cell(row_idx, 3).text = form

style_table(t17)
print('Tabla 17 (24 KPIs) homologada en snake_case.')

# Save to HOMOLOGADO first
homo_path = r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud_HOMOLOGADO.docx'
doc.save(homo_path)
print(f'Documento homologado guardado exitosamente en: {homo_path}')

# Try saving to target_path if not locked
try:
    doc.save(target_path)
    print(f'Documento principal actualizado en: {target_path}')
except PermissionError:
    print(f'AVISO: {target_path} se encuentra actualmente abierto en Word.')
    print(f'Todas las modificaciones se guardaron en {homo_path}.')

