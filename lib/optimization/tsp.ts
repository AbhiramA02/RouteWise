/* This file utilizes the Distance/Durations Matrices to contruct the TSP Route */
import { clusterByWalkingDistance, findClusterContaining, minCostBetweenClusters, } from "@/lib/optimization/cluster";
import { type PenaltyWeights, DEFAULT_PENALTY_WEIGHTS } from "@/lib/optimization/types";
import { type StopCoord, detectionDominantAxis, effectiveLegCost, nextSweepSign, type LegPenaltyContext, project } from "@/lib/optimization/penalties";

export type TspOptions = {
    startIndex?: number;
    endIndex?: number;
};

export type TspResult = {
    order: number[];
    totalCost: number;
};

export type LoopTspOptions = {
    startIndex?: number;
    maxEndDistanceMeters?: number;
    penaltyWeights?: PenaltyWeights;
    stops?: StopCoord[];
};

export type LoopTspResult = TspResult & {
    endIndex: number;
    endDistanceFromStartMeters: number;
    endsNearStart: boolean;
};

const DEFAULT_MAX_END_DISTANCE_METERS = 200;

export type ClusteredLoopTspResult = LoopTspResult & {
    clusters: number[][];
};

export type TspSolveContext = {
    stops: StopCoord[];
    penaltyWeights?: PenaltyWeights;
    /* Indices to use for dominant-axis detection (cluster stops or all). */
    axisIndices?: number[];
}

function findClosestEndCandidate(distances: number[][], startIndex: number, excludeIndex: number): number {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < distances.length; i++) {
        if (i === excludeIndex) continue;
        const d = distances[i][startIndex];
        if (d < bestDistance) {
            bestDistance = d;
            bestIndex = i;
        }
    }

    if (bestIndex === -1) {
        throw new Error("No valid end stop found");
    }

    return bestIndex;
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

export function solveGreedyLoopTsp(durations: number[][], distances: number[][], options: LoopTspOptions = {}, solveContext?: TspSolveContext): LoopTspResult {
    const n = durations.length;
    const startIndex = options.startIndex ?? 0;
    const maxEndDistanceMeters = options.maxEndDistanceMeters ?? DEFAULT_MAX_END_DISTANCE_METERS;

    if (n < 2) {
        throw new Error("At least 2 stops required for a loop route");
    }

    // Stops that can serve as finish point (walking distance to start)
    let endCandidates = Array.from({ length: n }, (_, i) => i).filter(
        (i) => i !== startIndex && distances[i][startIndex] <= maxEndDistanceMeters
    );

    // Fallback: no stop within radius, pick closest to start
    if (endCandidates.length === 0) {
        endCandidates = [findClosestEndCandidate(distances, startIndex, startIndex)];
    }

    let best: LoopTspResult | null = null;

    for (const endIndex of endCandidates) {
        const result = solveGreedyOpenTsp(durations, { startIndex, endIndex }, solveContext);
        const endDistanceFromStartMeters = distances[endIndex][startIndex];
        const candidate: LoopTspResult = {
            ...result,
            endIndex,
            endDistanceFromStartMeters,
            endsNearStart: endDistanceFromStartMeters <= maxEndDistanceMeters,
        };

        if (!best || candidate.totalCost < best.totalCost) {
            best = candidate;
        }
    }

    if (!best) {
        throw new Error("Failed to build loop route");
    }

    return best;
}

// Adds Serpentine Path as alternative to Greedy Nearest-Neighbor Open-Path TSP
function solveSerpentineWithinCluster( durations: number[][], clusterStops: number[], entryIndex: number, exitIndex: number | undefined, stops: StopCoord[] ) : { order: number[]; totalCost: number } {
    const axis = detectionDominantAxis(stops, clusterStops); // Detect Dominant Axis
    const sorted = [...clusterStops].sort((a, b) => project(stops[a], axis) - project(stops[b], axis)); // Sort Stops by Dominant Axis

    const entryPos = sorted.indexOf(entryIndex);

    if (entryPos === -1) {
        throw new Error("entryIndex must be in cluster")
    }

    if (exitIndex != null && !clusterStops.includes(exitIndex)) {
        throw new Error("exitIndex must be in cluster");
    }

    const buildSweepOrder = (direction: 1 | -1): number[] => {
        const result: number[] = [entryIndex];
        const used = new Set<number>([entryIndex]);

        let i = entryPos + direction;

        while (i >= 0 && i < sorted.length) {
            const stop = sorted[i];

            if (stop !== exitIndex) {
                result.push(stop);
                used.add(stop);
            }

            i += direction;
        }

        for (const stop of sorted) {
            if (!used.has(stop) && stop !== exitIndex) {
                result.push(stop);
                used.add(stop);
            }
        }

        if (exitIndex != null && !used.has(exitIndex)) {
            result.push(exitIndex);
        }

        return result;
    };

    const computeBaseCost = (order: number[]): number => {
        let total = 0;

        for (let i = 0; i < order.length - 1; i++) {
            const leg = durations[order[i]][order[i + 1]];

            if (!Number.isFinite(leg)) {
                return Number.POSITIVE_INFINITY;
            }

            total += leg;
        }

        return total;
    };

    const forwardOrder = buildSweepOrder(1);
    const backwardOrder = buildSweepOrder(-1);

    const forwardCost = computeBaseCost(forwardOrder);
    const backwardCost = computeBaseCost(backwardOrder);

    if (forwardCost <= backwardCost) {
        return { order: forwardOrder, totalCost: forwardCost };
    }

    return { order: backwardOrder, totalCost: backwardCost };
}

