#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║           AgriMarché — Launcher Professionnel               ║
║           Version 2.0.0 — Marketplace Agricole              ║
╚══════════════════════════════════════════════════════════════╝

Ce script lance automatiquement le Backend (FastAPI) et le
Frontend (React/Vite) de la plateforme AgriMarché.

Usage:
    python launch.py              # Lance tout (backend + frontend)
    python launch.py --backend    # Lance uniquement le backend
    python launch.py --frontend   # Lance uniquement le frontend
    python launch.py --install    # Installe toutes les dépendances
    python launch.py --check      # Vérifie les prérequis uniquement
    python launch.py --stop       # Arrête tous les processus AgriMarché
"""

import subprocess
import os
import sys
import time
import signal
import shutil
import argparse
import json
import socket
from pathlib import Path
from typing import Optional

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
ROOT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT_DIR / "backend-python"
FRONTEND_DIR = ROOT_DIR / "frontend"
VENV_DIR = ROOT_DIR / ".venv"

BACKEND_PORT = 8000
FRONTEND_PORT = 5173

# Détection du chemin Python dans le venv
if sys.platform == "win32":
    VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
    VENV_PIP = VENV_DIR / "Scripts" / "pip.exe"
    VENV_ACTIVATE = VENV_DIR / "Scripts" / "activate.bat"
else:
    VENV_PYTHON = VENV_DIR / "bin" / "python"
    VENV_PIP = VENV_DIR / "bin" / "pip"
    VENV_ACTIVATE = VENV_DIR / "bin" / "activate"

# Stockage des processus enfants pour nettoyage
child_processes = []


# ─────────────────────────────────────────────
# Utilitaires d'affichage
# ─────────────────────────────────────────────
class Colors:
    """Couleurs ANSI pour le terminal."""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"

    BG_GREEN = "\033[42m"
    BG_RED = "\033[41m"
    BG_BLUE = "\033[44m"
    BG_YELLOW = "\033[43m"


def banner():
    """Affiche la bannière AgriMarché."""
    banner_text = f"""
  ╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║        █████╗  ██████╗ ██████╗ ██╗███╗   ███╗ █████╗        ║
  ║       ██╔══██╗██╔════╝ ██╔══██╗██║████╗ ████║██╔══██╗       ║
  ║       ███████║██║  ███╗██████╔╝██║██╔████╔██║███████║       ║
  ║       ██╔══██║██║   ██║██╔══██╗██║██║╚██╔╝██║██╔══██║       ║
  ║       ██║  ██║╚██████╔╝██║  ██║██║██║ ╚═╝ ██║██║  ██║       ║
  ║       ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝  ╚═╝       ║
  ║                                                              ║
  ║         AgriMarché - Marketplace Agricole                    ║
  ║                     Version 2.0.0                            ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝
"""
    try:
        print(f"{Colors.GREEN}{Colors.BOLD}{banner_text}{Colors.RESET}")
    except UnicodeEncodeError:
        # Fallback pour les terminaux ne supportant pas l'UTF-8
        print(f"{Colors.GREEN}{Colors.BOLD}")
        print("  " + "="*60)
        print("  |                                                            |")
        print("  |            AGRIMARCHE - MARKETPLACE AGRICOLE               |")
        print("  |                      Version 2.0.0                         |")
        print("  |                                                            |")
        print("  " + "="*60)
        print(f"{Colors.RESET}")


def log(level: str, message: str):
    """Affiche un message formaté."""
    icons = {
        "info": "i",
        "ok": "v",
        "warn": "!",
        "error": "x",
        "step": ">",
        "wait": "o",
    }
    icon = icons.get(level, "  ")
    try:
        print(f"  {icon} {message}")
    except UnicodeEncodeError:
        print(f"  [{level}] {message.encode('ascii', 'replace').decode('ascii')}")


def progress_bar(step: int, total: int, label: str):
    """Affiche une barre de progression."""
    filled = "#" * step
    empty = "-" * (total - step)
    percentage = int(step / total * 100)
    try:
        print(f"\n  {Colors.GREEN}[{filled}{empty}]{Colors.RESET} {percentage}% - {label}")
    except UnicodeEncodeError:
        print(f"\n  [{filled}{empty}] {percentage}% - {label.encode('ascii', 'replace').decode('ascii')}")


def separator():
    """Affiche un séparateur."""
    try:
        print(f"  {Colors.DIM}{'-' * 56}{Colors.RESET}")
    except UnicodeEncodeError:
        print(f"  {'-' * 56}")


# ─────────────────────────────────────────────
# Vérifications des prérequis
# ─────────────────────────────────────────────
def check_command(name: str) -> bool:
    """Vérifie si une commande est disponible dans le PATH."""
    return shutil.which(name) is not None


def check_port_available(port: int) -> bool:
    """Vérifie si un port est disponible."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except socket.error:
            return False


