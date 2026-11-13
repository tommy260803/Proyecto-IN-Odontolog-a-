$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
Set-Location -LiteralPath $root
if(Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue){throw 'Puerto 3001 ocupado. Identifica el proceso; este script no lo sustituye.'}
$env:QA_BUYER_CHAT_REAL='true'
$env:LEAD_STAFF_AUTH_ENABLED='true'
$env:LEAD_STAFF_AUTH_QA='false'
$env:DISABLE_MART_SYNC='true'
$env:DUNNING_ENABLED='false'
$env:RUN_SQL_TESTS='false'
$env:QA_BUYER_HTTP_EVIDENCE='true'
node database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs
exit $LASTEXITCODE
