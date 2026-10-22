import urllib.request, json

urls = [
    'http://localhost:3001/api/reports/status',
    'http://localhost:3001/api/reports/executive/buyer?measure=contacto_registrado',
    'http://localhost:3001/api/reports/executive/lead?measure=cohorte_evaluable',
    'http://localhost:3001/api/reports/executive/payer?measure=pago_registrado',
    'http://localhost:3001/api/reports/executive/customer?measure=cita_evaluable',
    'http://localhost:3001/api/reports/executive/turned?measure=seguimiento_registrado'
]

for u in urls:
    try:
        res = urllib.request.urlopen(u)
        data = json.loads(res.read().decode())
        metric = data.get('metric', data.get('status', 'OK'))
        source = data.get('sourceMart', '')
        endpoint = u.split('?')[0].split('/')[-1]
        print(f'{endpoint}: metric="{metric}", source="{source}"')
    except Exception as e:
        print(f'Error on {u}:', e)
