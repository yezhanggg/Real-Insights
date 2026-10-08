"""HAND inundation mapping from USGS elevation tiles (MUSA 6950, lab 4 and assignment 2).

Height Above Nearest Drainage (HAND) is how far each cell sits above the stream it drains to. With a constant
channel water depth (the "stage", e.g. 5 m), every cell whose HAND is below the stage floods, to a depth of
stage − HAND. The steps, in order:

    tiles_in_bbox          USGS 1-arc-second tile names for a bounding box (get_tile_name / get_tiles_in_bbox from class)
    download_dem_1arc      download one tile from USGS TNM (from class; skips tiles already on disk)
    hand_depth             the pysheds sequence: fill pits → fill depressions → resolve flats → flow direction →
                           accumulation → HAND → depth where HAND < stage
    inundation_tile        hand_depth for one DEM file, written as a float32 GeoTIFF (NaN = dry)
    mosaic                 merge GeoTIFFs into one (rasterio.merge, lab 3)
    clip_to_boundary       mask a raster to a boundary and crop (rasterio.mask, lab 3)
    depth_map / depth_histogram / summarize    the map, the depth classes and the inundated area
    inundation_area        everything above in one call, for a city, county or state boundary

Elevation is in meters and the tiles are in EPSG:4269 (degrees), as USGS ships them.
This is a terrain screen: no rainfall, levees, flood walls or storm sewers. Show it next to FEMA flood zones.
"""
from __future__ import annotations

import math
import os
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

DIRMAP = (64, 128, 1, 2, 4, 8, 16, 32)  # D8 flow directions: N, NE, E, SE, S, SW, W, NW
USGS_1ARC = "https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current"


# ------------------------------------------------------------------ 1. which tiles
def get_tile_name(lat: float, lon: float) -> str:
    """The USGS tile name, e.g. 'n40w076'. Tiles are named by their north-west corner."""
    lat_tile = f"n{int(abs(lat)):02d}" if lat >= 0 else f"s{int(abs(lat)):02d}"
    lon_tile = f"w{int(abs(lon)):03d}" if lon < 0 else f"e{int(abs(lon)):03d}"
    return f"{lat_tile}{lon_tile}"


def tiles_in_bbox(west: float, south: float, east: float, north: float) -> list[str]:
    """Tile names covering a bounding box (degrees). Tile n40w076 covers 39–40° N and 76–75° W.

    Same naming as class; the loop bounds are worked out from the box so you don't have to (for Pennsylvania,
    39.7–42.3° N and 80.5–74.7° W, it returns the class's get_tiles_in_bbox(40, 43, -81, -75) tiles).
    """
    tiles = []
    for lat in range(math.floor(south) + 1, math.ceil(north) + 1):        # NW-corner latitude
        for lon in range(math.floor(west), math.ceil(east)):               # NW-corner longitude
            tiles.append(get_tile_name(lat, lon))
    return tiles


def download_dem_1arc(tile_name: str, save_path: str | Path = ".") -> Path | None:
    """Downloads a 1-arc-second (~30 m) DEM tile from USGS TNM to save_path/<tile>.tif."""
    import requests

    output_file = Path(save_path) / f"{tile_name}.tif"
    if output_file.exists():
        print(f"DEM Tile {tile_name} is already downloaded")
        return output_file
    url = f"{USGS_1ARC}/{tile_name}/USGS_1_{tile_name}.tif"
    response = requests.get(url, stream=True, timeout=300)
    if response.status_code != 200:
        print(f"Error: Tile {tile_name} not found (it may be all ocean). {url}")
        return None
    tmp = output_file.with_suffix(".part")
    with open(tmp, "wb") as file:
        for chunk in response.iter_content(1 << 20):
            file.write(chunk)
    tmp.rename(output_file)
    print(f"DEM Tile {tile_name} downloaded successfully!")
    return output_file


# ------------------------------------------------------------------ 2. HAND
def hand_depth(dem_path: str | Path, stage: float = 5.0, channel_cells: int = 200) -> np.ndarray:
    """Inundation depth (m) where HAND < stage, NaN elsewhere. The pysheds sequence from class.

    channel_cells: a cell is a stream channel when more than this many cells drain into it
    (200 cells of a 30 m DEM ≈ 0.18 km²). HAND is measured on the original DEM, as in class.
    """
    from pysheds.grid import Grid

    grid = Grid.from_raster(str(dem_path))
    dem = grid.read_raster(str(dem_path))

    pit_filled_dem = grid.fill_pits(dem)
    flooded_dem = grid.fill_depressions(pit_filled_dem)
    inflated_dem = grid.resolve_flats(flooded_dem)

    fdir = grid.flowdir(inflated_dem, dirmap=DIRMAP)
    acc = grid.accumulation(fdir, dirmap=DIRMAP)

    hand = grid.compute_hand(fdir, dem, acc > channel_cells)
    hand = np.asarray(hand, dtype="float32")
    return np.where(hand < stage, stage - hand, np.nan).astype("float32")


