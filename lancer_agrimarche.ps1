#Requires -Version 5.1
<#
.SYNOPSIS
    AgriMarché — Launcher Professionnel (PowerShell)

.DESCRIPTION
    Lance automatiquement le Backend FastAPI et le Frontend React/Vite
    de la plateforme AgriMarché avec vérification des prérequis.

.PARAMETER Mode
    Mode de lancement : All (défaut), Backend, Frontend, Install, Check, Stop

.EXAMPLE
    .\lancer_agrimarche.ps1              # Lance tout
    .\lancer_agrimarche.ps1 -Mode Backend   # Backend uniquement
    .\lancer_agrimarche.ps1 -Mode Frontend  # Frontend uniquement
    .\lancer_agrimarche.ps1 -Mode Install   # Installe les dépendances
    .\lancer_agrimarche.ps1 -Mode Check     # Vérifie les prérequis
    .\lancer_agrimarche.ps1 -Mode Stop      # Arrête les processus
#>

param(
    [ValidateSet("All", "Backend", "Frontend", "Install", "Check", "Stop")]
    [string]$Mode = "All"
)

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend-python"
$FrontendDir = Join-Path $RootDir "frontend"
$VenvDir = Join-Path $RootDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"
$VenvActivate = Join-Path $VenvDir "Scripts\Activate.ps1"

$BackendPort = 8000
$FrontendPort = 5173

# ─────────────────────────────────────────────
# Fonctions d'affichage
# ─────────────────────────────────────────────
function Show-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║                                                              ║" -ForegroundColor Green
    Write-Host "  ║        █████╗  ██████╗ ██████╗ ██╗███╗   ███╗ █████╗        ║" -ForegroundColor Green
    Write-Host "  ║       ██╔══██╗██╔════╝ ██╔══██╗██║████╗ ████║██╔══██╗       ║" -ForegroundColor Green
    Write-Host "  ║       ███████║██║  ███╗██████╔╝██║██╔████╔██║███████║       ║" -ForegroundColor Green
    Write-Host "  ║       ██╔══██║██║   ██║██╔══██╗██║██║╚██╔╝██║██╔══██║       ║" -ForegroundColor Green
    Write-Host "  ║       ██║  ██║╚██████╔╝██║  ██║██║██║ ╚═╝ ██║██║  ██║       ║" -ForegroundColor Green
    Write-Host "  ║       ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝  ╚═╝       ║" -ForegroundColor Green
    Write-Host "  ║                                                              ║" -ForegroundColor Green
    Write-Host "  ║         AgriMarche - Marketplace Agricole                    ║" -ForegroundColor Green
    Write-Host "  ║                     Version 2.0.0                            ║" -ForegroundColor Green
    Write-Host "  ║                                                              ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
}

function Write-Log {
    param(
        [ValidateSet("ok", "error", "warn", "info", "step", "wait")]
        [string]$Level,
        [string]$Message
    )
    $icons = @{
        "ok"    = @{ Icon = "[OK]";    Color = "Green" }
        "error" = @{ Icon = "[ERREUR]"; Color = "Red" }
        "warn"  = @{ Icon = "[ATTENTION]"; Color = "Yellow" }
        "info"  = @{ Icon = "[INFO]";  Color = "Cyan" }
        "step"  = @{ Icon = "[>>>]";   Color = "Blue" }
        "wait"  = @{ Icon = "[...]";   Color = "Magenta" }
    }
    $entry = $icons[$Level]
    Write-Host "  $($entry.Icon) " -ForegroundColor $entry.Color -NoNewline
    Write-Host $Message
}

function Show-Progress {
    param([int]$Step, [int]$Total, [string]$Label)
    $filled = "■" * $Step
    $empty = "□" * ($Total - $Step)
    $pct = [math]::Round($Step / $Total * 100)
    Write-Host ""
    Write-Host "  [$filled$empty] $pct% - $Label" -ForegroundColor Cyan
    Write-Host "  $('─' * 56)" -ForegroundColor DarkGray
}

