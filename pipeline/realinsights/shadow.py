"""Urban shadow analysis from a digital surface model (MUSA 6950, lab 5 and assignment 3).

For each pixel, follow a ray toward the sun. If a higher point of the DSM blocks the ray, the pixel is in shadow.
The steps, in order:

    read_dsm               the DSM as float32, its cell size, its metadata, and the lat/lon of its center
    sun_position           sun elevation and azimuth for a place and time (NOAA Solar Calculator equations)
    hourly_sun_positions   the (hour, elevation, azimuth) list for one day, e.g. 8 am to 5 pm
    shadow_gpu             the PyCUDA kernel from class (needs an NVIDIA GPU, e.g. Colab)
    shadow_cpu             the same ray test in NumPy, for machines without a GPU (gives the same answer)
    save_png / make_gif / save_geotiff    the outputs: hourly maps, the GIF of the day, 0/1 rasters
    shadow_day             everything above in one call, plus a summary CSV of the shadow share per hour

Units: heights and pixel size must be in the same unit (Philadelphia's DSM is EPSG:2272, feet for both).
`max_distance` is in that unit too. The DSM must be in a projected CRS, never degrees (the lab 2 rule).
Use a DSM (buildings and trees included), not a bare-earth DEM: a DEM has no buildings to cast shadows.
"""
from __future__ import annotations

import math
from datetime import date as Date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

# The kernel from class. The only change: the 2,000-unit tracing limit is a parameter (max_distance).
KERNEL_SHADOW = """
#define PI 3.1415926

__global__ void calculate_shadow(float *dsm, bool *shadow, int width, int height, float cell_size, float sun_azimuth, float sun_elevation, float max_distance) {
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    // Check if the thread is within the bounds of the image
    if (x >= width || y >= height)
        return;

    int idx = y * width + x;

    // Convert sun azimuth and elevation to radians
    float azimuth_rad = sun_azimuth * 3.14159 / 180.0;
    float elevation_rad = sun_elevation * 3.14159 / 180.0;

    // Direction of the shadow ray based on sun azimuth
    float dx = sin(azimuth_rad);
    float dy = -cos(azimuth_rad); //because the azimuth start from the north, clockwise; image rows grow southward
    float dz = tan(elevation_rad);

    // Initial height at the current pixel
    float initial_height = dsm[idx];
    bool in_shadow = false;

    // Trace the shadow ray
    for (float t = cell_size; t < max_distance; t += cell_size) { // Limit tracing distance
        int x_offset = x + int(dx * t / cell_size);
        int y_offset = y + int(dy * t / cell_size);

        if (x_offset < 0 || x_offset >= width || y_offset < 0 || y_offset >= height)
            break;  // Out of bounds

        int offset_idx = y_offset * width + x_offset;

        // Calculate height along the ray
        float height_along_ray = initial_height + dz * t;

        // Check if there is a higher point along the path
        if (dsm[offset_idx] > height_along_ray) {
            in_shadow = true;
            break;
        }
    }

    // Store shadow result: 1 for shadow, 0 for no shadow
    shadow[idx] = in_shadow;
}
"""


# ------------------------------------------------------------------ 1. the DSM
def read_dsm(path: str | Path):
    """Returns (dsm float32 with nodata as NaN, cell_size, rasterio meta, (lat, lon) of the center)."""
    import rasterio
    from pyproj import Transformer

    with rasterio.open(path) as src:
        if src.crs is None or src.crs.is_geographic:
            raise ValueError(f"{path} is in {src.crs}; reproject the DSM to a projected CRS (meters or feet) first")
        dsm = src.read(1).astype("float32")
        if src.nodata is not None:
            dsm[dsm == src.nodata] = np.nan
        cell_size = float(src.transform[0])
        if not math.isclose(cell_size, -src.transform[4], rel_tol=1e-6):
            raise ValueError("the kernel assumes square pixels; resample the DSM first")
        cx = (src.bounds.left + src.bounds.right) / 2
        cy = (src.bounds.bottom + src.bounds.top) / 2
        lon, lat = Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True).transform(cx, cy)
        meta = src.meta.copy()
    return dsm, cell_size, meta, (lat, lon)


