#!/usr/bin/env python3
"""
Quick starter script to modify config and run the downloader with 500 species max
"""
import inaturalist_downloader as dl

# Modify config for quick test
dl.CONFIG["target_species_per_category"] = 500
dl.CONFIG["images_per_species"] = 1
dl.CONFIG["api_delay"] = 1.5

print("✅ Modified config:")
print(f"   - Target species per category: {dl.CONFIG['target_species_per_category']}")
print(f"   - Images per species: {dl.CONFIG['images_per_species']}")
print(f"   - API delay: {dl.CONFIG['api_delay']}s")
print()

# Run main
dl.main()
