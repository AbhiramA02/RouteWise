/* This file utilizes the Distance/Durations Matrices to contruct the TSP Route */
import { type PenaltyWeights, DEFAULT_PENALTY_WEIGHTS } from "@/lib/optimization/types"; // Penalty Settings
import { type StopCoord, detectionDominantAxis, effectiveLegCost, nextSweepSign, type LegPenaltyContext, project } from "@/lib/optimization/penalties";

export type TspOptions = {
    startIndex?: number;
    endIndex?: number;
};

export type TspResult = {
    order: number[];
    totalCost: number;
};

export type TspSolveContext = {
    stops: StopCoord[];
    penaltyWeights?: PenaltyWeights;
    /* Indices to use for dominant-axis detection (cluster stops or all). */
    axisIndices?: number[];
}

export type OpenRouteOptions = {
    startIndex?: number;
    penaltyWeights?: PenaltyWeights;
    stops?: StopCoord[];
};

export type OpenRouteResult = {
    order: number[];
    totalDurationSeconds: number;
    totalPenaltySeconds: number;
    optimizationCost: number;
    startIndex: number;
};

function sumMatrixDuration(durations: number[][], order: number[]): number {
    let total = 0;
    for (let i = 0; i < order.length - 1; i++) {
        total += durations[order[i]][order[i + 1]];
    }

    return total;
}

// Greedy Nearest-Neighbor Open-Path TSP Solver
export function solveGreedyOpenTsp(cost: number[][], options: TspOptions = {}, solveContext?: TspSolveContext): TspResult {
    const n = cost.length;
    if (n === 0) {return { order: [], totalCost: 0 };}
    if (n === 1) {return { order: [0], totalCost: 0 };}

    const startIndex = options.startIndex ?? 0;
    const endIndex = options.endIndex;

    if (startIndex < 0 || startIndex >= n) {
        throw new Error(`startIndex ${startIndex} is out of bounds`);
    }

    if (endIndex != null) {
        if (endIndex < 0 || endIndex >= n) {
            throw new Error(`endIndex ${endIndex} is out of bounds`);
        }
        if (endIndex === startIndex) {
            throw new Error("startIndex and endIndex must differ")
        }
    }

    const visited = new Set<number>();
    const order: number[] = [startIndex];
    visited.add(startIndex);

    let totalCost = 0;
    let current = startIndex;

    // Visit until only end remains (if fixed), or until all visited 
    const targetLength = endIndex != null ? n - 1 : n;

    const weights = solveContext?.penaltyWeights; // Existing Penalty Weights?
    const usePenalties = weights != null && solveContext != null;
    const axisIndices = solveContext?.axisIndices ?? Array.from({ length: cost.length }, (_, i) => i); // Detect Dominant Axis
    const axis = usePenalties ? detectionDominantAxis(solveContext!.stops, axisIndices) : "lng";

    let sweepSign: 1 | -1 | null = null;
    let prev: number | null = null;

    // Selects the Unvisited Stops that is closest to the Current Stop
    while (order.length < targetLength) {
        let bestNext = -1;
        let bestCost = Number.POSITIVE_INFINITY;

        for (let candidate = 0; candidate < n; candidate++) {
            if (visited.has(candidate)) continue;
            if (endIndex != null && candidate === endIndex) continue;

            let legCost: number;
            if (usePenalties) {
                const ctx: LegPenaltyContext = { stops: solveContext!.stops, axis, sweepSign, prevIndex: prev, currentIndex: current, weights: weights! };
                legCost = effectiveLegCost(cost, ctx, candidate);
            } else {
                legCost = cost[current][candidate];
            }

            if (legCost < bestCost) {
                bestCost = legCost;
                bestNext = candidate;
            }
        }

        if (bestNext === -1 || !Number.isFinite(bestCost)) {
            throw new Error("No reachable unvisited stop remains");
        }

        order.push(bestNext);
        visited.add(bestNext);
        totalCost += bestCost;

        if (usePenalties) {
            const ctx: LegPenaltyContext = { stops: solveContext!.stops, axis, sweepSign, prevIndex: prev, currentIndex: current, weights: weights! };
            sweepSign = nextSweepSign(ctx, bestNext);
        }
        
        prev = current;
        current = bestNext;
    }

    if (endIndex != null) {
        const finalLeg = cost[current][endIndex];
        if (!Number.isFinite(finalLeg)) {
            throw new Error("No walking route to fixed end stop");
        }
        order.push(endIndex);
        totalCost += finalLeg;
    }

    return { order, totalCost };
}

export function solveOpenRoute(durations: number[][], options: OpenRouteOptions = {}): OpenRouteResult {
    const startIndex = options.startIndex ?? 0;
    const solveContext = options.stops != null ? { 
        stops: options.stops,
        penaltyWeights: options.penaltyWeights ?? DEFAULT_PENALTY_WEIGHTS,
     } : undefined;

     const { order, totalCost } = solveGreedyOpenTsp(durations, { startIndex }, solveContext);

     const totalDurationSeconds = sumMatrixDuration(durations, order);
     const totalPenaltySeconds = totalCost - totalDurationSeconds;

     return {
        order,
        totalDurationSeconds,
        totalPenaltySeconds,
        optimizationCost: totalCost,
        startIndex,
     };
}