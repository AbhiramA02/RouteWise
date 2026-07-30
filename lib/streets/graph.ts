/* This file groups stops by segment(street names/ids) and builds adjacency lists for each segment */
import distance from "@turf/distance";
import type { EnrichedStop, LngLat, StreetSegment } from "./types";

export const ENDPOINT_JOIN_M = 3;

// Defines Undirected Graph Structure
export type SegmentAdjacency = Map<string, Set<string>>; 

export function groupStopsBySegment(stops: EnrichedStop[]): Map<string, EnrichedStop[]> { // Organizes all stops by street segment
    const map = new Map<string, EnrichedStop[]>();
    for (const stop of stops) {
        if(!stop.segmentId) continue;
        const list = map.get(stop.segmentId) ?? []; // Checks if segmentId list exists, else create empty list
        list.push(stop); // Add stop to segment list
        map.set(stop.segmentId, list); // Set segmentId to list
    }
    return map;
}

// Calculates midpoint of a street segment (key for proximity-based ordering of segments)
export function segmentMidpoint(seg: StreetSegment): LngLat { 
    return [
        (seg.start[0] + seg.end[0]) / 2,
        (seg.start[1] + seg.end[1]) / 2,
    ];
}

// Checks if two endpoints are within a tolerance distance
function endpointsClose(a: LngLat, b: LngLat, tolM: number): boolean {
    return distance(a, b, { units: "meters" }) <= tolM;
}

// Creates adjacency list for each segment (street)
export function buildSegmentAdjacency(segments: StreetSegment[], tolM = ENDPOINT_JOIN_M): SegmentAdjacency {
    const adj: SegmentAdjacency = new Map();
    for (const s of segments) adj.set(s.id, new Set()); // Initialize empty adjacency list for each segment

    // Iterate through all segments and check they are within tolerance distance
    for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
            const a = segments[i];
            const b = segments[j];
            // Check specfically the start/endpoints of each segment are within tolerance of each other (touching)
            const touch = endpointsClose(a.start, b.start, tolM) || 
                endpointsClose(a.start, b.end, tolM) ||
                endpointsClose(a.start, b.end, tolM) ||
                endpointsClose(a.end, b.start, tolM) ||
                endpointsClose(a.end, b.end, tolM);
            if (!touch) continue;
            // If segments are touching, add each other to adjacency list
            adj.get(a.id)!.add(b.id);
            adj.get(b.id)!.add(a.id);
        }
    }
    return adj;
}

// Filter out all segments that have no stops (OSM returns all segments in BoundingBox)
export function activeSegments(segments: StreetSegment[], bySegment: Map<string, EnrichedStop[]>): StreetSegment[] {
    return segments.filter((s) => (bySegment.get(s.id)?.length ?? 0) > 0);
}