"use client";

import { useMemo, useState } from "react";
import { CoordinatePaste } from "@/components/input/CoordinatePaste";
import { ParsedStopsTable } from "@/components/input/ParsedStopsTable";
import { parseCoordinateInput } from "@/lib/validation/coordinates";

export default function Home() {
  const [text, setText] = useState("");
  const result = useMemo(() => {
    return parseCoordinateInput(text);
  }, [text]);

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
            <ParsedStopsTable result={result} />
          </section>

          <section className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 p-4">
            <p className="text-sm text-gray-500">
              Map coming soon...
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}