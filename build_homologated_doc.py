# -*- coding: utf-8 -*-
import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import sys
import os
import shutil

sys.stdout.reconfigure(encoding='utf-8')

src_path = r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud_ORIGINAL.docx'
out_path = r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud_HOMOLOGADO.docx'

doc = docx.Document(src_path)
print(f'Base doc loaded: {len(doc.paragraphs)} paragraphs, {len(doc.tables)} tables')

# Helper to style a table nicely
def style_table(table):
    for r_idx, row in enumerate(table.rows):
        trPr = row._tr.get_or_add_trPr()
        trPr.append(OxmlElement('w:cantSplit'))
        for c_idx, cell in enumerate(row.cells):
            tcPr = cell._tc.get_or_add_tcPr()
            # borders
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
# 1. ACTUALIZAR TABLA 5 (BUYER) - Table index 4
# -------------------------------------------------------------
t5 = doc.tables[4]
t5_data = [
    ["Elemento", "B1. Conversión BUYER → LEAD en 14 días", "B2. Contactos utilizables", "B3. Costo por LEAD atribuible"],
    ["Descripción", "Mide qué proporción de los contactos utilizables se convierte formalmente en LEAD dentro de los primeros 14 días desde su registro.", "Mide qué proporción de los contactos captados cumple las condiciones de calidad y consentimiento legal (Ley 29733) para ser utilizables.", "Mide el costo promedio de captación publicitaria necesario para generar un nuevo LEAD atribuible a campañas."],
    ["Medidas base (Figura 4 / Fact_CaptacionBuyer)", "Conversiones a LEAD [Cant.]\nContactos utilizables [Cant.]\nTiempo de conversión [Días]", "Contactos utilizables [Cant.]\nContactos registrados [Cant.]", "Costo atribuido de captación [S/.]\nConversiones a LEAD [Cant.]"],
    ["Fórmula KPI", "(Conversiones a LEAD con tiempo de conversión ≤ 14 días / Contactos utilizables con ventana de 14 días cumplida) × 100", "(Contactos utilizables / Contactos registrados) × 100", "Costo atribuido de captación / Conversiones a LEAD"],
    ["Tablas BD (OLTP & Mart)", "Personas, EventosEtapa\nNexoSalud_Mart.dbo.Fact_CaptacionBuyer", "Personas\nNexoSalud_Mart.dbo.Fact_CaptacionBuyer", "GastosCampana, Campanas\nNexoSalud_Mart.dbo.Fact_CaptacionBuyer"],
    ["Dimensiones de análisis", "Tiempo, Sede, Servicio, Canal, Tipo Persona, Fuente", "Tiempo, Canal, Tipo Persona, Fuente, Estado del registro", "Tiempo, Sede, Servicio, Canal, Fuente"],
    ["Periodicidad", "Cálculo diario (ventana 14d);\nrevisión semanal y consolidación mensual", "Cálculo diario;\nrevisión semanal y consolidación mensual", "Revisión semanal y consolidación mensual"],
    ["Semáforo", "Verde ≥ 20 %;\námbar ≥ 10 % y < 20 %;\nrojo < 10 %", "Verde ≥ 80 %;\námbar ≥ 60 % y < 80 %;\nrojo < 60 %", "Verde ≤ S/ 50;\námbar > S/ 50 y ≤ S/ 100;\nrojo > S/ 100"]
]
for r_idx, row in enumerate(t5_data):
    for c_idx, val in enumerate(row):
        t5.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t5.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t5)
print('Tabla 5 (BUYER) homologada con medidas literales de Figura 4.')