# ------------------------------------------------------------------ 2. sun positions
def sun_position(lat: float, lon: float, when: datetime) -> tuple[float, float]:
    """(elevation, azimuth) in degrees for a timezone-aware datetime, as the NOAA Solar Calculator reports them.

    Implements NOAA's solar position equations (gml.noaa.gov/grad/solcalc/calcdetails.html), with the
    atmospheric refraction correction. Azimuth is clockwise from north. Longitude is negative west of Greenwich.
    """
    if when.tzinfo is None:
        raise ValueError("pass a timezone-aware datetime, e.g. datetime(2026, 10, 5, 8, tzinfo=ZoneInfo('America/New_York'))")
    utc = when.astimezone(timezone.utc)
    jd = utc.timestamp() / 86400.0 + 2440587.5
    jc = (jd - 2451545.0) / 36525.0
    rad, deg = math.radians, math.degrees

    l0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360           # geometric mean longitude of the sun
    m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)                     # geometric mean anomaly
    e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)                # eccentricity of earth's orbit
    c = (math.sin(rad(m)) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
         + math.sin(rad(2 * m)) * (0.019993 - 0.000101 * jc)
         + math.sin(rad(3 * m)) * 0.000289)                                  # equation of center
    app_long = l0 + c - 0.00569 - 0.00478 * math.sin(rad(125.04 - 1934.136 * jc))
    obliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
    obliq += 0.00256 * math.cos(rad(125.04 - 1934.136 * jc))
    decl = deg(math.asin(math.sin(rad(obliq)) * math.sin(rad(app_long))))
    y = math.tan(rad(obliq / 2)) ** 2
    eq_time = 4 * deg(y * math.sin(2 * rad(l0)) - 2 * e * math.sin(rad(m))
                      + 4 * e * y * math.sin(rad(m)) * math.cos(2 * rad(l0))
                      - 0.5 * y * y * math.sin(4 * rad(l0)) - 1.25 * e * e * math.sin(2 * rad(m)))  # minutes

    minutes_utc = utc.hour * 60 + utc.minute + utc.second / 60 + utc.microsecond / 6e7
    true_solar = (minutes_utc + eq_time + 4 * lon) % 1440
    hour_angle = true_solar / 4 + 180 if true_solar < 0 else true_solar / 4 - 180

    cos_zen = (math.sin(rad(lat)) * math.sin(rad(decl))
               + math.cos(rad(lat)) * math.cos(rad(decl)) * math.cos(rad(hour_angle)))
    zenith = deg(math.acos(max(-1.0, min(1.0, cos_zen))))
    elev = 90 - zenith

    if elev > 85:
        refr = 0.0
    elif elev > 5:
        t = math.tan(rad(elev))
        refr = 58.1 / t - 0.07 / t**3 + 0.000086 / t**5
    elif elev > -0.575:
        refr = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)))
    else:
        refr = -20.772 / math.tan(rad(elev))
    elev += refr / 3600

    cos_az = ((math.sin(rad(lat)) * math.cos(rad(zenith))) - math.sin(rad(decl))) / (math.cos(rad(lat)) * math.sin(rad(zenith)))
    az = deg(math.acos(max(-1.0, min(1.0, cos_az))))
    azimuth = (az + 180) % 360 if hour_angle > 0 else (540 - az) % 360
    return elev, azimuth


def hourly_sun_positions(lat: float, lon: float, day: str | Date, tz: str, hours=range(8, 18)) -> list[tuple[int, float, float]]:
    """[(hour, elevation, azimuth), ...] in local clock time (daylight saving handled by `tz`, e.g. 'America/New_York')."""
    day = Date.fromisoformat(day) if isinstance(day, str) else day
    zone = ZoneInfo(tz)
    out = []
    for hour in hours:
        elev, az = sun_position(lat, lon, datetime(day.year, day.month, day.day, hour, tzinfo=zone))
        out.append((hour, round(elev, 2), round(az, 2)))
    return out


# ------------------------------------------------------------------ 3. the shadow
_gpu_kernel = None


def shadow_gpu(dsm: np.ndarray, cell_size: float, sun_azimuth: float, sun_elevation: float, max_distance: float = 2000.0) -> np.ndarray:
    """Boolean shadow map (True = shadow) from the PyCUDA kernel, launched on 16 x 16 blocks as in class."""
    global _gpu_kernel
    import pycuda.autoinit  # noqa: F401
    import pycuda.driver as cuda
    from pycuda.compiler import SourceModule

    if _gpu_kernel is None:
        _gpu_kernel = SourceModule(KERNEL_SHADOW).get_function("calculate_shadow")
    dsm = np.ascontiguousarray(dsm, dtype=np.float32)
    height, width = dsm.shape
    block_size = (16, 16, 1)
    grid_size = (int(np.ceil(width / block_size[0])), int(np.ceil(height / block_size[1])))

    d_dsm = cuda.mem_alloc(dsm.nbytes)
    d_shadow = cuda.mem_alloc(dsm.nbytes)
    cuda.memcpy_htod(d_dsm, dsm)
    _gpu_kernel(d_dsm, d_shadow, np.int32(width), np.int32(height), np.float32(cell_size),
                np.float32(sun_azimuth), np.float32(sun_elevation), np.float32(max_distance),
                block=block_size, grid=grid_size)
    shadow = np.zeros_like(dsm, dtype=bool)
    cuda.memcpy_dtoh(shadow, d_shadow)
    d_dsm.free()
    d_shadow.free()
    return shadow


