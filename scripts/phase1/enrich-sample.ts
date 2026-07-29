/* This file is a validation/test script for the enrich.ts file/function. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PHASE0_STOPS } from "../phase0/stops";
import { enrichStops } from "../../lib/streets/enrich";

// Defines where the enriched stops are written to.
const OUT = path.join(process.cwd(), "data/phase1/enriched-stops.json");

// Main function that performs the enrichment and writes the results to a file
async function main() {
    const stops = PHASE0_STOPS.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
    }));

    // Calls the enrichStops function from lib/streets/enrich.ts
    const result = await enrichStops(stops);

    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT,
        `${JSON.stringify({ summary: result.summary, stops: result.stops }, null, 2)}\n`,
        "utf8",
    );

    console.log(JSON.stringify(result.summary, null, 2));

    const low = result.stops.filter((s) => s.lowConfidence);
    if (low.length) {
        console.log("lowConfidence:", low.map((s) => `${s.id}:${s.lowConfidenceReasons.join(",")}`),
        );
    }

    const expect: Record<string, string> = {
        "1": "east",
        "3": "east",
        "5": "east",
        "7": "south",
        "10": "south",
        "14": "east",
        "16": "west",
        "18": "west",
        "22": "west",
        "25": "north",
    };

    for (const [id, want] of Object.entries(expect)) { // Iterates over the expected compass sides for each stop.
        const got = result.stops.find((s) => s.id === id)?.compassSide; // Finds the compass side for the stop in the result.
        console.log(`stop ${id}: ${got} (want ${want}) ${got === want ? "OK" : "MISMATCH"}`); // Prints the result.
    }

    console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});