def inundation_tile(dem_path: str | Path, out_path: str | Path, stage: float = 5.0, channel_cells: int = 200) -> Path:
    """hand_depth for one DEM, saved with the DEM's metadata as float32 (NaN = not inundated)."""
    import rasterio as rio

    depth = hand_depth(dem_path, stage, channel_cells)
    with rio.open(dem_path) as datasource:
        meta = datasource.meta.copy()
    meta.update(driver="GTiff", count=1, dtype=rio.float32, compress="lzw", nodata=np.nan)
    with rio.open(out_path, "w", **meta) as dst:
        dst.write(depth, 1)
    return Path(out_path)


# ------------------------------------------------------------------ 3. mosaic and clip
def mosaic(files: list[str | Path], out_path: str | Path) -> Path:
    """Merge rasters into one GeoTIFF (lab 3 pattern: rasterio.merge + updated meta)."""
    import rasterio
    from rasterio.merge import merge

    srcs = [rasterio.open(f) for f in files]
    data, out_trans = merge(srcs)
    out_meta = srcs[0].meta.copy()
    out_meta.update({"driver": "GTiff", "height": data.shape[1], "width": data.shape[2],
                     "transform": out_trans, "compress": "lzw", "BIGTIFF": "IF_SAFER"})
    for s in srcs:
        s.close()
    with rasterio.open(out_path, "w", **out_meta) as dest:
        dest.write(data)
    return Path(out_path)


def clip_to_boundary(raster_path: str | Path, boundary: gpd.GeoDataFrame, out_path: str | Path) -> Path:
    """Mask a raster to a boundary and crop to it (lab 3 pattern: rasterio.mask with crop=True)."""
    import rasterio
    from rasterio.mask import mask

    with rasterio.open(raster_path) as src:
        shapes = [g.__geo_interface__ for g in boundary.to_crs(src.crs).geometry]
        out_image, out_transform = mask(src, shapes, crop=True)
        out_meta = src.meta.copy()
    out_meta.update({"driver": "GTiff", "height": out_image.shape[1], "width": out_image.shape[2],
                     "transform": out_transform, "compress": "lzw", "BIGTIFF": "IF_SAFER"})
    with rasterio.open(out_path, "w", **out_meta) as dest:
        dest.write(out_image)
    return Path(out_path)


# ------------------------------------------------------------------ 4. results
def summarize(depth_path: str | Path, boundary: gpd.GeoDataFrame) -> dict:
    """Inundated area (km²), share of the boundary's area, mean depth, and the share of pixels in each 1 m class.

    Pixel areas are worked out row by row from latitude (a degree of longitude shrinks going north), so the
    numbers hold for any city, not only Pennsylvania's latitude.
    """
    import rasterio

    with rasterio.open(depth_path) as src:
        d = src.read(1).astype("float32")
        t = src.transform
        if src.crs.is_geographic:
            rows = np.arange(src.height)
            lat = t.f + (rows + 0.5) * t.e
            row_km2 = (abs(t.a) * 111.320 * np.cos(np.radians(lat))) * (abs(t.e) * 110.574)
        else:  # projected: assume meters
            row_km2 = np.full(src.height, abs(t.a * t.e) / 1e6)
    wet = np.isfinite(d)
    area_km2 = float((wet.sum(axis=1) * row_km2).sum())
    boundary_km2 = float(boundary.to_crs(boundary.estimate_utm_crs()).area.sum() / 1e6)
    depths = d[wet]
    classes = np.histogram(depths, bins=[-np.inf, 1, 2, 3, 4, 5, np.inf])[0]  # depth can't be < 0
    return {
        "inundated_km2": round(area_km2, 1),
        "boundary_km2": round(boundary_km2, 1),
        "inundated_share": round(area_km2 / boundary_km2, 4) if boundary_km2 else None,
        "mean_depth_m": round(float(depths.mean()), 2) if depths.size else None,
        "depth_class_share": {lab: round(float(c) / max(1, depths.size), 4)
                              for lab, c in zip(["0-1", "1-2", "2-3", "3-4", "4-5", ">5"], classes)},
    }


