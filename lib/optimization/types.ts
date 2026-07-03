/* This file defines the shape of data utilized in the optimization process */
/* This file is kept seperate from ParsedStop so stops can be geocoded and validated before optimization */

export type OptimizeStopInput = {
    id: string;
    lat: number;
    lng: number;
};

export type OptimizeRequest = {
    stops: OptimizeStopInput[];
    startIndex?: number; // defaults to 0 if not provided
    maxEndDistanceMeters?: number; // default 200 - "near start" radius
    penaltyWeights?: PenaltyWeights; // uses defaults, but later we can implement custom weights
};

export type RouteGeometry = {
    type: "LineString";
    coordinates: [number, number][]; // [lng, lat] pairs
};

//Mapbox Matrix can return null when no route exists
export type DurationMatrix = number[][];
export type DistanceMatrix = number[][];

export type OptimizeResponse = {
    stops: OptimizeStopInput[];
    durations: DurationMatrix; //NxN walking seconds
    distances: DistanceMatrix; //NxN walking meters
    order: number[]; // index of stops in order, no longer null
    totalDurationSeconds: number;

    // Loop-Style MetaData
    startIndex: number;
    endIndex: number;
    endDistanceFromStartMeters: number;
    endsNearStart: boolean;
    maxEndDistanceMeters: number;

    clusters?: StopCluster[];

    routeGeometry: RouteGeometry | null;
    routeDurationSeconds: number | null;
    routeDistanceMeters: number | null;

    penaltyWeights?: PenaltyWeights;
    totalPenaltySeconds?: number;
};

export type StopCluster = {
    id: number;
    stopIndices: number[];
};

export type ClusteringResult = {
    clusters: StopCluster[];
    clusterCount: number;
};

export type PenaltyWeights = {
    wBacktrack: number; // extra seconds for re-visiting stops
    wUturn: number; // extra seconds for making a u-turn
};

export const DEFAULT_PENALTY_WEIGHTS: PenaltyWeights = { // Default Configuration
    wBacktrack: 90,
    wUturn: 120,
};

