/**
 * Phase 0 Day 1 — Fetch OSM highway ways for the sample-stop bbox via Overpass.
 * Writes data/phase0/streets.geojson for offline Day 2 snapping.
 *
 * Run: npx tsx scripts/phase0/fetch-streets.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PHASE0_BOUNDING_BOX, type BoundingBox } from "./stops";

const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const OUTPUT_PATH = path.join(process.cwd(), "data/phase0/streets.geojson");

const HIGHWAY_FILTER =
    "^(residential|living_street|tertiary|secondary|unclassified|service)$";

type OverpassWay = {
    type: "way";
    id: number;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
};

type OverpassResponse = {
    elements?: OverpassWay[];
};

type StreetFeatureProperties = {
    osmId: number;
    name: string | null;
    highway: string | null;
};

type StreetFeatureCollection = {
    type: "FeatureCollection";
    features: Array<{
        type: "Feature";
        properties: StreetFeatureProperties;
        geometry: {
            type: "LineString";
            coordinates: [number, number][];
        };
    }>;
};

function buildOverpassQuery(bbox: BoundingBox): string {
    // Overpass bbox order: south,west,north,east
    const { minLat, minLng, maxLat, maxLng } = bbox;
    return `
[out:json][timeout:90];
way["highway"~"${HIGHWAY_FILTER}"](${minLat},${minLng},${maxLat},${maxLng});
out geom;
`.trim();
}

function overpassToGeoJson(data: OverpassResponse): StreetFeatureCollection {
    const features: StreetFeatureCollection["features"] = [];

    for (const element of data.elements ?? []) {
        if (element.type !== "way") continue;

        const geometry = element.geometry;
        if (!geometry || geometry.length < 2) continue;

        const coordinates: [number, number][] = geometry.map((n) => [n.lon, n.lat]);

        features.push({
            type: "Feature",
            properties: {
                osmId: element.id,
                name: element.tags?.name ?? null,
                highway: element.tags?.highway ?? null,
            },
            geometry: {
                type: "LineString",
                coordinates,
            },
        });
    }

    return { type: "FeatureCollection", features };
}

async function fetchStreets(bbox: BoundingBox): Promise<StreetFeatureCollection> {
    const query = buildOverpassQuery(bbox);
    const body = new URLSearchParams({ data: query }).toString();
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": "RoutewisePhase0/0.1 (street-graph feasibility spike)",
    };

    let lastError: Error | null = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
        console.log(`Trying ${endpoint}...`);
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                body,
            });

            if (!response.ok) {
                const text = await response.text();
                lastError = new Error(
                    `${endpoint} → ${response.status} ${response.statusText}\n${text.slice(0, 300)}`,
                );
                console.warn(lastError.message);
                continue;
            }

            const data = (await response.json()) as OverpassResponse;
            return overpassToGeoJson(data);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`${endpoint} failed:`, lastError.message);
        }
    }

    throw lastError ?? new Error("All Overpass endpoints failed");
}

async function main(): Promise<void> {
    console.log("Phase 0 bbox:", PHASE0_BOUNDING_BOX);
    console.log("Fetching OSM highways from Overpass...");

    const collection = await fetchStreets(PHASE0_BOUNDING_BOX);

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(collection, null, 2)}\n`, "utf8");

    const named = collection.features.filter((f) => f.properties.name).length;
    console.log(`Wrote ${collection.features.length} ways (${named} named) → ${OUTPUT_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
