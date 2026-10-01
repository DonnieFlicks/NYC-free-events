from common import classify_cost, clean_text, make_event, minutes_since_midnight, strip_html
from events import dedupe
from sources import brooklyn_bridge_park, nyc_parks, nyc_permits


# ---------- Shared cleanup ----------

def test_clean_text_decodes_entities_and_splits_glued_sentences():
    assert clean_text("Wear your colors!NYRR Open Run&nbsp;is free.") == "Wear your colors! NYRR Open Run is free."


def test_strip_html_keeps_paragraph_breaks_as_spaces():
    assert strip_html("<p>First part.</p>\n<p>Second<br />line</p>") == "First part. Second line"


def test_admission_price_is_paid():
    assert classify_cost("Admission: General Admission: $30.00") == "paid"
    assert classify_cost("Tickets: $125 per person") == "paid"
    assert classify_cost("Admission is $10 for members and $15 for non-members.") == "paid"


def test_suggested_donation_is_not_paid():
    assert classify_cost("Suggested donation for entry is $3, but no one is turned away.") == "donation"


def test_unrelated_dollar_amounts_stay_free():
    assert classify_cost("The park received $30 million from the Anchor Parks initiative.") == "free"
    assert classify_cost("Join us for a free yoga class.") == "free"


def test_minutes_since_midnight():
    assert minutes_since_midnight("8:00 am") == 480
    assert minutes_since_midnight("12:30 pm") == 750
    assert minutes_since_midnight("12:00 am") == 0
    assert minutes_since_midnight("") is None


def test_canceled_events_are_flagged_from_the_title():
    def event(title):
        return make_event(source="Test", id="1", title=title, start_date="2026-10-01")
    assert event("CANCELED: Kids In Motion")["canceled"] is True
    assert event("Cancelled: Tai Chi")["canceled"] is True
    assert event("Tai Chi")["canceled"] is False


def test_dedupe_keeps_the_first_copy_of_an_event():
    first = make_event(source="A", id="1", title="Sunset Yoga!", start_date="2026-10-06", start_time="5:30 pm")
    copy = make_event(source="B", id="9", title="Sunset yoga", start_date="2026-10-06", start_time="5:30 pm")
    other_day = make_event(source="B", id="10", title="Sunset yoga", start_date="2026-10-13", start_time="5:30 pm")
    assert dedupe([first, copy, other_day]) == [first, other_day]


# ---------- NYC Parks ----------

def test_parks_borough_from_park_id_or_place_name():
    assert nyc_parks.guess_borough({"parkids": "M072"}) == "Manhattan"
    assert nyc_parks.guess_borough({"parkids": "x012"}) == "Bronx"
    assert nyc_parks.guess_borough({"parkids": "", "location": "Queens Public Library - Corona"}) == "Queens"
    assert nyc_parks.guess_borough({"parkids": "", "location": "Virtual/Online Events"}) == "Online"
    assert nyc_parks.guess_borough({"parkids": "", "location": "Sunnyside Community Services"}) is None


def test_parks_missing_borough_comes_from_nearest_event():
    events = [
        {"borough": "Brooklyn", "lat": 40.67, "lng": -73.97},
        {"borough": "Staten Island", "lat": 40.58, "lng": -74.15},
        {"borough": None, "lat": 40.66, "lng": -73.91},
    ]
    nyc_parks.fill_missing_boroughs(events)
    assert events[2]["borough"] == "Brooklyn"


# ---------- NYC Event Permits ----------

def test_permit_street_location_is_tidied():
    place, street = nyc_permits.split_location(
        "LENOX AVENUE between WEST  136 STREET and WEST  137 STREET, LENOX AVENUE between WEST 137 STREET")
    assert place == ""
    assert street == "Lenox Avenue between West 136 Street and West 137 Street"


def test_permit_named_place_is_split_out():
    place, _ = nyc_permits.split_location("Times Square: 45/46 Broadway Pedestrian Plaza (Times Sq) BROADWAY")
    assert place == "Times Square"


def test_permit_row_becomes_event():
    event = nyc_permits.to_event({
        "event_id": "123", "event_name": "CENTRAL PARK PRECINCT COMMUNITY BLOCK PARTY",
        "event_type": "Single Block Festival", "event_borough": "Manhattan",
        "start_date_time": "2026-09-27T10:00:00.000", "end_date_time": "2026-09-27T18:00:00.000",
        "event_location": "EAST   60 STREET between 5 AVENUE and MADISON AVENUE",
    })
    assert event["title"] == "Central Park Precinct Community Block Party"
    assert (event["start_date"], event["start_time"], event["end_time"]) == ("2026-09-27", "10:00 am", "6:00 pm")
    assert event["location"] == "East 60 Street between 5 Avenue and Madison Avenue"
    assert event["categories"] == ["Festivals"]


def test_permit_ids_are_unique_across_days_of_one_permit():
    row = {"event_id": "899826", "event_name": "Afterschool Fun", "event_type": "Open Street Partner Event",
           "event_borough": "Queens", "event_location": "34 AVENUE between 93 STREET and 94 STREET"}
    monday = nyc_permits.to_event({**row, "start_date_time": "2026-09-28T08:00:00.000"})
    tuesday = nyc_permits.to_event({**row, "start_date_time": "2026-09-29T08:00:00.000"})
    assert monday["id"] != tuesday["id"]


# ---------- Brooklyn Bridge Park ----------

def test_bbp_post_becomes_event_with_location_coordinates():
    post = {
        "id": 56639, "link": "https://brooklynbridgepark.org/event/stargazing/",
        "title": {"rendered": "Stargazing &#8211; October 14"}, "event_category": [347],
        "acf": {"status": "Scheduled", "date": "20261014", "start_time": "7:30 pm", "end_time": "9:30 pm",
                "multi-day": False, "description": "<p>Look up!</p>", "event_location": [18685]},
    }
    locations = {18685: {"name": "Pier 1", "latitude": "40.7026", "longitude": "-73.9967"}}
    event = brooklyn_bridge_park.to_event(post, locations, {347: "Education"})
    assert event["title"] == "Stargazing – October 14"
    assert (event["start_date"], event["end_date"]) == ("2026-10-14", "2026-10-14")
    assert (event["location"], event["lat"], event["lng"]) == ("Pier 1", 40.7026, -73.9967)
    assert event["categories"] == ["Education"]
    assert event["canceled"] is False


def test_bbp_cancelled_status_is_respected():
    post = {"id": 1, "title": {"rendered": "Zumba"},
            "acf": {"status": "Cancelled", "date": "20261005", "event_location": []}}
    event = brooklyn_bridge_park.to_event(post, {}, {})
    assert event["canceled"] is True
    assert event["lat"] is None
