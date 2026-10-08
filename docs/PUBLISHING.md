# Publishing guide

Every update on the site is a **dataset**: a GeoJSON file in `public/data/` plus a YAML description in `content/layers/`. Site settings live in `content/site.yaml`. `npm run dev` rebuilds on every save. When you deploy, the build checks every file and stops with a clear message if something is off, so a broken dataset never reaches the site.

A published dataset shows up in three places at once:

- the map's **Data** panel,
- the start page's **Latest updates** list (newest first, by `updated`),
- the RSS feed at `/feed.xml`, which email services can turn into the "new data" email.

- [Publish a dataset](#publish-a-dataset)
- [Layer YAML reference](#layer-yaml-reference)
- [Site settings](#site-settings)
- [Before you hit deploy](#before-you-hit-deploy)

---

## Publish a dataset

**1. Shape the data** in Python (or QGIS, or anything that writes GeoPackage or GeoJSON). The toolkit in `pipeline/realinsights/toolkit.py` covers the common jobs: counting points per tract, distance screens, area shares, NDVI, zonal statistics and HAND flood screens. See [DATA_TOOLKIT.md](DATA_TOOLKIT.md).

**2. Publish it.** Either from the command line:

```bash
uv run --project pipeline python pipeline/publish_layer.py result.gpkg --id phl-permits-2025 \
  --title "Building permits, 2025" --source "City of Philadelphia, L&I" \
  --source-url https://opendataphilly.org --color-field value --popup-title address
```

or from a notebook or script:

```python
from realinsights import publish_layer
publish_layer(gdf, id="phl-permits-2025", title="Building permits, 2025",
              source="City of Philadelphia, L&I", color_field="value",
              popup_formats={"value": "money"}, labels={"value": "Permit value"})
```

It writes two files:

- `public/data/<id>.geojson`: WGS84, simplified to about 3 m, coordinates rounded, and only the fields you keep. Aim for under 5 MB per layer; the script warns you if it's bigger.
- `content/layers/<id>.yaml`: the description. It's written once, and re-running the data step **keeps your edits** (pass `overwrite_yaml=True` to regenerate it).

**3. Edit the YAML.** Write a human title, a one-line `dek`, an `about` paragraph with caveats, and labels for the popup.

**4. Deploy.** The dataset appears in the Data panel, at the top of Latest updates, and in the feed. Its own link is `/map/<id>`. It opens the map with the dataset on and flown to, which is good for sharing.

## Layer YAML reference

```yaml
id: phl-permits-2025                 # = file name; lowercase-with-dashes
title: Building permits, 2025        # required
dek: Every permit filed this year, sized by value.
about: >                             # shown when the layer is on; put caveats here
  Includes new construction and major alterations. Values are as declared on the permit.
source:                              # required
  name: City of Philadelphia, Department of Licenses & Inspections
  url: https://opendataphilly.org/datasets/building-permits/
license: Open Data Commons PDDL
updated: 2026-10-05
tags: [permits, philadelphia]
image: https://images.unsplash.com/photo-…?w=640  # optional cover for Latest updates (a URL or /img/file.jpg); a stock city photo otherwise
data: data/phl-permits-2025.geojson  # a file under public/   …or instead:
# tiles: https://example.com/tiles/{z}/{x}/{y}.png   # an XYZ raster (e.g. a flood-depth or NDVI tile set)
# bbox: [-75.28, 39.87, -74.95, 40.14]               # for raster tiles, so "Go to" knows where
place: { lng: -75.16, lat: 39.95, zoom: 11.5 }       # optional: where "Go to" flies (default: the data's extent)

style:
  type: circle          # fill · extrusion · line · circle · heatmap · raster (default: from the geometry)
  color: "#7c3aed"      # one color, or:
  # color: { field: value, stops: [[0, "#fdf4e3"], [1000000, "#cc5234"]] }       # smooth ramp
  # color: { field: value, breaks: [1e5, 1e6], colors: ["#fdf4e3", "#f6b26b", "#8f2d2a"] }   # steps
  # color: { field: type, categories: { New: "#7c3aed", Alteration: "#3a9163" }, other: "#e7e5e4" }
  radius: { field: value, stops: [[0, 3], [5000000, 14]] }   # circles: a number or a ramp
  height: { field: stories, scale: 3.5 }                     # extrusion: meters per unit
  opacity: 0.8
  outline: "#ffffff"    # fills and circles
  width: 2.5            # lines

legend: { title: Permit value, format: money }
popup:
  title: address        # the field shown as the popup heading
  fields:
    - { field: value, label: Permit value, format: money }
    - { field: filed, label: Filed, format: text }
```

**Formats** are used in popups and legends: `money` ($1,250), `number` (1,250), `decimal` (1,250.25), `percent` (0.125 → 12.5%), `percent100` (12.5 → 12.5%), `year`, and `text`.

**Palettes** that match the site (VisionPitts' ramps): warm `#fdf4e3 #fbdcaa #f6b26b #e9824a #cc5234 #8f2d2a` and green `#f3f8ec #d6ebc4 #a8d59a #6fb87a #3a9163 #1d5f48`. For "less vs more" use warm. For green space, water or "good" use green. Single-color layers use violet `#7c3aed`. Avoid red–green pairs.

## Site settings

`content/site.yaml` holds the title, tagline, the public URL (used by the RSS feed and the sitemap), where the map lands when opened (`home`), footer links, and the **subscribe gate**:

| `gate:` | Without subscribing, a reader can… |
|---|---|
| `map` *(default)* | see the start page; "Open the map" goes to Subscribe first, then straight into the map |
| `data` | open the map; turning on a dataset or downloading goes to Subscribe first |
| `off` | see everything |

`launched: false` is the pre-launch state: "Explore map" and "Insights" show the Coming soon page and Subscribe is a wait-list. Set it to `true` to open them (also locally, while you work on a dataset).

It's a friendly ask, not security: the data files are public, and the agent can still talk about everything. After one sign-up, the browser remembers and never asks again.

## Before you hit deploy

- [ ] `updated` is today's date, so the dataset tops Latest updates.
- [ ] Each layer's `source`, `license` and caveats (in `about`) are filled in.
- [ ] The title and `dek` read well as a row on the start page.
- [ ] The colors make sense, and the legend title and units are right.
- [ ] Clicking a shape shows labeled, formatted figures (`popup`).
- [ ] Nothing identifies a person.
- [ ] `npm run build` passes.
- [ ] After deploy: open `/map/<id>`, then ask the assistant one question about the new dataset.
