/* This file uses the nearest midpoint strategy in order to return segment order. */
import distance from "@turf/distance";
import type { EnrichedStop, StreetSegment } from "./types";
import { activeSegments, groupStopsBySegment, segmentMidpoint, type SegmentAdjacency } from "./graph";

// Order segments by selected the segment with the nearest midpoint to it
export function orderSegmentsNearestMidpoint(
    segments: StreetSegment[],
    stops: EnrichedStop[],
    options?: { startStopId?: string },
): StreetSegment[] {
    const bySegment = groupStopsBySegment(stops); // Group stops by segment
    const active = activeSegments(segments, bySegment); // Isolates active segments
    if (active.length === 0) return [];

    const startStopId = options?.startStopId ?? "1"; // Default to first stop
    const startStop = stops.find((s) => s.id === startStopId); 
    let start = active.find((s) => s.id === startStop?.segmentId) ?? active[0]; 

    const remaining = new Set(active.map((s) => s.id)); // Set of remaining segments
    const byId = new Map(active.map((s) => [s.id, s])); // Map of segments by id (lookup table)
    const ordered: StreetSegment[] = []; // Ordered segments

    let current = start;
    while (remaining.size > 0) { // Repeat until all segments are ordered
        ordered.push(current);
        remaining.delete(current.id);

        let bestId: string | null = null;
        let bestDist = Infinity;
        const curMid = segmentMidpoint(current);
        for (const id of remaining) { // Iterates over remaining segments and selects segment with the nearest midpoint
            const d = distance(curMid, segmentMidpoint(byId.get(id)!), { // Calculate distance to midpoint of selected segment
                units: "meters",
            });
            if (d < bestDist) { // Update best distance (keep closest segment)
                bestDist = d;
                bestId = id;
            }
        }
        if (bestId == null) break;
        current = byId.get(bestId)!;
    }
    return ordered;
}

// Implements a order pattern using boustrophedon (ox-turn) style
export function orderStopsOnSegment(stopsOnSeg: EnrichedStop[]): EnrichedStop[] {
    const right = stopsOnSeg
    .filter((s) => s.side === "right" || s.side === "on_line" || s.side == null) // Filters stops on segment that are on right
    .sort((a,b) => (a.alongDistM ?? 0) - (b.alongDistM ?? 0)); // Sorts stops by distance along segment (globally ordered)

    const left = stopsOnSeg
    .filter((s) => s.side === "left") // Filters stops on segment that are on left
    .sort((a, b) => (b.alongDistM ?? 0) - (a.alongDistM ?? 0)); // Sorts backwards (descending)
    
    return [...right, ...left];
}