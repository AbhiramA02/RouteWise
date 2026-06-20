/* This file is a reusable helper that will construct API URLs for the Reverse Geocode API */
import type { ReverseGeocodeResult } from "@/lib/geocode/types";

export async function fetchReverseGeocode( lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const params = new URLSearchParams({lat: String(lat), lng: String(lng),});
    const response = await fetch(`/api/geocode/reverse?${params}`);

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Geocoding request failed");
    }

    return response.json();
}