function Test-PortAvailable {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

function Test-PortInUse {
    param([int]$Port)
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $client.Connect("127.0.0.1", $Port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

# ─────────────────────────────────────────────
# Vérification des prérequis
# ─────────────────────────────────────────────
function Test-Prerequisites {
    Show-Progress -Step 1 -Total 5 -Label "Verification des prerequis"

    $allOk = $true

    # Python
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $ver = & python --version 2>&1
        Write-Log -Level "ok" -Message "Python installe ($ver)"
    } else {
        Write-Log -Level "error" -Message "Python non trouve ! Installez Python 3.10+ depuis https://python.org"
        $allOk = $false
    }

    # Node.js
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $ver = & node --version 2>&1
        Write-Log -Level "ok" -Message "Node.js installe ($ver)"
    } else {
        Write-Log -Level "error" -Message "Node.js non trouve ! Installez Node.js 18+ depuis https://nodejs.org"
        $allOk = $false
    }

    # npm
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $ver = & npm --version 2>&1
        Write-Log -Level "ok" -Message "npm installe (v$ver)"
    } else {
        Write-Log -Level "error" -Message "npm non trouve !"
        $allOk = $false
    }

    # Venv
    if (Test-Path $VenvPython) {
        Write-Log -Level "ok" -Message "Environnement virtuel Python trouve"
    } else {
        Write-Log -Level "warn" -Message "Environnement virtuel absent - sera cree automatiquement"
    }

    # node_modules
    if (Test-Path (Join-Path $FrontendDir "node_modules")) {
        Write-Log -Level "ok" -Message "Dependances frontend installees (node_modules)"
    } else {
        Write-Log -Level "warn" -Message "node_modules absent - sera installe automatiquement"
    }

    # .env
    if (Test-Path (Join-Path $BackendDir ".env")) {
        Write-Log -Level "ok" -Message "Fichier .env backend trouve"
    } else {
        Write-Log -Level "warn" -Message "Fichier .env backend absent"
    }

    # Ports
    Write-Host "  $('─' * 56)" -ForegroundColor DarkGray
    if (Test-PortAvailable -Port $BackendPort) {
        Write-Log -Level "ok" -Message "Port $BackendPort disponible (Backend)"
    } elseif (Test-PortInUse -Port $BackendPort) {
        Write-Log -Level "warn" -Message "Port $BackendPort deja utilise - backend peut-etre deja lance"
    } else {
        Write-Log -Level "error" -Message "Port $BackendPort indisponible"
        $allOk = $false
    }

    if (Test-PortAvailable -Port $FrontendPort) {
        Write-Log -Level "ok" -Message "Port $FrontendPort disponible (Frontend)"
    } elseif (Test-PortInUse -Port $FrontendPort) {
        Write-Log -Level "warn" -Message "Port $FrontendPort deja utilise - frontend peut-etre deja lance"
    } else {
        Write-Log -Level "warn" -Message "Port $FrontendPort indisponible - Vite choisira un autre port"
    }

    Write-Host "  $('─' * 56)" -ForegroundColor DarkGray
    return $allOk
}

# ─────────────────────────────────────────────
# Installation
# ─────────────────────────────────────────────
function Install-BackendDeps {
    Show-Progress -Step 2 -Total 5 -Label "Installation des dependances Backend"

    # Créer le venv si nécessaire
    if (-not (Test-Path $VenvPython)) {
        Write-Log -Level "step" -Message "Creation de l'environnement virtuel..."
        & python -m venv $VenvDir
        if ($LASTEXITCODE -ne 0) {
            Write-Log -Level "error" -Message "Impossible de creer l'environnement virtuel"
            return $false
        }
        Write-Log -Level "ok" -Message "Environnement virtuel cree"
    }

    # Installer les dépendances
    $reqFile = Join-Path $BackendDir "requirements.txt"
    if (Test-Path $reqFile) {
        Write-Log -Level "step" -Message "Installation des dependances Python..."
        & $VenvPip install -r $reqFile --quiet 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log -Level "ok" -Message "Dependances Python installees"
        } else {
            Write-Log -Level "warn" -Message "Certaines dependances ont eu des avertissements"
        }
    } else {
        Write-Log -Level "error" -Message "requirements.txt introuvable"
        return $false
    }
    return $true
}

function Install-FrontendDeps {
    Show-Progress -Step 3 -Total 5 -Label "Installation des dependances Frontend"

    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        Write-Log -Level "step" -Message "Installation des dependances npm..."
        Push-Location $FrontendDir
        & npm install
        Pop-Location
        if ($LASTEXITCODE -eq 0) {
            Write-Log -Level "ok" -Message "Dependances npm installees"
        } else {
            Write-Log -Level "error" -Message "Erreur npm install"
            return $false
        }
    } else {
        Write-Log -Level "ok" -Message "Dependances npm deja installees"
    }
    return $true
}

function New-RequiredDirectories {
    $dirs = @(
        (Join-Path $BackendDir "uploads"),
        (Join-Path $RootDir "uploads")
    )
    foreach ($d in $dirs) {
        if (-not (Test-Path $d)) {
            New-Item -ItemType Directory -Path $d -Force | Out-Null
        }
    }
}

