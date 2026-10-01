# Free in NYC

Find free events across NYC. Data refreshes hourly from:

- [NYC Parks events](https://www.nycgovparks.org/events): classes, tours, concerts, and kids' programs in city parks.
- [Brooklyn Bridge Park](https://brooklynbridgepark.org/events/): fitness, stargazing, and festivals on the waterfront.
- [NYC Permitted Event Information](https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tvpp-9vvx)
  (NYC Open Data): street fairs, farmers markets, parades, plaza events, and Open Streets. These have no
  descriptions or coordinates, so most don't appear on the map.

NYPL and Queens Public Library block automated requests, so they aren't included.

## Run it

The backend is Python (FastAPI); the frontend is React + TypeScript (Vite).

```
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python -m uvicorn main:app --reload
```

Then open http://127.0.0.1:8000. FastAPI serves the built frontend from `frontend/dist`.

### While working on the frontend

Run the backend as above, and in a second terminal:

```
cd frontend
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Changes show up instantly, and
`/api` requests are forwarded to the backend on port 8000.

## How it fits together

- `sources/` has one module per data source. Each has a `NAME` and a `fetch()` that returns events.
  To add a source, write a module like these and add it to `SOURCES` in `sources/__init__.py`.
- `common.py` holds what the sources share: `make_event()` (the one event shape the page expects),
  text cleanup, and free/paid detection.
- `events.py` fetches all sources in parallel, caches each for an hour, and removes duplicates.
  If one source is down, the others still load.
- `main.py` serves `GET /api/events` and the built frontend.
- `frontend/src/` is the React app:
  - `types.ts`: the event shape, matching `make_event()` on the backend.
  - `lib/`: date and filter logic as plain functions (no React), with tests alongside.
  - `components/`: `FilterBar`, `EventList`, `EventCard`, and `EventMap` (Leaflet via react-leaflet).
  - `App.tsx`: holds the filter state and connects the list and the map.

Events that charge admission are hidden. "Suggested donation" events are shown by default,
and there's a toggle to hide them. Canceled events are hidden.

## Tests

```
pip install pytest
python -m pytest          # backend

cd frontend
npm test                  # frontend (Vitest)
```
