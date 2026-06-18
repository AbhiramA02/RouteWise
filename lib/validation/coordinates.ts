/* The purpose of this file is to parse and validate the coordinates of a stop. */
export type StopStatus = "valid" | "invalid" | "duplicate";

export type ParsedStop = {
    id: string;
    lineNumber: number;
    lat: number | null;
    lng: number | null;
    status: StopStatus;
    errors: string[];
    duplicateOfLine?: number;
};

export type ParseResult = {
    stops: ParsedStop[];
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
};

/* Calculates real-world distance between two points on the Earth's surface. */
function haversineMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/* Converts raw textarea input into structured stop data. */
export function parseCoordinateInput(text: string): ParseResult {
    const stops: ParsedStop[] = [];

    const lines = text.split("\n");

    lines.forEach((rawLine, index) => {
        const line = rawLine.trim();
        
        if (!line) return;

        const lineNumber = index + 1;
        let parts = line.split(/[,\t]/).map((part) => part.trim());

        if (parts.length < 2) {
            parts = line.split(/\s+/).map((part) => part.trim());
        }

        const errors: string[] = [];

        let lat: number | null = null;
        let lng: number | null = null;

        /* Validates that two values exist, can be parsed as numbers, and are within valid ranges. */
        if (parts.length < 2) {
            errors.push("Could not parse coordinates");
        } else {
            const parsedLat = parseFloat(parts[0]);
            const parsedLng = parseFloat(parts[1]);

            if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
                errors.push("Could not parse coordinates");
            } else {
                lat = parsedLat;
                lng = parsedLng;

                if (lat < -90 || lat > 90) {
                    errors.push("Latitude must be between -90 and 90");
                }

                if (lng < -180 || lng > 180) {
                    errors.push("Longitude must be between -180 and 180");
                }
            }
        }
        /* Adds the stop to the list with its status and errors. */
        stops.push({
            id: `row-${lineNumber}`,
            lineNumber,
            lat,
            lng,
            status: errors.length === 0 ? "valid" : "invalid",
            errors,
        });
    });

    /*Duplicate Detection: Compare each valid stop against all previously seen valid stops.*/
    const earlierValidStops: ParsedStop[] = [];

    for (const stop of stops) {
        if (stop.status !== "valid" || stop.lat === null || stop.lng === null) {
            continue;
        }

        const duplicate = earlierValidStops.find((earlier) => {
            if (earlier.lat === null || earlier.lng === null) return false;
            return (haversineMeters(stop.lat!, stop.lng!, earlier.lat, earlier.lng) < 10);
        });
        if (duplicate) {
            stop.status = "duplicate";
            stop.duplicateOfLine = duplicate.lineNumber;
        } else{
            earlierValidStops.push(stop);
        }
    }

    return {
        stops,
        validCount: stops.filter((stop) => stop.status === "valid").length,
        invalidCount: stops.filter((stop) => stop.status === "invalid").length,
        duplicateCount: stops.filter((stop) => stop.status === "duplicate").length
    };
}