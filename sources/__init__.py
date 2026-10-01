"""Each event source is a module with a NAME and a fetch() that returns events built by common.make_event.

Listed in priority order: when the same event appears in two sources, the earlier one wins.
"""
from sources import brooklyn_bridge_park, nyc_parks, nyc_permits

SOURCES = [nyc_parks, brooklyn_bridge_park, nyc_permits]
