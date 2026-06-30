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
    endNearStart: boolean;
    maxEndDistanceMeters: number;

    routeGeometry: RouteGeometry | null;
    routeDurationSeconds: number | null;
    routeDistanceMeters: number | null;
};