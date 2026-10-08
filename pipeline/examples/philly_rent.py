#!/usr/bin/env python3
"""EXAMPLE (development only): Philadelphia census tracts with ACS median gross rent.

It exists to show the whole path, from the Census API to a layer on the map, and to give `npm run dev` something to draw.
It writes to content/examples/ and public/data/examples/, which production builds leave out.

    uv run --project pipeline python pipeline/examples/philly_rent.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from realinsights import publish_layer  # noqa: E402
from realinsights.census import acs, tiger  # noqa: E402

STATE, COUNTY = "42", "101"  # Pennsylvania, Philadelphia County

tracts = tiger("tract", STATE, COUNTY)
data = acs(["B25064_001E", "B25003_001E", "B25003_003E"], "tract", STATE, COUNTY, year=2023)
data = data.drop(columns="NAME").rename(columns={"B25064_001E": "median_rent", "B25003_001E": "households", "B25003_003E": "renter_households"})
data["renter_share"] = (data["renter_households"] / data["households"]).where(data["households"] > 0).round(3)

g = tracts.merge(data, on="GEOID", how="left")
g["tract"] = g["NAME"].str.replace("Census Tract ", "Tract ", regex=False)
g = g[g["households"].fillna(0) > 0]

publish_layer(
    g,
    id="example-phl-median-rent",
    title="Median gross rent by census tract, Philadelphia",
    dek="What renters pay each month, rent plus utilities, ACS 2019–2023.",
    about="Example layer. American Community Survey 5-year estimates (table B25064). Small-area figures carry margins of error; treat neighboring tracts that differ by a little as about the same.",
    source="U.S. Census Bureau, ACS 2019–2023 5-year (B25064, B25003)",
    source_url="https://data.census.gov/table/ACSDT5Y2023.B25064",
    fields=["GEOID", "tract", "median_rent", "households", "renter_households", "renter_share"],
    color_field="median_rent",
    popup_title="tract",
    popup_formats={"median_rent": "money", "renter_share": "percent", "households": "number", "renter_households": "number"},
    labels={"median_rent": "Median gross rent", "households": "Households", "renter_households": "Renter households", "renter_share": "Renter share", "GEOID": "GEOID"},
    license="Public domain (U.S. Government work)",
    tags=["rent", "census", "philadelphia", "example"],
    simplify_m=4,
    digits=5,
    example=True,
    overwrite_yaml=True,
)
