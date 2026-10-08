"""US Census helpers: ACS tables from the Census API and boundaries from TIGERweb (both free).

Needs CENSUS_API_KEY in the repo-root .env (https://api.census.gov/data/key_signup.html).
Small-area ACS figures are estimates with margins of error; fetch the matching *_M variables when it matters.
"""
from __future__ import annotations

import os

import geopandas as gpd
import pandas as pd
import requests
from dotenv import load_dotenv

from .paths import ROOT

load_dotenv(ROOT / ".env")

ACS_NULLS = {-666666666, -999999999, -888888888, -222222222, -333333333, -555555555}

# TIGERweb layer ids (current vintage). See https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer
TIGER_LAYERS = {"tract": 8, "block group": 10, "county": 82, "place": 28, "zcta": 2}


def acs(variables: list[str], geography: str, state: str, county: str | None = None, year: int = 2023, dataset: str = "acs/acs5") -> pd.DataFrame:
    """ACS estimates for every `geography` ("tract", "block group", "county", "place", ...) in a state or county.

    Returns one row per area with a GEOID column and one numeric column per variable (Census null codes → NaN).
    """
    key = os.environ.get("CENSUS_API_KEY")
    params = {"get": ",".join(["NAME", *variables]), "for": f"{geography}:*"}
    params["in"] = f"state:{state}" + (f" county:{county}" if county else "")
    if key:
        params["key"] = key
    r = requests.get(f"https://api.census.gov/data/{year}/{dataset}", params=params, timeout=60)
    r.raise_for_status()
    rows = r.json()
    df = pd.DataFrame(rows[1:], columns=rows[0])
    geo_cols = [c for c in ["state", "county", "tract", "block group", "place"] if c in df.columns]
    df["GEOID"] = df[geo_cols].astype(str).agg("".join, axis=1)
    for v in variables:
        df[v] = pd.to_numeric(df[v], errors="coerce")
        df.loc[df[v].isin(ACS_NULLS), v] = pd.NA
    return df.drop(columns=geo_cols)


def tiger(geography: str, state: str, county: str | None = None) -> gpd.GeoDataFrame:
    """Boundaries from TIGERweb as a GeoDataFrame in EPSG:4326, with a GEOID column (pages through big requests)."""
    layer = TIGER_LAYERS[geography]
    where = f"STATE='{state}'" + (f" AND COUNTY='{county}'" if county else "")
    url = f"https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/{layer}/query"
    frames, offset = [], 0
    while True:
        params = {"where": where, "outFields": "GEOID,NAME,AREALAND,AREAWATER", "outSR": 4326, "f": "geojson", "resultOffset": offset, "resultRecordCount": 1000}
        r = requests.get(url, params=params, timeout=120)
        r.raise_for_status()
        gj = r.json()
        feats = gj.get("features", [])
        if not feats:
            break
        frames.append(gpd.GeoDataFrame.from_features(feats, crs="EPSG:4326"))
        if len(feats) < 1000:
            break
        offset += len(feats)
    if not frames:
        raise RuntimeError(f"TIGERweb returned no {geography} for {where}")
    return gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs="EPSG:4326")
