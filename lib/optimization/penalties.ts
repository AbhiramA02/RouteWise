/* This file is used to develop the penalty system/engine */
import { PenaltyWeights, DEFAULT_PENALTY_WEIGHTS, DEFAULT_SKIP_RADIUS_METERS, DEFAULT_NEARBY_WALK_SECONDS } from "./types";

export type StopCoord = { lat: number; lng: number };
export type DominantAxis = "lat" | "lng";

const U_TURN_ANGLE_DEG = 120; // Angle Treshold for U-turn
const AXIS_EPSILON = 1e-7; // Prevents Coordinate Comparison Errors

/* Street-ish axis: wider spread wins (suburban blocks) */
export function detectionDominantAxis(stops: StopCoord[], indices: number[]): DominantAxis {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const i of indices) {
        const s = stops[i];
        minLat = Math.min(minLat, s.lat);
        maxLat = Math.max(maxLat, s.lat);
        minLng = Math.min(minLng, s.lng);
        maxLng = Math.max(maxLng, s.lng);
    }

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    return lngSpan >= latSpan ? "lng" : "lat";
}

/* Converts stop to 1D coordinates for dominant axis */
export function project(stop: StopCoord, axis: DominantAxis): number {
    return axis === "lat" ? stop.lat : stop.lng;
}

/* Computes direction of travel between two stops */
function bearingDegrees(from: StopCoord, to: StopCoord): number {
    const dLng = to.lng - from.lng;
    const dLat = to.lat - from.lat;
    return (Math.atan2(dLng, dLat) * 180) / Math.PI;
}

/* Computes the difference between two angles in degrees */
function angleDiff(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return diff > 180 ? 360 - diff : diff;
}

export type LegPenaltyContext = { // Complete information needed to compute penalties
    stops: StopCoord[];
    axis: DominantAxis;
    sweepSign: 1 | -1 | null; // Direction of travel so 1 = forward and -1 = backward
    prevIndex: number | null;
    currentIndex: number;
    weights: PenaltyWeights;
};

/* Core function to compute penalties for a single leg */
export function computeLegPenalty(ctx: LegPenaltyContext, nextIndex: number): number {
    const { stops, axis, sweepSign, prevIndex, currentIndex, weights} = ctx;
    let penalty = 0;

    const current = stops[currentIndex];
    const next = stops[nextIndex];
    const axisDelta = project(next, axis) - project(current, axis);

    if (sweepSign != null && axisDelta * sweepSign < -AXIS_EPSILON) { // Backtrack detected
        const magnitude = Math.abs(axisDelta);
        const scaled = Math.min(1, magnitude / 0.00015); // Scale penalty to 0-1 range
        penalty += weights.wBacktrack * scaled;
    }

    if (prevIndex != null) { // U-turn detected
        const prev = stops[prevIndex];
        const incoming = bearingDegrees(prev, current);
        const outgoing = bearingDegrees(current, next);
        const  turn = angleDiff(incoming, outgoing);
        if (turn >= U_TURN_ANGLE_DEG) {
            const intensity = Math.min(1, (turn - U_TURN_ANGLE_DEG) / 60); // Scale penalty to 0-1 range
            penalty += weights.wUturn * intensity;
        }
    }

    return penalty;
}

/* Updates route's current direction of travel */
export function nextSweepSign(ctx: LegPenaltyContext, nextIndex: number): 1 | -1 | null {
    const delta = project(ctx.stops[nextIndex], ctx.axis) - project(ctx.stops[ctx.currentIndex], ctx.axis);
    
    if (Math.abs(delta) < AXIS_EPSILON) return ctx.sweepSign;
    const sign: 1 | -1 = delta > 0 ? 1 : -1;
    return ctx.sweepSign ?? sign;
}

/* Combines Mapbox duration w/ determined penalties */
export function effectiveLegCost(durations: number[][], ctx: LegPenaltyContext, nextIndex: number): number {
    const base = durations[ctx.currentIndex][nextIndex];
    if (!Number.isFinite(base)) return Number.POSITIVE_INFINITY;
    return base + computeLegPenalty(ctx, nextIndex);
}

