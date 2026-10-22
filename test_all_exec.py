import urllib.request, json

res = urllib.request.urlopen('http://localhost:3001/api/reports/all-executive')
data = json.loads(res.read().decode())
for stage, rep in data.items():
    print(f"{stage.upper()}: metric='{rep['metric']}', grandTotal={rep['grandTotal']}, categories={len(rep['categories'])}")
