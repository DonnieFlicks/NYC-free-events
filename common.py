"""Helpers shared by every event source: HTTP, text cleanup, and the common event shape."""
import html
import re

import requests

HEADERS = {"User-Agent": "nyc-free-events-app/0.1 (learning project)"}
TIMEOUT = 20

# A dollar amount near a word like "admission" or "tickets" means the event costs money.
# (A bare "$30 million" in a park's history blurb shouldn't count.)
PAID_RE = re.compile(
    r"\b(admission|tickets?|fees?|costs?|price|charge)\b[^.]{0,60}?\$\s?\d"
    r"|\$\s?\d+(\.\d\d)?\s*(per|/|each)\b",
    re.IGNORECASE,
)
DONATION_RE = re.compile(r"suggested donation|pay what you (wish|can)", re.IGNORECASE)
CANCELED_RE = re.compile(r"cancel+ed\b", re.IGNORECASE)


def get(url, params=None):
    resp = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp


def make_event(*, source, id, title, start_date, description="", url=None, registration_url=None,
               park="", location="", borough=None, end_date=None, start_time=None, end_time=None,
               categories=(), lat=None, lng=None, image=None, canceled=False, cost_text=""):
    """Build an event in the one shape the frontend understands, whatever the source."""
    title = clean_text(title)
    description = clean_text(description)
    return {
        "id": f"{source_slug(source)}-{id}",
        "source": source,
        "title": title,
        # Some sources only flag cancellations in the title ("CANCELED: Tai Chi").
        "canceled": canceled or bool(CANCELED_RE.match(title)),
        "description": description,
        "url": url,
        "registration_url": registration_url,
        "park": clean_text(park),
        "location": clean_text(location),
        "borough": borough,
        "start_date": start_date,
        "end_date": end_date or start_date,
        "start_time": start_time,
        "end_time": end_time,
        "start_minutes": minutes_since_midnight(start_time),
        "end_minutes": minutes_since_midnight(end_time),
        "categories": list(categories),
        "cost": classify_cost(f"{title} {description} {cost_text}"),
        "lat": lat,
        "lng": lng,
        "image": image,
    }


def source_slug(source):
    return re.sub(r"[^a-z0-9]+", "-", source.lower()).strip("-")


def clean_text(text):
    if not text:
        return ""
    text = html.unescape(text).replace("\xa0", " ")
    # Feeds often strip <p> tags, gluing sentences together ("colors!NYRR"); put the space back.
    text = re.sub(r"([.!?])([A-Z])", r"\1 \2", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_html(text):
    text = re.sub(r"<br\s*/?>|</p>|</li>", " ", text or "", flags=re.IGNORECASE)
    return clean_text(re.sub(r"<[^>]+>", "", text))


def classify_cost(text):
    """'donation', 'paid', or 'free'. Events are assumed free unless the text says otherwise."""
    if DONATION_RE.search(text):
        return "donation"
    if PAID_RE.search(text):
        return "paid"
    return "free"


def minutes_since_midnight(value):
    """'8:00 am' -> 480. Used to sort events within a day."""
    match = re.match(r"\s*(\d{1,2}):(\d{2})\s*([ap])\.?m", value or "", re.IGNORECASE)
    if not match:
        return None
    hour, minute, half = int(match[1]) % 12, int(match[2]), match[3].lower()
    return (hour + (12 if half == "p" else 0)) * 60 + minute
