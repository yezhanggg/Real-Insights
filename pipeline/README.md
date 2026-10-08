# Pipeline

Python that turns spatial data into site layers. It isn't part of the website build: run it on your machine, then commit what it writes (`public/data/*.geojson`, `content/layers/*.yaml`).

```bash
cd pipeline
uv sync                    # GeoPandas, requests, PyYAML (vector work)
uv sync --extra raster     # + rasterio, pystac-client, planetary-computer, pysheds
uv sync --extra ml         # + scikit-learn
cd ..
uv run --project pipeline python pipeline/examples/philly_rent.py    # try the example end to end
```

The Census key is read from the repo-root `.env` (`CENSUS_API_KEY`).

| File | What it does |
|---|---|
| `publish_layer.py` | Command line: any vector file → layer. `--help` lists every option. |
| `realinsights/publish.py` | `publish_layer(gdf, …)` for notebooks; quantile color stops; the warm and sea palettes |
| `realinsights/census.py` | `acs()` (ACS tables, null codes cleaned) and `tiger()` (TIGERweb boundaries, paged) |
| `realinsights/toolkit.py` | Spatial methods from MUSA 6950: point counts, distance screens, area shares, NAIP search, NDVI, zonal means, USGS DEM tiles, HAND flood screen |
| `examples/philly_rent.py` | Dev-only example: Philadelphia tracts with ACS median gross rent |

Scratch downloads go in `pipeline/work/` and `pipeline/raw/` (both git-ignored), along with rasters and shapefiles. See [../docs/DATA_TOOLKIT.md](../docs/DATA_TOOLKIT.md) for the methods and data sources.
