$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendScript = Join-Path $PSScriptRoot "start_backend.ps1"
$FrontendCommand = "Set-Location '$RootDir'; py -3.13 -m http.server 4173 --directory frontend"

if (-not (Test-Path (Join-Path $RootDir "backend\.venv\Scripts\python.exe"))) {
    throw "Backend virtual environment was not found. Run scripts\setup_backend.ps1 first."
}

$backend = Start-Process powershell -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $BackendScript
) -WindowStyle Hidden -PassThru

$frontend = Start-Process powershell -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $FrontendCommand
) -WindowStyle Hidden -PassThru

Write-Host "Backend started:  http://127.0.0.1:8000  (PID $($backend.Id))"
Write-Host "Frontend started: http://127.0.0.1:4173  (PID $($frontend.Id))"
Write-Host "Stop them later with: Stop-Process -Id $($backend.Id),$($frontend.Id)"
