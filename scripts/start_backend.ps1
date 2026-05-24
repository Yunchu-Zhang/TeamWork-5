$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $RootDir "backend"
$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    throw "Backend virtual environment was not found. Run scripts\setup_backend.ps1 first."
}

$env:PYTHONPATH = "$RootDir;$env:PYTHONPATH"
Set-Location $RootDir

Write-Host "Starting FastAPI backend at http://127.0.0.1:8000"
Write-Host "Swagger docs: http://127.0.0.1:8000/docs"
& $PythonExe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
