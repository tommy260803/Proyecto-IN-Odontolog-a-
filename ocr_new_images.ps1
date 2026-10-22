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

$files = @('image4.jpeg', 'image12.jpeg', 'image20.jpeg', 'image27.jpeg', 'image29.jpeg')

foreach ($f in $files) {
    $fullPath = Join-Path 'D:\Proyects\nexosalud-docs\Contexto\new_extracted_images' $f
    if (Test-Path $fullPath) {
        Write-Host ('`n==================== ' + $f + ' ====================')
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
        Write-Host $ocrResult.Text
    }
}
