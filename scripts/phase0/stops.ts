/* This script file converts raw stop information into reliable geographic data for OSM use */

import { SAMPLE_STOPS_TEXT } from "../../data/sample-stops";

export type Phase0Stop = {
    id: string;
    lat: number;
    lng: number;
};

export type BoundingBox = {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
};

export function parseStopsText(text: string): Phase0Stop[] {
    const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

    return lines.map((line, index) => {
        const parts = line.split(",").map((part) => part.trim());
        
        if (parts.length !== 2) {
            throw new Error(`Invalid stop on line ${index + 1}: expected "lat, lng", received "${line}"`);
        }

        const lat = Number(parts[0]);
        const lng = Number(parts[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error(`Invalid coordinates on line ${index + 1}: "${line}"`);
        }

        if (lat < -90 || lat > 90) {
            throw new Error(`Latitude out of range on line ${index + 1}: ${lat}`);
        }

        if (lng < -180 || lng > 180) {
            throw new Error(`Longitude out of range on line ${index + 1}: ${lng}`);
        }

        return {
            id: String(index + 1),
            lat,
            lng,
        };
    });
}

export function computePaddedBoundingBox(
    stops: readonly Phase0Stop[],
    paddingMeters = 90,
): BoundingBox {
    if(stops.length === 0) {
        throw new Error("Cannot calculate a bounding box with zero stops.");
    }

    if (!Number.isFinite(paddingMeters) || paddingMeters < 0) {
        throw new Error(`paddingMeters must be a non-negative number. Received: ${paddingMeters}`);
    }

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    let latitudeSum = 0;

    for (const stop of stops) {
        minLat = Math.min(minLat, stop.lat);
        maxLat = Math.max(maxLat, stop.lat);
        minLng = Math.min(minLng, stop.lng);
        maxLng = Math.max(maxLng, stop.lng);
        latitudeSum += stop.lat;
    }

    const averageLatitude = latitudeSum / stops.length;
    const averageLatitudeRadians = averageLatitude * (Math.PI / 180);

    const metersPerDegreeLatitude = 111_320;
    const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.cos(averageLatitudeRadians);
    
    const latitudePaddingDegrees = paddingMeters / metersPerDegreeLatitude;
    const longitudePaddingDegrees = paddingMeters / metersPerDegreeLongitude;

    return {
        minLng: minLng - longitudePaddingDegrees,
        minLat: minLat - latitudePaddingDegrees,
        maxLng: maxLng + longitudePaddingDegrees,
        maxLat: maxLat + latitudePaddingDegrees,
    };
}

export const PHASE0_STOPS = parseStopsText(SAMPLE_STOPS_TEXT);
export const PHASE0_BOUNDING_BOX = computePaddedBoundingBox(PHASE0_STOPS, 90);