/* This file creates a backend endpoint that is called when Optimize is selected */
/* Calls matrix.ts to get duration/distance matrices */
/* Calls tsp.ts to solve and get the Order/Duration from theTSP */

import { NextRequest, NextResponse } from "next/server";
import { getWalkingDurationMatrix } from "@/lib/mapbox/matrix";
import type { OptimizeRequest, OptimizeResponse } from "@/lib/optimization/types";
import { solveGreedyOpenTsp } from "@/lib/optimization/tsp";

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
            return NextResponse.json( { error: "Each stop must have id, lat, and lng" }, { status: 400 });
        }

        if (stop.lat < -90 || stop.lat > 90 || stop.lng < -180 || stop.lng > 180) {
            return NextResponse.json(
                { error: `Stop ${stop.id} has out-of-bounds coordinates`},
                { status: 400 }
            );
        }
    }

    // Validate Start Index
    if (body.startIndex != null){
        if (!Number.isInteger(body.startIndex) || body.startIndex < 0 || body.startIndex >= stops.length) {
            return NextResponse.json(
                { error: "Invalid startIndex" },
                { status: 400 }
            );
        }
    }

    try {
        const { durations, distances } = await getWalkingDurationMatrix(stops);
        const startIndex = body.startIndex ?? 0;
        const { order, totalCost } = solveGreedyOpenTsp(durations, { startIndex, });
        const response: OptimizeResponse = {
            stops,
            durations,
            distances,
            order,
            totalDurationSeconds: totalCost,
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