# -------------------------------------------------------------
# 2. ACTUALIZAR TABLA 7 (LEAD) - Table index 6
# -------------------------------------------------------------
t7 = doc.tables[6]
t7_data = [
    ["Elemento", "L1. Conversión LEAD → PAYER en ≤ 14 días", "L2. Primera respuesta útil en ≤ 15 minutos hábiles", "L3. Tasa de abandono de negociaciones"],
    ["Descripción", "Mide la proporción de LEADs evaluables que validan una reserva con abono dentro de los primeros 14 días de negociación.", "Mide la proporción de prospectos que reciben su primera respuesta comercial calificada dentro del SLA de 15 minutos hábiles.", "Mide la proporción de negociaciones LEAD finalizadas cuyo resultado es Abandonado o desestimado."],
    ["Medidas base (Figura 13 / Fact_NegociacionLead)", "Cantidad de LEADs convertidos a PAYER en 14 días\nCantidad de LEADs de cohorte evaluable", "Cantidad de LEADs con primera respuesta útil en 15 min hábiles\nCantidad de LEADs que requieren respuesta", "Cantidad de LEADs abandonados\nCantidad de LEADs con resultado final"],
    ["Fórmula KPI", "(Cantidad de LEADs convertidos a PAYER en 14 días / Cantidad de LEADs de cohorte evaluable) × 100", "(Cantidad de LEADs con primera respuesta útil en 15 min hábiles / Cantidad de LEADs que requieren respuesta) × 100", "(Cantidad de LEADs abandonados / Cantidad de LEADs con resultado final) × 100"],
    ["Tablas BD (OLTP & Mart)", "Solicitudes, Pagos, EventosEtapa\nNexoSalud_Mart.dbo.Fact_NegociacionLead", "Solicitudes, Interacciones\nNexoSalud_Mart.dbo.Fact_NegociacionLead", "Solicitudes, EventosEtapa\nNexoSalud_Mart.dbo.Fact_NegociacionLead"],
    ["Dimensiones de análisis", "Tiempo, Sede, Servicio, Negociador, Profesional", "Tiempo, Sede, Servicio, Negociador", "Tiempo, Sede, Servicio, Negociador"],
    ["Periodicidad", "Cálculo diario sobre cohortes maduras;\nrevisión semanal y mensual", "Cálculo continuo en tiempo real;\nrevisión diaria y semanal", "Cálculo diario;\nrevisión semanal y mensual"],
    ["Semáforo", "Verde ≥ 30 %;\námbar ≥ 15 % y < 30 %;\nrojo < 15 %", "Verde ≥ 80 %;\námbar ≥ 50 % y < 80 %;\nrojo < 50 %", "Verde ≤ 15 %;\námbar > 15 % y ≤ 30 %;\nrojo > 30 %"]
]
for r_idx, row in enumerate(t7_data):
    for c_idx, val in enumerate(row):
        t7.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t7.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t7)
print('Tabla 7 (LEAD) homologada con medidas literales de Figura 13.')

# -------------------------------------------------------------
# 3. ACTUALIZAR TABLA 9 (PAYER) - Table index 8
# -------------------------------------------------------------
t9 = doc.tables[8]
t9_data = [
    ["Elemento", "P1. Pagos Validados", "P2. Tiempo Promedio de Validación", "P3. Pagos Rechazados", "P4. Conversión PAYER → CUSTOMER"],
    ["Descripción", "Mide la eficacia de la tesorería en conciliar y aprobar exitosamente los pagos recibidos.", "Mide la agilidad del proceso de verificación bancaria entre el pago del usuario y su aprobación.", "Mide la proporción de pagos o comprobantes inválidos, erróneos o fallidos sobre el total recibido.", "Mide la proporción de abonos registrados que logran sentar efectivamente al paciente en sillón dental."],
    ["Medidas base (Figura 22 / Fact_GestionPayer)", "Pagos validados [Cant.]\nPagos registrados [Cant.]", "Tiempo total de validación [Min.]\nPagos validados [Cant.]", "Pagos rechazados [Cant.]\nPagos registrados [Cant.]", "Conversiones a CUSTOMER [Cant.]\nPagos registrados [Cant.]"],
    ["Fórmula KPI", "(Pagos validados / Pagos registrados) × 100", "Tiempo total de validación / Pagos validados", "(Pagos rechazados / Pagos registrados) × 100", "(Conversiones a CUSTOMER / Pagos registrados) × 100"],
    ["Tablas BD (OLTP & Mart)", "Pagos\nNexoSalud_Mart.dbo.Fact_GestionPayer", "Pagos\nNexoSalud_Mart.dbo.Fact_GestionPayer", "Pagos\nNexoSalud_Mart.dbo.Fact_GestionPayer", "Pagos, Reservas, EventosEtapa\nNexoSalud_Mart.dbo.Fact_GestionPayer"],
    ["Dimensiones de análisis", "Fecha, Hora, Sede, Pasarela, Cobro", "Fecha, Hora, Sede, Pasarela, Pagador", "Fecha, Hora, Sede, Pasarela, Cobro", "Fecha, Hora, Sede, Servicio, Cobro"],
    ["Periodicidad", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo continuo;\nrevisión diaria y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario sobre cohortes;\nrevisión semanal y mensual"],
    ["Semáforo", "Verde ≥ 80 %;\námbar ≥ 60 % y < 80 %;\nrojo < 60 %", "Verde ≤ 60 min;\námbar > 60 y ≤ 120 min;\nrojo > 120 min", "Verde ≤ 5 %;\námbar > 5 % y ≤ 10 %;\nrojo > 10 %", "Verde ≥ 90 %;\námbar ≥ 75 % y < 90 %;\nrojo < 75 %"]
]
for r_idx, row in enumerate(t9_data):
    for c_idx, val in enumerate(row):
        t9.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t9.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t9)
