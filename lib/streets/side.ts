/* This file determines the side of the selected street segment that the door coordinates is on */
import bearing from "@turf/bearing";
import { point } from "@turf/helpers";
import type { CompassSide, LngLat, SideLR } from "./types";

// Calculates # of meters that corresponds to 1 degree of latitude and longitude at a given position
function metersPerDegree(lat: number): {
    metersPerDegLat: number;
    metersPerDegLng: number;
} {
    const metersPerDegLat = 111_320; // latitude is constant across globe
    const metersPerDegLng = metersPerDegLat * Math.cos((lat * Math.PI) / 180); // longitude varies w/ latitude (closer at poles)

    return { metersPerDegLat, metersPerDegLng };
}


export function sideOfStreet(args: {
    doorLng: number; // Door Coordinates
    doorLat: number;
    snapLng: number; // Snapped Segment Coordinates
    snapLat: number;
    segStart: LngLat; // Segment Endpoints
    segEnd: LngLat;
}): {
    side: SideLR;
    compassSide: CompassSide;
    bearingDeg: number;
} {

    const { doorLng, doorLat, snapLng, snapLat, segStart, segEnd } = args;
    const { metersPerDegLat, metersPerDegLng } = metersPerDegree(snapLat);

    const tx = (segEnd[0] - segStart[0]) * metersPerDegLng; // Calculate Street-Direction Vector (X-Component)
    const ty = (segEnd[1] - segStart[1]) * metersPerDegLat; // Calculate Street-Direction Vector (Y-Component)
    const ox = (doorLng - snapLng) * metersPerDegLng; // Calculate Door-to-Segment Offset (X-Component)
    const oy = (doorLat - snapLat) * metersPerDegLat; // Calculate Door-to-Segment Offset (Y-Component)

    const cross = tx * oy - ty * ox; // Calculate Cross Product to Determine Side
    const offsetMag = Math.hypot(ox, oy); // Calculate Magnitude of Offset

    const bearingDeg = bearing(point(segStart), point(segEnd)); // Calculates Bearing of Street Segment, to determine if it's East-West or North-South
    const absBearing = ((bearingDeg % 360) + 360) % 360; // Normalize Bearing to 0-360
    const streetisEastWest = // Check if Street is East-West (not North-South)
        (absBearing >= 45 && absBearing < 135) || 
        (absBearing >= 225 && absBearing < 315);

    if (offsetMag < 0.05) { 
        return { side: "on_line", compassSide: "on_line", bearingDeg };
    }

    const side: SideLR = cross > 0 ? "left" : "right"; // Determine Side of Street (Left or Right of Street)
    // Determine Compass Side (North, South, East, West) based on Street Direction and Offset Direction
    const compassSide: CompassSide = streetisEastWest
        ? oy > 0
            ? "north"
            : "south"
        : ox > 0
            ? "east"
            : "west";

    return { side, compassSide, bearingDeg }
}