/* This is a server-side helper that converts Ordered Stops to a real Mapbox Walking Route */
import "server-only";

const MAPBOX_DIRECTIONS_BASE = "https://api.mapbox.com/directions/v5/mapbox/walking";

type DirectionsCoordinate = {
    lng: number;
    lat: number;
};

export type WalkingDirectionsResult = {
    geometry: {
        type: "LineString";
        coordinates: [number, number][];
    };
    durationSeconds: number;
    distanceMeters: number;
};

function getSecretToken(): string {
    const token = process.env.MAPBOX_SECRET_TOKEN;
    if (!token) {
        throw new Error("MAPBOX_SECRET_TOKEN is not configured");
    }

    return token;
}

function formatWaypointPath(stops: DirectionsCoordinate[]): string {
    return stops.map((s) => `${s.lng},${s.lat}`).join(";");
}

export async function getWalkingDirections(stopsInOrder: DirectionsCoordinate[]): Promise<WalkingDirectionsResult> {
    if (stopsInOrder.length < 2) {
        throw new Error("At least 2 stops required for directions");
    }

    if (stopsInOrder.length > 25) {
        throw new Error("Mapbox Directions supports at most 25 waypoints");
    }

    const token = getSecretToken();
    const path = formatWaypointPath(stopsInOrder);

    const url = new URL(`${MAPBOX_DIRECTIONS_BASE}/${path}`);

    url.searchParams.set("access_token", token);
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("overview", "full");

    const response = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
        },
    });

    if (response.status === 429) {
        throw new Error("Mapbox rate limit reached");
    }

    if (!response.ok) {
        throw new Error(`Mapbox directions failed: ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route?.geometry) {
        throw new Error("No route geometry returned");
    }

    return {
        geometry: route.geometry,
        durationSeconds: route.duration,
        distanceMeters: route.distance,
    };
}