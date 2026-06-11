"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          iNaturalist Bulk Image Downloader — Agriculture & Élevage          ║
║          Compatible Windows & Google Colab | Python 3.10+                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dépendances :
    pip install requests tqdm

Exécution Windows :
    python inaturalist_downloader.py

Exécution Google Colab :
    !pip install requests tqdm
    !python inaturalist_downloader.py
"""

# ─────────────────────────────────────────────────────────────────────────────
#  IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
import csv
import json
import logging
import os
import re
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from tqdm import tqdm

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIGURATION  ← Modifiez uniquement cette section
# ─────────────────────────────────────────────────────────────────────────────
CONFIG = {
    # Dossier racine du dataset
    "output_dir": "dataset",

    # Nombre d'images à télécharger par espèce
    # Réduit à 2 pour couvrir 5000 espèces = ~10000 images
    "images_per_species": 2,

    # Nombre d'espèces à télécharger par catégorie
    # Cible ambitieuse : 5000 par catégorie (animaux + plantes)
    "target_species_per_category": 5000,

    # Découverte automatique des espèces via l'API iNaturalist
    # Si True, le script ignore SPECIES et cherche des espèces Animalia/Plantae
    "auto_discover_species": True,

    # Catégories actives : "animaux", "plantes", ou les deux
    "active_categories": ["animaux", "plantes"],

    # Nombre de workers parallèles (réduit pour éviter les timeouts et blocages)
    "max_workers": 1,

    # Timeout en secondes pour chaque requête (augmenté pour les connexions lentes)
    "timeout": 180,

    # Nombre de tentatives en cas d'erreur réseau
    "max_retries": 25,

    # Délai entre chaque page de l'API (secondes) — respecte le rate limit
    "api_delay": 2.0,

    # Nombre d'observations par page lors de la découverte d'espèces
    "species_discovery_per_page": 200,

    # Limite de pages pour la découverte automatique d'espèces
    "species_discovery_max_pages": 500,

    # Taille minimum d'une image valide en octets (évite les images corrompues)
    "min_image_size": 5_000,

    # Qualité d'image préférée : "large", "medium", "small"
    "preferred_quality": "medium",
}

# ─────────────────────────────────────────────────────────────────────────────
#  ESPÈCES  ← Ajoutez / supprimez des espèces ici facilement
# ─────────────────────────────────────────────────────────────────────────────
SPECIES = {
    "animaux": [
        # ── Bovins & Ovins ──
        {"common": "goat",      "taxon": "Capra hircus"},
        {"common": "sheep",     "taxon": "Ovis aries"},
        {"common": "cow",       "taxon": "Bos taurus"},
        {"common": "buffalo",   "taxon": "Bubalus bubalis"},
        {"common": "donkey",    "taxon": "Equus asinus"},
        {"common": "horse",     "taxon": "Equus caballus"},
        {"common": "pig",       "taxon": "Sus scrofa domesticus"},
        {"common": "rabbit",    "taxon": "Oryctolagus cuniculus"},
        # ── Volailles ──
        {"common": "chicken",   "taxon": "Gallus gallus domesticus"},
        {"common": "turkey",    "taxon": "Meleagris gallopavo"},
        {"common": "duck",      "taxon": "Anas platyrhynchos domesticus"},
        {"common": "goose",     "taxon": "Anser anser domesticus"},
        {"common": "guinea_fowl", "taxon": "Numida meleagris"},
        {"common": "pigeon",    "taxon": "Columba livia"},
        # ── Poissons & Aquaculture ──
        {"common": "tilapia",   "taxon": "Oreochromis niloticus"},
        {"common": "catfish",   "taxon": "Clarias gariepinus"},
        {"common": "salmon",    "taxon": "Salmo salar"},
        {"common": "carp",      "taxon": "Cyprinus carpio"},
        # ── Insectes utiles ──
        {"common": "honeybee",  "taxon": "Apis mellifera"},
        {"common": "silkworm",  "taxon": "Bombyx mori"},
        # ── Faune sauvage agricole ──
        {"common": "earthworm", "taxon": "Lumbricus terrestris"},
        {"common": "ladybug",   "taxon": "Coccinella septempunctata"},
    ],
    "plantes": [
        # ── Céréales & Grains ──
        {"common": "maize",     "taxon": "Zea mays"},
        {"common": "wheat",     "taxon": "Triticum aestivum"},
        {"common": "rice",      "taxon": "Oryza sativa"},
        {"common": "sorghum",   "taxon": "Sorghum bicolor"},
        {"common": "millet",    "taxon": "Pennisetum glaucum"},
        {"common": "barley",    "taxon": "Hordeum vulgare"},
        # ── Légumes ──
        {"common": "tomato",    "taxon": "Solanum lycopersicum"},
        {"common": "pepper",    "taxon": "Capsicum annuum"},
        {"common": "eggplant",  "taxon": "Solanum melongena"},
        {"common": "cabbage",   "taxon": "Brassica oleracea"},
        {"common": "onion",     "taxon": "Allium cepa"},
        {"common": "garlic",    "taxon": "Allium sativum"},
        {"common": "carrot",    "taxon": "Daucus carota"},
        {"common": "potato",    "taxon": "Solanum tuberosum"},
        {"common": "sweet_potato", "taxon": "Ipomoea batatas"},
        {"common": "cassava",   "taxon": "Manihot esculenta"},
        {"common": "yam",       "taxon": "Dioscorea rotundata"},
        {"common": "cucumber",  "taxon": "Cucumis sativus"},
        {"common": "okra",      "taxon": "Abelmoschus esculentus"},
        {"common": "spinach",   "taxon": "Spinacia oleracea"},
        # ── Légumineuses ──
        {"common": "soybean",   "taxon": "Glycine max"},
        {"common": "cowpea",    "taxon": "Vigna unguiculata"},
        {"common": "groundnut", "taxon": "Arachis hypogaea"},
        {"common": "bean",      "taxon": "Phaseolus vulgaris"},
        {"common": "lentil",    "taxon": "Lens culinaris"},
        # ── Fruits ──
        {"common": "mango",     "taxon": "Mangifera indica"},
        {"common": "banana",    "taxon": "Musa acuminata"},
        {"common": "papaya",    "taxon": "Carica papaya"},
        {"common": "avocado",   "taxon": "Persea americana"},
        {"common": "orange",    "taxon": "Citrus sinensis"},
        {"common": "pineapple", "taxon": "Ananas comosus"},
        {"common": "watermelon","taxon": "Citrullus lanatus"},
        # ── Cultures commerciales ──
        {"common": "coffee",    "taxon": "Coffea arabica"},
        {"common": "cocoa",     "taxon": "Theobroma cacao"},
        {"common": "sugarcane", "taxon": "Saccharum officinarum"},
        {"common": "cotton",    "taxon": "Gossypium hirsutum"},
        {"common": "sunflower", "taxon": "Helianthus annuus"},
        # ── Plantes fourragères ──
        {"common": "alfalfa",   "taxon": "Medicago sativa"},
        {"common": "clover",    "taxon": "Trifolium repens"},
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
#  INITIALISATION DES CHEMINS & LOGGING
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR        = Path(CONFIG["output_dir"])
LOGS_DIR        = BASE_DIR / "logs"
FAILED_DIR      = BASE_DIR / "failed_downloads"
METADATA_DIR    = BASE_DIR / "metadata"
METADATA_CSV    = METADATA_DIR / "metadata.csv"
DOWNLOADED_JSON = METADATA_DIR / "downloaded_ids.json"
FAILED_JSON     = FAILED_DIR / "failed_urls.json"

def setup_directories():
    """Crée l'arborescence de base du dataset."""
    for category in CONFIG["active_categories"]:
        (BASE_DIR / category).mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    FAILED_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

