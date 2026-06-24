/* This is a server-side helper that talks to Mapbox Matrix API to Populate Duration/Distance Matrices */

import "server-only";

const MAPBOX_MATRIX_BASE = "https://api.mapbox.com/directions-matrix/v1/mapbox/walking";

type MatrixCoordinate = {
    lng: number;
    lat: number;
};

type WalkingMatrixResult = {
    durations: number[][];
    distances: number[][];
};

function getSecretToken(): string {
    const token = process.env.MAPBOX_SECRET_TOKEN;
    if (!token) {
        throw new Error("MAPBOX_SECRET_TOKEN is not configured");
    }

    return token;
}

function formatCoordinates(stops: MatrixCoordinate[]): string {
    return stops.map((stop) => `${stop.lng},${stop.lat}`).join(";");
}

function normalizeMatrix(matrix: (number | null)[][]): number[][] {
    return matrix.map((row) => row.map((value) => value === null ? Number.POSITIVE_INFINITY : value));
}

export async function getWalkingDurationMatrix(stops: MatrixCoordinate[]): Promise<WalkingMatrixResult> {
    if (stops.length < 2) {
        throw new Error("At least 2 stops are required for a matrix");
    }

    if (stops.length > 25) {
        throw new Error("Mapbox Matrix supports at most 25 stops");
    }

    const token = getSecretToken();
    const coordinates = formatCoordinates(stops);

    /* Performs Matrix Request to Mapbox API to get Walking Duration/Distance Matrix */
    const url = new URL(`${MAPBOX_MATRIX_BASE}/${coordinates}`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("annotations", "duration,distance");

    const response = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
        },
    });

    if (response.status === 429) {
        throw new Error("Mapbox rate limit reached. Please try again later.");
    }

    if (!response.ok) {
        throw new Error(`Mapbox matrix failed: ${response.status}`);
    }

    const data = await response.json();

    const durations = normalizeMatrix(data.durations as (number | null)[][]);
    const distances = normalizeMatrix(data.distances as (number | null)[][]);

    return {durations, distances};
}