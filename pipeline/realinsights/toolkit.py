"""The spatial toolkit: methods from MUSA 6950 (AI for Urban Sustainability, UPenn), made reusable.

Vector (geopandas, always installed):
    count_points_in_polygons   permits / sales / crashes / 311 calls per tract       (lab 2: sjoin → groupby → merge)
    within_distance            "within 0.5 mi of a station", measured in a projected CRS (lab 2: buffers in feet)
    area_share                 share of each polygon covered by another layer (flood zone, park, zoning district)
Raster (pip install -e '.[raster]'):
    naip_items                 find 60 cm NAIP aerial imagery for an area (lab 3: Planetary Computer STAC)
    ndvi                       vegetation index from a 4-band NAIP scene (lab 3)
    zonal_mean                 average a raster inside each polygon, e.g. NDVI per tract (lab 3)
    usgs_dem_tiles             USGS 3DEP 1-arc-second elevation tiles for a bounding box (lab 4)
    hand_inundation            Height Above Nearest Drainage flood screen from a DEM (lab 4: pysheds)

Every function takes and returns plain GeoDataFrames / arrays so steps chain, and each says what CRS it works in.
Rule of thumb from lab 2: never buffer or measure in degrees. Project first (estimate_utm_crs() or a State Plane).
"""
from __future__ import annotations

import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd


# ------------------------------------------------------------------ vector
def count_points_in_polygons(points: gpd.GeoDataFrame, polygons: gpd.GeoDataFrame, key: str = "GEOID", name: str = "count") -> gpd.GeoDataFrame:
    """Number of points inside each polygon (0 where none). Both layers are brought to the polygons' CRS."""
    pts = points.to_crs(polygons.crs)
    joined = gpd.sjoin(pts[[pts.geometry.name]], polygons[[key, polygons.geometry.name]], predicate="within", how="inner")
    counts = joined.groupby(key).size().rename(name)
    out = polygons.merge(counts, left_on=key, right_index=True, how="left")
    out[name] = out[name].fillna(0).astype(int)
    return out


def within_distance(features: gpd.GeoDataFrame, targets: gpd.GeoDataFrame, meters: float, name: str = "near") -> gpd.GeoDataFrame:
    """Flags each feature that lies within `meters` of any target, and adds the distance (m) to the nearest target."""
    crs = features.estimate_utm_crs()
    f = features.to_crs(crs)
    t = targets.to_crs(crs)
    nearest = gpd.sjoin_nearest(f[[f.geometry.name]], t[[t.geometry.name]], how="left", distance_col="_d")
    d = nearest.groupby(level=0)["_d"].min()
    out = features.copy()
    out[f"{name}_m"] = d.round(1)
    out[name] = out[f"{name}_m"] <= meters
    return out


def area_share(polygons: gpd.GeoDataFrame, cover: gpd.GeoDataFrame, key: str = "GEOID", name: str = "share") -> gpd.GeoDataFrame:
    """Share (0–1) of each polygon's area that `cover` overlaps, computed in a local equal-distance projection."""
    crs = polygons.estimate_utm_crs()
    p = polygons[[key, polygons.geometry.name]].to_crs(crs)
    c = cover.to_crs(crs)
    c = gpd.GeoDataFrame(geometry=[c.union_all()], crs=crs)
    inter = gpd.overlay(p, c, how="intersection", keep_geom_type=True)
    covered = inter.assign(_a=inter.area).groupby(key)["_a"].sum()
    total = p.set_index(key).area
    out = polygons.copy()
    out[name] = out[key].map((covered / total).clip(0, 1)).fillna(0).round(4)
    return out


# ------------------------------------------------------------------ raster
def naip_items(aoi: gpd.GeoDataFrame, start: str = "2020-01-01", end: str = "2024-12-31"):
    """NAIP scenes covering an area of interest, newest first (signed URLs, ready for rasterio)."""
    import planetary_computer as pc
    from pystac_client import Client

    cat = Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)
    geom = aoi.to_crs("EPSG:4326").union_all().__geo_interface__
    items = cat.search(collections=["naip"], intersects=geom, datetime=f"{start}/{end}").item_collection()
    return sorted(items, key=lambda i: i.datetime, reverse=True)


def ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """(NIR − Red) / (NIR + Red). NAIP band order is R, G, B, NIR (bands 1 and 4). > 0.2 is usually vegetation."""
    red = red.astype("float32")
    nir = nir.astype("float32")
    return (nir - red) / (nir + red + 1e-6)


def zonal_mean(raster_path: str | Path, polygons: gpd.GeoDataFrame, name: str = "mean", band: int = 1) -> gpd.GeoDataFrame:
    """Mean of a raster band inside each polygon (nodata ignored). Polygons are reprojected to the raster's CRS."""
    import rasterio
    from rasterio.mask import mask

    out = polygons.copy()
    vals = []
    with rasterio.open(raster_path) as src:
        polys = polygons.to_crs(src.crs)
        for geom in polys.geometry:
            try:
                arr, _ = mask(src, [geom.__geo_interface__], crop=True, indexes=band, filled=True, nodata=np.nan if src.dtypes[0].startswith("float") else src.nodata)
                a = arr.astype("float32")
                if src.nodata is not None:
                    a[a == src.nodata] = np.nan
                vals.append(float(np.nanmean(a)) if np.isfinite(a).any() else np.nan)
            except ValueError:  # polygon outside the raster
                vals.append(np.nan)
    out[name] = pd.Series(vals, index=out.index).round(4)
    return out


def usgs_dem_tiles(west: float, south: float, east: float, north: float) -> list[str]:
    """URLs of USGS 3DEP 1-arc-second (~30 m) GeoTIFF tiles covering a bounding box (tiles are named by their NW corner)."""
    urls = []
    for lat in range(math.floor(south) + 1, math.ceil(north) + 1):
        for lon in range(math.floor(west), math.ceil(east)):
            ns = f"n{abs(lat):02d}" if lat >= 0 else f"s{abs(lat):02d}"
            ew = f"w{abs(lon):03d}" if lon < 0 else f"e{abs(lon):03d}"
            tile = f"{ns}{ew}"
            urls.append(f"https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/{tile}/USGS_1_{tile}.tif")
    return urls


def hand_inundation(dem_path: str | Path, out_path: str | Path, stage_m: float = 3.0, channel_cells: int = 200) -> Path:
    """Flood screen: cells whose Height Above Nearest Drainage is below `stage_m` get a depth (stage − HAND).

    Steps (pysheds): fill pits → fill depressions → resolve flats → D8 flow direction → accumulation → HAND.
    This is terrain only: no rainfall, no levees, no storm sewers. Present it as a screen, next to FEMA zones.
    """
    import rasterio
    from pysheds.grid import Grid

    grid = Grid.from_raster(str(dem_path))
    dem = grid.read_raster(str(dem_path))
    dem = grid.resolve_flats(grid.fill_depressions(grid.fill_pits(dem)))
    fdir = grid.flowdir(dem)
    acc = grid.accumulation(fdir)
    hand = grid.compute_hand(fdir, dem, acc > channel_cells)
    h = np.asarray(hand, dtype="float32")
    depth = np.where(h < stage_m, stage_m - h, np.nan).astype("float32")
    with rasterio.open(dem_path) as src:
        meta = src.meta.copy()
    meta.update(count=1, dtype="float32", nodata=np.nan, compress="lzw")
    out_path = Path(out_path)
    with rasterio.open(out_path, "w", **meta) as dst:
        dst.write(depth, 1)
    return out_path
