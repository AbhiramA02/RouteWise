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