# ─────────────────────────────────────────────
# Lancement des services
# ─────────────────────────────────────────────
function Start-Backend {
    Show-Progress -Step 4 -Total 5 -Label "Lancement du Backend FastAPI"

    if (Test-PortInUse -Port $BackendPort) {
        Write-Log -Level "warn" -Message "Backend deja en ligne sur le port $BackendPort"
        Write-Log -Level "info" -Message "URL : http://127.0.0.1:$BackendPort"
        return
    }

    Write-Log -Level "step" -Message "Demarrage du serveur FastAPI..."

    $backendCmd = @"
TITLE AgriMarche Backend (Port $BackendPort)
COLOR 0B
cd /d "$BackendDir"
call "$VenvDir\Scripts\activate.bat"
echo.
echo  Backend AgriMarche - FastAPI
echo  Port: $BackendPort
echo  Status: STARTING...
echo.
python main.py
"@

    Start-Process cmd.exe -ArgumentList "/k", $backendCmd.Replace("`n", " && ")

    Write-Log -Level "wait" -Message "Attente du demarrage du backend..."
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        if (Test-PortInUse -Port $BackendPort) {
            Write-Log -Level "ok" -Message "Backend en ligne sur http://127.0.0.1:$BackendPort"
            Write-Log -Level "info" -Message "Documentation API : http://127.0.0.1:$BackendPort/docs"
            return
        }
    }

    Write-Log -Level "warn" -Message "Le backend peut avoir besoin de plus de temps pour demarrer"
}

function Start-Frontend {
    Show-Progress -Step 5 -Total 5 -Label "Lancement du Frontend React"

    if (Test-PortInUse -Port $FrontendPort) {
        Write-Log -Level "warn" -Message "Frontend deja en ligne sur le port $FrontendPort"
        Write-Log -Level "info" -Message "URL : http://localhost:$FrontendPort"
        return
    }

    Write-Log -Level "step" -Message "Demarrage du serveur Vite..."
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║                                                              ║" -ForegroundColor Green
    Write-Host "  ║   AgriMarche est pret !                                      ║" -ForegroundColor Green
    Write-Host "  ║                                                              ║" -ForegroundColor Green
    Write-Host "  ║   Backend  : " -ForegroundColor Green -NoNewline
    Write-Host "http://127.0.0.1:$BackendPort" -ForegroundColor Cyan -NoNewline
    Write-Host "                          ║" -ForegroundColor Green
    Write-Host "  ║   Frontend : " -ForegroundColor Green -NoNewline
    Write-Host "http://localhost:$FrontendPort" -ForegroundColor Cyan -NoNewline
    Write-Host "                           ║" -ForegroundColor Green
    Write-Host "  ║   API Docs : " -ForegroundColor Green -NoNewline
    Write-Host "http://127.0.0.1:$BackendPort/docs" -ForegroundColor Cyan -NoNewline
    Write-Host "                      ║" -ForegroundColor Green
    Write-Host "  ║                                                              ║" -ForegroundColor Green
    Write-Host "  ║   Pour arreter : Ctrl+C                                      ║" -ForegroundColor Green
    Write-Host "  ║                                                              ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""

    Push-Location $FrontendDir
    try {
        & npm run dev
    } finally {
        Pop-Location
    }
}

# ─────────────────────────────────────────────
# Arrêt
# ─────────────────────────────────────────────
function Stop-AgriMarche {
    Write-Log -Level "step" -Message "Recherche des processus AgriMarche..."

    # Arrêter les processus sur les ports
    foreach ($port in @($BackendPort, $FrontendPort)) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
            foreach ($conn in $connections) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Log -Level "ok" -Message "Processus PID $($conn.OwningProcess) sur le port $port arrete"
            }
        } catch {
            Write-Log -Level "info" -Message "Aucun processus sur le port $port"
        }
    }

    Write-Log -Level "ok" -Message "Nettoyage termine"
}

# ─────────────────────────────────────────────
# Point d'entrée principal
# ─────────────────────────────────────────────
Show-Banner

switch ($Mode) {
    "Stop" {
        Stop-AgriMarche
    }
    "Check" {
        Test-Prerequisites | Out-Null
    }
    "Install" {
        Test-Prerequisites | Out-Null
        Install-BackendDeps | Out-Null
        Install-FrontendDeps | Out-Null
        New-RequiredDirectories
        Write-Log -Level "ok" -Message "Installation terminee avec succes !"
    }
    "Backend" {
        Test-Prerequisites | Out-Null
        Install-BackendDeps | Out-Null
        New-RequiredDirectories
        Start-Backend
        Write-Log -Level "info" -Message "Backend en cours d'execution. Appuyez Ctrl+C pour arreter."
        try { while ($true) { Start-Sleep -Seconds 1 } } catch { }
    }
    "Frontend" {
        Test-Prerequisites | Out-Null
        Install-FrontendDeps | Out-Null
        Start-Frontend
    }
    default {
        # Mode "All" — lancer tout
        $prereqs = Test-Prerequisites
        if (-not $prereqs) {
            Write-Log -Level "error" -Message "Des prerequis manquent. Installez-les avant de continuer."
            exit 1
        }
        Install-BackendDeps | Out-Null
        Install-FrontendDeps | Out-Null
        New-RequiredDirectories
        Start-Backend
        Start-Frontend
    }
}

Write-Host ""
Write-Host "  Merci d'avoir utilise AgriMarche !" -ForegroundColor Green
Write-Host ""
