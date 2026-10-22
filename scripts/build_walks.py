"""Route each walk in data/routes.json along OpenStreetMap roads and paths.

Uses the FOSSGIS OSRM walking server (routing.openstreetmap.de, no key, fair use).
Writes data/walks.geojson: one LineString per walk with distance and duration.
A stop can be a site id from data/sites.geojson, or a {"lat": .., "lon": ..} via point
to push the route along a preferred lane (via points are not shown as stops).
Run: python3 scripts/build_walks.py
"""
import json, sys, time, urllib.request, urllib.error
from datetime import date

ROUTER = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/"
UA = "GuernseyFolkloreMap/1.0 (https://folklore.thequarry.media; The Quarry)"
SNAP_WARN_M = 150

sites = {f["properties"]["id"]: f["geometry"]["coordinates"] for f in json.load(open("data/sites.geojson"))["features"]}
walks = json.load(open("data/routes.json"))

def coord(stop):
    if isinstance(stop, str):
        if stop not in sites:
            sys.exit(f"Unknown site id in routes.json: {stop}")
        return sites[stop]
    return [stop["lon"], stop["lat"]]

def route(points):
    path = ";".join(f"{lon:.6f},{lat:.6f}" for lon, lat in points)
    url = f"{ROUTER}{path}?overview=full&geometries=geojson&steps=false"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            if data.get("code") != "Ok":
                sys.exit(f"Router error: {data.get('code')} {data.get('message', '')}")
            return data
        except urllib.error.URLError as e:
            print(f"  retry {attempt + 1}: {e}")
            time.sleep(5)
    sys.exit("Router unreachable")

features, problems = [], 0
for w in walks:
    stops = w["stops"]
    pts = [coord(s) for s in stops]
    data = route(pts)
    r = data["routes"][0]
    print(f"{w['id']}: {r['distance'] / 1000:.1f} km, {r['duration'] / 60:.0f} min")
    for s, wp in zip(stops, data["waypoints"]):
        if wp["distance"] > SNAP_WARN_M:
            problems += 1
            name = s if isinstance(s, str) else "via point"
            print(f"  check: {name} is {wp['distance']:.0f} m from the nearest routable path")
    features.append({"type": "Feature", "geometry": r["geometry"], "properties": {
        "id": w["id"], "distance_m": round(r["distance"]), "duration_s": round(r["duration"]),
        "legs_m": [round(l["distance"]) for l in r["legs"]]}})
    time.sleep(1.5)

out = {"type": "FeatureCollection", "generated": date.today().isoformat(),
       "source": "Routed on OpenStreetMap data via routing.openstreetmap.de (OSRM foot profile)",
       "features": features}
json.dump(out, open("data/walks.geojson", "w"), separators=(",", ":"))
print(f"Wrote data/walks.geojson ({len(features)} walks, {problems} stops to check)")
