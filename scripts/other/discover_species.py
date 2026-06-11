#!/usr/bin/env python3
"""
Simplified iNaturalist downloader with direct species discovery
Targets: 5000 animals + 5000 plants with useful filtering
"""
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

# Configuration
CONFIG = {
    "output_dir": "dataset",
    "images_per_species": 1,
    "target_species_per_category": 500,  # Start with 500, scale to 5000 later
    "active_categories": ["animaux", "plantes"],
    "max_workers": 1,
    "timeout": 180,
    "max_retries": 25,
    "api_delay": 1.5,
    "species_discovery_per_page": 200,
    "species_discovery_max_pages": 500,
    "min_image_size": 5_000,
    "preferred_quality": "medium",
}

# Setup paths
BASE_DIR = Path(CONFIG["output_dir"])
LOGS_DIR = BASE_DIR / "logs"
FAILED_DIR = BASE_DIR / "failed_downloads"
METADATA_DIR = BASE_DIR / "metadata"
METADATA_CSV = METADATA_DIR / "metadata.csv"
DOWNLOADED_JSON = METADATA_DIR / "downloaded_ids.json"
FAILED_JSON = FAILED_DIR / "failed_urls.json"

def setup_directories():
    for category in CONFIG["active_categories"]:
        (BASE_DIR / category).mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    FAILED_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

def setup_logging():
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

def fetch_observations(page=1, per_page=20, iconic_taxon=None, extra_params=None):
    params = {
        "has[]": "photos",
        "quality_grade": "research",
        "per_page": per_page,
        "page": page,
        "order": "desc",
        "order_by": "observations",
    }
    if iconic_taxon:
        params["iconic_taxon"] = iconic_taxon
    if extra_params:
        params.update(extra_params)
    
    for attempt in range(CONFIG["max_retries"]):
        try:
            resp = requests.get(
                "https://api.inaturalist.org/v1/observations",
                params=params,
                timeout=CONFIG["timeout"],
                headers={"User-Agent": "inat-downloader/2.0"},
            )
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                logging.warning(f"Rate limit reached, waiting {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logging.debug(f"API error attempt {attempt+1}: {e}")
            time.sleep(2 ** min(attempt, 5))
    return {}

def discover_species_simple(category, target):
    """Simple, direct species discovery without nested loops"""
    species = []
    seen = set()
    iconic_taxon = "Animalia" if category == "animaux" else "Plantae"
    
    logging.info(f"Starting species discovery for {category}: targeting {target} species")
    
    for page in range(1, CONFIG["species_discovery_max_pages"] + 1):
        if len(species) >= target:
            break
            
        logging.debug(f"Fetching {category} page {page}...")
        data = fetch_observations(
            page=page,
            per_page=CONFIG["species_discovery_per_page"],
            iconic_taxon=iconic_taxon,
        )
        results = data.get("results", [])
        if not results:
            logging.info(f"No more results for {category} at page {page}")
            break
        
        for obs in results:
            if len(species) >= target:
                break
            
            taxon = obs.get("taxon", {})
            if not taxon or taxon.get("rank") != "species":
                continue
            
            sci_name = taxon.get("name")
            if not sci_name or sci_name in seen:
                continue
            
            common = taxon.get("preferred_common_name", sci_name)
            
            # Filter for plants: useful ones
            if category == "plantes":
                text = (common + " " + sci_name).lower()
                useful = any(kw in text for kw in [
                    "fruit", "grain", "legume", "vegetable", "maize", "corn", "wheat", "rice",
                    "berry", "apple", "banana", "orange", "mango", "medicinal", "herb",
                    "potato", "tomato", "carrot", "bean", "coffee", "cocoa", "tea"
                ])
                if not useful and len(species) % 4 != 0:
                    continue  # Keep ~25% of non-useful plants for diversity
            
            species.append({"common": common, "taxon": sci_name})
            seen.add(sci_name)
            
            if len(species) % 100 == 0:
                logging.info(f"[{category}] Found {len(species)}/{target} species")
        
        time.sleep(CONFIG["api_delay"])
    
    logging.info(f"[{category}] COMPLETE: {len(species)}/{target} species found")
    return species[:target]

def main():
    setup_directories()
    logger = setup_logging()
    
    logger.info("=" * 70)
    logger.info("  iNaturalist Bulk Downloader v2 — 5000 Species Target")
    logger.info("=" * 70)
    
    # Discover species for each category
    all_species = {}
    for category in CONFIG["active_categories"]:
        logger.info(f"\n🔍 Discovering species for '{category}'...")
        species_list = discover_species_simple(category, CONFIG["target_species_per_category"])
        all_species[category] = species_list
        logger.info(f"✅ {category}: {len(species_list)} species ready")
    
    logger.info("\n" + "=" * 70)
    logger.info("  Species discovery complete! Ready for download phase...")
    logger.info("=" * 70)
    
    for cat, specs in all_species.items():
        logger.info(f"  {cat}: {len(specs)} species")

if __name__ == "__main__":
    main()
