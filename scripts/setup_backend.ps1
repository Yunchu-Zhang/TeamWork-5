$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $RootDir "backend"
$VenvDir = Join-Path $BackendDir ".venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"

function Invoke-Checked {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Command)
    & $Command[0] @($Command | Select-Object -Skip 1)
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $($Command -join ' ')"
    }
}

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python launcher 'py' was not found. Install Python 3.13 or adjust this script to your Python path."
}

if (-not (Test-Path $PythonExe)) {
    Write-Host "Creating backend virtual environment with py -3.13..."
    Invoke-Checked py -3.13 -m venv $VenvDir
}

Write-Host "Upgrading packaging tools..."
Invoke-Checked $PythonExe -m pip install --upgrade pip wheel "setuptools<82"

Write-Host "Installing backend requirements. The first Torch/SAM2 download can take a while on CPU-only machines..."
Invoke-Checked $PythonExe -m pip install -r (Join-Path $BackendDir "requirements.txt")

Write-Host "Backend environment is ready: $PythonExe"
