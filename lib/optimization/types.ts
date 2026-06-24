/* This file defines the shape of data utilized in the optimization process */
/* This file is kept seperate from ParsedStop so stops can be geocoded and validated before optimization */

export type OptimizeStopInput = {
    id: string;
    lat: number;
    lng: number;
};

export type OptimizeRequest = {
    stops: OptimizeStopInput[];
};

//Mapbox Matrix can return null when no route exists
export type DurationMatrix = (number | null)[][];
export type DistanceMatrix = (number | null)[][];

export type OptimizeResponse = {
    stops: OptimizeStopInput[];
    durations: DurationMatrix; //NxN walking seconds
    distances: DistanceMatrix; //NxN walking meters
    order: number[] | null;
}