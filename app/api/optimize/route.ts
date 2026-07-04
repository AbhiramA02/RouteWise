/* This file creates a backend endpoint that is called when Optimize is selected */
/* Calls matrix.ts to get duration/distance matrices */
/* Calls tsp.ts to solve and get the Order/Duration from the TSP */
/* Calls directions.ts to get the Complete Route Geometry */

import { NextRequest, NextResponse } from "next/server";
import { getWalkingDurationMatrix } from "@/lib/mapbox/matrix";
import type { OptimizeRequest, OptimizeResponse } from "@/lib/optimization/types";
import { getWalkingDirections } from "@/lib/mapbox/directions";
import { solveOpenRoute } from "@/lib/optimization/tsp";
import { DEFAULT_PENALTY_WEIGHTS } from "@/lib/optimization/types";
import { totalMatrixDuration, countBacktracks } from "@/lib/optimization/metrics";

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

    const penaltyWeights = body.penaltyWeights ?? DEFAULT_PENALTY_WEIGHTS;

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

        const { order, totalDurationSeconds, totalPenaltySeconds, optimizationCost, } = solveOpenRoute(durations, {
            startIndex,
            stops: stops.map((s) => ({ lat: s.lat, lng: s.lng })),
            penaltyWeights,
        });

        const stopCoords = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
        const pasteOrder = stops.map((_, index) => index);
        const pasteOrderDurationSeconds = totalMatrixDuration(durations, pasteOrder);
        const backtrackCount = countBacktracks(order, stopCoords);

        const stopsInVisitOrder = order.map((index) => ({
            lng: stops[index].lng, 
            lat: stops[index].lat
        }));

        let routeGeometry = null;
        let routeDurationSeconds = null;
        let routeDistanceMeters = null;

        try {
            const directions = await getWalkingDirections(stopsInVisitOrder);

            routeGeometry = directions.geometry;
            routeDurationSeconds = directions.durationSeconds;
            routeDistanceMeters = directions.distanceMeters;
        } catch (directionsError) {
            console.error("Directions failed:", directionsError);
        }
        
        const response: OptimizeResponse = {
            stops,
            durations,
            distances,
            order,
            startIndex,
            totalDurationSeconds,
            totalPenaltySeconds,
            optimizationCost,
            routeGeometry,
            routeDurationSeconds,
            routeDistanceMeters,
            penaltyWeights,
            backtrackCount,
            pasteOrderDurationSeconds,
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