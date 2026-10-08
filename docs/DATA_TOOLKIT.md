# Data toolkit

The methods behind the maps, taken from **MUSA 6950, AI for Urban Sustainability** (University of Pennsylvania, Prof. Xiaojiang Li) and rewritten as reusable functions in `pipeline/realinsights/toolkit.py`. Each section starts with the real estate question, then the method, then the code.

Setup: `cd pipeline && uv sync` for vector work, and `uv sync --extra raster` (plus `--extra ml`) for imagery, elevation and flood. Run scripts with `uv run --project pipeline python <script>` from the repo root.

- [The golden rule: project before you measure](#the-golden-rule-project-before-you-measure)
- [How many X are in each area?](#how-many-x-are-in-each-area)
- [What's within walking distance?](#whats-within-walking-distance)
- [How much of each area is covered by Y?](#how-much-of-each-area-is-covered-by-y)
- [How green is it? (NDVI from aerial imagery)](#how-green-is-it)
- [Average a raster for each area (zonal statistics)](#average-a-raster-for-each-area)
- [Where does the ground flood? (HAND)](#where-does-the-ground-flood)
- [What's on the land? (classification and building detection)](#whats-on-the-land)
- [Census data, done carefully](#census-data-done-carefully)
- [Free data sources for real estate](#free-data-sources-for-real-estate)
- [Gaps worth filling next](#gaps-worth-filling-next)

---

## The golden rule: project before you measure

*Lab 2.* Distances and areas in EPSG:4326 are in degrees, and a degree of longitude shrinks as you go north. Always reproject before you buffer, measure or compute areas:

```python
local = gdf.estimate_utm_crs()          # good anywhere
gdf_m = gdf.to_crs(local)               # meters
# or a State Plane in feet, e.g. Pennsylvania South: EPSG:2272
```

Every toolkit function does this for you and says so in its docstring. `publish_layer()` converts back to WGS84 for the web.

## How many X are in each area?

*Permits, sales, crashes, 311 complaints, new businesses per tract or ZIP code. Lab 2: spatial join → group → merge → choropleth.*

```python
from realinsights.census import tiger
from realinsights.toolkit import count_points_in_polygons

tracts = tiger("tract", "42", "101")                       # Philadelphia tracts
permits = gpd.read_file("permits.geojson")
per_tract = count_points_in_polygons(permits, tracts, name="permits")
per_tract["permits_per_1k_households"] = per_tract.permits / households * 1000   # normalize. Raw counts mostly map population.
```

Use it for development pipelines, absorption hot spots and nuisance screens. Always normalize, by area, households or units. Otherwise the biggest tracts win.

## What's within walking distance?

*"Within half a mile of a rail station", "within 1,000 ft of a highway". Lab 2: buffers in a projected CRS.*

```python
from realinsights.toolkit import within_distance
parcels = within_distance(parcels, stations, meters=805, name="near_rail")   # adds near_rail (bool) and near_rail_m
```

Use it for TOD screens, zoning overlay proximity and amenity counts. These are straight-line distances. True walk times need a street network; see [gaps](#gaps-worth-filling-next).

## How much of each area is covered by Y?

*Share of a parcel in the FEMA floodplain, share of a tract that's parkland, share inside an opportunity zone.*

```python
from realinsights.toolkit import area_share
tracts = area_share(tracts, fema_100yr, name="floodplain_share")   # 0–1
```

## How green is it?

*Tree canopy and vegetation, as an amenity, a heat proxy or an ESG metric. Lab 3: NAIP imagery from Microsoft Planetary Computer.*

NAIP is 60 cm aerial imagery of the whole US, refreshed every 2–3 years, in 4 bands (R, G, B, NIR).

```python
import rasterio
from realinsights.toolkit import naip_items, ndvi

items = naip_items(tracts.loc[tracts.GEOID == "42101000300"])
with rasterio.open(items[0].assets["image"].href) as src:
    red, nir = src.read(1), src.read(4)
    v = ndvi(red, nir)              # −1…1; > 0.2 is usually vegetation
    meta = src.meta | {"count": 1, "dtype": "float32", "compress": "lzw"}
with rasterio.open("ndvi.tif", "w", **meta) as dst:
    dst.write(v, 1)
```

For a whole city, loop over scenes, then mosaic them (`rasterio.merge.merge`) and clip to the boundary (`rasterio.mask.mask(crop=True)`), the pattern from lab 3, notebook 3.

## Average a raster for each area

*Mean NDVI, mean elevation or mean flood depth for each tract or parcel. Lab 3: zonal statistics.*

```python
from realinsights.toolkit import zonal_mean
tracts = zonal_mean("ndvi.tif", tracts, name="ndvi_mean")
tracts["green_share"] = ...   # or threshold first: write (ndvi > 0.2) as a 0/1 raster and average it
```

## Where does the ground flood?

*Flood exposure beyond FEMA's lines, for pluvial and small-stream risk on low ground. Lab 4: Height Above Nearest Drainage (HAND) with pysheds.*

```python
from realinsights.toolkit import usgs_dem_tiles, hand_inundation
urls = usgs_dem_tiles(-75.3, 39.85, -74.95, 40.15)        # 1-arc-second (~30 m) USGS 3DEP tiles
# download and mosaic them to dem.tif, then:
hand_inundation("dem.tif", "flood_3m.tif", stage_m=3.0)   # depth where HAND < 3 m
```

How to present it: show it as a **screen**, labeled that way, next to FEMA flood zones. It is terrain only, with no rainfall, levees or storm sewers. A `stage_m` of 3–5 m flags low ground near drainage; compare a few stages rather than picking one. For finer detail, use the 1/3 arc-second (~10 m) or 1 m 3DEP products for the area.

To put a raster result on the site, either average it per tract or parcel with `zonal_mean` and publish polygons (the easiest option), or cut XYZ tiles (`gdal2tiles.py`, or `rio-tiler` on a server) and publish a layer with `tiles:`.

## What's on the land?

*Impervious surface, vacant land, new rooftops. Labs 6 and 8.*

- **Land-cover classification (lab 6).** Pair NAIP with a reference land-use raster. Align them (resample, find the common bounds, clip), sample about 500 pixels per class, train a `RandomForestClassifier` (it did best among GaussianNB, SVC, KNN and a decision tree), then predict the full scene by reshaping it to (pixels, bands). Report accuracy with `classification_report`.
- **Building detection (lab 8, U-Net).** Tile the imagery and the labels (`raster2tiles` / `naip2tiles`), split them 80/20, and train a U-Net with CrossEntropyLoss and Adam. Comparing predictions across NAIP years finds **new construction**, an early signal of supply.

These are heavier jobs. Run them in a notebook (a GPU on Colab helps), then publish the per-area summaries. Always state the model's accuracy in the layer's `about`.

## Census data, done carefully

```python
from realinsights.census import acs, tiger
rent = acs(["B25064_001E", "B25064_001M"], "tract", "42", "101", year=2023)   # estimate and margin of error
```

- Use **5-year** ACS for tracts and block groups. It's the only release that covers them.
- Keep the margin of error (`_M` variables). If two tracts' ranges overlap, call them "about the same".
- Compare years using **non-overlapping** 5-year windows, such as 2014–2018 vs. 2019–2023.
- Census null codes (−666666666 and others) become NaN automatically.
- Useful tables:

| Table | What it holds |
|---|---|
| B25064 | Median gross rent |
| B25077 | Median home value |
| B25003 | Tenure (owners vs. renters) |
| B25070 | Rent burden |
| B19013 | Median household income |
| B25024 | Units in structure |
| B25034 | Year built |
| B08301 | Commute mode |
| B01003 | Population |

## Free data sources for real estate

| Topic | Source | Notes |
|---|---|---|
| Demographics, rent, values | [Census ACS API](https://www.census.gov/data/developers.html) | Key in `.env` as `CENSUS_API_KEY` |
| Boundaries | [TIGERweb](https://tigerweb.geo.census.gov/) | Tracts, block groups, ZCTAs and places; `census.tiger()` |
| Rents and income limits | [HUD User API](https://www.huduser.gov/portal/dataset/fmr-api.html) | FMR, SAFMR, income limits |
| Affordable housing | [HUD LIHTC database](https://lihtc.huduser.gov/), QCT/DDA maps | Project points and qualifying areas |
| Flood zones | [FEMA NFHL](https://www.fema.gov/flood-maps/national-flood-hazard-layer) | Official 100- and 500-year zones |
| Elevation | [USGS 3DEP](https://www.usgs.gov/3d-elevation-program) | 1 m to 30 m DEMs; `toolkit.usgs_dem_tiles()` |
| Aerial imagery | [NAIP on Planetary Computer](https://planetarycomputer.microsoft.com/dataset/naip) | 60 cm, 4-band; `toolkit.naip_items()` |
| Streets, buildings, POIs | [OpenStreetMap](https://www.openstreetmap.org/) (Overpass, Geofabrik) | Also the basemap |
| Building footprints | [Overture Maps](https://overturemaps.org/), Microsoft footprints | National coverage |
| Transit | GTFS feeds (agency sites, [Mobility Database](https://mobilitydatabase.org/)) | Stops, routes and frequency |
| Opportunity zones | [CDFI Fund](https://www.cdfifund.gov/opportunity-zones) | Tract list |
| Evictions | [Eviction Lab](https://evictionlab.org/) | Filings by area |
| Local permits, parcels, zoning | City open data portals (e.g. [OpenDataPhilly](https://opendataphilly.org/), [WPRDC](https://data.wprdc.org/), NYC Open Data) | The richest source for development stories |

Always record the source URL, the date you downloaded it and the license in the layer's YAML.

## Gaps worth filling next

The course didn't cover these. They matter for real estate:

- **Network accessibility.** True walk and drive times (isochrones) with `osmnx` + `networkx`, or `r5py` for transit. This upgrades every "within X" screen.
- **Heat.** Land surface temperature from Landsat 8/9 thermal bands (also on Planetary Computer). It pairs naturally with NDVI.
- **Change over time.** Imagery or permits differenced across years, with a time slider on the map (a `year` field and a filter).
- **Parcel-level joins.** Joining county assessor parcels to everything above. Show results by parcel only for physical facts, never for owners.