def setup_logging():
    """Configure le logging vers fichier + console."""
    log_file = LOGS_DIR / f"download_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )
    return logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  ÉTAT PERSISTANT : IDs DÉJÀ TÉLÉCHARGÉS
# ─────────────────────────────────────────────────────────────────────────────
_state_lock = threading.Lock()

def load_downloaded_ids() -> set:
    """Charge les IDs déjà téléchargés depuis le fichier JSON."""
    if DOWNLOADED_JSON.exists():
        with open(DOWNLOADED_JSON, "r") as f:
            return set(json.load(f))
    return set()

def save_downloaded_ids(ids: set):
    """Sauvegarde atomique des IDs téléchargés."""
    with _state_lock:
        with open(DOWNLOADED_JSON, "w") as f:
            json.dump(list(ids), f)

def load_failed_urls() -> list:
    if FAILED_JSON.exists():
        with open(FAILED_JSON, "r") as f:
            return json.load(f)
    return []

def save_failed_url(entry: dict):
    """Ajoute une URL échouée dans le fichier JSON."""
    with _state_lock:
        failures = load_failed_urls()
        failures.append(entry)
        with open(FAILED_JSON, "w") as f:
            json.dump(failures, f, indent=2)

# ─────────────────────────────────────────────────────────────────────────────
#  UTILITAIRES
# ─────────────────────────────────────────────────────────────────────────────
def sanitize_filename(name: str) -> str:
    """Nettoie un nom de fichier pour Windows et Linux."""
    name = re.sub(r'[\\/:*?"<>|]', "_", name)
    name = re.sub(r"\s+", "_", name.strip())
    return name[:100]  # Limite la longueur

