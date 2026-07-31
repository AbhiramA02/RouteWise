/* This file uses the nearest midpoint strategy in order to return segment order. */
import distance from "@turf/distance";
import type { EnrichedStop, StreetSegment } from "./types";
import { activeSegments, groupStopsBySegment, segmentMidpoint, type SegmentAdjacency } from "./graph";

// Order segments by selected the segment with the nearest midpoint to it (BACKUP METHOD - FALLBACK)
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

// Constants for scoring candidate segments
export const ADJACENCY_BONUS_M = 40;
export const SAME_WAY_BONUS_M = 60;

// Converts EnrichedStop into Coordinate Pair
function stopPoint(s: EnrichedStop): [number, number] {
    return [s.lng, s.lat];
}

// Determines better direction for entering/traversing each candidate segment
function entryCost(
    exit: [number, number],
    ordered: EnrichedStop[],
): { cost: number; chosen: EnrichedStop[] } {
    const forward = ordered; // forward traversal order
    const backward = [...ordered].reverse(); // backward traversal order
    const dF = distance(exit, stopPoint(forward[0]), {units: "meters"}); // distance to first stop in forward order
    const dB = distance(exit, stopPoint(backward[0]), { units: "meters" }); // distance to first stop in backward order
    return dB < dF ? { cost: dB, chosen: backward } : { cost: dF, chosen: forward }; // choose the shorter distance (cheaper direction)
}

// This defines the shape of the final result returned by the sequencing algorithm
export type SequenceResult = {
    stops: EnrichedStop[];
    orderedSegments: StreetSegment[];
};

/* Production Sequencer: Joint Next-Segment + Orientation from Current Exit (INCOMPLETE) */
export function sequenceActiveSegments(
    segments: StreetSegment[],
    stops: EnrichedStop[],
    options?: { 
        startStopId?: string;
        adjacency?: SegmentAdjacency;
        adjacencyBonusM?: number;
        sameWayBonusM?: number;
    },
): SequenceResult {
    const bySegment = groupStopsBySegment(stops);
    const active = activeSegments(segments, bySegment);
    if (active.length === 0) return { stops: [], orderedSegments: []};

    const adj = options?.adjacency ?? buildSegmentAdjacency(segments);
    const adjBonus = options?.adjacencyBonusM ?? ADJACENCY_BONUS_M;
    const wayBonus = options?.sameWayBonusM ?? SAME_WAY_BONUS_M;
    const startStopId = options?.startStopId ?? "1";
    const startStop = stops.find((s) => s.id === startStopId);

    const remaining = new Set(active.map((s) => s.id));
    const byId = new Map(active.map((s) => [s.id, s]));
    const out: EnrichedStop[] = [];
    const orderedSegments: StreetSegment[] = [];
}