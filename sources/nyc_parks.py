"""NYC Parks' public events feed: ~1,000 events over the next two weeks, with map coordinates."""
from common import clean_text, get, make_event

NAME = "NYC Parks"
FEED_URL = "https://www.nycgovparks.org/xml/events_300_rss.json"

BOROUGHS = {"M": "Manhattan", "X": "Bronx", "B": "Brooklyn", "Q": "Queens", "R": "Staten Island"}


def fetch():
    events = [to_event(raw) for raw in get(FEED_URL).json()]
    fill_missing_boroughs(events)
    return events


def to_event(raw):
    borough = guess_borough(raw)
    # Online events carry a placeholder Midtown pin, which would be misleading on a map.
    lat, lng = (None, None) if borough == "Online" else parse_coordinates(raw.get("coordinates"))
    return make_event(
        source=NAME,
        id=raw["guid"],
        title=raw.get("title"),
        description=raw.get("description"),
        url=https(raw.get("link")),
        registration_url=raw.get("registration_url"),
        park=raw.get("parknames"),
        location=raw.get("location"),
        borough=borough,
        start_date=raw.get("startdate"),
        end_date=raw.get("enddate"),
        start_time=raw.get("starttime"),
        end_time=raw.get("endtime"),
        categories=[c.strip() for c in (raw.get("categories") or "").split("|") if c.strip()],
        lat=lat,
        lng=lng,
        image=https(raw.get("image")),
        cost_text=clean_text(raw.get("registration_description")),
    )


def https(url):
    return (url or "").replace("http://", "https://", 1) or None


def guess_borough(raw):
    if "virtual" in (raw.get("location") or "").lower():
        return "Online"
    # Park IDs start with a borough letter, e.g. "M072" is in Manhattan.
    park_id = (raw.get("parkids") or "").strip().upper()
    if park_id[:1] in BOROUGHS:
        return BOROUGHS[park_id[0]]
    # Events outside parks (libraries, community centers) often name the borough.
    place = f"{raw.get('location')} {raw.get('parknames')}".lower()
    for name in BOROUGHS.values():
        if name.lower() in place:
            return name
    return None


def fill_missing_boroughs(events):
    """Give each event with no known borough the borough of the closest event that has one."""
    known = [e for e in events if e["borough"] and e["borough"] != "Online" and e["lat"] is not None]
    for event in events:
        if event["borough"] or event["lat"] is None or not known:
            continue
        nearest = min(known, key=lambda k: (k["lat"] - event["lat"]) ** 2 + (k["lng"] - event["lng"]) ** 2)
        event["borough"] = nearest["borough"]


def parse_coordinates(value):
    try:
        lat, lng = (float(part) for part in value.split(",")[:2])
        return round(lat, 6), round(lng, 6)
    except (AttributeError, ValueError):
        return None, None
