/* This files finds the nearest point on a street segment and returns the snapped result, along distance, and other useful information */
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString, point } from "@turf/helpers";
import type { StreetSegment } from "./types";

export const LOW_OFFSET_M = 1.5;
export const HIGH_OFFSET_M = 30;

export type SnapLowConfidenceReason = 
    | "offset_too_small"
    | "offset_too_large"
    | "no_segment"

export type SnapResult = {
    segment: StreetSegment | null;
    snapLng: number | null;
    snapLat: number | null;
    offsetM: number | null;
    alongDistM: number | null; // meters along parent way
    t: number | null; // alongDistM / wayLengthM
    lowConfidence: boolean;
    lowConfidenceReasons: SnapLowConfidenceReason[];
};

function clamp01(n: number): number {
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

export function snapDoorToSegment(
    door: { lat: number, lng: number },
    segments: StreetSegment[],
): SnapResult {
    if (segments.length === 0) { // If No Segments, Return Null
        return {
            segment: null,
            snapLng: null,
            snapLat: null,
            offsetM: null,
            alongDistM: null,
            t: null,
            lowConfidence: true,
            lowConfidenceReasons: ["no_segment"],
        };
    }

    const doorPoint = point([door.lng, door.lat]); // Converts House Coordinate to GeoJSON Point for Turf

    let best: { // Stores Best Snap Result
        segment: StreetSegment;
        offsetM: number;
        locationOnSegM: number;
        snap: [number, number];
    } | null = null;

    for (const segment of segments) { 
        const line = lineString([segment.start, segment.end]); // Converts Segment to GeoJSON LineString for Turf
        const snapped = nearestPointOnLine(line, doorPoint, { // Finds Nearest Point on Line to Door Point
            units: "meters"
        });

        const offsetM = snapped.properties.pointDistance ?? Number.POSITIVE_INFINITY;
        const locationOnSegM = snapped.properties.segmentDistance ?? 0;
        const snap = snapped.geometry.coordinates as [number, number];

        if (!best || offsetM < best.offsetM) { // Updates Best if New Offset is Smaller
            best = { segment, offsetM, locationOnSegM, snap };
        }
    }

    if (!best) {
        return {
            segment: null,
            snapLng: null,
            snapLat: null,
            offsetM: null,
            alongDistM: null,
            t: null,
            lowConfidence: true,
            lowConfidenceReasons: ["no_segment"],
        }
    }

    const alongDistM = best.segment.alongStartM + best.locationOnSegM;
    const t = best.segment.wayLengthM > 0 
        ? clamp01(alongDistM / best.segment.wayLengthM) 
        : 0;

    const reasons: SnapLowConfidenceReason[] = [];
    if (best.offsetM < LOW_OFFSET_M) {reasons.push("offset_too_small");}
    if (best.offsetM > HIGH_OFFSET_M) {reasons.push("offset_too_large");}

    return {
        segment: best.segment,
        snapLng: best.snap[0],
        snapLat: best.snap[1],
        offsetM: Number(best.offsetM.toFixed(2)),
        alongDistM: Number(alongDistM.toFixed(2)),
        t: Number(t.toFixed(6)),
        lowConfidence: reasons.length > 0,
        lowConfidenceReasons: reasons,
    };
}