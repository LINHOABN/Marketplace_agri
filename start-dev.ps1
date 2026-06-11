# Lance le backend FastAPI et le frontend Vite (deux fenêtres)
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend-python"
$Frontend = Join-Path $Root "frontend"
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "Environnement .venv introuvable. Créez-le à la racine du projet." -ForegroundColor Yellow
    $VenvPython = "python"
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Backend'; Write-Host '=== AgriMarché API (port 8000) ===' -ForegroundColor Green; & '$VenvPython' -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Frontend'; Write-Host '=== AgriMarché Frontend (port 5173) ===' -ForegroundColor Green; npm run dev"
)

Write-Host ""
Write-Host "Backend  -> http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Frontend -> http://localhost:5173" -ForegroundColor Cyan
Write-Host "Fermez les fenêtres PowerShell pour arrêter les serveurs." -ForegroundColor Gray
