import re

path = r'D:\Proyects\Proyecto-IN-Odontolog-a-\backend\src\routes\report.routes.ts'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

fixed = re.sub(r"(sourceMart:\s*'NexoSalud_Mart\.[a-z_]+')", r"\1,", text)
# Fix potential double commas
fixed = fixed.replace(",,", ",")

with open(path, 'w', encoding='utf-8') as f:
    f.write(fixed)

print('Fixed sourceMart commas successfully.')