def build_filename(common: str, taxon: Optional[str], index: int, ext: str = "jpg") -> str:
    """Construit un nom de fichier structuré et lisible."""
    parts = [sanitize_filename(common)]
    if taxon:
        parts.append(sanitize_filename(taxon.replace(" ", "_")))
    parts.append(f"{index:04d}")
    return f"{'_'.join(parts)}.{ext}"

def get_image_extension(url: str) -> str:
    """Extrait l'extension de l'image depuis l'URL."""
    url_path = url.split("?")[0].lower()
    for ext in ("jpg", "jpeg", "png", "webp", "gif"):
        if url_path.endswith(ext):
            return "jpg" if ext == "jpeg" else ext
    return "jpg"

# ─────────────────────────────────────────────────────────────────────────────
#  INITIALISATION DU CSV METADATA
# ─────────────────────────────────────────────────────────────────────────────
CSV_HEADERS = [
    "common_name", "scientific_name", "category",
    "original_url", "local_path", "inat_id", "license",
]
_csv_lock = threading.Lock()

def init_metadata_csv():
    """Crée le CSV avec en-têtes s'il n'existe pas encore."""
    if not METADATA_CSV.exists():
        with open(METADATA_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
            writer.writeheader()

def append_metadata(row: dict):
    """Ajoute une ligne au CSV de manière thread-safe."""
    with _csv_lock:
        with open(METADATA_CSV, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
            writer.writerow(row)

# ─────────────────────────────────────────────────────────────────────────────
#  REQUÊTES API iNATURALIST
# ─────────────────────────────────────────────────────────────────────────────
INAT_API = "https://api.inaturalist.org/v1/observations"

def fetch_observations(
    taxon_name: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    iconic_taxon: Optional[str] = None,
    extra_params: Optional[dict] = None,
) -> dict:
    """
    Interroge l'API iNaturalist pour récupérer des observations avec photos.
    Retourne le JSON de réponse ou un dict vide en cas d'erreur.
    """
    params = {
        "has[]":         "photos",
        "quality_grade": "research",
        "per_page":      per_page,
        "page":          page,
        "order":         "desc",
        "order_by":      "votes",
    }
    if taxon_name:
        params["taxon_name"] = taxon_name
    if iconic_taxon:
        params["iconic_taxon"] = iconic_taxon
    if extra_params:
        params.update(extra_params)
    for attempt in range(CONFIG["max_retries"]):
        try:
            resp = requests.get(
                INAT_API,
                params=params,
                timeout=CONFIG["timeout"],
                headers={"User-Agent": "inat-agri-downloader/1.0"},
            )
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                logging.warning(f"Rate limit atteint, pause {wait}s…")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logging.warning(f"Erreur API (tentative {attempt+1}/{CONFIG['max_retries']}): {e}")
            time.sleep(2 ** attempt)
    return {}

def discover_species(category: str, target: int) -> list:
    """
    Découvre automatiquement des espèces uniques prioritaires pour une catégorie.
    - Animaux: priorise les animaux domestiques, puis les populaires
    - Plantes: priorise fruits, plantes utiles/médicinales, puis les populaires
    Triée par nombre d'observations (espèces les plus connues en premier).
    """
    species = []
    seen = set()
    iconic_taxon = "Animalia" if category == "animaux" else "Plantae"

    # Listes de recherches prioritaires pour chaque catégorie
    if category == "animaux":
        search_queries = [
            # Animaux domestiques (très importants pour l'agriculture)
            None,  # Generic search first to get domestic animals mixed in
        ]
    else:  # plantes
        search_queries = [
            # Fruits et plantes utiles
            None,  # Generic search to include all useful plants
        ]

    for search_term in search_queries:
        page = 1
        while len(species) < target and page <= CONFIG["species_discovery_max_pages"]:
            data = fetch_observations(
                taxon_name=search_term,
                page=page,
                per_page=CONFIG["species_discovery_per_page"],
                iconic_taxon=iconic_taxon,
                extra_params={"order_by": "observations", "order": "desc"},
            )
            results = data.get("results", [])
            if not results:
                break

            for obs in results:
                if len(species) >= target:
                    break

                taxon = obs.get("taxon") or {}
                if taxon.get("rank") != "species":
                    continue
                sci_name = taxon.get("name")
                if not sci_name or sci_name in seen:
                    continue

                common = taxon.get("preferred_common_name") or sci_name

                # Filtre spécifique pour les plantes : inclure utiles, fruits, médicinales
                if category == "plantes":
                    # Inclut fruits, légumes, plantes médicinales via mots-clés
                    common_lower = common.lower()
                    sci_lower = sci_name.lower()
                    keywords = [
                        "fruit", "grain", "légume", "vegetable", "maize", "corn", "wheat", "rice",
                        "berry", "apple", "banana", "orange", "mango", "coconut",
                        "medicinal", "herbal", "herb", "spice", "basil", "mint",
                        "potato", "tomato", "carrot", "cabbage", "pepper", "bean",
                        "coffee", "cocoa", "tea", "sugarcane", "cotton",
                    ]
                    # Accepter si aucune annotation ou si contient un mot-clé pertinent
                    if not any(kw in common_lower or kw in sci_lower for kw in keywords):
                        # Garder quand même ~50% des autres pour diversité
                        if len(species) % 2 != 0:
                            continue

                species.append({"common": common, "taxon": sci_name})
                seen.add(sci_name)

            page += 1
            time.sleep(CONFIG["api_delay"])

        if len(species) >= target:
            break

    logging.info(
        f"[découverte] {category}: {len(species)}/{target} espèces trouvées "
        f"(triées par popularité/observations)"
    )
    return species[:target]  # Tronquer au target exact


def extract_photo_url(observation: dict, quality: str = "large") -> Optional[str]:
    """
    Extrait l'URL de la meilleure photo disponible depuis une observation.
    Essaie 'large' → 'medium' → 'small' en cascade.
    """
    photos = observation.get("photos", [])
    if not photos:
        return None
    photo = photos[0]
    url = photo.get("url", "")
    if not url:
        return None
    # Remplace la taille dans l'URL iNaturalist
    for size in [quality, "large", "medium", "small"]:
        candidate = re.sub(r"/square\.|/thumb\.|/small\.|/medium\.|/large\.", f"/{size}.", url)
        if candidate != url or size in url:
            return candidate
    return url

def extract_license(observation: dict) -> str:
    """Récupère la licence de la première photo."""
    photos = observation.get("photos", [])
    if photos:
        return photos[0].get("license_code", "unknown") or "unknown"
    return "unknown"

# ─────────────────────────────────────────────────────────────────────────────
#  TÉLÉCHARGEMENT D'UNE IMAGE
# ─────────────────────────────────────────────────────────────────────────────
def download_image(url: str, dest_path: Path) -> bool:
    """
    Télécharge une image avec retry automatique.
    Retourne True si succès, False sinon.
    """
    for attempt in range(CONFIG["max_retries"]):
        try:
            resp = requests.get(
                url,
                timeout=CONFIG["timeout"],
                stream=True,
                headers={"User-Agent": "inat-agri-downloader/1.0"},
            )
            resp.raise_for_status()

            # Vérifie le Content-Type
            ct = resp.headers.get("Content-Type", "")
            if "image" not in ct and "octet-stream" not in ct:
                logging.debug(f"Content-Type invalide ({ct}): {url}")
                return False

            # Écriture en streaming
            tmp_path = dest_path.with_suffix(".tmp")
            with open(tmp_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            # Vérifie la taille minimale
            if tmp_path.stat().st_size < CONFIG["min_image_size"]:
                tmp_path.unlink(missing_ok=True)
                logging.debug(f"Image trop petite, ignorée : {url}")
                return False

            tmp_path.rename(dest_path)
            return True

        except requests.RequestException as e:
            logging.debug(f"Erreur download (tentative {attempt+1}): {e}")
            time.sleep(2 ** attempt)
        except OSError as e:
            logging.warning(f"Erreur fichier: {e}")
            return False

    return False

# ─────────────────────────────────────────────────────────────────────────────
#  TRAITEMENT D'UNE ESPÈCE
# ─────────────────────────────────────────────────────────────────────────────
def process_species(
    category: str,
    species: dict,
    downloaded_ids: set,
    pbar: tqdm,
) -> dict:
    """
    Télécharge toutes les images pour une espèce donnée.
    Retourne un dict de statistiques.
    """
    common  = species["common"]
    taxon   = species.get("taxon", "")
    target  = CONFIG["images_per_species"]
    dest_dir = BASE_DIR / category / common
    dest_dir.mkdir(parents=True, exist_ok=True)

    stats = {"downloaded": 0, "skipped": 0, "failed": 0}
    index = len(list(dest_dir.glob("*.jpg"))) + len(list(dest_dir.glob("*.png")))

    page = 1
    search_term = taxon if taxon else common

    while stats["downloaded"] < target:
        data = fetch_observations(search_term, page=page, per_page=100)
        results = data.get("results", [])

        if not results:
            break  # Plus de résultats disponibles

        for obs in results:
            if stats["downloaded"] >= target:
                break

            obs_id = str(obs.get("id", ""))

            # Anti-duplication par ID iNaturalist
            if obs_id in downloaded_ids:
                stats["skipped"] += 1
                continue

            photo_url = extract_photo_url(obs, CONFIG["preferred_quality"])
            if not photo_url:
                continue

            # Nom scientifique depuis l'observation si dispo
            sci_name = None
            taxon_obs = obs.get("taxon", {})
            if taxon_obs:
                sci_name = taxon_obs.get("name")

            ext       = get_image_extension(photo_url)
            index    += 1
            filename  = build_filename(common, sci_name or taxon, index, ext)
            dest_path = dest_dir / filename

            # Skip si le fichier existe déjà
            if dest_path.exists():
                stats["skipped"] += 1
                with _state_lock:
                    downloaded_ids.add(obs_id)
                continue

            # Téléchargement
            success = download_image(photo_url, dest_path)

            if success:
                stats["downloaded"] += 1
                with _state_lock:
                    downloaded_ids.add(obs_id)

                append_metadata({
                    "common_name":     common,
                    "scientific_name": sci_name or taxon or "",
                    "category":        category,
                    "original_url":    photo_url,
                    "local_path":      str(dest_path),
                    "inat_id":         obs_id,
                    "license":         extract_license(obs),
                })
                pbar.update(1)
                pbar.set_postfix_str(f"{category}/{common}: {stats['downloaded']}/{target}")
            else:
                stats["failed"] += 1
                save_failed_url({
                    "common": common,
                    "taxon":  taxon,
                    "url":    photo_url,
                    "obs_id": obs_id,
                })

        page += 1
        time.sleep(CONFIG["api_delay"])

    # Sauvegarde périodique des IDs
    save_downloaded_ids(downloaded_ids)

    logging.info(
        f"[{category}/{common}] Terminé — "
        f"téléchargés={stats['downloaded']} "
        f"ignorés={stats['skipped']} "
        f"échoués={stats['failed']}"
    )
    return stats

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    # ── Setup ──
    setup_directories()
    logger = setup_logging()
    init_metadata_csv()

    logger.info("=" * 70)
    logger.info("  iNaturalist Bulk Downloader — Agriculture & Élevage")
    logger.info("=" * 70)

    # Charge l'état de reprise
    downloaded_ids = load_downloaded_ids()
    logger.info(f"IDs déjà téléchargés en mémoire : {len(downloaded_ids)}")

    # Construire la liste des tâches selon les catégories actives
    tasks = []
    for category in CONFIG["active_categories"]:
        if CONFIG["auto_discover_species"]:
            species_list = discover_species(category, CONFIG["target_species_per_category"])
            if not species_list:
                logger.warning(f"Aucune espèce découverte pour {category}.")
            else:
                logger.info(f"{len(species_list)} espèces découvertes pour {category}.")
        else:
            species_list = SPECIES.get(category, [])

        for sp in species_list:
            tasks.append((category, sp))

    total_target = len(tasks) * CONFIG["images_per_species"]
    logger.info(f"Espèces à traiter : {len(tasks)} | Cible totale : ~{total_target} images")
    logger.info(f"Images par espèce : {CONFIG['images_per_species']}")
    logger.info(f"Workers parallèles : {CONFIG['max_workers']}")
    est_hours = max(1, total_target // 60)  # Estimation très approximative
    logger.info(f"Estimation : {est_hours}-{est_hours*2} heures (dépend de la connexion)")
    logger.info("-" * 70)

    # ── Téléchargement parallèle ──
    global_stats = {"downloaded": 0, "skipped": 0, "failed": 0}

    with tqdm(
        total=total_target,
        desc="Progression globale",
        unit="img",
        colour="green",
        dynamic_ncols=True,
    ) as pbar:
        with ThreadPoolExecutor(max_workers=CONFIG["max_workers"]) as executor:
            futures = {
                executor.submit(
                    process_species, category, sp, downloaded_ids, pbar
                ): (category, sp["common"])
                for category, sp in tasks
            }

            for future in as_completed(futures):
                category, common = futures[future]
                try:
                    result = future.result()
                    global_stats["downloaded"] += result["downloaded"]
                    global_stats["skipped"]    += result["skipped"]
                    global_stats["failed"]     += result["failed"]
                except Exception as e:
                    logger.error(f"Erreur inattendue pour {category}/{common}: {e}")

    # Sauvegarde finale
    save_downloaded_ids(downloaded_ids)

    # ── Résumé final ──
    logger.info("=" * 70)
    logger.info("  RÉSUMÉ FINAL")
    logger.info("=" * 70)
    logger.info(f"  ✅ Images téléchargées  : {global_stats['downloaded']}")
    logger.info(f"  ⏭  Doublons ignorés     : {global_stats['skipped']}")
    logger.info(f"  ❌ Téléchargements échoués : {global_stats['failed']}")
    logger.info(f"  📁 Dataset              : {BASE_DIR.resolve()}")
    logger.info(f"  📄 Métadonnées CSV      : {METADATA_CSV.resolve()}")
    logger.info(f"  📋 IDs enregistrés      : {len(downloaded_ids)}")
    logger.info("=" * 70)

    # Stats par catégorie
    for category in CONFIG["active_categories"]:
        count = sum(
            len(list((BASE_DIR / category / sp["common"]).glob("*.*")))
            for sp in SPECIES.get(category, [])
            if (BASE_DIR / category / sp["common"]).exists()
        )
        logger.info(f"  📂 {category}: {count} images au total")

    logger.info("=" * 70)
    logger.info("  Téléchargement terminé !")


if __name__ == "__main__":
    main()
