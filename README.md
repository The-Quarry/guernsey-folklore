# Guernsey Folklore Map

Interactive map of places in Guernsey and Sark where the island's folklore is attached to the ground, published by The Quarry at https://folklore.thequarry.media.

Plain static site: `index.html`, `assets/`, `data/`, `images/`. No build step. Leaflet 1.9.4 and Leaflet.markercluster 1.5.3 load from unpkg; the basemap is CARTO Dark Matter (OpenStreetMap data).

## Editing content

- `data/sites.geojson`: one feature per site. Properties: `id` (also the page anchor, e.g. `/#le-trepied`), `name`, `gloss`, `category` (`fairies`, `witches`, `beasts`, `ghosts`, `stones`), `parish`, `location_precision` (`site` or `area`), `story` (array of paragraphs), `sources` (title and url), `images` (src, caption, credit, year) and `access` (a visiting note; shown on the site card when filled in).
- `data/routes.json`: walks. Each has `id` (anchor, e.g. `/#walk-catioroc`), `name`, `summary`, `stops` (site ids in order, or `{"lat": .., "lon": ..}` via points to steer the route along a preferred lane) and `notes`.
- `data/walks.geojson`: generated. The **Build walking routes** Action (`scripts/build_walks.py`) routes each walk along OpenStreetMap roads and paths using the FOSSGIS OSRM walking server, commits the file and republishes. It runs when `routes.json` changes, or by hand from the Actions tab. Its log lists any stop more than 150 m from a routable path.
- `images/1903/`: plates from MacCulloch, *Guernsey Folk Lore*, ed. Carey (1903), out of copyright.

Pushing to `main` publishes the site through GitHub Pages (`.github/workflows/pages.yml`). The workflow fails if either data file is not valid JSON.

## Setup (once)

1. Repo Settings > Pages > Source: **GitHub Actions**.
2. Cloudflare DNS: add `CNAME folklore -> the-quarry.github.io`, DNS only (grey cloud) until GitHub has issued the certificate.
3. Repo Settings > Pages: confirm the custom domain `folklore.thequarry.media` and tick **Enforce HTTPS** once available.

## Before launch

- Walk each route and check the line, stop order and access.
- Fill in `access` for sites on private land or with restricted access.
- Check the basemap provider's terms for production traffic.

## Stage 2 (planned)

Reader contributions (stories and photos) through a Cloud Run endpoint with Cloudflare Turnstile, stored in Firestore as pending, approved in Quarry Studio, and shown as a separate "readers' tales" layer.
