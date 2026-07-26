/**
 * This File: Downloads and caches nearby OpenStreetMap roads using Overpass,
 * converts the raw response into StreetWay objects, and splits
 * those ways into measurable StreetSegment objects for snapping.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import bearing from "@turf/bearing";
import distance from "@turf/distance";
import { point } from "@turf/helpers";

import { bboxCacheKey } from "./bbox";
import type {
  BBox,
  LngLat,
  StreetSegment,
  StreetWay,
} from "./types";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
] as const;

const CACHE_DIRECTORY = path.join(
    process.cwd(),
    ".cache",
    "streets",
);

type OverpassGeometryPoint = {
    lat: number;
    lon: number;
};

type OverpassWayElement = {
    type: "way";
    id: number;
    tags?: {
        name?: string;
        highway?: string;
        [key: string]: string | undefined;
    };
    geometry?: OverpassGeometryPoint[];
};

type OverpassOtherElement = {
    type: "node";
    id?: number;
};

type OverpassResponse = {
    elements?: Array<OverpassWayElement | OverpassOtherElement>;
};

// Fetches OpenStreetMap Ways within the Supplied Bounding Box
export async function fetchWaysForBbox(bbox: BBox): Promise<StreetWay[]> {
    const key = bboxCacheKey(bbox);
    const cachePath = path.join(CACHE_DIRECTORY, `${key}.json`);

    const cachedWays = await readCachedWays(cachePath);

    if (cachedWays != null) {
        console.log(`[streets] cache hit: ${cachePath}`);
        return cachedWays;
    }

    const query = buildOverpassQuery(bbox);
    const response = await fetchFromOverpass(query);
    const ways = overpassResponseToWays(response);

    await mkdir(CACHE_DIRECTORY, { recursive: true });
    await writeFile(cachePath, JSON.stringify(ways, null, 2), "utf8");
    
    console.log(`[streets] cached ${ways.length} ways: ${cachePath}`);
    return ways;
}

//Converts OpenStreetMap Ways into individual straight-line segments
export function waysToSegments(ways: StreetWay[]): StreetSegment[] {
    const segments: StreetSegment[] = [];

    for (const way of ways) {
        if (way.coordinates.length < 2){
            continue;
        }

        //First Pass - Calculate Segment Lengths and Way Length
        const segmentLengthsM: number[] = [];
        let wayLengthM = 0;

        for(let i = 0; i < way.coordinates.length - 1; i+= 1){
            const start = way.coordinates[i];
            const end = way.coordinates[i + 1];

            const lengthM = distance(start, end, {
                units: "meters",
              });
        
              segmentLengthsM.push(lengthM);
              wayLengthM += lengthM;
        }

        //Second Pass - Calculate Segment Properties
        let along = 0;

        for (let i = 0; i < way.coordinates.length - 1; i += 1) {
        const start = way.coordinates[i];
        const end = way.coordinates[i + 1];
        const lengthM = segmentLengthsM[i];

        const bearingDeg = bearing(
            point(start),
            point(end),
        );

        segments.push({
            id: `${way.osmId}:${i}`,
            osmWayId: way.osmId,
            name: way.name,
            highway: way.highway,
            index: i,
            start,
            end,
            bearingDeg,
            lengthM,
            wayLengthM,
            alongStartM: along,
        });

        along += lengthM;
        }
    }

    return segments
}

async function readCachedWays(cachePath: string): Promise<StreetWay[] | null> {
    try {
        const contents = await readFile(cachePath, "utf8");
        const parsed: unknown = JSON.parse(contents);

        if (!Array.isArray(parsed)) {
            throw new Error(
                `Invalid streets cache: expected an array at ${cachePath}`,
            );
        }

        return parsed as StreetWay[];
    } catch (error) {
        if (isFileNotFoundError(error)){
            return null;
        }

        throw error;
    }
}

function buildOverpassQuery(bbox: BBox): string {
    const south = bbox.minLat;
    const west = bbox.minLng;
    const north = bbox.maxLat;
    const east = bbox.maxLng;
  
    return `
  [out:json][timeout:90];
  way["highway"~"^(residential|living_street|tertiary|secondary|unclassified|service)$"](${south},${west},${north},${east});
  out geom;
  `.trim();
}

async function fetchFromOverpass(query: string): Promise<OverpassResponse> {
    const errors: string[] = [];
  
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        console.log(`[streets] fetching from ${endpoint}`);
  
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            data: query,
          }).toString(),
        });
  
        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status} ${response.statusText}`,
          );
        }
  
        const data: unknown = await response.json();
  
        if (!isOverpassResponse(data)) {
          throw new Error("Overpass returned an invalid response");
        }
  
        return data;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
  
        errors.push(`${endpoint}: ${message}`);
  
        console.warn(
          `[streets] Overpass endpoint failed: ${endpoint}: ${message}`,
        );
      }
    }
  
    throw new Error(
      [
        "All Overpass endpoints failed.",
        ...errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
}
  
function overpassResponseToWays(response: OverpassResponse): StreetWay[] {
    const ways: StreetWay[] = [];
  
    for (const element of response.elements ?? []) {
      if (element.type !== "way") {
        continue;
      }
  
      const way = element as OverpassWayElement;
  
      if (!Array.isArray(way.geometry)) {
        continue;
      }
  
      const coordinates: LngLat[] = way.geometry
        .filter(
          (coordinate) =>
            Number.isFinite(coordinate.lon) &&
            Number.isFinite(coordinate.lat),
        )
        .map((coordinate) => [
          coordinate.lon,
          coordinate.lat,
        ]);
  
      if (coordinates.length < 2) {
        continue;
      }
  
      ways.push({
        osmId: way.id,
        name: way.tags?.name ?? null,
        highway: way.tags?.highway ?? null,
        coordinates,
      });
    }
  
    return ways;
}
  
function isOverpassResponse(
    value: unknown,
  ): value is OverpassResponse {
    if (typeof value !== "object" || value == null) {
      return false;
    }
  
    const response = value as Record<string, unknown>;
  
    return (
      response.elements == null ||
      Array.isArray(response.elements)
    );
}
  
  function isFileNotFoundError(
    error: unknown,
  ): error is NodeJS.ErrnoException {
    return (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    );
}