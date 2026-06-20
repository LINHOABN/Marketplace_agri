# Image de base légère (Python 3.13)
FROM python:3.13-slim

# Empêche la création de fichiers .pyc et active le logging immédiat
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Installation des dépendances système nécessaires (pour psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copie des dépendances
COPY requirements.txt .

# Installation des bibliothèques Python
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source
COPY . .

# Création du dossier uploads
RUN mkdir -p uploads

# Exposition du port
EXPOSE 8000

# Commande de lancement (Uvicorn avec Socket.IO)
# On utilise le port dynamique $PORT (par défaut 8000 si non défini)
CMD uvicorn main:socket_app --host 0.0.0.0 --port ${PORT:-8000}