print('Tabla 9 (PAYER) homologada con medidas literales de Figura 22.')

# -------------------------------------------------------------
# 4. ACTUALIZAR TABLA 12 (CUSTOMER) - Table index 11
# -------------------------------------------------------------
t12 = doc.tables[11]
# Convert Table 12 to 8 rows x 5 columns
# Clear table and recreate rows/cells
# Table 12 originally has 5 rows x 4 columns. Let's make it 8 rows x 5 columns!
while len(t12.rows) < 8:
    t12.add_row()
for r in t12.rows:
    while len(r.cells) < 5:
        r._tr.append(docx.oxml.OxmlElement('w:tc'))

t12_data = [
    ["Elemento", "C1. Asistencia Efectiva en Sillón", "C2. Tasa de No-Show (Ausentismo)", "C3. Tiempo Promedio en Sillón Dental", "C4. Conformidad Asistencial"],
    ["Descripción", "Mide la proporción de citas agendadas que se convierten en atenciones médicas efectivas en consultorio.", "Mide la proporción de pacientes que no asisten a su consulta odontológica programada.", "Mide la duración promedio que el paciente permanece en el sillón dental durante el procedimiento.", "Mide la proporción de atenciones clínicas culminadas que cuentan con historia clínica y ficha completa."],
    ["Medidas base (Figura 30 / Fact_AtencionCustomer)", "Atenciones realizadas [Cant.]\nCitas evaluables [Cant.]", "Citas con inasistencia [Cant.]\nCitas evaluables [Cant.]", "Tiempo en sillón dental [Min.]\nAtenciones realizadas [Cant.]", "Atenciones finalizadas conformes [Cant.]\nAtenciones realizadas [Cant.]"],
    ["Fórmula KPI", "(Atenciones realizadas / Citas evaluables) × 100", "(Citas con inasistencia / Citas evaluables) × 100", "Tiempo en sillón dental / Atenciones realizadas", "(Atenciones finalizadas conformes / Atenciones realizadas) × 100"],
    ["Tablas BD (OLTP & Mart)", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer", "Atenciones\nNexoSalud_Mart.dbo.Fact_AtencionCustomer"],
    ["Dimensiones de análisis", "Tiempo, Sede, Servicio, Profesional, Estado de Atención", "Tiempo, Sede, Servicio, Profesional, Estado de Atención", "Tiempo, Sede, Servicio, Profesional", "Tiempo, Sede, Servicio, Profesional"],
    ["Periodicidad", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nrevisión semanal y mensual", "Cálculo diario;\nauditoría clínica mensual"],
    ["Semáforo", "Verde ≥ 80 %;\námbar ≥ 65 % y < 80 %;\nrojo < 65 %", "Verde ≤ 10 %;\námbar > 10 % y ≤ 20 %;\nrojo > 20 %", "Verde: ± 10 min de duración objetivo;\námbar: ± 15 min;\nrojo: > 20 min", "Verde ≥ 95 %;\námbar ≥ 85 % y < 95 %;\nrojo < 85 %"]
]
for r_idx, row in enumerate(t12_data):
    for c_idx, val in enumerate(row):
        t12.cell(r_idx, c_idx).text = val
        if r_idx == 0 or c_idx == 0:
            for p in t12.cell(r_idx, c_idx).paragraphs:
                for run in p.runs:
                    run.bold = True
style_table(t12)
print('Tabla 12 (CUSTOMER) homologada con medidas literales de Figura 30 y estructura APA 7ma.')

# Save to out_path
doc.save(out_path)
print(f'Document successfully saved to {out_path}')
