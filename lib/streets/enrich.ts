/* This file provides the complete workflow for connecting types.ts, bbox.ts, overpass.ts, snap.ts, and side.ts */
import { computePaddedBoundingBox } from "./bbox";
import { fetchWaysForBbox, waysToSegments } from "./overpass";
import { HIGH_OFFSET_M, snapDoorToSegment } from "./snap";
import { sideOfStreet } from "./side";
import type { BBox, EnrichedStop, StreetSegment, StreetStopInput, StreetWay } from "./types";

export type EnrichResult = { // Defines the return type for enrichStops function
    stops: EnrichedStop[];
    ways: StreetWay[];
    segments: StreetSegment[];
    bbox: BBox;
    summary: {
        stopCount: number;
        wayCount: number;
        segmentCount: number;
        snappedOk: number;
        lowConfidence: number;
        meanOffsetM: number;
    };
};

export async function enrichStops(
    stops: StreetStopInput[],
    options?: { paddingMeters?: number },
): Promise<EnrichResult> {
    const bbox = computePaddedBoundingBox(stops, options?.paddingMeters ?? 90);
    const ways = await fetchWaysForBbox(bbox);
    const segments = waysToSegments(ways);

    const enriched: EnrichedStop[] = stops.map((stop) => {
        const snap = snapDoorToSegment(stop, segments);
        if (!snap.segment || snap.snapLng == null || snap.snapLat == null) {
            return {
                ...stop,
                osmWayId: null,
                segmentId: null,
                streetNameOsm: null,
                alongDistM: null,
                t: null,
                offsetM: null,
                side: null,
                compassSide: null,
                lowConfidence: true,
                lowConfidenceReasons: [...snap.lowConfidenceReasons]
            };
        }

        const side = sideOfStreet({
            doorLng: stop.lng,
            doorLat: stop.lat,
            snapLng: snap.snapLng,
            snapLat: snap.snapLat,
            segStart: snap.segment.start,
            segEnd: snap.segment.end,
        });

        const reasons: string[] = [...snap.lowConfidenceReasons];
        if (side.side === "on_line") reasons.push("on_centerline");

        return {
            ...stop,
            osmWayId: snap.segment.osmWayId,
            segmentId: snap.segment.id,
            streetNameOsm: snap.segment.name,
            alongDistM: snap.alongDistM,
            t: snap.t,
            offsetM: snap.offsetM,
            side: side.side,
            compassSide: side.compassSide,
            lowConfidence: reasons.length > 0,
            lowConfidenceReasons: reasons,
        };
    });

    const offsets = enriched.map((s) => s.offsetM).filter((n): n is number => n != null);

    const summary = {
        stopCount: enriched.length,
        wayCount: ways.length,
        segmentCount: segments.length,
        snappedOk: enriched.filter(
            (s) => s.offsetM != null && s.offsetM <= HIGH_OFFSET_M,
        ).length,
        lowConfidence: enriched.filter((s) => s.lowConfidence).length,
        meanOffsetM: offsets.length === 0 ? 0 : Number((offsets.reduce((a, b) => a + b, 0) / offsets.length).toFixed(2)),
    };

    return { stops: enriched, ways, segments, bbox, summary };
}