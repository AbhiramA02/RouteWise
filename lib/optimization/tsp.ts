/* This file utilizes the Distance/Durations Matrices to contruct the TSP Route */

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
};

export type LoopTspResult = TspResult & {
    endIndex: number;
    endDistanceFromStartMeters: number;
    endsNearStart: boolean;
};

const DEFAULT_MAX_END_DISTANCE_METERS = 200;

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
export function solveGreedyOpenTsp(cost: number[][], options: TspOptions = {}): TspResult {
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

    // Selects the Unvisited Stops that is closest to the Current Stop
    while (order.length < targetLength) {
        let bestNext = -1;
        let bestCost = Number.POSITIVE_INFINITY;

        for (let candidate = 0; candidate < n; candidate++) {
            if (visited.has(candidate)) continue;
            if (endIndex != null && candidate === endIndex) continue;

            const legCost = cost[current][candidate];

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

export function solveGreedyLoopTsp(durations: number[][], distances: number[][], options: LoopTspOptions = {}): LoopTspResult {
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
        const result = solveGreedyOpenTsp(durations, { startIndex, endIndex });
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