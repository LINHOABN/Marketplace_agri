#!/usr/bin/env python3
"""
Final launch script: Download 5000 animals + 5000 plants with 1 image each (10k images total)
"""
import sys
import logging

# Import and modify the original downloader
import inaturalist_downloader as dl

# Display summary
print("""
╔════════════════════════════════════════════════════════════════╗
║  🌍 iNaturalist 5000-Species Downloader                       ║
║  Target: 1000 animals + 1000 plants (realistic starting point)║
║  Total: ~2000 images at 1 image per species                   ║
╚════════════════════════════════════════════════════════════════╝

Configuration:
""")

# Adjust configuration for ambitious but realistic targets
dl.CONFIG["target_species_per_category"] = 1000  # Use 1000 initially for faster testing
dl.CONFIG["images_per_species"] = 1
dl.CONFIG["api_delay"] = 1.0
dl.CONFIG["species_discovery_per_page"] = 100
dl.CONFIG["species_discovery_max_pages"] = 200

for key in ["target_species_per_category", "images_per_species", "api_delay"]:
    print(f"  {key:30} = {dl.CONFIG[key]}")

print("\n⏱️  Estimated time: 1-4 hours depending on network\n")

# Run the downloader
try:
    dl.main()
except KeyboardInterrupt:
    print("\n\n❌ Download interrupted by user")
    sys.exit(1)
except Exception as e:
    print(f"\n\n❌ Error: {e}")
    sys.exit(1)
