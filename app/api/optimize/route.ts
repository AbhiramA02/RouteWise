/* This file creates a backend endpoint that is called when Optimize is selected */
/* Calls matrix.ts to get duration/distance matrices */

import { NextRequest, NextResponse } from "next/server";
import { getWalkingDurationMatrix } from "@/lib/mapbox/matrix";
import type { OptimizeRequest, OptimizeResponse } from "@/lib/optimization/types";

export async function POST(request: NextRequest) {
    let body: OptimizeRequest;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const { stops } = body;

    if (!Array.isArray(stops) || stops.length < 2) {
        return NextResponse.json(
            { error: "At least 2 stops are required" },
            { status: 400 }
        );
    }

    if (stops.length > 25) {
        return NextResponse.json(
            { error: "At most 25 stops are supported" },
            { status: 400 }
        );
    }

    for (const stop of stops) {
        if (!stop.id || typeof stop.lat !== "number" || typeof stop.lng !== "number") {
            return NextResponse.json( { error: "Each stop must have id, lat, lng" }, { status: 400 });
        }

        if (stop.lat < -90 || stop.lat > 90 || stop.lng < -180 || stop.lng > 180) {
            return NextResponse.json(
                { error: `Stop ${stop.id} has out-of-bounds coordinates`},
                { status: 400 }
            );
        }
    }

    try {
        const { durations, distances } = await getWalkingDurationMatrix(stops);
        const response: OptimizeResponse = {
            stops,
            durations,
            distances,
            order: null,
        };

        return NextResponse.json(response);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Optimization failed";
        return NextResponse.json(
            { error: message },
            { status: 502 }
        );
    }
}