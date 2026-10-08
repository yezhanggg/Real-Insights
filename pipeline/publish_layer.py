#!/usr/bin/env python3
"""Publish any vector file as an Atlas layer.

    uv run --project pipeline python pipeline/publish_layer.py permits.gpkg --id phl-permits-2025 \
        --title "Building permits, 2025" --source "City of Philadelphia, L&I" \
        --source-url https://opendataphilly.org/ --color-field value --tags permits,philadelphia

Reads anything GeoPandas can (GeoPackage, shapefile, GeoJSON, GeoParquet, zipped shapefile).
Then edit content/layers/<id>.yaml (title, about, colors, popup labels) and run `npm run dev` to see it.
"""
import argparse
import sys
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).parent))
from realinsights import publish_layer  # noqa: E402
from realinsights.publish import SEA, WARM  # noqa: E402

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("path")
ap.add_argument("--id", required=True, help="lowercase-with-dashes, becomes the file name and URL")
ap.add_argument("--title", required=True)
ap.add_argument("--source", required=True, help="who published the data")
ap.add_argument("--source-url")
ap.add_argument("--dek", default="", help="one line under the title")
ap.add_argument("--fields", help="comma-separated columns to keep (default: all)")
ap.add_argument("--color-field", help="numeric column that colors the map")
ap.add_argument("--palette", choices=["warm", "sea"], default="warm")
ap.add_argument("--type", choices=["fill", "extrusion", "line", "circle", "heatmap"], help="default: from the geometry")
ap.add_argument("--height-field", help="for --type extrusion")
ap.add_argument("--popup-title", help="column shown as the popup heading (e.g. a name)")
ap.add_argument("--license")
ap.add_argument("--tags", default="")
ap.add_argument("--simplify", type=float, default=3.0, help="meters; 0 keeps geometry exact")
ap.add_argument("--digits", type=int, default=6)
ap.add_argument("--layer", help="layer name inside a GeoPackage")
ap.add_argument("--overwrite-yaml", action="store_true", help="rewrite the description even if you edited it")
a = ap.parse_args()

gdf = gpd.read_file(a.path, layer=a.layer) if a.layer else gpd.read_file(a.path)
publish_layer(
    gdf,
    id=a.id,
    title=a.title,
    source=a.source,
    source_url=a.source_url,
    dek=a.dek,
    fields=a.fields.split(",") if a.fields else None,
    color_field=a.color_field,
    palette=SEA if a.palette == "sea" else WARM,
    style_type=a.type,
    height_field=a.height_field,
    popup_title=a.popup_title,
    license=a.license,
    tags=[t for t in a.tags.split(",") if t],
    simplify_m=a.simplify or None,
    digits=a.digits,
    overwrite_yaml=a.overwrite_yaml,
)