def depth_map(depth_path: str | Path, boundary: gpd.GeoDataFrame, out_png: str | Path, stage: float = 5.0, title: str = "") -> Path:
    """Grey area, blue depths (0 → stage), black outline: the assignment's map."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import rasterio

    with rasterio.open(depth_path) as src:
        d = src.read(1)
        b = src.bounds
        crs = src.crs
    bnd = boundary.to_crs(crs)
    w, h = b.right - b.left, b.top - b.bottom
    fig, ax = plt.subplots(figsize=(10, max(4, 10 * h / w)))
    bnd.plot(ax=ax, color="#f2f2f2", zorder=1)
    im = ax.imshow(d, extent=(b.left, b.right, b.bottom, b.top), cmap="Blues", vmin=0, vmax=stage, zorder=2)
    plt.colorbar(im, ax=ax, label="Inundation depth (m)", shrink=0.7)
    bnd.boundary.plot(ax=ax, color="black", linewidth=0.8, zorder=3)
    ax.set_title(title or f"HAND inundation depth (constant channel depth = {stage:g} m)")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    plt.tight_layout()
    plt.savefig(out_png, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return Path(out_png)


def depth_histogram(depth_path: str | Path, out_png: str | Path, stage: float = 5.0) -> Path:
    """Share of inundated pixels in each 1 m depth class (deeper than the stage counts in the top class)."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import rasterio

    with rasterio.open(depth_path) as src:
        d = src.read(1)
    depths = d[np.isfinite(d)]
    bins = list(range(0, int(math.ceil(stage)) + 1))
    fig = plt.figure(figsize=(7, 4))
    counts, edges, _ = plt.hist(np.minimum(depths, stage), bins=bins, color="steelblue", edgecolor="white",
                                weights=np.ones(len(depths)) / max(1, len(depths)) * 100)
    for count, left in zip(counts, edges[:-1]):
        plt.text(left + 0.5, count + 0.5, f"{count:.1f}%", ha="center", fontsize=9)
    plt.xlabel("Inundation depth (m)")
    plt.ylabel("Share of inundated pixels (%)")
    plt.title("Distribution of inundation depth")
    plt.tight_layout()
    plt.savefig(out_png, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return Path(out_png)


# ------------------------------------------------------------------ 5. one call
def inundation_area(boundary: gpd.GeoDataFrame, out_dir: str | Path, name: str = "area", stage: float = 5.0,
                    channel_cells: int = 200, dem_dir: str | Path | None = None, merge_first: bool | None = None) -> dict:
    """The whole workflow for one boundary (a city, county or state). Writes into out_dir:

        dem_tiles/<tile>.tif          downloaded USGS tiles (reused on the next run; or pass dem_dir to share them)
        hand_tiles/<tile>_inundation.tif   per-tile depth (only when the tiles are run one by one)
        <name>_inundation_depth_<stage>m.tif   the result, clipped to the boundary
        <name>_inundation_map.png, <name>_depth_distribution.png, <name>_summary.csv

    merge_first: True mosaics the DEM tiles and clips them to the boundary (plus a 0.05° margin) before HAND,
    so water flows across tile edges; best for a city or county. False runs each tile on its own and mosaics
    the results, as in class; needed for a whole state, which won't fit in memory as one grid.
    Default (None): merge first when the area needs 4 tiles or fewer.
    """
    out_dir = Path(out_dir)
    dem_dir = Path(dem_dir) if dem_dir else out_dir / "dem_tiles"
    dem_dir.mkdir(parents=True, exist_ok=True)
    boundary = boundary.to_crs("EPSG:4269")
    west, south, east, north = boundary.total_bounds
    tiles = tiles_in_bbox(west, south, east, north)
    print("Number of tiles:", len(tiles), tiles)
    dems = [p for p in (download_dem_1arc(t, dem_dir) for t in tiles) if p is not None]
    if merge_first is None:
        merge_first = len(dems) <= 4

    tag = f"{stage:g}m"
    result = out_dir / f"{name}_inundation_depth_{tag}.tif"
    if merge_first:
        dem_mosaic = mosaic(dems, out_dir / f"{name}_dem_mosaic.tif")
        pad = boundary.envelope.buffer(0.05) if len(boundary) == 1 else gpd.GeoSeries([boundary.union_all().envelope.buffer(0.05)], crs=boundary.crs)
        dem_clip = clip_to_boundary(dem_mosaic, gpd.GeoDataFrame(geometry=pad, crs=boundary.crs), out_dir / f"{name}_dem.tif")
        os.remove(dem_mosaic)
        depth_all = inundation_tile(dem_clip, out_dir / f"{name}_inundation_unclipped.tif", stage, channel_cells)
    else:
        hand_dir = out_dir / "hand_tiles"
        hand_dir.mkdir(exist_ok=True)
        outs = []
        for dem in dems:
            out = hand_dir / f"{dem.stem}_inundation.tif"
            if not out.exists():
                inundation_tile(dem, out, stage, channel_cells)
            print(dem.stem, "saved")
            outs.append(out)
        depth_all = mosaic(outs, out_dir / f"{name}_inundation_mosaic.tif")
    clip_to_boundary(depth_all, boundary, result)
    os.remove(depth_all)

    stats = summarize(result, boundary)
    depth_map(result, boundary, out_dir / f"{name}_inundation_map.png", stage,
              f"{name}: HAND inundation depth (constant channel depth = {stage:g} m)")
    depth_histogram(result, out_dir / f"{name}_depth_distribution.png", stage)
    row = {"name": name, "stage_m": stage, "channel_cells": channel_cells, "tiles": len(dems), "merge_first": merge_first,
           **{k: v for k, v in stats.items() if k != "depth_class_share"},
           **{f"share_{k}m": v for k, v in stats["depth_class_share"].items()}}
    pd.DataFrame([row]).to_csv(out_dir / f"{name}_summary.csv", index=False)
    print(f"Inundated area: {stats['inundated_km2']:,.1f} km2 of {stats['boundary_km2']:,.1f} km2 "
          f"({(stats['inundated_share'] or 0) * 100:.1f}%), mean depth {stats['mean_depth_m']} m")
    return {"result": result, **stats}
