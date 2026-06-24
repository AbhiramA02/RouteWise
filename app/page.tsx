"use client";

import { useMemo, useState } from "react";
import { CoordinatePaste } from "@/components/input/CoordinatePaste";
import { ParsedStopsTable } from "@/components/input/ParsedStopsTable";
import { parseCoordinateInput } from "@/lib/validation/coordinates";
import { RouteMap } from "@/components/map/RouteMap";
import { SAMPLE_STOPS_TEXT } from "@/data/sample-stops"; /* Import Sample Stops for Easy/Consistent Testing */
import { useStopGeocoding } from "@/lib/hooks/useStopGeocoding";

export default function Home() {
  const [text, setText] = useState("");
  const result = useMemo(() => { return parseCoordinateInput(text); }, [text]);

  const parsedStops = useMemo(() => result.stops, [result]);
  const geocodeByStopId = useStopGeocoding(parsedStops);

  /* Derives/Keeps Valid Stops for Mapbox Representation */
  const mapStops = useMemo(() => 
    result.stops.filter((s) => s.status === "valid" && s.lat != null && s.lng != null)
    .map((s) => ({ id: s.id, lat: s.lat!, lng: s.lng!})),
    [result.stops]
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-white">RouteWise</h1>
          <p className="mt-2 text-slate-300">
            Paste coordinates, validate stops, and prepare routes for field work.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
            <CoordinatePaste value={text} onChange={setText} />
            
            <button
            type = "button"
            onClick={() => setText(SAMPLE_STOPS_TEXT)}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600"
            >
              Load Sample Stops
            </button>

            <ParsedStopsTable result={result} geocodeByStopId={geocodeByStopId} />
          </section>

          <section className="min-h-[400px] rounded-lg border border-slate-700 bg-slate-900 p-4">
            <RouteMap stops={mapStops} />
          </section>
        </div>
      </div>
    </main>
  )
}