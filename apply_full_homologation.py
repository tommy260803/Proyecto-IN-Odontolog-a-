# -*- coding: utf-8 -*-
import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import sys
import os

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
# 1. ACTUALIZAR TABLA 4 (Tabla 5 en texto: BUYER)
# -------------------------------------------------------------
t4 = doc.tables[4]
t4_data = [
    ["Elemento", "B1. Conversión BUYER → LEAD en 14 días", "B2. Contactos utilizables", "B3. Costo por LEAD atribuible"],
    ["Descripción", "Mide qué proporción de los contactos utilizables se convierte formalmente en LEAD dentro de los primeros 14 días desde su registro.", "Mide qué proporción de los contactos captados cumple las condiciones de calidad y consentimiento legal (Ley 29733) para ser utilizables.", "Mide el costo promedio de captación publicitaria necesario para generar un nuevo LEAD atribuible a campañas."],
    ["Medidas base (Figura 4 / Fact_CaptacionBuyer)", "Conversiones a LEAD [Cant.]\nContactos utilizables [Cant.]\nTiempo de conversión [Días]", "Contactos utilizables [Cant.]\nContactos registrados [Cant.]", "Costo atribuido de captación [S/.]\nConversiones a LEAD [Cant.]"],
    ["Fórmula KPI", "(Conversiones a LEAD [Cant.] con Tiempo de conversión [Días] ≤ 14 / Contactos utilizables [Cant.]) × 100", "(Contactos utilizables [Cant.] / Contactos registrados [Cant.]) × 100", "Costo atribuido de captación [S/.] / Conversiones a LEAD [Cant.]"],
    ["Tablas BD (OLTP & Mart)", "Personas, EventosEtapa\nNexoSalud_Mart.dbo.Fact_CaptacionBuyer", "Personas\nNexoSalud_Mart.dbo.Fact_CaptacionBuyer", "GastosCampana, Campanas\nNexoSalud_Mart.dbo.Fact_CaptacionBuyer"],
    ["Dimensiones de análisis", "Tiempo, Sede, Servicio, Canal, Tipo Persona, Fuente", "Tiempo, Canal, Tipo Persona, Fuente, Estado del registro", "Tiempo, Sede, Servicio, Canal, Fuente"],
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
print('Tabla 4 (BUYER) homologada con medidas literales de Figura 4.')

# -------------------------------------------------------------
# 2. INSERTAR PÁRRAFO DETALLADO DE MEDIDAS DE FIGURA 13 (LEAD)
# -------------------------------------------------------------
p207_idx = None
for i, p in enumerate(doc.paragraphs):
    if 'El modelo de análisis dimensional para la Negociación LEAD' in p.text:
        p207_idx = i
        break

if p207_idx is not None:
    has_lead_measures = any('Cantidad de LEADs de cohorte evaluable' in doc.paragraphs[j].text for j in range(p207_idx, min(p207_idx+5, len(doc.paragraphs))))
    if not has_lead_measures:
        new_p = doc.paragraphs[p207_idx+1].insert_paragraph_before(
            "En el núcleo del modelo dimensional (Fact_NegociacionLead), se cuantifican de forma sistemática las medidas base del proceso de negociación comercial que alimentan los indicadores clave de la etapa (Figura 13):\n"
            "• Cantidad de LEADs de cohorte evaluable: Total de prospectos calificados con ventana mínima de maduración comercial cumplida (14 días).\n"
            "• Cantidad de LEADs convertidos a PAYER en 14 días: Prospectos que completaron la aceptación de la propuesta y confirmaron su abono inicial dentro del SLA objetivo de 14 días.\n"
            "• Cantidad de LEADs que requieren respuesta: Solicitudes de presupuesto y consultas comerciales entrantes por canales omnicanal.\n"
            "• Cantidad de LEADs con primera respuesta útil en 15 min hábiles: Prospectos que recibieron una respuesta efectiva y personalizada en un plazo máximo de 15 minutos en horario laboral.\n"
            "• Cantidad de LEADs con resultado final: Negociaciones concluidas con resolución formal (convertida, cerrada o abandonada).\n"
            "• Cantidad de LEADs abandonados: Oportunidades comerciales descartadas o dadas de baja por desistimiento o falta de respuesta."
        )
        print('Párrafo de medidas literales de Figura 13 insertado correctamente.')

# -------------------------------------------------------------
# 3. ACTUALIZAR TABLA 6 (Tabla 7 en texto: LEAD)
# -------------------------------------------------------------
t6 = doc.tables[6]
t6_data = [
    ["Elemento", "L1. Conversión LEAD → PAYER en ≤ 14 días", "L2. Primera respuesta útil en ≤ 15 minutos hábiles", "L3. Tasa de abandono de negociaciones"],
    ["Descripción", "Mide la proporción de LEADs evaluables que validan una reserva con abono dentro de los primeros 14 días de negociación.", "Mide la proporción de prospectos que reciben su primera respuesta comercial calificada dentro del SLA de 15 minutos hábiles.", "Mide la proporción de negociaciones LEAD finalizadas cuyo resultado es Abandonado o desestimado."],
    ["Medidas base (Figura 13 / Fact_NegociacionLead)", "Cantidad de LEADs convertidos a PAYER en 14 días\nCantidad de LEADs de cohorte evaluable", "Cantidad de LEADs con primera respuesta útil en 15 min hábiles\nCantidad de LEADs que requieren respuesta", "Cantidad de LEADs abandonados\nCantidad de LEADs con resultado final"],
    ["Fórmula KPI", "(Cantidad de LEADs convertidos a PAYER en 14 días / Cantidad de LEADs de cohorte evaluable) × 100", "(Cantidad de LEADs con primera respuesta útil en 15 min hábiles / Cantidad de LEADs que requieren respuesta) × 100", "(Cantidad de LEADs abandonados / Cantidad de LEADs con resultado final) × 100"],
    ["Tablas BD (OLTP & Mart)", "Solicitudes, Pagos, EventosEtapa\nNexoSalud_Mart.dbo.Fact_NegociacionLead", "Solicitudes, Interacciones\nNexoSalud_Mart.dbo.Fact_NegociacionLead", "Solicitudes, EventosEtapa\nNexoSalud_Mart.dbo.Fact_NegociacionLead"],
    ["Dimensiones de análisis", "Tiempo, Sede, Servicio, Negociador, Profesional", "Tiempo, Sede, Servicio, Negociador", "Tiempo, Sede, Servicio, Negociador"],
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
print('Tabla 6 (LEAD) homologada con medidas literales de Figura 13.')

# -------------------------------------------------------------
# 4. ACTUALIZAR TABLA 8 (Tabla 9 en texto: PAYER)
# -------------------------------------------------------------
t8 = doc.tables[8]
t8_data = [
    ["Elemento", "P1. Pagos Validados", "P2. Tiempo Promedio de Validación", "P3. Pagos Rechazados", "P4. Conversión PAYER → CUSTOMER"],
    ["Descripción", "Mide la eficacia de la tesorería en conciliar y aprobar exitosamente los pagos recibidos.", "Mide la agilidad del proceso de verificación bancaria entre el pago del usuario y su aprobación.", "Mide la proporción de pagos o comprobantes inválidos, erróneos o fallidos sobre el total recibido.", "Mide la proporción de abonos registrados que logran sentar efectivamente al paciente en sillón dental."],
    ["Medidas base (Figura 22 / Fact_GestionPayer)", "Pagos validados [Cant.]\nPagos registrados [Cant.]", "Tiempo total de validación [Min.]\nPagos validados [Cant.]", "Pagos rechazados [Cant.]\nPagos registrados [Cant.]", "Conversiones a CUSTOMER [Cant.]\nPagos registrados [Cant.]"],
    ["Fórmula KPI", "(Pagos validados [Cant.] / Pagos registrados [Cant.]) × 100", "Tiempo total de validación [Min.] / Pagos validados [Cant.]", "(Pagos rechazados [Cant.] / Pagos registrados [Cant.]) × 100", "(Conversiones a CUSTOMER [Cant.] / Pagos registrados [Cant.]) × 100"],
    ["Tablas BD (OLTP & Mart)", "Pagos\nNexoSalud_Mart.dbo.Fact_GestionPayer", "Pagos\nNexoSalud_Mart.dbo.Fact_GestionPayer", "Pagos\nNexoSalud_Mart.dbo.Fact_GestionPayer", "Pagos, Reservas, EventosEtapa\nNexoSalud_Mart.dbo.Fact_GestionPayer"],
    ["Dimensiones de análisis", "Fecha, Hora, Sede, Pasarela, Cobro", "Fecha, Hora, Sede, Pasarela, Pagador", "Fecha, Hora, Sede, Pasarela, Cobro", "Fecha, Hora, Sede, Servicio, Cobro"],
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
print('Tabla 8 (PAYER) homologada con medidas literales de Figura 22.')

# -------------------------------------------------------------
# 5. REEMPLAZAR TABLA 11 (Tabla 12 en texto: CUSTOMER)
# -------------------------------------------------------------
t11_old = doc.tables[11]
t11_new = doc.add_table(rows=8, cols=5)

t11_data = [
    ["Elemento", "C1. Asistencia Efectiva en Sillón", "C2. Tasa de No-Show (Ausentismo)", "C3. Tiempo Promedio en Sillón Dental", "C4. Conformidad Asistencial"],
    ["Descripción", "Mide la proporción de citas agendadas que se convierten en atenciones médicas efectivas en consultorio.", "Mide la proporción de pacientes que no asisten a su consulta odontológica programada.", "Mide la duración promedio que el paciente permanece en el sillón dental durante el procedimiento.", "Mide la proporción de atenciones clínicas culminadas que cuentan con historia clínica y ficha completa."],
    ["Medidas base (Figura 30 / Fact_AtencionCustomer)", "Atenciones realizadas [Cant.]\nCitas evaluables [Cant.]", "Citas con inasistencia [Cant.]\nCitas evaluables [Cant.]", "Tiempo en sillón dental [Min.]\nAtenciones realizadas [Cant.]", "Atenciones finalizadas conformes [Cant.]\nAtenciones realizadas [Cant.]"],
    ["Fórmula KPI", "(Atenciones realizadas [Cant.] / Citas evaluables [Cant.]) × 100", "(Citas con inasistencia [Cant.] / Citas evaluables [Cant.]) × 100", "Tiempo en sillón dental [Min.] / Atenciones realizadas [Cant.]", "(Atenciones finalizadas conformes [Cant.] / Atenciones realizadas [Cant.]) × 100"],
    ["Tablas BD (OLTP & Mart)", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer"],
    ["Dimensiones de análisis", "Tiempo, Sede, Servicio, Profesional, Estado de Atención", "Tiempo, Sede, Servicio, Profesional, Estado de Atención", "Tiempo, Sede, Servicio, Profesional", "Tiempo, Sede, Servicio, Profesional"],
    ["Periodicidad", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nauditoría clínica mensual"],
    ["Semáforo", "Verde ≥ 80 %;\námbar ≥ 65 % y < 80 %;\nrojo < 65 %", "Verde ≤ 10 %;\námbar > 10 % y ≤ 20 %;\nrojo > 20 %", "Verde: ± 10 min de duración objetivo;\námbar: ± 15 min;\nrojo: > 20 min", "Verde ≥ 95 %;\námbar ≥ 85 % y < 95 %;\nrojo < 85 %"]
]

for r_idx, row in enumerate(t11_data):
    for c_idx, val in enumerate(row):
        t11_new.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t11_new.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t11_new)

# Swap new table into position of old table 11
t11_old._tbl.addprevious(t11_new._tbl)
t11_old._tbl.getparent().remove(t11_old._tbl)
print('Tabla 11 (CUSTOMER) reconstruida limpiamente como 8x5 APA con medidas literales de Figura 30.')

# -------------------------------------------------------------
# 6. ACTUALIZAR TABLA 14 (Tabla 15 en texto: TURNED)
# -------------------------------------------------------------
t14 = doc.tables[14]
t14_data = [
    ["Código", "Nombre del Indicador", "Fórmula Matemática / Algoritmo", "Unidad", "Semáforo y Umbrales", "Sentido", "Fuente de Datos"],
    ["T1", "Cobertura de Contacto Post-Atención 48h", "(Seguimientos efectivos [Cant.] / Seguimientos registrados [Cant.]) × 100", "%", "Verde: >= 90%\nÁmbar: 75% - 89.9%\nRojo: < 75%", "Maximizar", "NexoSalud_Mart.dbo.Fact_SeguimientoTurned (SeguimientosEfectivos / SeguimientosRegistrados)"],
    ["T2", "Resolución Oportuna de Incidencias Clínicas (≤ 24h)", "(Incidencias resueltas en ≤ 24h [Cant.] / Incidencias reportadas [Cant.]) × 100", "%", "Verde: >= 85%\nÁmbar: 70% - 84.9%\nRojo: < 70%", "Maximizar", "NexoSalud_Mart.dbo.Fact_SeguimientoTurned (IncidenciasResueltas24h / IncidenciasReportadas)"],
    ["T3", "Tasa de Retorno y Recompra Odontológica (90d)", "(Retornos en cohorte de 90 días [Cant.] / Pacientes elegibles de retorno [Cant.]) × 100", "%", "Verde: >= 35%\nÁmbar: 20% - 34.9%\nRojo: < 20%", "Maximizar", "NexoSalud_Mart.dbo.Fact_SeguimientoTurned (RetornosCohorte90Dias / PacientesElegiblesRetorno)"],
    ["T4", "Efectividad de Activación Preventiva", "(Pacientes elegibles de retorno [Cant.] / Seguimientos efectivos [Cant.]) × 100", "%", "Verde: >= 60%\nÁmbar: 40% - 59.9%\nRojo: < 40%", "Maximizar", "NexoSalud_Mart.dbo.Fact_SeguimientoTurned (PacientesElegiblesRetorno / SeguimientosEfectivos)"]
]
for r_idx, row in enumerate(t14_data):
    for c_idx, val in enumerate(row):
        t14.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t14.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t14)
print('Tabla 14 (TURNED) homologada con Fact_SeguimientoTurned.')

# -------------------------------------------------------------
# 7. ACTUALIZAR TABLA 17 (Tabla 18 en texto: 24 KPIs)
# -------------------------------------------------------------
t17 = doc.tables[17]
kpi_formulas = {
    1: "(Conversiones a LEAD [Cant.] con Tiempo de conversión ≤ 14d / Contactos utilizables [Cant.]) × 100",
    2: "(Contactos utilizables [Cant.] / Contactos registrados [Cant.]) × 100",
    3: "Costo atribuido de captación [S/.] / Conversiones a LEAD [Cant.]",
    4: "(Cantidad de LEADs convertidos a PAYER en 14 días / Cantidad de LEADs de cohorte evaluable) × 100",
    5: "(Cantidad de LEADs con primera respuesta útil en 15 min hábiles / Cantidad de LEADs que requieren respuesta) × 100",
    6: "(Opciones de tratamiento seleccionadas / Total opciones ofrecidas) × 100",
    7: "(Cantidad de LEADs abandonados / Cantidad de LEADs con resultado final) × 100",
    8: "(Pagos validados [Cant.] / Pagos registrados [Cant.]) × 100",
    9: "Tiempo total de validación [Min.] / Pagos validados [Cant.]",
    10: "(Pagos rechazados [Cant.] / Pagos registrados [Cant.]) × 100",
    11: "(Importe total de cobro recaudado [S/.] / Meta mensual presupuestada) × 100",
    12: "(Atenciones realizadas [Cant.] / Citas evaluables [Cant.]) × 100",
    13: "(Citas con inasistencia [Cant.] / Citas evaluables [Cant.]) × 100",
    14: "(Atenciones realizadas con inicio puntual ≤ 10 min / Atenciones realizadas [Cant.]) × 100",
    15: "(Atenciones finalizadas conformes [Cant.] / Atenciones realizadas [Cant.]) × 100",
    16: "(Seguimientos efectivos [Cant.] / Seguimientos registrados [Cant.]) × 100",
    17: "(Pacientes con control preventivo semestral realizado / Pacientes con indicación clínica) × 100",
    18: "(Incidencias resueltas en ≤ 24h [Cant.] / Incidencias reportadas [Cant.]) × 100",
    19: "(Retornos en cohorte de 90 días [Cant.] / Pacientes elegibles de retorno [Cant.]) × 100",
    20: "SUM(Importe total de cobro [S/.] con estado validado)",
    21: "SUM(Atenciones finalizadas conformes [Cant.] × Tarifa de Arancel)",
    22: "Importe total de cobro [S/.] / Atenciones realizadas [Cant.]",
    23: "((Nuevos Clientes Mes_t - Mes_{t-1}) / Nuevos Clientes Mes_{t-1}) × 100"
}

for row_idx, form in kpi_formulas.items():
    if row_idx < len(t17.rows):
        t17.cell(row_idx, 3).text = form

style_table(t17)
print('Tabla 17 (24 KPIs) homologada con medidas literales de modelos dimensionales.')

doc.save(target_path)
print(f'Documento final actualizado con éxito en: {target_path}')
