"""publish_layer(): the one way data gets onto the site.

It writes two files:
  public/data/<id>.geojson     the data, WGS84, simplified, coordinates rounded, only the fields you keep
  content/layers/<id>.yaml     the description the site and the agent read (title, source, style, popup)

The YAML is written only if it does not exist yet (or overwrite_yaml=True), so your hand edits to the
description and style survive re-running the data step.
"""
from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import yaml

from .paths import EXAMPLE_LAYERS, LAYERS, PUBLIC_DATA

# The VisionPitts ramps. WARM for "more" (rent, value, counts); SEA (green) for green space, water or "good".
WARM = ["#fdf4e3", "#fbdcaa", "#f6b26b", "#e9824a", "#cc5234", "#8f2d2a"]
SEA = ["#f3f8ec", "#d6ebc4", "#a8d59a", "#6fb87a", "#3a9163", "#1d5f48"]


def _round_coords(geom_json: dict, digits: int) -> dict:
    def rnd(c):
        if isinstance(c, (int, float)):
            return round(c, digits)
        return [rnd(x) for x in c]

    geom_json["coordinates"] = rnd(geom_json["coordinates"])
    return geom_json


def _clean_value(v):
    if v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return None if math.isnan(v) or math.isinf(v) else round(float(v), 6)
    if isinstance(v, (pd.Timestamp, dt.date)):
        return v.isoformat()[:10]
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def quantile_stops(values: pd.Series, colors: list[str]) -> list[list]:
    """Evenly spaced quantile stops for a ramp, rounded to friendly numbers."""
    v = pd.to_numeric(values, errors="coerce").dropna()
    if v.empty:
        return [[0, colors[0]], [1, colors[-1]]]
    qs = np.linspace(0.02, 0.98, len(colors))
    raw = np.quantile(v, qs)
    span = float(raw[-1] - raw[0]) or 1.0
    step = 10 ** math.floor(math.log10(span / 10)) if span > 0 else 1
    stops, last = [], None
    for q, c in zip(raw, colors):
        x = round(float(q) / step) * step
        x = int(x) if float(x).is_integer() else round(x, 4)
        if last is not None and x <= last:
            continue
        stops.append([x, c])
        last = x
    return stops


def publish_layer(
    gdf: gpd.GeoDataFrame,
    id: str,
    title: str,
    source: str,
    source_url: str | None = None,
    dek: str = "",
    about: str = "",
    fields: list[str] | None = None,
    color_field: str | None = None,
    palette: list[str] | None = None,
    style_type: str | None = None,
    height_field: str | None = None,
    height_scale: float = 1.0,
    popup_title: str | None = None,
    popup_formats: dict[str, str] | None = None,
    labels: dict[str, str] | None = None,
    license: str | None = None,
    tags: list[str] | None = None,
    simplify_m: float | None = 3.0,
    digits: int = 6,
    example: bool = False,
    overwrite_yaml: bool = False,
) -> tuple[Path, Path]:
    """Write a GeoDataFrame as a site layer. Returns (geojson path, yaml path).

    simplify_m   tolerance in meters (done in a local projected CRS, so it is real distance). None = keep as is.
    digits       coordinate decimals; 6 ≈ 10 cm, 5 ≈ 1 m. Fewer digits, smaller files.
    """
    if gdf.crs is None:
        raise ValueError("The data has no CRS. Set it first, e.g. gdf = gdf.set_crs('EPSG:4326').")
    if not id.replace("-", "").isalnum() or id != id.lower():
        raise ValueError("id must be lowercase letters, numbers and dashes")
    g = gdf[[*(fields or [c for c in gdf.columns if c != gdf.geometry.name]), gdf.geometry.name]].copy()
    g = g[g.geometry.notna() & ~g.geometry.is_empty]

    if simplify_m:
        local = g.estimate_utm_crs()
        g = g.to_crs(local)
        g[g.geometry.name] = g.geometry.simplify(simplify_m, preserve_topology=True)
    g = g.to_crs("EPSG:4326")

    features = []
    for _, row in g.iterrows():
        props = {k: _clean_value(row[k]) for k in g.columns if k != g.geometry.name}
        features.append({"type": "Feature", "properties": props, "geometry": _round_coords(row.geometry.__geo_interface__, digits)})
    fc = {"type": "FeatureCollection", "features": features}

    sub = Path("examples") if example else Path()
    data_path = PUBLIC_DATA / sub / f"{id}.geojson"
    data_path.parent.mkdir(parents=True, exist_ok=True)
    data_path.write_text(json.dumps(fc, separators=(",", ":")))

    yaml_dir = EXAMPLE_LAYERS if example else LAYERS
    yaml_path = yaml_dir / f"{id}.yaml"
    yaml_dir.mkdir(parents=True, exist_ok=True)
    wrote_yaml = overwrite_yaml or not yaml_path.exists()
    if wrote_yaml:
        geom = g.geometry.iloc[0].geom_type.replace("Multi", "") if len(g) else "Polygon"
        stype = style_type or {"Point": "circle", "LineString": "line"}.get(geom, "fill")
        style: dict = {"type": stype}
        if color_field:
            style["color"] = {"field": color_field, "stops": quantile_stops(g[color_field], palette or WARM)}
        else:
            style["color"] = "#7c3aed"
        if stype == "extrusion" and height_field:
            style["height"] = {"field": height_field, "scale": height_scale}
        fmt = popup_formats or {}
        lab = labels or {}
        doc = {
            "id": id,
            "title": title,
            "dek": dek,
            "about": about,
            "source": {"name": source, **({"url": source_url} if source_url else {})},
            "license": license,
            "updated": dt.date.today().isoformat(),
            "tags": tags or [],
            "data": f"data/{sub.as_posix() + '/' if example else ''}{id}.geojson",
            "style": style,
            "legend": {"title": lab.get(color_field, color_field), "format": fmt.get(color_field, "number")} if color_field else None,
            "popup": {
                "title": popup_title,
                "fields": [{"field": f, "label": lab.get(f, f), "format": fmt.get(f, "number" if pd.api.types.is_numeric_dtype(g[f]) else "text")} for f in g.columns if f != g.geometry.name and f != popup_title],
            },
        }
        yaml_path.write_text(yaml.safe_dump({k: v for k, v in doc.items() if v not in (None, "", [])}, sort_keys=False, allow_unicode=True))

    size = data_path.stat().st_size
    print(f"✓ {id}: {len(features)} features, {size / 1024:.0f} KB → {data_path.relative_to(PUBLIC_DATA.parents[1])}")
    if size > 5 * 1024**2:
        print("  ! over 5 MB: raise simplify_m, lower digits, drop fields, or split by area")
    print(f"  description → {yaml_path.relative_to(PUBLIC_DATA.parents[1])}{'' if wrote_yaml else ' (already existed; your edits kept)'}")
    return data_path, yaml_path