def shadow_cpu(dsm: np.ndarray, cell_size: float, sun_azimuth: float, sun_elevation: float, max_distance: float = 2000.0) -> np.ndarray:
    """The kernel's ray test in NumPy: one step along the ray at a time, for every pixel at once.

    Same steps, offsets (truncated toward zero, like C's int()) and stop rules as the GPU kernel, so the maps match.
    A Philadelphia tile (2,600 x 2,600) takes a few seconds per hour on a laptop.
    """
    dsm = np.asarray(dsm, dtype=np.float32)
    height, width = dsm.shape
    az = np.float32(sun_azimuth * 3.14159 / 180.0)
    el = np.float32(sun_elevation * 3.14159 / 180.0)
    dx, dy, dz = np.sin(az), -np.cos(az), np.tan(el)
    cs = np.float32(cell_size)

    shadow = np.zeros((height, width), dtype=bool)
    t = cs
    last = None
    while t < max_distance:
        xo = int(dx * t / cs)
        yo = int(dy * t / cs)
        if abs(xo) >= width or abs(yo) >= height:
            break  # every ray has left the tile
        # The same cell again, further along the ray (so higher up): it can't block what the first visit didn't.
        if (xo, yo) != last:
            last = (xo, yo)
            y0, y1 = max(0, -yo), min(height, height - yo)
            x0, x1 = max(0, -xo), min(width, width - xo)
            here = dsm[y0:y1, x0:x1]
            there = dsm[y0 + yo:y1 + yo, x0 + xo:x1 + xo]
            shadow[y0:y1, x0:x1] |= there > here + dz * t
        t = np.float32(t + cs)
    return shadow


def has_gpu() -> bool:
    try:
        import pycuda.driver as cuda

        cuda.init()
        return cuda.Device.count() > 0
    except Exception:
        return False


# ------------------------------------------------------------------ 4. outputs
def save_png(shadow: np.ndarray, hour: int, path: str | Path) -> Path:
    """Black = shadow, white = sun, titled 'Shadow Map - HH:00' (the assignment's style)."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 6))
    ax.imshow(shadow == 0, cmap="gray")
    ax.set_title("Shadow Map - %02d:00" % hour)
    ax.axis("off")
    plt.savefig(path, bbox_inches="tight", dpi=150)
    plt.close(fig)
    return Path(path)


def make_gif(png_files: list[Path], path: str | Path, fps: float = 1) -> Path:
    import imageio.v2 as imageio

    imageio.mimsave(path, [imageio.imread(p) for p in png_files], fps=fps, loop=0)
    return Path(path)


def save_geotiff(shadow: np.ndarray, dsm_meta: dict, path: str | Path) -> Path:
    """1 = shadow, 0 = no shadow, on the DSM's grid (its metadata with one uint8 band)."""
    import rasterio

    meta = dsm_meta.copy()
    meta.update({"driver": "GTiff", "count": 1, "dtype": "uint8", "nodata": None, "compress": "lzw"})
    with rasterio.open(path, "w", **meta) as dst:
        dst.write(shadow.astype(np.uint8), 1)
    return Path(path)


# ------------------------------------------------------------------ 5. one call
def shadow_day(dsm_path: str | Path, day: str | Date, tz: str, out_dir: str | Path, hours=range(8, 18),
               sun_positions: list[tuple[int, float, float]] | None = None, lat: float | None = None, lon: float | None = None,
               backend: str = "auto", max_distance: float = 2000.0, geotiff: bool = True) -> pd.DataFrame:
    """Shadow maps for each hour of one day: shadow_HH.png (+ .tif), shadow_distribution_day.gif and summary.csv.

    Sun positions are computed for the DSM's center unless you pass `sun_positions` (e.g. copied from the NOAA
    website) or `lat`/`lon`. Hours with the sun below the horizon are skipped. `backend`: 'auto', 'gpu' or 'cpu'.
    Returns the summary table: hour, sun elevation, sun azimuth, share of the area in shadow.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    dsm, cell_size, meta, (clat, clon) = read_dsm(dsm_path)
    lat = clat if lat is None else lat
    lon = clon if lon is None else lon
    if sun_positions is None:
        sun_positions = hourly_sun_positions(lat, lon, day, tz, hours)
    if backend == "auto":
        backend = "gpu" if has_gpu() else "cpu"
    run = shadow_gpu if backend == "gpu" else shadow_cpu

    rows, pngs = [], []
    valid = np.isfinite(dsm)
    for hour, sunele, azimuth in sun_positions:
        if sunele <= 0:
            print("Hour %02d:00: the sun is below the horizon (%.1f°), skipped" % (hour, sunele))
            continue
        shadow = run(dsm, cell_size, azimuth, sunele, max_distance)
        share = float(shadow[valid].mean())
        print("Hour %02d:00 (Elev: %s, Azim: %s), %.1f%% of the area is in shadow" % (hour, sunele, azimuth, share * 100))
        pngs.append(save_png(shadow, hour, out_dir / ("shadow_%02d.png" % hour)))
        if geotiff:
            save_geotiff(shadow, meta, out_dir / ("shadow_%02d.tif" % hour))
        rows.append({"hour": hour, "sun_elevation": sunele, "sun_azimuth": azimuth, "shadow_share": round(share, 4)})

    if pngs:
        make_gif(pngs, out_dir / "shadow_distribution_day.gif")
    summary = pd.DataFrame(rows)
    summary.attrs = {"date": str(day), "tz": tz, "lat": lat, "lon": lon, "backend": backend, "cell_size": cell_size}
    summary.to_csv(out_dir / "summary.csv", index=False)
    return summary
