/* This file implements 2-Opt Algorithm on existing TSP Solution */
import { type StopCoord, replayRouteCost } from "@/lib/optimization/penalties";
import { type PenaltyWeights } from "@/lib/optimization/types";

export type TwoOptOptions = {
    startIndex: number;
    stops: StopCoord[];
    penaltyWeights: PenaltyWeights;
    nearbyWalkSeconds?: number;
    clusterOf?: Map<number, number>;
};

export type TwoOptResult = {
    order: number[];
    optimizationCost: number;
    totalDurationSeconds: number;
    totalPenaltySeconds: number;
};

// Reverses segment of order between indices i and j (inclusive)
function reverseSegment(order: number[], i: number, j: number): number[] {
    const next = order.slice();
    while (i < j) {
        const tmp = next[i];
        next[i] = next[j];
        next[j] = tmp;
        i += 1;
        j -= 1;
    }
    return next;
}

export function improveOpenRoute2Opt(durations: number[][], order: number[], options: TwoOptOptions): TwoOptResult {
    if (order. length <= 3) {
        const finalCost = replayRouteCost(durations, order, { stops: options.stops, penaltyWeights: options.penaltyWeights, nearbyWalkSeconds: options.nearbyWalkSeconds, clusterOf: options.clusterOf });
        return { order: [...order], optimizationCost: finalCost.optimizationCost,  totalDurationSeconds: finalCost.totalDurationSeconds, totalPenaltySeconds: finalCost.totalPenaltySeconds };
    }

    // Safety: start must be first stop
    if (order[0] !== options.startIndex) {
        throw new Error("improveOpenRoute2Opt: order[0] must equal startIndex");
    }

    let best = [...order];
    let bestCost = replayRouteCost(durations, best, {
        stops: options.stops,
        penaltyWeights: options.penaltyWeights,
        nearbyWalkSeconds: options.nearbyWalkSeconds,
        clusterOf: options.clusterOf,
    }).optimizationCost;
    let improved = true;

    while (improved) {
        improved = false;

        for (let i = 1; i < best.length - 1; i++) {
            for (let j = i + 1; j < best.length; j++) {
                const candidate = reverseSegment(best, i, j);
                const { optimizationCost } = replayRouteCost(durations, candidate, {
                    stops: options.stops,
                    penaltyWeights: options.penaltyWeights,
                    nearbyWalkSeconds: options.nearbyWalkSeconds,
                    clusterOf: options.clusterOf,
                });

                if (optimizationCost < bestCost) {
                    best = candidate;
                    bestCost = optimizationCost;
                    improved = true;
                }
            }
        }
    }

    const finalCost = replayRouteCost(durations, best, { stops: options.stops, penaltyWeights: options.penaltyWeights, nearbyWalkSeconds: options.nearbyWalkSeconds, clusterOf: options.clusterOf });
    return { order: best, optimizationCost: finalCost.optimizationCost,  totalDurationSeconds: finalCost.totalDurationSeconds, totalPenaltySeconds: finalCost.totalPenaltySeconds };
}