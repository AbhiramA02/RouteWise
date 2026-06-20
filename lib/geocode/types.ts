/* 
 * Creates TypeScript Types for Reverse Geocoding API Responses.
 * This will be combined with ParsedStop to create a complete StopGeocodeState in the UI!
 */

export type GeocodeCandidate = { // Potential Address Match
    formattedAddress: string;
    placeName: string;
    confidence?: number;
};

export type ReverseGeocodeResult = { // Full Coordinate Result
    primary: GeocodeCandidate | null;
    candidates: GeocodeCandidate[];
};

export type StopGeocodeState = { // Tracks Geocode Status for Single Stop
    status: "idle" | "loading" | "success" | "error";
    result?: ReverseGeocodeResult;
    error?: string;
};