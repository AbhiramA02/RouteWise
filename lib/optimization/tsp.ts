/* This file utilizes the Distance/Durations Matrices to contruct the TSP Route */
export type TspOptions = {
    startIndex?: number;
};

export type TspResult = {
    order: number[];
    totalCost: number;
};

// Greedy Nearest-Neighbor Open-Path TSP Solver
export function solveGreedyOpenTsp(cost: number[][], options: TspOptions = {}): TspResult {
    const n = cost.length;
    if (n === 0) {
        return { order: [], totalCost: 0 };
    }

    if (n === 1) {
        return { order: [0], totalCost: 0 };
    }

    const startIndex = options.startIndex ?? 0;

    if (startIndex < 0 || startIndex >= n) {
        throw new Error(`startIndex ${startIndex} is out of bounds`);
    }

    const visited = new Set<number>();
    const order: number[] = [startIndex];

    visited.add(startIndex);

    let totalCost = 0;
    let current = startIndex;
    // Selects the Unvisited Stops that is closest to the Current Stop
    while (order.length < n) {
        let bestNext = -1;
        let bestCost = Number.POSITIVE_INFINITY;

        for (let candidate = 0; candidate < n; candidate++) {
            if (visited.has(candidate)) continue;

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

    return { order, totalCost };
}