// Identifies order of stops within a cluster
export function orderWithinCluster(cost: number[][], clusterStops: number[], entryIndex: number, exitIndex?: number, solveContext?: TspSolveContext ): { order: number[], totalCost: number } {
    if (clusterStops.length === 0) {
        return { order: [], totalCost: 0 };
    }

    if (!clusterStops.includes(entryIndex)) {
        throw new Error("entryIndex must be in cluster");
    }

    if (exitIndex != null && !clusterStops.includes(exitIndex)) {
        throw new Error("exitIndex must be in cluster");
    }

    const remaining = new Set(clusterStops);
    const order: number[] = [entryIndex];
    remaining.delete(entryIndex);

    let totalCost = 0;
    let current = entryIndex;

    const weights = solveContext?.penaltyWeights; // Introducting Penalty Weights, similar to solveGreedyOpenTsp
    const usePenalties = weights != null && solveContext != null;

    const axis = usePenalties ? detectionDominantAxis(solveContext!.stops, clusterStops): "lng";

    let sweepSign: 1 | -1 | null = null;
    let prev: number | null = null;

    const targetSize = exitIndex != null && remaining.has(exitIndex) ? clusterStops.length - 1 : clusterStops.length;

    while (order.length < targetSize) {
        let bestNext = -1;
        let bestCost = Number.POSITIVE_INFINITY;

        for (const candidate of remaining) {
            if (exitIndex != null && candidate === exitIndex) continue;

            let legCost: number;
            if (usePenalties) {
                const ctx: LegPenaltyContext = { stops: solveContext!.stops, axis, sweepSign, prevIndex: prev, currentIndex: current, weights: weights!, };
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
            throw new Error("No reachable stop remains in cluster");
        }

        if (usePenalties) {
            const ctx: LegPenaltyContext = { stops: solveContext!.stops, axis, sweepSign, prevIndex: prev, currentIndex: current, weights: weights!, };
            sweepSign = nextSweepSign(ctx, bestNext);
        }

        prev = current;
        current = bestNext;

        order.push(bestNext);
        remaining.delete(bestNext);
        totalCost += bestCost;
    }

    if (exitIndex != null && remaining.has(exitIndex)) {
        const finalLeg = cost[current][exitIndex];
        if (!Number.isFinite(finalLeg)) {
            throw new Error("No route to cluster exit");
        }

        order.push(exitIndex);
        totalCost += finalLeg;
    }

    return { order, totalCost };
}

function closestStopInClusterTo(cost: number[][], clusterStops: number[], fromStop: number): number {
    let best = clusterStops[0];
    let bestCost = Number.POSITIVE_INFINITY;

    for (const stop of clusterStops) {
        const leg = cost[fromStop][stop];
        if (leg < bestCost) {
            bestCost = leg;
            best = stop;
        }
    }

    return best;
}

function buildClusteredRoute(durations: number[][], distances: number[][], clusters: number[][], startIndex: number, endIndex: number, maxEndDistanceMeters: number, solveContext?: TspSolveContext): ClusteredLoopTspResult {
    const startClusterIdx = findClusterContaining(clusters, startIndex);
    const endClusterIdx = findClusterContaining(clusters, endIndex);

    // Start and end in the same cluster: flat open-path TSP preserves end-last semantics.
    if (startClusterIdx === endClusterIdx) {
        const result = solveGreedyOpenTsp(durations, { startIndex, endIndex }, solveContext ? {...solveContext, axisIndices: clusters[startClusterIdx]} : undefined);
        const endDistanceFromStartMeters = distances[endIndex][startIndex];
        return {
            ...result,
            endIndex,
            endDistanceFromStartMeters,
            endsNearStart: endDistanceFromStartMeters <= maxEndDistanceMeters,
            clusters,
        };
    }

    const visitedClusters = new Set<number>();
    const clusterOrder: number[] = [startClusterIdx];
    visitedClusters.add(startClusterIdx);

    let currentClusterIdx = startClusterIdx;

    // Greedy Inter-Cluster TSP
    while (clusterOrder.length < clusters.length) {
        let bestNext = -1;
        let bestCost = Number.POSITIVE_INFINITY;

        for (let c = 0; c < clusters.length; c++) {
            if (visitedClusters.has(c)) continue;
            const cost = minCostBetweenClusters(durations, clusters[currentClusterIdx], clusters[c]);
            if (cost < bestCost) {
                bestCost = cost;
                bestNext = c;
            }
        }

        if (bestNext === -1) break;

        clusterOrder.push(bestNext);
        visitedClusters.add(bestNext);
        currentClusterIdx = bestNext;
    }

    // End cluster must be visited last so endIndex is the final stop.
    const endClusterPosition = clusterOrder.indexOf(endClusterIdx);
    if (endClusterPosition !== -1 && endClusterPosition !== clusterOrder.length - 1) {
        clusterOrder.splice(endClusterPosition, 1);
        clusterOrder.push(endClusterIdx);
    }

    // Walk clusters in order, building global visit order
    const globalOrder: number[] = [];
    let totalCost = 0;
    let previousExit: number | null = null;

    for (let ci = 0; ci < clusterOrder.length; ci++) {
        const clusterIdx = clusterOrder[ci];
        const clusterStops = clusters[clusterIdx];
        const isFirst = ci === 0;
        const isLast = ci === clusterOrder.length - 1;

        let entry: number;
        if (isFirst) {
            entry = startIndex;
        } else {
            entry = closestStopInClusterTo(durations, clusterStops, previousExit!);
        }

        const exit = isLast && clusterIdx === endClusterIdx ? endIndex : undefined;
        const { order: intraOrder, totalCost: intraCost } = orderWithinCluster(durations, clusterStops, entry, exit, solveContext);

        if(!isFirst && previousExit != null) {
            totalCost += durations[previousExit][intraOrder[0]];
        }

        totalCost += intraCost;
        globalOrder.push(...intraOrder);
        previousExit = intraOrder[intraOrder.length - 1];
    }

    if (globalOrder[globalOrder.length - 1] !== endIndex) {
        throw new Error("End stop is not last in visit order");
    }

    const endDistanceFromStartMeters = distances[endIndex][startIndex];

    return { order: globalOrder, totalCost, endIndex, endDistanceFromStartMeters, endsNearStart: endDistanceFromStartMeters <= maxEndDistanceMeters, clusters };
}

export function solveClusteredLoopTsp(durations: number[][], distances: number[][], options: LoopTspOptions & { clusterThresholdMeters?: number } = {}): ClusteredLoopTspResult {
    const n = durations.length;
    const startIndex = options.startIndex ?? 0;
    const maxEndDistanceMeters = options.maxEndDistanceMeters ?? DEFAULT_MAX_END_DISTANCE_METERS;
    const clusterThresholdMeters = options.clusterThresholdMeters ?? 150;

    const solveContext: TspSolveContext | undefined = options.stops != null ? {
        stops: options.stops,
        penaltyWeights: options.penaltyWeights ?? DEFAULT_PENALTY_WEIGHTS,
    } : undefined;

    // Small Routes: fall back to flat loop TSP
    if (n <= 3) {
        const flat = solveGreedyLoopTsp(durations, distances, options, solveContext);
        return {...flat, clusters: [Array.from({ length: n }, (_, i) => i)] };
    }

    const clusters = clusterByWalkingDistance(distances, {
        thresholdMeters: clusterThresholdMeters,
    });

    // Single Cluster: same as flat but we know clustering didn't help
    if (clusters.length === 1) {
        const flat = solveGreedyLoopTsp(durations, distances, options, solveContext);
        return {...flat, clusters };
    }

    const startClusterIdx = findClusterContaining(clusters, startIndex);

    // Prefer end stops outside the start cluster so the end visit can be last.
    let endCandidates = Array.from({ length: n }, (_, i) => i).filter((i) => {
        if (i === startIndex) return false;
        if (distances[i][startIndex] > maxEndDistanceMeters) return false;
        return findClusterContaining(clusters, i) !== startClusterIdx;
    });

    // Fallback: closest stops outside the start cluster (may exceed maxEndDistanceMeters).
    if (endCandidates.length === 0) {
        endCandidates = Array.from({ length: n }, (_, i) => i)
            .filter((i) => i !== startIndex)
            .filter((i) => findClusterContaining(clusters, i) !== startClusterIdx)
            .sort((a, b) => distances[a][startIndex] - distances[b][startIndex]);
    }

    let best: ClusteredLoopTspResult | null = null;

    for (const endIndex of endCandidates) {
        const endClusterIdx = findClusterContaining(clusters, endIndex);
        if (endClusterIdx === startClusterIdx) {
            continue;
        }

        try {
            const candidate = buildClusteredRoute(
                durations,
                distances,
                clusters,
                startIndex,
                endIndex,
                maxEndDistanceMeters,
                solveContext
            );
            if (!best || candidate.totalCost < best.totalCost) {
                best = candidate;
            }
        } catch {
            continue;
        }
    }

    if (!best) {
        const flat = solveGreedyLoopTsp(durations, distances, options, solveContext);
        return {...flat, clusters };
    }

    return best;
}