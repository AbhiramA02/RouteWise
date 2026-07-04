/* This file implements 2-Opt Algorithm on existing TSP Solution */
import { totalMatrixDuration } from "@/lib/optimization/metrics";

export type TwoOptOptions = {
    startIndex: number;
};

export type TwoOptResult = {
    order: number[];
    totalDurationSeconds: number;
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
        return {
            order: [...order],
            totalDurationSeconds: totalMatrixDuration(durations, order),
        };
    }

    // Safety: start must be first stop
    if (order[0] !== options.startIndex) {
        throw new Error("improveOpenRoute2Opt: order[0] must equal startIndex");
    }

    let best = [...order];
    let bestCost = totalMatrixDuration(durations, best);
    let improved = true;

    while (improved) {
        improved = false;

        for (let i = 1; i < best.length - 1; i++) {
            for (let j = i + 1; j < best.length; j++) {
                const candidate = reverseSegment(best, i, j);
                const cost = totalMatrixDuration(durations, candidate);

                if (cost < bestCost) {
                    best = candidate;
                    bestCost = cost;
                    improved = true;
                }
            }
        }
    }

    return { order: best, totalDurationSeconds: bestCost };
}