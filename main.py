from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from events import get_events

# The React app, built by `npm run build` in frontend/.
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

app = FastAPI(title="NYC Free Events")
app.add_middleware(GZipMiddleware)  # shrinks the ~1 MB event list about 5x


@app.get("/api/events")
def list_events():
    # ~1,500 events is small enough to send all at once and filter in the browser.
    try:
        events = get_events()
    except RuntimeError as err:
        raise HTTPException(status_code=503, detail=str(err))
    return sorted(events, key=lambda e: (e["start_date"] or "", e["start_minutes"] or 0))


# Registered after the API routes so /api/... is matched first.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    def frontend_not_built():
        return "<p>The frontend isn't built yet. Run <code>npm run build</code> in <code>frontend/</code>.</p>"
