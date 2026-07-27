/* This file determines the side of the selected street segment that the door coordinates is on */
import bearing from "@turf/bearing";
import { point } from "@turf/helpers";
import type { CompassSide, LngLat, SideLR } from "./types";

function metersPerDegree(lat: number): {
    metersPerDegLat: number;
    metersPerDegLng: number;
} {
    const metersPerDegLat = 111_320;
    const metersPerDegLng = metersPerDegLat * Math.cos((lat * Math.PI) / 180);

    return { metersPerDegLat, metersPerDegLng };
}

export function sideOfStreet(args: {
    doorLng: number;
    doorLat: number;
    snapLng: number;
    snapLat: number;
    segStart: LngLat;
    segEnd: LngLat;
}): {
    side: SideLR;
    compassSide: CompassSide;
    bearingDeg: number;
} {

    const { doorLng, doorLat, snapLng, snapLat, segStart, segEnd } = args;
    const { metersPerDegLat, metersPerDegLng } = metersPerDegree(snapLat);

    const tx = (segEnd[0] - segStart[0]) * metersPerDegLng;
    const ty = (segEnd[1] - segStart[1]) * metersPerDegLat;
    const ox = (doorLng - snapLng) * metersPerDegLng;
    const oy = (doorLat - snapLat) * metersPerDegLat;

    const cross = tx * oy - ty * ox;
    const offsetMag = Math.hypot(ox, oy);
    
    return { side, compassSide, bearingDeg }
}