// Gets Distance in Meters for 2 points on Earth's Surface
export function haversineMeters(a: StopCoord, b: StopCoord): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

export function skipNearbyPenalty(durations: number[][], unvisited: ReadonlySet<number>, currentIndex: number, nextIndex: number, nearbyWalkSeconds: number, wSkipNearby: number): number {
    let nearbyLeftBehind = 0;
    const toNext = durations[currentIndex][nextIndex];

    for (const k of unvisited) {
        if (k === nextIndex) continue;

        const toK = durations[currentIndex][k];
        if (Number.isFinite(toK) && toK <= nearbyWalkSeconds && toK < toNext) {
            nearbyLeftBehind += 1;
        }
    }

    //const capped = Math.min(nearbyLeftBehind, 5);
    return wSkipNearby * nearbyLeftBehind;
}

// Requisite context for determining leg cost
export type BuildLegCostContext = {
    stops: StopCoord[];
    unvisited: ReadonlySet<number>;
    prevIndex: number | null;
    currentIndex: number;
    nextIndex: number;
    axis: DominantAxis;
    sweepSign: 1 | -1 | null;
    weights: PenaltyWeights;
    nearbyWalkSeconds?: number;
};

// Determines cost from current stop to next stop, including penalties
export function buildLegCost(durations: number[][], ctx: BuildLegCostContext): number {
    const base = durations[ctx.currentIndex][ctx.nextIndex];
    if (!Number.isFinite(base)) return Number.POSITIVE_INFINITY;

    const legCtx: LegPenaltyContext = {
        stops: ctx.stops,
        axis: ctx.axis,
        sweepSign: ctx.sweepSign,
        prevIndex: ctx.prevIndex,
        currentIndex: ctx.currentIndex,
        weights: ctx.weights,
    };

    let penalty = computeLegPenalty(legCtx, ctx.nextIndex);

    // Adds penalty for skipping nearby stops to backtrack + u-turn penalties
    penalty += skipNearbyPenalty(
        durations,
        ctx.unvisited,
        ctx.currentIndex,
        ctx.nextIndex,
        ctx.nearbyWalkSeconds ?? DEFAULT_NEARBY_WALK_SECONDS,
        ctx.weights.wSkipNearby,
    );

    return base + penalty;
}

export type ReplayRouteOptions = {
    stops: StopCoord[];
    penaltyWeights: PenaltyWeights;
    nearbyWalkSeconds?: number;
};

// Scores complete route on walk time + penalties
export function replayRouteCost(durations: number[][], order: number[], options: ReplayRouteOptions): { optimizationCost: number, totalDurationSeconds: number; totalPenaltySeconds: number } {
    const { stops, penaltyWeights, nearbyWalkSeconds } = options;
    const unvisited = new Set(order);
    const axis = detectionDominantAxis(stops, order);

    let optimizationCost = 0;
    let totalDurationSeconds = 0;
    let prev: number | null = null;
    let sweepSign: 1 | -1 | null = null;

    for (let i = 0; i < order.length - 1; i++) {
        const current = order[i];
        const next = order[i + 1];

        const legDuration = durations[current][next];
        if (!Number.isFinite(legDuration)) {
            return { optimizationCost: Infinity, totalDurationSeconds: Infinity, totalPenaltySeconds: Infinity };
        }

        const legCost = buildLegCost(durations, {
            stops,
            unvisited,
            prevIndex: prev,
            currentIndex: current,
            nextIndex: next,
            axis,
            sweepSign,
            weights: penaltyWeights,
            nearbyWalkSeconds,
        });

        optimizationCost += legCost;
        totalDurationSeconds += legDuration;
        unvisited.delete(current);

        sweepSign = nextSweepSign(
            {stops, axis, sweepSign, prevIndex: prev, currentIndex: current,  weights: penaltyWeights },
            next,
        );
        prev = current;
    }

    const totalPenaltySeconds = optimizationCost - totalDurationSeconds;
    return { optimizationCost,  totalDurationSeconds, totalPenaltySeconds };
}