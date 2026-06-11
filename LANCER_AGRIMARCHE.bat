@echo off
TITLE AgriMarche - Systeme de Lancement
color 0A

echo #######################################################
echo #                                                     #
echo #        BIENVENUE SUR AGRIMARCHE v2.0                #
echo #                                                     #
echo #######################################################
echo.

:: Definir le chemin de base
set BASEDIR=%~dp0
cd /d "%BASEDIR%"

echo [1/2] Preparation du Backend...
if not exist ".venv" (
    echo [!] AVERTISSEMENT: Environnement .venv introuvable.
    echo Creation de l'environnement virtuel...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r backend-python\requirements.txt
)

echo [2/2] Preparation du Frontend...
if not exist "frontend\node_modules" (
    echo [!] AVERTISSEMENT: Dependances frontend manquantes.
    echo Installation en cours...
    cd frontend && npm install && cd ..
)

echo.
echo =======================================================
echo    LANCEMENT DES SERVICES (Fenetres separees)
echo =======================================================
echo.

:: Lancement du Backend dans une nouvelle fenêtre
start "BACKEND - AgriMarche" cmd /k "color 0B && echo [SIO] Demarrage du Backend avec Socket.io... && cd backend-python && ..\.venv\Scripts\activate && python main.py"

:: Lancement du Frontend dans une nouvelle fenêtre
start "FRONTEND - AgriMarche" cmd /k "color 0E && echo [VITE] Demarrage du Frontend... && cd frontend && npm run dev"

echo.
echo -------------------------------------------------------
echo  SUCCESS : Les serveurs sont en cours de demarrage !
echo.
echo  - BACKEND  : http://localhost:8000
echo  - FRONTEND : http://localhost:5173
echo -------------------------------------------------------
echo.
echo Appuyez sur une touche pour fermer cette fenetre de controle.
pause > nul
