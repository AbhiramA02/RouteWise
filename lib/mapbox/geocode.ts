/* This is a server-only helper module for Mapbox Geocoding API */
import "server-only";
import type { GeocodeCandidate, ReverseGeocodeResult } from "@/lib/geocode/types";

const MAPBOX_GEOCODE_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

type MapboxFeature = {
    place_name: string;
    text?: string;
    relevance?: number;
};

type MapboxGeocodeResponse = {
    features?: MapboxFeature[];
};

function getSecretToken(): string { /* Get the Mapbox Secret Token from the Environment Variables */
    const token = process.env.MAPBOX_SECRET_TOKEN;
    if(!token) {
        throw new Error("MAPBOX_SECRET_TOKEN is not configured");
    }

    return token;
}

function mapFeature(feature: MapboxFeature): GeocodeCandidate { /* Converts Raw Mapbox Address to GeocodeCandidate */
    return {
        formattedAddress: feature.place_name,
        placeName: feature.text ?? feature.place_name,
        confidence: feature.relevance,
    };
}

/* Key Geocode Reverse Function*/
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    // Creates the Request URL for the Mapbox Geocode API
    const token = getSecretToken();
    const url = new URL(`${MAPBOX_GEOCODE_BASE}/${lng},${lat}.json`);

    url.searchParams.set("access_token", token);
    url.searchParams.set("types", "address,poi");
    url.searchParams.set("limit", "5");

    // Sends Request to Mapbox Geocode API & Caches Response
    const response = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
        },
        next: {
            revalidate: 86400, //24 hours
        },
    });

    if (response.status === 429) {
        throw new Error("Mapbox rate limit reached. Please try again later.");
    }

    if (!response.ok) {
        throw new Error(`Mapbox geocode failed: ${response.status}`);
    }

    const data = (await response.json()) as MapboxGeocodeResponse;
    const features = data.features ?? [];

    if (features.length === 0) {
        return {
            primary: null,
            candidates: [],
        };
    }

    const candidates = features.map(mapFeature);

    return {
        primary: candidates[0],
        candidates,
    };
}

