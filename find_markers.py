# -*- coding: utf-8 -*-
import docx, sys
sys.stdout.reconfigure(encoding='utf-8')
doc = docx.Document(r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud.docx')

markers = [
    'Las tres primeras medidas de la Figura 4',
    'Costo atribuido de captación [S/.] representa',
    'Medida Principal (Intersección): Contactos Registrados',
    'En el núcleo del modelo dimensional (Fact_NegociacionLead)',
    'Medida Principal (Intersección): LEADs Convertidos a PAYER',
    'En la intersección de estas dimensiones se registran las medidas base aditivas',
    'Por su parte, las medidas financieras Importe total de cobro',
    'Medida Principal (Intersección): Importe Total de Cobro',
    'Citas evaluables [Cant.]:',
    'Atenciones realizadas [Cant.]:',
    'Citas con inasistencia [Cant.]:',
    'Tiempo en sillón dental [Min.]:',
    'Atenciones finalizadas conformes [Cant.]:',
    'Medida Principal (Intersección): Atenciones Realizadas',
    'Medidas Atómicas y de Cohorte: La tabla proyecta las siguientes métricas',
    'Medida Principal (Intersección Matricial): Tasa de Retorno'
]

for m in markers:
    found = False
    for i, p in enumerate(doc.paragraphs):
        if m.lower() in p.text.lower():
            print(f'Found "{m[:35]}" at P{i}')
            found = True
            break
    if not found:
        print(f'NOT FOUND: "{m}"')
