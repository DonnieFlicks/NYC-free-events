import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import compression from 'compression'
import express from 'express'

import { getEvents } from './events.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// The React app, built by `npm run build` in frontend/.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist')
const PORT = Number(process.env.PORT ?? 8000)

const app = express()
app.use(compression()) // shrinks the ~1 MB event list about 5x

app.get('/api/events', async (_req, res) => {
  // ~1,500 events is small enough to send all at once and filter in the browser.
  try {
    const events = await getEvents()
    events.sort((a, b) => {
      const byDate = (a.start_date ?? '').localeCompare(b.start_date ?? '')
      return byDate !== 0 ? byDate : (a.start_minutes ?? 0) - (b.start_minutes ?? 0)
    })
    res.json(events)
  } catch (err) {
    res.status(503).json({ detail: err instanceof Error ? err.message : String(err) })
  }
})

// Registered after the API route so /api/... is matched first.
if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST))
} else {
  app.get('/', (_req, res) => {
    res
      .type('html')
      .send(
        "<p>The frontend isn't built yet. Run <code>npm run build</code> in <code>frontend/</code>.</p>",
      )
  })
}

app.listen(PORT, () => {
  console.log(`NYC Free Events running at http://127.0.0.1:${PORT}`)
})
