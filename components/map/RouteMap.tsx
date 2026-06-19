/* The purpose of this file is to render/display the Mapbox Map & Place Pins */
"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapStop = {
    id: string;
    lat: number;
    lng: number;
};

type RouteMapProps = {
    stops: MapStop[];
};

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12;

export function RouteMap({ stops }: RouteMapProps) {
    /* Establish references (stored information) for Mapbox Map, Markers, and Container */
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);

    /* Implements Token Safety Check */
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
        return (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-mg border border-dashed border-red-500/50 bg-slate-800 p-4">
                <p className="text-sm text-red-400">
                    Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local
                </p>
            </div>
        );
    }

    /* Initializes Mapbox Map, Navigation Control, and Markers */
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: "mapbox://stlyes/mapbox/streets-v12",
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        mapRef.current = map;

        return () => {
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];
            map.remove();
            mapRef.current = null;
        };
    }, []);

    /* Updates/Syncs Mapbox Map & Markers when Stops Change */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        if (stops.length === 0) return;

        const bounds = new mapboxgl.LngLatBounds();

        for (const stop of stops) {
            const marker = new mapboxgl.Marker({ color: "#3b82f6"})
            .setLngLat([stop.lng, stop.lat])
            .addTo(map);

            markersRef.current.push(marker);
            bounds.extend([stop.lng, stop.lat]);
        }

        if (stops.length === 1) {
            map.flyTo({
                center: [stops[0].lng, stops[0].lat],
                zoom: 15,
            });
        } else {
            map.fitBounds(bounds, {
                padding: 60,
                maxZoom: 16,
            });
        }
    }, [stops]);

    return (
        <div
        ref={containerRef}
        className="h-full min-h-[400px] w-full overflow-hidden rounded-md"
        />
    );
}