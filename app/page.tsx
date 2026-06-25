"use client";

import { useMemo, useState } from "react";
import { CoordinatePaste } from "@/components/input/CoordinatePaste";
import { ParsedStopsTable } from "@/components/input/ParsedStopsTable";
import { parseCoordinateInput } from "@/lib/validation/coordinates";
import { RouteMap } from "@/components/map/RouteMap";
import { SAMPLE_STOPS_TEXT } from "@/data/sample-stops"; /* Import Sample Stops for Easy/Consistent Testing */
import { useStopGeocoding } from "@/lib/hooks/useStopGeocoding";
import { fetchOptimize } from "@/lib/optimization/client";
import type { OptimizeResponse } from "@/lib/optimization/types";

export default function Home() {
  const [text, setText] = useState("");
  const result = useMemo(() => { return parseCoordinateInput(text); }, [text]);

  const parsedStops = useMemo(() => result.stops, [result]);
  const geocodeByStopId = useStopGeocoding(parsedStops);

  /* Derives/Keeps Valid Stops for Mapbox Representation & Optimization */
  const mapStops = useMemo(() => 
    result.stops.filter((s) => s.status === "valid" && s.lat != null && s.lng != null)
    .map((s) => ({ id: s.id, lat: s.lat!, lng: s.lng!})),
    [result.stops]
  );

  const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  async function handleOptimize() {
    if (mapStops.length < 2) {
      setOptimizeError("Need at least 2 valid stops to optimize.");
      return;
    }

    setIsOptimizing(true);
    setOptimizeError(null);

    try { // Sends Request to Optimization API
      const response = await fetchOptimize({ stops: mapStops });
      setOptimizeResult(response);
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : "Optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  }

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

        <div className="mt-4 space-y-3">
          <button
          type = "button"
          onClick={handleOptimize}
          disabled={isOptimizing || mapStops.length < 2}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isOptimizing ? "Building Matrix..." : "Optimize (A1 Test)"}
          </button>

          {optimizeError && (
            <p className="text-sm text-red-400">{optimizeError}</p>
          )}

          {optimizeResult && (
            <div className="rounded-md border border-slate-600 bg-slate-800 p-3 text-xs font-mono text-slate-300">
              <p>
                Matrix: {optimizeResult.durations.length}x{optimizeResult.durations[0]?.length}
              </p>
              <p>
                Sample 0-1:{" "}
                {optimizeResult.durations[0]?.[1] != null
                ? `${Math.round(optimizeResult.durations[0][1]!)}s walking` : "unreachable"}
              </p>
              <p>
                order: {optimizeResult.order ?? "null (A2)"}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}