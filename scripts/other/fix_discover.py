#!/usr/bin/env python3
"""Fix the inaturalist_downloader.py by removing the problematic discover_species function"""

with open('inaturalist_downloader.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire discover_species function with a working version
old_func_start = content.find('def discover_species(category: str, target: int)')
if old_func_start == -1:
    print("❌ Could not find discover_species function")
    exit(1)

# Find the end of the function (next def or end of file)
next_def = content.find('\ndef ', old_func_start + 5)
if next_def == -1:
    next_def = len(content)

old_func = content[old_func_start:next_def]

new_func = '''def discover_species(category: str, target: int) -> list:
    """Discover species for a category via iNaturalist API (sorted by popularity)."""
    iconic_taxon = "Animalia" if category == "animaux" else "Plantae"
    species = []
    seen = set()
    page = 1

    while len(species) < target and page <= CONFIG["species_discovery_max_pages"]:
        try:
            data = fetch_observations(
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
                species.append({"common": common, "taxon": sci_name})
                seen.add(sci_name)

            page += 1
            time.sleep(CONFIG["api_delay"])
            if len(species) % 100 == 0:
                logging.info(f"[{category}] {len(species)}/{target}")
        except Exception as e:
            logging.debug(f"Page {page} error: {e}")
            page += 1
            time.sleep(2)

    logging.info(f"[{category}] Complete: {len(species)}/{target} species")
    return species
'''

# Replace
new_content = content[:old_func_start] + new_func + content[next_def:]

with open('inaturalist_downloader.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ discover_species function fixed and simplified")
print(f"   Old function: {len(old_func)} chars")
print(f"   New function: {len(new_func)} chars")
