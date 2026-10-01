"""NYC's permitted events (NYC Open Data): street fairs, farmers markets, parades, plaza events.

The dataset covers every city event permit, most of which aren't public (ballfield bookings,
film shoots, private picnics), so only the types anyone can walk up to are kept.
It has no descriptions or coordinates, just a borough and a street-segment location.
"""
import re
import string
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import requests

from common import get, make_event

NAME = "NYC Event Permits"
API_URL = "https://data.cityofnewyork.us/resource/tvpp-9vvx.json"
GEOSEARCH_URL = "https://geosearch.planninglabs.nyc/v2/search"
DAYS_AHEAD = 30

# Permit type -> the category shown in the app. Anything not listed here is skipped.
EVENT_TYPES = {
    "Street Event": "Street Events",
    "Street Festival": "Festivals",
    "Single Block Festival": "Festivals",
    "Farmers Market": "Farmers Markets",
    "Parade": "Parades",
    "Plaza Event": "Plaza Events",
    "Plaza Partner Event": "Plaza Events",
    "Open Street Partner Event": "Open Streets",
    "Clean-Up": "Volunteer",
}

DESCRIPTION = (
    "From NYC's event permits ({permit_type}). The time shown is the permit window, "
    "which can include setup, so check details before you go."
)

# Place name -> (lat, lng) or None. Survives hourly refreshes so each place is looked up once.
_geocode_cache = {}


def fetch():
    start = date.today() - timedelta(days=1)  # a day of slack, since the server may not be on NYC time
    types = ", ".join(f"'{t}'" for t in EVENT_TYPES)
    rows = get(API_URL, params={
        "$where": f"start_date_time between '{start}' and '{start + timedelta(days=DAYS_AHEAD)}' "
                  f"AND event_type in ({types})",
        "$order": "start_date_time",
        "$limit": 5000,
    }).json()

    # The same event is sometimes permitted more than once (e.g. by two agencies).
    unique = {(r["event_name"], r["start_date_time"]): r for r in rows}.values()
    events = [to_event(row) for row in unique]
    add_coordinates(events)
    return events


def to_event(row):
    place, location = split_location(row.get("event_location", ""))
    return make_event(
        source=NAME,
        # A multi-day permit reuses one event_id for every day, so add the start to keep ids unique.
        id=f"{row['event_id']}-{re.sub(r'[^0-9]', '', row['start_date_time'])[:12]}",
        title=tidy_title(row["event_name"]),
        description=DESCRIPTION.format(permit_type=row["event_type"]),
        park=place,
        location=location,
        borough=row.get("event_borough"),
        start_date=row["start_date_time"][:10],
        end_date=row.get("end_date_time", "")[:10] or None,
        start_time=format_time(row["start_date_time"]),
        end_time=format_time(row.get("end_date_time")),
        categories=[EVENT_TYPES[row["event_type"]]],
    )


def format_time(iso):
    """'2026-10-06T17:30:00.000' -> '5:30 pm'."""
    if not iso or len(iso) < 16:
        return None
    hour, minute = int(iso[11:13]), int(iso[14:16])
    return f"{hour % 12 or 12}:{minute:02d} {'am' if hour < 12 else 'pm'}"


def tidy_title(name):
    name = re.sub(r"\s+", " ", name).strip()
    # Many permits are typed in ALL CAPS; "Celebracion Latina Block Party" was left alone.
    return string.capwords(name.lower()) if name.isupper() else name


def split_location(raw):
    """Turn a permit location into (named place, street description).

    'Times Square: 45/46 Broadway Pedestrian Plaza (Times Sq) BROADWAY between ...' -> ('Times Square', ...)
    'LENOX AVENUE between WEST  136 STREET and WEST  137 STREET, ...' -> ('', 'Lenox Avenue between West 136 Street and West 137 Street')
    Parades and races list every street on the route; only the first segment is kept.
    """
    first = re.sub(r"\s+", " ", raw.split(",")[0]).strip()
    place, _, rest = first.partition(":") if ":" in first else ("", "", first)
    return place.strip(), tidy_street(rest.strip())


def tidy_street(text):
    small = {"between", "and", "to", "at", "of", "the"}
    words = [w.lower() if w.lower() in small else (w.capitalize() if w.isupper() else w) for w in text.split()]
    return " ".join(words)


def add_coordinates(events):
    """Pin events held at a named place (a plaza or park) using NYC's free GeoSearch service.

    Plain street segments ("Lenox Avenue between ...") can't be geocoded this way, so those
    events stay off the map; the frontend links them to Google Maps directions instead.
    """
    places = {(e["park"], e["borough"]) for e in events if e["park"] and e["borough"]}
    todo = [p for p in places if p not in _geocode_cache]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for place, coords in zip(todo, pool.map(geocode, todo)):
            _geocode_cache[place] = coords

    for event in events:
        coords = _geocode_cache.get((event["park"], event["borough"]))
        if coords:
            event["lat"], event["lng"] = coords


def geocode(place):
    name, borough = place
    try:
        features = get(GEOSEARCH_URL, params={"text": f"{name}, {borough}", "size": 1}).json()["features"]
    except (requests.RequestException, ValueError, KeyError):
        return None
    if not features:
        return None
    props, (lng, lat) = features[0]["properties"], features[0]["geometry"]["coordinates"]
    # GeoSearch always returns *something*; "Lou Gehrig Plaza" comes back as "Lou Gehrig JHS".
    # Only trust it when the result really is the place we asked for.
    if props.get("borough") != borough or normalize(name) not in normalize(props.get("name", "")):
        return None
    return round(lat, 6), round(lng, 6)


def normalize(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())
