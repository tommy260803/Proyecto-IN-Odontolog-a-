# Solo empaqueta archivos de este bloque; no conecta a SQL Server.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$zipPath = Join-Path $repoRoot 'pruebas_backend_buyer_qa_daniel_20261112.zip'
$manifestPath = Join-Path $PSScriptRoot 'MANIFIESTO_ENTREGA.json'
$verificationPath = Join-Path $PSScriptRoot 'VERIFICACION_ZIP.json'
if ((Test-Path -LiteralPath $zipPath) -or (Test-Path -LiteralPath $manifestPath) -or (Test-Path -LiteralPath $verificationPath)) {
    throw 'La entrega ya existe. No se sobrescribe ZIP, manifiesto ni verificacion.'
}
$qaFiles = @(Get-ChildItem -LiteralPath $PSScriptRoot -Recurse -File)
$report = Get-Item -LiteralPath (Join-Path $repoRoot 'docs/agentes/PRUEBAS_BACKEND_BUYER_QA_DANIEL.md')
$files = @($qaFiles) + @($report)
$records = @($files | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($repoRoot, $_.FullName).Replace('\','/')
    if ($relative -match '(^|/)(\.env[^/]*|node_modules|dist|\.git|backups?|respaldos?)(/|$)|\.(bak|trn|zip)$' -or $relative.StartsWith('../')) {
        throw "Ruta excluida: $relative"
    }
    [ordered]@{path=$relative;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
} | Sort-Object { $_.path })
[ordered]@{
    generatedUtc=(Get-Date).ToUniversalTime().ToString('o');
    scope='Archivos nuevos QA backend Buyer e informe; rutas relativas preservadas';
    files=$records;
    manifestNote='El ZIP incluye este manifiesto. Su propia huella se comprueba al leer el ZIP contra el origen, fuera de este manifiesto.';
    verificationNote='VERIFICACION_ZIP.json se genera externamente despues de cerrar y leer todas las entradas; no se incluye en el ZIP para evitar autorreferencia.'
} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$allFiles = @($files) + @(Get-Item -LiteralPath $manifestPath)
Add-Type -AssemblyName System.IO.Compression
$archive = [IO.Compression.ZipFile]::Open($zipPath,[IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $allFiles) {
        $relative = [IO.Path]::GetRelativePath($repoRoot,$file.FullName).Replace('\','/')
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal)
    }
} finally { $archive.Dispose() }
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
$entries = @()
try {
    if ($archive.Entries.Count -ne $allFiles.Count) { throw 'Cantidad de entradas inesperada' }
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -match '(^|/)\.\.?(/|$)|\\|(^|/)(\.env[^/]*|node_modules|dist|\.git|backups?|respaldos?)(/|$)|\.(bak|trn|zip)$') { throw 'Entrada ZIP prohibida' }
        $expected = @($allFiles | Where-Object { [IO.Path]::GetRelativePath($repoRoot,$_.FullName).Replace('\','/') -eq $entry.FullName })
        if ($expected.Count -ne 1) { throw 'Entrada desconocida o duplicada' }
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $digest = [Convert]::ToHexString($sha.ComputeHash($stream)) }
        finally { $sha.Dispose(); $stream.Dispose() }
        $sourceHash = (Get-FileHash -LiteralPath $expected[0].FullName -Algorithm SHA256).Hash
        if ($digest -ne $sourceHash -or $entry.Length -ne $expected[0].Length) { throw 'Contenido ZIP distinto del origen' }
        $entries += [ordered]@{path=$entry.FullName;bytes=$entry.Length;sha256=$digest;matchesSource=$true}
    }
} finally { $archive.Dispose() }
[ordered]@{
    checkedUtc=(Get-Date).ToUniversalTime().ToString('o');zip=[IO.Path]::GetFileName($zipPath);
    sha256=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash;
    opened=$true;allEntriesRead=$true;entryCount=$entries.Count;entries=$entries;
    excluded='Secretos, .env, dependencias, dist, .git, respaldos y entregas previas';
    result='APROBADO'
} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $verificationPath -Encoding utf8
Get-Content -LiteralPath $verificationPath
