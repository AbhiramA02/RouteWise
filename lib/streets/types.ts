export type LngLat = [number, number];

// Rectangular Geographic Area Surrounding All Stops
export type BBox = { 
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
};

// Represents One Complete Road Polyline returned by OpenStreetMap API
export type StreetWay = {
    osmId: number;
    name: string | null;
    highway: string | null;
    coordinates: LngLat[];
};

// Represents a Straight Segment Portion of a OpenStreetMap Way
export type StreetSegment = {
    id: string;
    osmWayId: number;
    name: string | null;
    highway: string | null;
    index: number;
    start: LngLat;
    end: LngLat;
    bearingDeg: number;
    lengthM: number;
    wayLengthM: number;
    alongStartM: number;
};

export type SideLR = "left" | "right" | "on_line";
export type CompassSide = "north" | "south" | "east" | "west" | "on_line";

// Represents a Single Stop Point before its matched to OpenStreetMap Way
export type StreetStopInput = {
    id: string;
    lat: number;
    lng: number;
    streetName?: string;
    houseNumber?: string;
    addressAccuracy?: string;
};

// Represents the Original Stop + Results from OpenStreetMap API
export type EnrichedStop = StreetStopInput &{
    osmWayId: number | null;
    segmentId: string | null;
    streetNameOsm: string | null;
    alongDistM: number | null;
    t: number | null;
    offsetM: number | null;
    side: SideLR | null;
    compassSide: CompassSide | null;
    lowConfidence: boolean;
    lowConfidenceReasons: string[];
}