import { BBox } from "./types";

export function computePaddedBoundingBox(
    stops: readonly {lat: number, lng: number}[],
    paddingMeters = 90,
): BBox {
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

export function bboxCacheKey(bbox: BBox, decimals = 5): string {
    const r = (n: number) => n.toFixed(decimals);
    return `${r(bbox.minLng)}_${r(bbox.minLat)}_${r(bbox.maxLng)}_${r(bbox.maxLat)}`;
}