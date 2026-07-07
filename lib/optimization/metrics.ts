/* This file is used to develop/record metrics that will be used to evaluate MVP Route Solver Performance */
import { detectionDominantAxis, haversineMeters, project, type StopCoord } from "@/lib/optimization/penalties";

const AXIS_EPSILON = 1e-7; // Prevents Coordinate Comparison Errors

// Computes real walking time after order is solved (without penalties)
export function totalMatrixDuration(durations: number[][], order: number[]): number {
    let total = 0;
    for (let i = 0; i < order.length - 1; i++) {
        const leg = durations[order[i]][order[i + 1]];
        if (!Number.isFinite(leg)) {
            return Number.POSITIVE_INFINITY;
        }

        total += leg;
    }

    return total;
}

// Computes number of backtracks (opposite direction travel) in a given order
export function countBacktracks(order: number[], stops: StopCoord[]): number {
    if (order.length < 3) {return 0;}

    const axis = detectionDominantAxis(stops, order);
    
    let backtracks = 0;
    let sweepSign: 1 | -1 | null = null;

    for (let i = 0; i < order.length - 1; i++) {
        const from = stops[order[i]];
        const to = stops[order[i + 1]];
        const delta = project(to, axis) - project(from, axis);

        if (Math.abs(delta) < AXIS_EPSILON) continue;

        const sign: 1 | -1 = delta > 0 ? 1 : -1;

        if (sweepSign != null && sign !== sweepSign) {
            backtracks += 1;
        }
        sweepSign = sign;
    }

    return backtracks;
}

export function countSkipNearbyLegs( durations: number[][], order: number[], nearbyWalkSeconds: number ): number {
    if (order.length < 2) return 0;

    const unvisited = new Set(order);
    let count = 0;

    for (let i = 0; i < order.length - 1; i++) {
        const current = order[i];
        const next = order[i + 1];
        unvisited.delete(current);

        const toNext = durations[current][next];
        if (!Number.isFinite(toNext)) continue;

        for (const k of unvisited) {
            if (k === next) continue;

            const toK = durations[current][k];
            if (Number.isFinite(toK) && toK <= nearbyWalkSeconds && toK < toNext) {
                count += 1;
                break;
            }
        }
    }

    return count;
}