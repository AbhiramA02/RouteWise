/* This file builds clusters for the penalty function optimization */

export type ClusterOptions = {
    thresholdMeters?: number; // default is 120 meters
};

// Identifies largest walking distance between any two points in set(cluster)
function maxPairwiseDistance(
    distances: number[][],
    indices: number[],
): number {
    let max = 0;

    for (let i = 0; i < indices.length; i++){
        for(let j = i + 1; j < indices.length; j++){
            const fromIndex = indices[i];
            const toIndex = indices[j];
            const distance = distances[fromIndex][toIndex];

            if(!Number.isFinite(distance)){
                return Number.POSITIVE_INFINITY;
            }

            if(distance > max){
                max = distance;
            }
        }
    }

    return max;
}

// Groups stops using walking distance, clusters merge only if every stop is <= thresholdMeters
export function clusterByWalkingDistanceDiameter(
    distances: number[][],
    options: ClusterOptions = {},
): number[][] { 
    const thresholdMeters = options.thresholdMeters ?? 120;
    const stopCount = distances.length;

    if (stopCount == 0){
        return [];
    }

    //Initially, every stop is its own cluster
    const clusters: number[][] = Array.from(
        { length: stopCount },
        (_, stopIndex) => [stopIndex],
    );

    while(true) {
        let bestClusterA = -1; // Cluster Positions
        let bestClusterB = -1;
        let bestMergedDiameter = Number.POSITIVE_INFINITY;

        // Iterates over all pairs of clusters to find optimal merge cluster
        for (let a = 0; a < clusters.length; a++){
            for (let b = a + 1; b < clusters.length; b++){
                const mergedMembers = [...clusters[a], ...clusters[b]]; // Proposed merge

                const mergedDiameter = maxPairwiseDistance(distances, mergedMembers);
                const mergeIsAllowed = mergedDiameter <= thresholdMeters;
                const mergeIsBetter = mergedDiameter < bestMergedDiameter;

                if (mergeIsAllowed && mergeIsBetter){
                    bestClusterA = a;
                    bestClusterB = b;
                    bestMergedDiameter = mergedDiameter;
                }
            }
        }

        if (bestClusterA === -1 || bestClusterB === -1){
            break;
        }

        clusters[bestClusterA] = [...clusters[bestClusterA], ...clusters[bestClusterB]];
        clusters.splice(bestClusterB, 1);
    }

    return clusters;
 }

/* Lookup (Stop ID) -> (Cluster Index) */
export function buildClusterLookup(clusters: number[][]): Map<number, number> {
    const map = new Map<number, number>();
    clusters.forEach((members, clusterIndex) => {
        for (const stopIndex of members) {
            map.set(stopIndex, clusterIndex);
        }
    });

    return map;
}