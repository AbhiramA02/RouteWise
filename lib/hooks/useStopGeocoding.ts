"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchReverseGeocode } from "@/lib/geocode/client";
import type { ParsedStop } from "@/lib/validation/coordinates";
import type { ReverseGeocodeResult, StopGeocodeState } from "@/lib/geocode/types";

/* Cache to Store Results of Reverse Geocoding */
const cache = new Map<string, ReverseGeocodeResult>();

/* Helper Function to Create a Stable Coordinate Identifier Key for the Reverse Geocoding */
function cacheKey(lat: number, lng: number): string {
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function useStopGeocoding(stops: ParsedStop[]): Record<string, StopGeocodeState> {
    const [geocodeByStopId, setGeocodeByStopId] = useState<Record<string, StopGeocodeState>>({});

    const geocodeKey = useMemo(
        () => 
            stops
            .filter(
                (stop) => 
                    stop.status === "valid" &&
                    stop.lat !== null &&
                    stop.lat !== undefined &&
                    stop.lng !== null &&
                    stop.lng !== undefined
            )
            .map((stop) => `${stop.id}:${stop.lat},${stop.lng}`)
            .join("|"),
        [stops]
    );

    useEffect(() => {
        const validStops = stops.filter(
            (stop) => 
                stop.status === "valid" && 
                stop.lat !== null && 
                stop.lat !== undefined && 
                stop.lng !== null && 
                stop.lng !== undefined
        );

        if (validStops.length === 0) {
            setGeocodeByStopId((prev) => Object.keys(prev).length === 0 ? prev : {});
            return;
        }

        const abortController = new AbortController();
        setGeocodeByStopId(() => {
            const next: Record<string, StopGeocodeState> = {};
            for (const stop of validStops) {
                next[stop.id] = { status: "loading" };
            }

            return next;
        });

        async function run() {
            for (const stop of validStops) {
                if (abortController.signal.aborted) return;
                const lat = stop.lat;
                const lng = stop.lng;

                if (lat == null || lng == null) continue;
                const key = cacheKey(lat, lng);

                try {
                    let result = cache.get(key);
                    
                    if (!result) {
                        result = await fetchReverseGeocode(lat, lng);
                        cache.set(key, result);
                    }
                    
                    if (abortController.signal.aborted) return;

                    setGeocodeByStopId((prev) => ({
                        ...prev,
                        [stop.id]: {status: "success", result},
                    }));
                } catch (error) {
                    if (abortController.signal.aborted) return;

                    setGeocodeByStopId((prev) => ({
                        ...prev,
                        [stop.id]: {status: "error", error: error instanceof Error ? error.message : "Geocoding failed"},
                    }))
                }
            }
        }

        void run();

        return () => {
            abortController.abort();
        };
    }, [geocodeKey]);

    return geocodeByStopId;
}