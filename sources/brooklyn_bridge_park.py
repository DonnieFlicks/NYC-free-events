"""Brooklyn Bridge Park's events, from the WordPress API behind brooklynbridgepark.org.

Fitness classes, stargazing, bird walks, workshops and festivals on the Brooklyn waterfront.
Each event points at a "map location" (Pier 3, Pier 6 ...) that has exact coordinates.
"""
import html
from datetime import date, timedelta

from common import get, make_event, strip_html

NAME = "Brooklyn Bridge Park"
API = "https://brooklynbridgepark.org/wp-json/wp/v2"
MAX_PAGES = 12  # ~100 events per page; the site has ~700 events, past and future


def fetch():
    locations = {loc["id"]: loc.get("acf") or {} for loc in get_all("maplocations", "id,acf")}
    categories = {c["id"]: html.unescape(c["name"]) for c in get_all("event_category", "id,name")}
    cutoff = (date.today() - timedelta(days=1)).strftime("%Y%m%d")

    events = []
    # Events are ordered by when they were posted, not when they happen, so upcoming ones
    # are spread across every page and we have to read them all.
    for post in get_all("events", "id,link,title,acf,event_category"):
        acf = post.get("acf")
        if isinstance(acf, dict) and (acf.get("date") or "") >= cutoff:
            events.append(to_event(post, locations, categories))
    return events


def get_all(endpoint, fields):
    items, page, total_pages = [], 1, 1
    while page <= min(total_pages, MAX_PAGES):
        resp = get(f"{API}/{endpoint}", params={"per_page": 100, "page": page, "_fields": fields})
        items.extend(resp.json())
        total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
        page += 1
    return items


def to_event(post, locations, categories):
    acf = post["acf"]
    location_ids = acf.get("event_location") or []
    place = locations.get(location_ids[0], {}) if location_ids else {}
    lat, lng = to_float(place.get("latitude")), to_float(place.get("longitude"))
    return make_event(
        source=NAME,
        id=post["id"],
        title=post["title"]["rendered"],
        description=strip_html(acf.get("description")),
        url=post.get("link"),
        park=NAME,
        location=place.get("name") or "",
        borough="Brooklyn",
        start_date=to_iso_date(acf["date"]),
        end_date=to_iso_date(acf.get("end_date")) if acf.get("multi-day") else None,
        start_time=acf.get("start_time") or None,
        end_time=acf.get("end_time") or None,
        categories=[categories[c] for c in post.get("event_category") or [] if c in categories],
        lat=lat if lng is not None else None,
        lng=lng if lat is not None else None,
        canceled=(acf.get("status") or "").lower().startswith("cancel"),
    )


def to_iso_date(value):
    """'20261003' -> '2026-10-03'."""
    value = str(value or "")
    return f"{value[:4]}-{value[4:6]}-{value[6:8]}" if len(value) == 8 and value.isdigit() else None


def to_float(value):
    try:
        return round(float(value), 6)
    except (TypeError, ValueError):
        return None
