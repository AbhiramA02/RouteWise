/* This file utilizes the Distance/Durations Matrices to contruct the TSP Route */
import { type PenaltyWeights, DEFAULT_PENALTY_WEIGHTS } from "@/lib/optimization/types"; // Penalty Settings
import { type StopCoord, detectionDominantAxis, buildLegCost, nextSweepSign, type LegPenaltyContext} from "@/lib/optimization/penalties";
import { totalMatrixDuration } from "@/lib/optimization/metrics";
import { improveOpenRoute2Opt } from "@/lib/optimization/two-opt";

export type TspOptions = { // Configures low-level TSP solver
    startIndex?: number;
    endIndex?: number;
};

export type TspResult = { // Result
    order: number[];
    totalCost: number;
};

export type TspSolveContext = {
    stops: StopCoord[];
    penaltyWeights?: PenaltyWeights;
    /* Indices to use for dominant-axis detection (cluster stops or all). */
    axisIndices?: number[];
}

export type OpenRouteOptions = { // Inputs for MVP Route Solver
    startIndex?: number;
    penaltyWeights?: PenaltyWeights;
    stops?: StopCoord[];
};

export type OpenRouteResult = {
    order: number[];
    totalDurationSeconds: number; // Mapbox walking time in seconds
    totalPenaltySeconds: number; // Penalty cost in seconds
    optimizationCost: number; // Total cost in seconds (minimized by solver)
    startIndex: number;
};

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

            // Takes into account penalties if enabled
            let legCost: number;
            if (usePenalties) {
                const unvisited = new Set<number>();
                for (let i = 0; i < n; i++) {
                    if (!visited.has(i)) {
                        unvisited.add(i);
                    }
                }

                legCost = buildLegCost(cost, {
                    stops: solveContext!.stops,
                    unvisited,
                    prevIndex: prev,
                    currentIndex: current,
                    nextIndex: candidate,
                    axis,
                    sweepSign,
                    weights: weights!,
                });
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

    return { order, totalCost };
}

export function solveOpenRoute(durations: number[][], options: OpenRouteOptions = {}): OpenRouteResult {
    const startIndex = options.startIndex ?? 0;
    
    const stops = options.stops!;
    const penaltyWeights = options.penaltyWeights ?? DEFAULT_PENALTY_WEIGHTS;

    const solveContext = options.stops != null ? { 
        stops,
        penaltyWeights,
    } : undefined;

    const { order: greedyOrder } = solveGreedyOpenTsp(
        durations, 
        { startIndex }, 
        solveContext
    );

    const { 
        order, 
        optimizationCost, 
        totalDurationSeconds, 
        totalPenaltySeconds 
    } = improveOpenRoute2Opt(durations, greedyOrder, { startIndex, stops, penaltyWeights });

    return { order, optimizationCost, totalDurationSeconds, totalPenaltySeconds, startIndex };
}