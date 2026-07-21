# Benchmark Log

### Jul 9 Baseline (Start: Stop 1) - Sample-Stops.ts

| Metric | Value |
|--------|-------|
| Visit order | 1 -> 19 -> 7 -> 8 -> 3 -> 16 -> 2 -> 4 -> 18 -> 5 -> 6 -> 17 -> 9 -> 20 -> 21 -> 10 -> 11 -> 12 -> 23 -> 22 -> 13 -> 15 -> 25 -> 24 -> 14 |
| Total walk time (s) | 35 min (2098s) |
| Paste order walk time (s) | 106 min |
| Backtrack count | 10 |
| Skip nearby legs | 2 |
| Penalty cost (s) | 2351s |
| Optimization cost (s) | 4449s |
| Route distance (m) | 1.35 mi (2067 m) |

### Human Ideal Order (Jul 9)
1 -> 5 -> 6 -> 18 -> 19 -> 7 -> 20 -> 23 -> 24 -> 14 -> 25 -> 15 -> 13 -> 22 -> 12 -> 11 -> 10 -> 21 -> 9 -> 8 -> 17 -> 4 -> 2 -> 16 -> 3

### Observations - Algorithm vs. Human
**Where the Algorithm Fails**
- First 8 Stops: Algorithm Scatters (1->19->7->3...), human sweeps north (1->5->6->18)
- Algorithm ends at stop 14 (368m from start); human ends at stop 3 (55m from start)
- Algorithm has visible knot/zigzag mid route

**What the Human Order Optimizes For**
1. Corridor Sweeps - Walk one direction along a street before turning
2. Pocket-First - Finish an area before crossing to next
3. Soft Loop - End near start (stop 3) without forcing round-trip TSP
4. Anti-ZigZag - Fewer sharp turns, not necessarily fewer total backtracks

---

## Phase 0 — Street-Graph Feasibility Spike (Jul 21)

### Day 1 — OSM coverage
- BBox (90 m pad): `minLng=-118.779376`, `minLat=34.264035`, `maxLng=-118.775970`, `maxLat=34.269452`
- Overpass returned **36** highway ways (**27** named) → [`data/phase0/streets.geojson`](../data/phase0/streets.geojson)
- Named streets hitting stops: Windmill Way, Violet Lane, Gardenia Lane, Rose Arbor Lane, Azalea Way, Golden Amber Lane, Marigold Lane, Walnut Grove Lane, Oleander Way, Silver Tree Lane
- Coverage check: every sample stop has a residential centerline nearby (confirmed Day 2: **25/25** snap with `offsetM ≤ 30`)
- Overlay for eyeballing: [`data/phase0/overlay.geojson`](../data/phase0/overlay.geojson) (open in geojson.io)

### Day 2 — Snap + side-of-street
- Mean snap offset: **9.95 m**; low-confidence (`offsetM < 1.5` or `> 30`): **0/25**
- Reverse geocode: **25/25** addresses with house numbers; **25/25** Mapbox `accuracy=rooftop` (no interpolated/centerline pins in this set)
- On Windmill Way, parity lined up with geometry: even numbers on east, odd on west (cross-check only)

#### Satellite verification (10 stops)

Blue pin = door, red pin = snap on centerline. Images in `data/phase0/satellite-checks/`.

| Stop | Human side | Algo side | offsetM | Match? | Notes |
|------|------------|-----------|---------|--------|-------|
| 1 | east | east | 11.34 | yes | Windmill Way east lot |
| 3 | east | east | 18.30 | yes | Cul-de-sac; snap at way endpoint |
| 5 | east | east | 10.94 | yes | Near Windmill/Oleander curve |
| 7 | south | south | 6.76 | yes | Gardenia→Rose Arbor bend |
| 10 | south | south | 4.43 | yes | Azalea Way; smaller offset still clear |
| 14 | east | east | 5.74 | yes | Marigold Lane east driveway |
| 16 | west | west | 7.63 | yes | Windmill Way west (odd #) |
| 18 | west | west | 14.45 | yes | Violet Lane west roof |
| 22 | west | west | 10.42 | yes | Silver Tree Lane west |
| 25 | north | north | 9.68 | yes | Walnut Grove Lane north |

**Side accuracy: 10/10**

### GO / NO-GO

**Decision: GO** — proceed to Phase 1 (`lib/streets/*`, enriched stops, segment sequencing).

Criteria:
- OSM coverage ≥95% with `offsetM ≤ 30`: **100% (25/25)**
- Side accuracy ≥8/10: **10/10**
- Low-confidence rate <20%: **0%**
- Mismatches explainable: none in sample; note cul-de-sac endpoint snaps + sharp bends for Phase 1 edge-case handling

Reproduce:
```bash
npm run phase0:fetch-streets
npm run phase0:snap
npm run phase0:verify
```
