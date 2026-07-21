/**
 * Phase 0 Day 2 — Reverse-geocode all snaps and pull satellite static images
 * for a 10-stop verification sample.
 *
 * Run: npx tsx scripts/phase0/verify.ts
 * Requires MAPBOX_SECRET_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN in .env.local
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PHASE0_STOPS } from "./stops";

const RESULTS_PATH = path.join(process.cwd(), "data/phase0/snap-results.json");
const VERIFY_PATH = path.join(process.cwd(), "data/phase0/verify-results.json");
const IMAGES_DIR = path.join(process.cwd(), "data/phase0/satellite-checks");

/** Stops spanning multiple streets / sides / corners for human satellite review */
const VERIFY_STOP_IDS = ["1", "3", "5", "7", "10", "14", "16", "18", "22", "25"];

type SnapRow = {
    id: string;
    lat: number;
    lng: number;
    streetName: string | null;
    offsetM: number | null;
    side: string | null;
    compassSide: string | null;
    lowConfidence: boolean;
    snapLng: number | null;
    snapLat: number | null;
};

type SnapSummary = {
    results: SnapRow[];
};

type MapboxFeature = {
    place_name?: string;
    text?: string;
    address?: string;
    relevance?: number;
    properties?: { accuracy?: string };
};

async function loadEnvLocal(): Promise<void> {
    try {
        const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eq = trimmed.indexOf("=");
            if (eq < 0) continue;
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = value;
        }
    } catch {
        // rely on existing process env
    }
}

function getToken(): string {
    const token = process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) throw new Error("Missing MAPBOX_SECRET_TOKEN / NEXT_PUBLIC_MAPBOX_TOKEN");
    return token;
}

async function reverseGeocode(lat: number, lng: number, token: string) {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("types", "address,poi");
    url.searchParams.set("limit", "3");

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Geocode failed for ${lat},${lng}: ${response.status}`);
    }

    const data = (await response.json()) as { features?: MapboxFeature[] };
    const primary = data.features?.[0];
    const houseNumber =
        primary?.address ??
        (primary?.place_name?.match(/^(\d+)\s/)?.[1] ?? null);

    return {
        formattedAddress: primary?.place_name ?? null,
        placeName: primary?.text ?? null,
        houseNumber,
        accuracy: primary?.properties?.accuracy ?? null,
        relevance: primary?.relevance ?? null,
    };
}

async function downloadSatelliteCheck(
    row: SnapRow,
    token: string,
): Promise<string> {
    await mkdir(IMAGES_DIR, { recursive: true });
    const outPath = path.join(IMAGES_DIR, `stop-${row.id}.png`);

    // Blue pin = door, red pin = snap on centerline
    const overlays = [
        `pin-s+3b82f6(${row.lng},${row.lat})`,
        row.snapLng != null && row.snapLat != null
            ? `pin-s+ef4444(${row.snapLng},${row.snapLat})`
            : null,
    ]
        .filter(Boolean)
        .join(",");

    const url =
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
        `${overlays}/${row.lng},${row.lat},19,0/600x600@2x?access_token=${token}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Static image failed for stop ${row.id}: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outPath, buffer);
    return outPath;
}

async function main(): Promise<void> {
    await loadEnvLocal();
    const token = getToken();

    const snapSummary = JSON.parse(await readFile(RESULTS_PATH, "utf8")) as SnapSummary;
    const byId = new Map(snapSummary.results.map((r) => [r.id, r]));

    const geocodes = [];
    for (const stop of PHASE0_STOPS) {
        const geo = await reverseGeocode(stop.lat, stop.lng, token);
        const snap = byId.get(stop.id);
        geocodes.push({
            id: stop.id,
            ...geo,
            offsetM: snap?.offsetM ?? null,
            compassSide: snap?.compassSide ?? null,
            side: snap?.side ?? null,
            streetName: snap?.streetName ?? null,
            lowConfidence: snap?.lowConfidence ?? true,
        });
        // gentle pacing for rate limits
        await new Promise((r) => setTimeout(r, 120));
    }

    const verifyRows = [];
    for (const id of VERIFY_STOP_IDS) {
        const row = byId.get(id);
        if (!row) continue;
        const imagePath = await downloadSatelliteCheck(row, token);
        const geo = geocodes.find((g) => g.id === id);
        verifyRows.push({
            id,
            streetName: row.streetName,
            offsetM: row.offsetM,
            algoSide: row.side,
            algoCompassSide: row.compassSide,
            lowConfidence: row.lowConfidence,
            formattedAddress: geo?.formattedAddress ?? null,
            houseNumber: geo?.houseNumber ?? null,
            accuracy: geo?.accuracy ?? null,
            satelliteImage: imagePath,
            // Filled after visual review of satellite PNGs
            humanCompassSide: null as string | null,
            match: null as boolean | null,
            notes: null as string | null,
        });
        await new Promise((r) => setTimeout(r, 120));
    }

    const withHouseNumber = geocodes.filter((g) => g.houseNumber).length;
    const interpolatedLike = geocodes.filter(
        (g) => g.accuracy === "street" || g.accuracy === "interpolated" || (g.offsetM != null && g.offsetM < 1.5),
    ).length;

    const output = {
        geocodeSummary: {
            stopCount: geocodes.length,
            withHouseNumber,
            interpolatedOrCenterlineRisk: interpolatedLike,
        },
        geocodes,
        satelliteSample: verifyRows,
    };

    await writeFile(VERIFY_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(output.geocodeSummary, null, 2));
    console.log(`Wrote ${VERIFY_PATH}`);
    console.log(`Satellite images in ${IMAGES_DIR}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
