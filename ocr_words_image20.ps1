Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Globalization.Language,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null

$lang = New-Object Windows.Globalization.Language('es')
$ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $ocr) { $ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }

$fullPath = 'D:\Proyects\nexosalud-docs\Contexto\new_extracted_images\image20.jpeg'
$fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath)
$storageFile = Await $fileTask ([Windows.Storage.StorageFile])
$streamTask = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
$stream = Await $streamTask ([Windows.Storage.Streams.IRandomAccessStream])
$decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
$decoder = Await $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmapTask = $decoder.GetSoftwareBitmapAsync()
$bitmap = Await $bitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])
$ocrTask = $ocr.RecognizeAsync($bitmap)
$ocrResult = Await $ocrTask ([Windows.Media.Ocr.OcrResult])

foreach ($line in $ocrResult.Lines) {
    $words = ($line.Words | ForEach-Object { $_.Text }) -join ' '
    $rect = $line.Words[0].BoundingRect
    Write-Host ("Y={0:F0}, X={1:F0}: {2}" -f $rect.Y, $rect.X, $words)
}
