import docx, sys

doc = docx.Document(r'D:\Proyects\nexosalud-docs\Contexto\Archivo Informe Nexosalud.docx')

topics = ['problema', 'crecimiento', 'nuevos clientes', 'ltv', 'copiloto']
for t in topics:
    matches = [i for i, p in enumerate(doc.paragraphs) if t in p.text.lower()]
    print(f"Topic '{t}': found in {len(matches)} paragraphs (e.g. P{matches[:3]})")
