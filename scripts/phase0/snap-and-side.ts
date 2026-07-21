/**
 * Phase 0 Day 2 — Snap each sample stop to the nearest OSM street segment
 * and infer side-of-street via cross product in a local meter frame.
 *
 * Run: npx tsx scripts/phase0/snap-and-side.ts
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { PHASE0_STOPS, type Phase0Stop } from "./stops";

const STREETS_PATH = path.join(process.cwd(), "data/phase0/streets.geojson");
const RESULTS_PATH = path.join(process.cwd(), "data/phase0/snap-results.json");
const OVERLAY_PATH = path.join(process.cwd(), "data/phase0/overlay.geojson");

const LOW_OFFSET_M = 1.5;
const HIGH_OFFSET_M = 30;

type StreetProperties = {
    osmId: number;
    name: string | null;
    highway: string | null;
};

type StreetFeature = Feature<LineString, StreetProperties>;

type SideLR = "left" | "right" | "on_line";
type CompassSide = "north" | "south" | "east" | "west" | "on_line";

export type SnapResult = {
    id: string;
    lat: number;
    lng: number;
    osmWayId: number | null;
    streetName: string | null;
    highway: string | null;
    offsetM: number | null;
    alongDistM: number | null;
    snapLng: number | null;
    snapLat: number | null;
    segmentBearingDeg: number | null;
    side: SideLR | null;
    compassSide: CompassSide | null;
    lowConfidence: boolean;
    lowConfidenceReasons: string[];
};

function metersPerDegree(lat: number): { metersPerDegLat: number; metersPerDegLng: number } {
    const metersPerDegLat = 111_320;
    const metersPerDegLng = metersPerDegLat * Math.cos((lat * Math.PI) / 180);
    return { metersPerDegLat, metersPerDegLng };
}

function sideOfStreet(
    doorLng: number,
    doorLat: number,
    snapLng: number,
    snapLat: number,
    segStart: [number, number],
    segEnd: [number, number],
): { side: SideLR; compassSide: CompassSide; bearingDeg: number } {
    const { metersPerDegLat, metersPerDegLng } = metersPerDegree(snapLat);

    const tx = (segEnd[0] - segStart[0]) * metersPerDegLng;
    const ty = (segEnd[1] - segStart[1]) * metersPerDegLat;
    const ox = (doorLng - snapLng) * metersPerDegLng;
    const oy = (doorLat - snapLat) * metersPerDegLat;

    const cross = tx * oy - ty * ox;
    const offsetMag = Math.hypot(ox, oy);

    const bearingDeg = turf.bearing(turf.point(segStart), turf.point(segEnd));
    const absBearing = ((bearingDeg % 360) + 360) % 360;
    const streetIsEastWest =
        (absBearing >= 45 && absBearing < 135) || (absBearing >= 225 && absBearing < 315);

    if (offsetMag < 0.05) {
        return { side: "on_line", compassSide: "on_line", bearingDeg };
    }

    const side: SideLR = cross > 0 ? "left" : "right";

    // Compass side of the street: which side of the centerline the door sits on.
    let compassSide: CompassSide;
    if (streetIsEastWest) {
        compassSide = oy > 0 ? "north" : "south";
    } else {
        compassSide = ox > 0 ? "east" : "west";
    }

    return { side, compassSide, bearingDeg };
}

function segmentAroundLocation(
    line: Feature<LineString>,
    locationM: number,
): { start: [number, number]; end: [number, number] } {
    const coords = line.geometry.coordinates as [number, number][];
    if (coords.length < 2) {
        throw new Error("LineString needs at least 2 coordinates");
    }

    let traveled = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const start = coords[i];
        const end = coords[i + 1];
        const segLen = turf.distance(turf.point(start), turf.point(end), { units: "meters" });
        if (traveled + segLen >= locationM || i === coords.length - 2) {
            return { start, end };
        }
        traveled += segLen;
    }

    return {
        start: coords[coords.length - 2],
        end: coords[coords.length - 1],
    };
}

function snapDoorToStreets(stop: Phase0Stop, streets: StreetFeature[]): SnapResult {
    const door = turf.point([stop.lng, stop.lat]);

    let best: {
        feature: StreetFeature;
        offsetM: number;
        locationM: number;
        snap: [number, number];
    } | null = null;

    for (const feature of streets) {
        const snapped = turf.nearestPointOnLine(feature, door, { units: "meters" });
        const offsetM = snapped.properties.dist ?? Number.POSITIVE_INFINITY;
        const locationM = snapped.properties.location ?? 0;
        const snap = snapped.geometry.coordinates as [number, number];

        if (!best || offsetM < best.offsetM) {
            best = { feature, offsetM, locationM, snap };
        }
    }

    if (!best) {
        return {
            id: stop.id,
            lat: stop.lat,
            lng: stop.lng,
            osmWayId: null,
            streetName: null,
            highway: null,
            offsetM: null,
            alongDistM: null,
            snapLng: null,
            snapLat: null,
            segmentBearingDeg: null,
            side: null,
            compassSide: null,
            lowConfidence: true,
            lowConfidenceReasons: ["no_streets"],
        };
    }

    const { start, end } = segmentAroundLocation(best.feature, best.locationM);
    const { side, compassSide, bearingDeg } = sideOfStreet(
        stop.lng,
        stop.lat,
        best.snap[0],
        best.snap[1],
        start,
        end,
    );

    const reasons: string[] = [];
    if (best.offsetM < LOW_OFFSET_M) reasons.push("offset_too_small");
    if (best.offsetM > HIGH_OFFSET_M) reasons.push("offset_too_large");
    if (side === "on_line") reasons.push("on_centerline");

    return {
        id: stop.id,
        lat: stop.lat,
        lng: stop.lng,
        osmWayId: best.feature.properties.osmId,
        streetName: best.feature.properties.name,
        highway: best.feature.properties.highway,
        offsetM: Number(best.offsetM.toFixed(2)),
        alongDistM: Number(best.locationM.toFixed(2)),
        snapLng: best.snap[0],
        snapLat: best.snap[1],
        segmentBearingDeg: Number(bearingDeg.toFixed(1)),
        side,
        compassSide,
        lowConfidence: reasons.length > 0,
        lowConfidenceReasons: reasons,
    };
}

function buildOverlay(
    streets: FeatureCollection,
    results: SnapResult[],
): FeatureCollection {
    const stopFeatures = results.map((r) =>
        turf.point([r.lng, r.lat], {
            id: r.id,
            kind: "door",
            streetName: r.streetName,
            side: r.side,
            compassSide: r.compassSide,
            offsetM: r.offsetM,
            lowConfidence: r.lowConfidence,
        }),
    );

    const snapFeatures = results
        .filter((r) => r.snapLng != null && r.snapLat != null)
        .map((r) =>
            turf.point([r.snapLng!, r.snapLat!], {
                id: r.id,
                kind: "snap",
                streetName: r.streetName,
            }),
        );

    const connectors = results
        .filter((r) => r.snapLng != null && r.snapLat != null)
        .map((r) =>
            turf.lineString(
                [
                    [r.lng, r.lat],
                    [r.snapLng!, r.snapLat!],
                ],
                { id: r.id, kind: "offset", offsetM: r.offsetM },
            ),
        );

    return {
        type: "FeatureCollection",
        features: [...streets.features, ...stopFeatures, ...snapFeatures, ...connectors],
    };
}

async function main(): Promise<void> {
    const raw = await readFile(STREETS_PATH, "utf8");
    const streetsJson = JSON.parse(raw) as FeatureCollection;
    const streets = streetsJson.features.filter(
        (f): f is StreetFeature => f.geometry?.type === "LineString",
    ) as StreetFeature[];

    if (streets.length === 0) {
        throw new Error(`No LineString features in ${STREETS_PATH}. Run fetch-streets first.`);
    }

    const results = PHASE0_STOPS.map((stop) => snapDoorToStreets(stop, streets));

    const summary = {
        stopCount: results.length,
        wayCount: streets.length,
        snappedWithin30m: results.filter((r) => r.offsetM != null && r.offsetM <= HIGH_OFFSET_M).length,
        lowConfidenceCount: results.filter((r) => r.lowConfidence).length,
        meanOffsetM: Number(
            (
                results.reduce((sum, r) => sum + (r.offsetM ?? 0), 0) / results.length
            ).toFixed(2),
        ),
        byStreet: Object.fromEntries(
            [...new Set(results.map((r) => r.streetName ?? "(unnamed)"))].map((name) => [
                name,
                results.filter((r) => (r.streetName ?? "(unnamed)") === name).length,
            ]),
        ),
        results,
    };

    await mkdir(path.dirname(RESULTS_PATH), { recursive: true });
    await writeFile(RESULTS_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(
        OVERLAY_PATH,
        `${JSON.stringify(buildOverlay(streetsJson, results), null, 2)}\n`,
        "utf8",
    );

    console.log(
        JSON.stringify(
            {
                stopCount: summary.stopCount,
                wayCount: summary.wayCount,
                snappedWithin30m: summary.snappedWithin30m,
                lowConfidenceCount: summary.lowConfidenceCount,
                meanOffsetM: summary.meanOffsetM,
                byStreet: summary.byStreet,
            },
            null,
            2,
        ),
    );
    console.log(`Wrote ${RESULTS_PATH}`);
    console.log(`Wrote ${OVERLAY_PATH} (open in geojson.io)`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
