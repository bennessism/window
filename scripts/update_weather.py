#!/usr/bin/env python3
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "weather" / "catalog.json"
DATA_DIR = ROOT / "weather" / "data"

CURRENT_FIELDS = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "rain",
    "showers",
    "weather_code",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
]

RETRY_DELAYS = [5, 15, 30]
REQUEST_TIMEOUT = 35


def fetch_country(locations):
    params = {
        "latitude": ",".join(str(x["lat"]) for x in locations),
        "longitude": ",".join(str(x["lon"]) for x in locations),
        "current": ",".join(CURRENT_FIELDS),
        "timezone": "auto",
        "forecast_days": "1",
    }
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "bennessism-window/1.1"})

    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as response:
                payload = json.load(response)
            return payload if isinstance(payload, list) else [payload]
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt >= len(RETRY_DELAYS):
                raise
            delay = RETRY_DELAYS[attempt]
            print(f"Open-Meteo request failed: {exc}. Retrying in {delay}s...", flush=True)
            time.sleep(delay)


def clean_current(item):
    current = item.get("current") or {}
    units = item.get("current_units") or {}
    return {
        "time": current.get("time"),
        "temperature_c": current.get("temperature_2m"),
        "apparent_temperature_c": current.get("apparent_temperature"),
        "relative_humidity_pct": current.get("relative_humidity_2m"),
        "precipitation_mm": current.get("precipitation"),
        "rain_mm": current.get("rain"),
        "showers_mm": current.get("showers"),
        "weather_code": current.get("weather_code"),
        "cloud_cover_pct": current.get("cloud_cover"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "wind_direction_deg": current.get("wind_direction_10m"),
        "wind_gusts_kmh": current.get("wind_gusts_10m"),
        "is_day": bool(current.get("is_day")),
        "timezone": item.get("timezone"),
        "timezone_abbreviation": item.get("timezone_abbreviation"),
        "utc_offset_seconds": item.get("utc_offset_seconds"),
        "source_units": units,
    }


def main():
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        catalog = json.load(handle)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    refreshed = 0
    failed = []

    for code, country in catalog["countries"].items():
        locations = country["locations"]
        try:
            results = fetch_country(locations)
            if len(results) != len(locations):
                raise RuntimeError(
                    f"Open-Meteo returned {len(results)} results for {len(locations)} {country['name']} locations"
                )

            out = {
                "country_code": code,
                "country": country["name"],
                "updated_at": fetched_at,
                "source": "Open-Meteo",
                "source_url": "https://open-meteo.com/",
                "locations": {},
            }

            for location, result in zip(locations, results):
                out["locations"][location["id"]] = {
                    "name": location["name"],
                    "city": location["city"],
                    "latitude": location["lat"],
                    "longitude": location["lon"],
                    **clean_current(result),
                }

            path = DATA_DIR / f"{code}.json"
            with path.open("w", encoding="utf-8") as handle:
                json.dump(out, handle, ensure_ascii=False, separators=(",", ":"))
                handle.write("\n")

            refreshed += 1
            print(f"Refreshed {code}: {country['name']}", flush=True)
        except Exception as exc:
            failed.append(code)
            print(f"WARNING: keeping previous cache for {code} ({country['name']}): {exc}", flush=True)

    print(f"Weather refresh complete: {refreshed} refreshed, {len(failed)} kept from previous cache.", flush=True)
    if failed:
        print("Failed country codes: " + ", ".join(failed), flush=True)

    if refreshed == 0:
        raise RuntimeError("All Open-Meteo country requests failed; no cache was refreshed.")


if __name__ == "__main__":
    main()
