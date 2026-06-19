# Routewise Implementation Schedule

**Pace:** 4 hours/day  
**MVP target:** ~3 weeks (15 working days)  
**Principle:** Vertical slices — each day produces something visible or testable.

See [plan.md](./plan.md) for full product spec, architecture, and algorithm details.

---

## Progress summary (as of Jun 17, 2026)

### Completed — Step #3 coordinate input (Parts 1–4)

| Part | File | Status |
|------|------|--------|
| Validation library | `lib/validation/coordinates.ts` | Done |
| Paste UI | `components/input/CoordinatePaste.tsx` | Done |
| Results table | `components/input/ParsedStopsTable.tsx` | Done |
| Homepage wiring | `app/page.tsx` | Done |

**What works today:**

- Paste `lat,lng` (comma-, tab-, or space-separated) into a textarea
- Live parsing with bounds checks and parse-error messages
- Duplicate detection within ~10 m (haversine)
- Summary counts and status badges in a results table
- Two-column layout with a map placeholder

**Day 1 checklist status:**

| Item | Status |
|------|--------|
| 1. Accounts & keys (`.env.local`, Mapbox tokens) | Done |
| 2. Repo scaffold (Next.js, folders, `mapbox-gl`) | Done |
| 3. Coordinate input (paste + validation + table) | Done |
| 4. Map with unordered pins (`RouteMap.tsx`) | **Not started** |
| 5. Sample data (`data/sample-stops.csv`) | **Not started** |

**Day 1 success criteria (not yet met):** Open localhost → paste 10 coordinates → see pins on map; invalid/duplicate rows flagged in table.

---

## Week 1 — Input, geocoding, map (no optimizer yet)

| Day | Date | Hours | Focus | Done when |
|-----|------|-------|-------|-----------|
| **1** | Wed Jun 17 | 4h | **Finish Day 1 leftovers** | `RouteMap.tsx` with Mapbox GL; markers for valid non-duplicate stops; fit bounds; add `data/sample-stops.csv` (15–20 stops); run `npm run build` |
| **2** | Thu Jun 18 | 4h | **Reverse geocoding** | `app/api/geocode/reverse/route.ts` + `lib/mapbox/geocode.ts`; address column in table; loading/error states |
| **3** | Fri Jun 19 | 4h | **CSV upload** | `CsvUpload.tsx`; reuse `coordinates.ts`; file parse for lat/lng/name/notes columns; invalid rows highlighted |
| **4** | Mon Jun 22 | 4h | **Stop review table** | `StopReviewTable.tsx` — edit lat/lng, remove rows, fix before continuing |
| **5** | Tue Jun 23 | 4h | **Map polish** | Click pin → `StopPopup.tsx` with address + coords; highlight selected row |

**Week 1 milestone:** Paste or upload leads → validated, geocoded stops on an interactive map. No optimizer yet.

---

## Week 2 — Optimizer + route visualization

| Day | Date | Hours | Focus | Done when |
|-----|------|-------|-------|-----------|
| **6** | Wed Jun 24 | 4h | **Walking duration matrix** | `lib/mapbox/matrix.ts`; API route; N×N matrix for ≤25 stops |
| **7** | Thu Jun 25 | 4h | **TSP solver** | OR-Tools (Python FastAPI sidecar *or* JS heuristic for MVP); open route + fixed start; returns visit order |
| **8** | Fri Jun 26 | 4h | **Directions + polyline** | Mapbox Directions per leg; merged route line; numbered pins in visit order |
| **9** | Mon Jun 29 | 4h | **Start/end + round-trip** | `StartEndPicker.tsx`; depot toggle; re-optimize on change |
| **10** | Tue Jun 30 | 4h | **Route summary sidebar** | `OrderedStopList.tsx` + `LegSummary.tsx`; distance/time per leg + totals |

**Week 2 milestone:** Full optimize → visualize loop. A rep can see an efficient walking order on the map.

---

## Week 3 — Rep workflow + ship MVP

| Day | Date | Hours | Focus | Done when |
|-----|------|-------|-------|-----------|
| **11** | Wed Jul 1 | 4h | **CSV export** | `ExportMenu.tsx`; download order, address, lat/lng, leg stats |
| **12** | Thu Jul 2 | 4h | **Manual reorder + lock** | Drag-and-drop in `OrderedStopList`; lock first/last; optimizer respects locks |
| **13** | Fri Jul 3 | 4h | **Exclude + visit status** | Exclude stops; completed / skipped / follow-up badges; session state |
| **14** | Mon Jul 6 | 4h | **Save/load routes** | In-memory or SQLite; named routes survive refresh (no auth) |
| **15** | Tue Jul 7 | 4h | **Polish + ship** | Error/loading UX; wire sample data; README run instructions; demo-ready |

**MVP ship target: Tue Jul 7**

---

## Deferred past MVP (Week 4+)

Only start after the Jul 7 milestone:

- PostgreSQL + PostGIS
- User accounts / saved routes in DB
- Side-of-street penalties, OSM enrichment
- PDF export, Google/Apple Maps deep links
- Crossing-count analytics, adjustable penalty weight sliders

---

## Today’s 4-hour block (Wed Jun 17)

Since Day 1 items 4–5 are still open, use today to finish the map slice:

| Block | Task |
|-------|------|
| **0:00–0:30** | Add Mapbox CSS import; create `components/map/RouteMap.tsx` skeleton |
| **0:30–1:30** | Render markers from `result.stops.filter(s => s.status === "valid")`; fit bounds; swap placeholder in `page.tsx` |
| **1:30–2:00** | Create `data/sample-stops.csv`; add "Load sample" button |
| **2:00–2:30** | Test invalid/duplicate/valid cases with pins |
| **2:30–3:00** | `npm run build`; fix any client/server boundary issues |
| **3:00–4:00** | Buffer — map styling, dark theme polish, or start geocode API research |

---

## Pace notes

- At **4 hrs/day**, the 15-day plan maps roughly 1:1 to calendar days (weekends off in the table above).
- If a day runs long, **don't stack** — push optimizer work rather than rushing geocoding.
- **Day 7 (TSP)** is the highest-risk day; budget an extra half-day if OR-Tools setup is new to you.
