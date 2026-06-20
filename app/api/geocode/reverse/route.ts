/* This file creates a public "doorway" for Frontend to call the Mapbox Geocode API */
import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/mapbox/geocode";

export async function GET(request: NextRequest) {
    const latParam = request.nextUrl.searchParams.get("lat");
    const lngParam = request.nextUrl.searchParams.get("lng");

    const lat = latParam ? Number(latParam) : NaN;
    const lng = lngParam ? Number(lngParam) : NaN;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return NextResponse.json(
            { error: "lat and lng query params are required" },
            { status: 400 }
        );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
            { error: "Coordinates out of bounds" },
            { status: 400 }
        );
    }

    try {
        const result = await reverseGeocode(lat, lng);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Geocoding failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}