def check_port_in_use(port: int) -> bool:
    """Vérifie si un port est en cours d'utilisation (service actif)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.settimeout(1)
            s.connect(("127.0.0.1", port))
            return True
        except (socket.error, socket.timeout):
            return False


def get_version(command: str) -> str:
    """Récupère la version d'une commande."""
    try:
        result = subprocess.run(
            [command, "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        version = result.stdout.strip() or result.stderr.strip()
        return version.split("\n")[0]
    except Exception:
        return "inconnue"


def check_prerequisites() -> bool:
    """Vérifie tous les prérequis du système."""
    progress_bar(1, 5, "Vérification des prérequis")
    separator()

    all_ok = True

    # Python
    if check_command("python"):
        version = get_version("python")
        log("ok", f"Python installé ({version})")
    else:
        log("error", "Python non trouvé ! Installez Python 3.10+ depuis https://python.org")
        all_ok = False

    # Node.js
    if check_command("node"):
        version = get_version("node")
        log("ok", f"Node.js installé ({version})")
    else:
        log("error", "Node.js non trouvé ! Installez Node.js 18+ depuis https://nodejs.org")
        all_ok = False

    # npm
    if check_command("npm"):
        version = get_version("npm")
        log("ok", f"npm installé ({version})")
    else:
        log("error", "npm non trouvé !")
        all_ok = False

    # Environnement virtuel
    if VENV_PYTHON.exists():
        log("ok", "Environnement virtuel Python trouvé")
    else:
        log("warn", "Environnement virtuel non trouvé — sera créé automatiquement")

    # node_modules
    if (FRONTEND_DIR / "node_modules").exists():
        log("ok", "Dépendances frontend installées (node_modules)")
    else:
        log("warn", "node_modules absent — sera installé automatiquement")

    # Fichier .env backend
    if (BACKEND_DIR / ".env").exists():
        log("ok", "Fichier .env backend trouvé")
    else:
        log("warn", "Fichier .env backend absent — vérifiez la configuration")

    # Ports
    separator()
    if check_port_available(BACKEND_PORT):
        log("ok", f"Port {BACKEND_PORT} disponible (Backend)")
    else:
        if check_port_in_use(BACKEND_PORT):
            log("warn", f"Port {BACKEND_PORT} déjà utilisé — le backend est peut-être déjà lancé")
        else:
            log("error", f"Port {BACKEND_PORT} indisponible")
            all_ok = False

    if check_port_available(FRONTEND_PORT):
        log("ok", f"Port {FRONTEND_PORT} disponible (Frontend)")
    else:
        if check_port_in_use(FRONTEND_PORT):
            log("warn", f"Port {FRONTEND_PORT} déjà utilisé — le frontend est peut-être déjà lancé")
        else:
            log("warn", f"Port {FRONTEND_PORT} indisponible — Vite utilisera le prochain port disponible")

    separator()
    return all_ok


# ─────────────────────────────────────────────
# Installation des dépendances
# ─────────────────────────────────────────────
def setup_venv():
    """Crée l'environnement virtuel Python si nécessaire."""
    if not VENV_PYTHON.exists():
        log("step", "Création de l'environnement virtuel Python...")
        try:
            subprocess.run(
                [sys.executable, "-m", "venv", str(VENV_DIR)],
                check=True,
                cwd=str(ROOT_DIR)
            )
            log("ok", "Environnement virtuel créé")
        except subprocess.CalledProcessError as e:
            log("error", f"Impossible de créer l'environnement virtuel : {e}")
            return False
    return True


def install_backend_deps():
    """Installe les dépendances Python du backend."""
    progress_bar(2, 5, "Installation des dépendances Backend")
    separator()

    if not setup_venv():
        return False

    requirements_file = BACKEND_DIR / "requirements.txt"
    if not requirements_file.exists():
        log("error", "Fichier requirements.txt introuvable dans backend-python/")
        return False

    log("step", "Installation des dépendances Python (pip install)...")
    try:
        subprocess.run(
            [str(VENV_PIP), "install", "-r", str(requirements_file), "--quiet"],
            check=True,
            cwd=str(ROOT_DIR),
            capture_output=True
        )
        log("ok", "Dépendances Python installées avec succès")
    except subprocess.CalledProcessError as e:
        log("error", f"Erreur pip install : {e}")
        log("info", "Tentative avec --user flag...")
        try:
            subprocess.run(
                [str(VENV_PIP), "install", "-r", str(requirements_file), "--quiet", "--no-warn-script-location"],
                check=True,
                cwd=str(ROOT_DIR)
            )
            log("ok", "Dépendances installées (mode alternatif)")
        except subprocess.CalledProcessError:
            log("error", "Impossible d'installer les dépendances Python")
            return False

    separator()
    return True


def install_frontend_deps():
    """Installe les dépendances npm du frontend."""
    progress_bar(3, 5, "Installation des dépendances Frontend")
    separator()

    if not (FRONTEND_DIR / "node_modules").exists():
        log("step", "Installation des dépendances npm...")
        try:
            npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
            subprocess.run(
                [npm_cmd, "install"],
                check=True,
                cwd=str(FRONTEND_DIR)
            )
            log("ok", "Dépendances npm installées avec succès")
        except subprocess.CalledProcessError as e:
            log("error", f"Erreur npm install : {e}")
            return False
    else:
        log("ok", "Dépendances npm déjà installées")

    separator()
    return True


def ensure_directories():
    """Crée les répertoires nécessaires."""
    dirs_to_create = [
        BACKEND_DIR / "uploads",
        ROOT_DIR / "uploads",
    ]
    for d in dirs_to_create:
        d.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────
# Lancement des services
# ─────────────────────────────────────────────
def start_backend() -> Optional[subprocess.Popen]:
    """Lance le serveur Backend FastAPI."""
    progress_bar(4, 5, "Lancement du Backend FastAPI")
    separator()

    # Vérifier si le backend tourne déjà
    if check_port_in_use(BACKEND_PORT):
        log("warn", f"Le backend est déjà en ligne sur le port {BACKEND_PORT}")
        log("info", f"URL : http://127.0.0.1:{BACKEND_PORT}")
        separator()
        return None

    log("step", "Démarrage du serveur FastAPI...")

    try:
        if sys.platform == "win32":
            # Lancement dans une nouvelle fenêtre CMD sur Windows
            cmd = (
                f'start "AgriMarché Backend" cmd /k "'
                f'TITLE 🌾 AgriMarché Backend (Port {BACKEND_PORT}) && '
                f'COLOR 0B && '
                f'cd /d {BACKEND_DIR} && '
                f'{VENV_DIR}\\Scripts\\activate.bat && '
                f'echo. && '
                f'echo  Backend AgriMarché - FastAPI && '
                f'echo  Port: {BACKEND_PORT} && '
                f'echo  Status: STARTING... && '
                f'echo. && '
                f'python main.py"'
            )
            backend_process = subprocess.Popen(cmd, shell=True, cwd=str(ROOT_DIR))
        else:
            # Sur Linux/Mac, lancer en arrière-plan
            backend_process = subprocess.Popen(
                [str(VENV_PYTHON), "main.py"],
                cwd=str(BACKEND_DIR),
                stdout=open(ROOT_DIR / "server.log", "a"),
                stderr=open(ROOT_DIR / "server.err", "a"),
            )

        child_processes.append(backend_process)
        log("ok", "Processus backend démarré")

        # Attendre que le backend soit opérationnel
        log("wait", "Attente du démarrage du backend...")
        for i in range(15):
            time.sleep(1)
            if check_port_in_use(BACKEND_PORT):
                log("ok", f"Backend en ligne sur http://127.0.0.1:{BACKEND_PORT}")
                log("info", f"Documentation API : http://127.0.0.1:{BACKEND_PORT}/docs")
                separator()
                return backend_process

        log("warn", "Le backend n'a pas répondu dans le délai imparti (15s)")
        log("error", "Vérifiez la fenêtre « AgriMarché Backend » (.env, PostgreSQL, modules Python).")
        log("info", "Sans backend actif, Vite affiche: ECONNREFUSED 127.0.0.1:8000")
        separator()
        return backend_process

    except Exception as e:
        log("error", f"Erreur lors du lancement du backend : {e}")
        separator()
        return None


def start_frontend():
    """Lance le serveur Frontend React/Vite."""
    progress_bar(5, 5, "Lancement du Frontend React")
    separator()

    # Vérifier si le frontend tourne déjà
    if check_port_in_use(FRONTEND_PORT):
        log("warn", f"Le frontend est déjà en ligne sur le port {FRONTEND_PORT}")
        log("info", f"URL : http://localhost:{FRONTEND_PORT}")
        return

    log("step", "Démarrage du serveur Vite...")
    print()
    
    status_text = f"""
  {Colors.GREEN}{Colors.BOLD}╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║   🚀 AgriMarché est prêt !                                   ║
  ║                                                              ║
  ║   Backend  : {Colors.CYAN}http://127.0.0.1:{BACKEND_PORT}{Colors.GREEN}                          ║
  ║   Frontend : {Colors.CYAN}http://localhost:{FRONTEND_PORT}{Colors.GREEN}                           ║
  ║   API Docs : {Colors.CYAN}http://127.0.0.1:{BACKEND_PORT}/docs{Colors.GREEN}                      ║
  ║                                                              ║
  ║   Pour arrêter : Ctrl+C                                      ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝{Colors.RESET}
"""
    try:
        print(status_text)
    except UnicodeEncodeError:
        print(f"  {Colors.GREEN}{Colors.BOLD}*** AgriMarché est prêt ! ***{Colors.RESET}")
        print(f"  Backend  : http://127.0.0.1:{BACKEND_PORT}")
        print(f"  Frontend : http://localhost:{FRONTEND_PORT}")
        print(f"  API Docs : http://127.0.0.1:{BACKEND_PORT}/docs")
        print("  Pour arreter : Ctrl+C")

    try:
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        frontend_process = subprocess.run(
            [npm_cmd, "run", "dev"],
            cwd=str(FRONTEND_DIR)
        )
    except KeyboardInterrupt:
        log("info", "Arrêt du frontend demandé par l'utilisateur")
    except Exception as e:
        log("error", f"Erreur lors du lancement du frontend : {e}")


# ─────────────────────────────────────────────
# Arrêt propre
# ─────────────────────────────────────────────
def cleanup(signum=None, frame=None):
    """Nettoyage des processus enfants."""
    print()
    log("info", "Arrêt d'AgriMarché...")

    for proc in child_processes:
        try:
            if proc and proc.poll() is None:
                proc.terminate()
                proc.wait(timeout=5)
                log("ok", f"Processus {proc.pid} arrêté")
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    log("ok", "Tous les processus ont été arrêtés")
    print()
    print(f"  {Colors.GREEN}Merci d'avoir utilisé AgriMarché ! 🌾{Colors.RESET}")
    print()


def stop_all():
    """Arrête tous les processus AgriMarché (backend et frontend)."""
    log("step", "Recherche des processus AgriMarché...")

    if sys.platform == "win32":
        # Tuer le backend (uvicorn/python main.py)
        try:
            subprocess.run(
                ["taskkill", "/F", "/FI", f"WINDOWTITLE eq *AgriMarché Backend*"],
                capture_output=True
            )
            log("ok", "Processus backend arrêtés")
        except Exception:
            log("warn", "Aucun processus backend trouvé")

        # Tuer les processus sur les ports
        for port in [BACKEND_PORT, FRONTEND_PORT]:
            try:
                result = subprocess.run(
                    ["netstat", "-ano", "-p", "TCP"],
                    capture_output=True, text=True
                )
                for line in result.stdout.split("\n"):
                    if f":{port}" in line and "LISTENING" in line:
                        pid = line.strip().split()[-1]
                        subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                        log("ok", f"Processus PID {pid} sur le port {port} arrêté")
            except Exception:
                pass
    else:
        # Sur Linux/Mac
        for port in [BACKEND_PORT, FRONTEND_PORT]:
            try:
                result = subprocess.run(
                    ["lsof", "-ti", f":{port}"],
                    capture_output=True, text=True
                )
                if result.stdout.strip():
                    pids = result.stdout.strip().split("\n")
                    for pid in pids:
                        os.kill(int(pid), signal.SIGTERM)
                        log("ok", f"Processus PID {pid} sur le port {port} arrêté")
            except Exception:
                pass

    log("ok", "Nettoyage terminé")


# ─────────────────────────────────────────────
# Point d'entrée principal
# ─────────────────────────────────────────────
def main():
    """Point d'entrée principal du launcher."""

    # Parsing des arguments
    parser = argparse.ArgumentParser(
        description="AgriMarché Launcher — Lance le Backend et le Frontend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python launch.py              Lance tout (backend + frontend)
  python launch.py --backend    Lance uniquement le backend
  python launch.py --frontend   Lance uniquement le frontend
  python launch.py --install    Installe toutes les dépendances
  python launch.py --check      Vérifie les prérequis
  python launch.py --stop       Arrête tous les processus
        """
    )
    parser.add_argument("--backend", action="store_true", help="Lancer uniquement le backend")
    parser.add_argument("--frontend", action="store_true", help="Lancer uniquement le frontend")
    parser.add_argument("--install", action="store_true", help="Installer les dépendances uniquement")
    parser.add_argument("--check", action="store_true", help="Vérifier les prérequis uniquement")
    parser.add_argument("--stop", action="store_true", help="Arrêter tous les processus AgriMarché")
    args = parser.parse_args()

    # Activer le support des couleurs ANSI sur Windows
    if sys.platform == "win32":
        os.system("")  # Active les séquences ANSI dans cmd.exe

    # Enregistrer le handler de nettoyage
    signal.signal(signal.SIGINT, cleanup)
    if sys.platform != "win32":
        signal.signal(signal.SIGTERM, cleanup)

    # Afficher la bannière
    banner()

    # Mode arrêt
    if args.stop:
        stop_all()
        return

    # Mode vérification seule
    if args.check:
        check_prerequisites()
        return

    # Vérification des prérequis
    prereqs_ok = check_prerequisites()
    if not prereqs_ok:
        log("error", "Des prérequis manquent. Veuillez les installer avant de continuer.")
        sys.exit(1)

    # Mode installation seule
    if args.install:
        install_backend_deps()
        install_frontend_deps()
        ensure_directories()
        log("ok", "Installation terminée avec succès !")
        return

    # Installer les dépendances
    install_backend_deps()
    install_frontend_deps()
    ensure_directories()

    # Lancement selon le mode choisi
    if args.backend:
        start_backend()
        log("info", "Le backend tourne. Appuyez Ctrl+C pour arrêter.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            cleanup()
    elif args.frontend:
        start_frontend()
    else:
        # Mode par défaut : lancer les deux
        start_backend()
        start_frontend()

    # Nettoyage final
    cleanup()


if __name__ == "__main__":
    main()
