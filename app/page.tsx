"use client";

import { useMemo, useState, useEffect } from "react";
import { CoordinatePaste } from "@/components/input/CoordinatePaste";
import { ParsedStopsTable } from "@/components/input/ParsedStopsTable";
import { parseCoordinateInput } from "@/lib/validation/coordinates";
import { RouteMap } from "@/components/map/RouteMap";
import { BENCHMARKS } from "@/data/benchmarks"; /* Import Sample Stops for Easy/Consistent Testing */
import { useStopGeocoding } from "@/lib/hooks/useStopGeocoding";
import { fetchOptimize } from "@/lib/optimization/client";
import type { OptimizeResponse } from "@/lib/optimization/types";
import { StartDepotPicker } from "@/components/route/StartDepotPicker";

export default function Home() {
  const [text, setText] = useState("");
  const [startIndex, setStartIndex] = useState(0);
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

  const displayStops = useMemo(() => {
    if (!optimizeResult) {
      return mapStops;
    }

    return optimizeResult.order.map((stopIndex, visitIndex) => {
      const stop = mapStops[stopIndex];

      if (!stop) {
        return null;
      }

      return {
        ...stop,
        visitNumber: visitIndex + 1,
        isStart: visitIndex === 0,
      };
    }).filter((stop) => stop !== null);
  }, [optimizeResult, mapStops]);

  useEffect(() => {
    if (mapStops.length === 0) {
      setStartIndex(0);
      return;
    }
    if (startIndex >= mapStops.length) {
      setStartIndex(0);
    }
  }, [mapStops.length, startIndex]);

  useEffect(() => {
    setOptimizeResult(null);
    setOptimizeError(null);
  }, [text]);

  async function handleOptimize() {
    if (mapStops.length < 2) {
      setOptimizeError("Need at least 2 valid stops to optimize.");
      return;
    }

    setIsOptimizing(true);
    setOptimizeError(null);

    try { // Sends Request to Optimization API
      const response = await fetchOptimize({ stops: mapStops, startIndex, });
      setOptimizeResult(response);
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : "Optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  }

  const stopOptions = useMemo(() => 
    mapStops.map((stop, index) => ({
      id: stop.id,
      label: `Stop ${index + 1}`,
    })),
  [mapStops]);

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
            
            <div className="flex flex-wrap gap-2">
              {BENCHMARKS.map((benchmark) => (
                <button 
                key={benchmark.id}
                type="button"
                onClick={() => {
                  setText(benchmark.stopsText);
                  setStartIndex(benchmark.startIndex);
                }}
                className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600">
                  Load {benchmark.name}
                </button>
              ))}
            </div>

            <ParsedStopsTable result={result} geocodeByStopId={geocodeByStopId} />
          </section>

          <section className="min-h-[400px] rounded-lg border border-slate-700 bg-slate-900 p-4">
            <RouteMap 
            stops={displayStops} 
            routeGeometry={optimizeResult?.routeGeometry ?? null}
            />
          </section>
        </div>

        <div className="mt-4 space-y-3">
          <StartDepotPicker
          stops={stopOptions}
          startIndex={startIndex}
          onStartIndexChange={setStartIndex}
          />

          <button
          type = "button"
          onClick={handleOptimize}
          disabled={isOptimizing || mapStops.length < 2}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isOptimizing ? "Optimizing..." : "Optimize"}
          </button>

          {optimizeError && (
            <p className="text-sm text-red-400">{optimizeError}</p>
          )}

          {optimizeResult && (
            <div className="rounded-md border border-slate-600 bg-slate-800 p-3 text-xs text-slate-300 space-y-2">
              <p>
                Visit Order: {" "}
                <span className = "font-mono">
                  {optimizeResult.order.map((index) => index + 1).join(" -> ")}
                </span>
              </p>

              <p>
                Total Walk Time:{" "}
                {Math.round(optimizeResult.totalDurationSeconds / 60)} min (
                {Math.round(optimizeResult.totalDurationSeconds)}s)
              </p>

              <p>
                Start: stop {(optimizeResult.startIndex ?? 0) + 1}
              </p>

              <p>
                Optimized vs Paste Order: {" "}
                {Math.round(optimizeResult.totalDurationSeconds / 60)} min vs{" "}
                {Math.round(optimizeResult.pasteOrderDurationSeconds / 60)}{" "} min
              </p>

              {optimizeResult.routeDurationSeconds != null && (
                <p>
                  Route Walk Time: {" "}
                  {Math.round(optimizeResult.routeDurationSeconds / 60)} min (
                  {Math.round(optimizeResult.routeDurationSeconds)}s)
                </p>
              )}

              {optimizeResult.routeDistanceMeters != null && (
                <p>
                  Route Distance: {" "}
                  {Math.round(optimizeResult.routeDistanceMeters / 1609).toFixed(2)} mi (
                  {Math.round(optimizeResult.routeDistanceMeters)} m)
                </p>
              )}

              <p>Skip Nearby Legs (less than 90s walk): {optimizeResult.skipNearbyCount}</p>

              <p>
                  Penalty Cost:{" "} {Math.round(optimizeResult.totalPenaltySeconds)}s
              </p>

              <p>
                  Optimization Cost:{" "} {Math.round(optimizeResult.optimizationCost)}s
              </p>

              <p>Backtrack Count: {optimizeResult.backtrackCount}</p>

              <ol className = "list-decimal pl-4 space-y-1">
                {optimizeResult.order.map((stopIndex, visitNumber) => {
                  const stop = optimizeResult.stops[stopIndex];

                  return (
                    <li key={stop.id}>
                      #{visitNumber + 1}: {stop.id} ({stop.lat.toFixed(5)}, {" "}
                      {stop.lng.toFixed(5)})
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}