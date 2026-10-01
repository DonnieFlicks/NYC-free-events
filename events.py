"""Combine events from every source, caching each one separately for an hour."""
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import truststore

# nycgovparks.org doesn't send its full certificate chain, so Python's bundled
# certificates can't verify it. Windows/macOS fill in the gap, so use their trust store.
# (This has to run before anything opens an HTTPS connection.)
truststore.inject_into_ssl()

from sources import SOURCES  # noqa: E402

CACHE_SECONDS = 3600
RETRY_SECONDS = 300  # after a failure, wait a bit before hitting that source again

log = logging.getLogger(__name__)
_cache = {source.NAME: {"events": [], "fetched_at": 0.0} for source in SOURCES}
_lock = threading.Lock()


def get_events():
    """All upcoming events from every source, with duplicates removed."""
    with _lock:  # so two visitors arriving at once don't both refetch everything
        stale = [s for s in SOURCES if time.time() - _cache[s.NAME]["fetched_at"] > CACHE_SECONDS]
        if stale:
            with ThreadPoolExecutor(max_workers=len(stale)) as pool:
                list(pool.map(refresh, stale))

    events = [event for source in SOURCES for event in _cache[source.NAME]["events"]]
    if not events:
        raise RuntimeError("No event sources could be loaded")
    return dedupe(events)


def refresh(source):
    entry = _cache[source.NAME]
    try:
        entry["events"] = source.fetch()
        entry["fetched_at"] = time.time()
        log.info("Loaded %d events from %s", len(entry["events"]), source.NAME)
    except Exception:
        # One broken source shouldn't take the whole app down: keep its last good copy.
        log.exception("Couldn't load events from %s", source.NAME)
        entry["fetched_at"] = time.time() - CACHE_SECONDS + RETRY_SECONDS


def dedupe(events):
    """Drop repeats of the same event (same title, day and start time), keeping the first."""
    seen, unique = set(), []
    for event in events:
        key = (re.sub(r"[^a-z0-9]", "", event["title"].lower()), event["start_date"], event["start_time"])
        if key not in seen:
            seen.add(key)
            unique.append(event)
    return unique
