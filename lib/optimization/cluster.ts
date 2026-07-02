/* This file contains the clusterning logic for route optimization */

export type ClusterOptions = {
    thresholdMeters?: number;
};

export function clusterByWalkingDistance(distances: number[][], options: ClusterOptions = {}): number[][] {
    const thresholdMeters = options.thresholdMeters ?? 150;
    const n = distances.length;

    if (n === 0) return [];

    const parent = Array.from({ length: n }, (_, i) => i);

    function find(i: number): number {
        if (parent[i] !== i) {
            parent[i] = find(parent[i]);
        }

        return parent[i];
    }

    function union(i: number, j: number): void {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) {
            parent[rootI] = rootJ;
        }
    }

    // Union all stops that are within the threshold distance of each other
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d = distances[i][j];
            if (Number.isFinite(d) && d <= thresholdMeters) {
                union(i, j);
            }
        }
    }

    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
        const root = find(i);
        const group = groups.get(root) ?? [];
        group.push(i);
        groups.set(root, group);
    }

    return Array.from(groups.values());
}

export function findClusterContaining(clusters: number[][], stopIndex: number): number {
    const clusterIndex = clusters.findIndex((cluster) => cluster.includes(stopIndex));
    if (clusterIndex === -1) {
        throw new Error(`Stop ${stopIndex} not found in any cluster`);
    }

    return clusterIndex;
}

// Used for inter-cluster TSP Optimization
export function minCostBetweenClusters(cost: number[][], clusterA: number[], clusterB: number[]): number {
    let minCost = Number.POSITIVE_INFINITY;

    for (const i of clusterA) {
        for (const j of clusterB) {
            if (cost[i][j] < minCost) {
                minCost = cost[i][j];
            }
        }
    }

    return minCost;
}