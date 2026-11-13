$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
Set-Location -LiteralPath $root
if(Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue){throw 'Puerto 5173 ocupado. Identifica el proceso; este script no lo sustituye.'}
$env:VITE_API_URL='http://127.0.0.1:3001/api'
$env:VITE_USE_API='true'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
exit $LASTEXITCODE
