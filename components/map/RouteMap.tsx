/* The purpose of this file is to render/display the Mapbox Map & Place Pins */
"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapStop = {
    id: string;
    lat: number;
    lng: number;
    visitNumber?: number;
    isStart?: boolean;
};

type RouteMapProps = {
    stops: MapStop[];
    routeGeometry?: {
        type: "LineString";
        coordinates: [number, number][];
    } | null;
};

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12;

function createMarkerElement(visitNumber?: number, isStart?: boolean): HTMLElement {
    const el = document.createElement("div");

    if (visitNumber != null) {
        let bg = "bg-blue-600";
        if (isStart) bg = "bg-green-600";
        el.className = `flex h-7 w-7 items-center justify-center rounded-full ${bg} text-xs font-bold text-white shadow-md border-2 border-white`;
        el.textContent = String(visitNumber);
    } else {
        el.className = "h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow";
    }

    return el;
}

export function RouteMap({ stops, routeGeometry }: RouteMapProps) {
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
            style: "mapbox://styles/mapbox/streets-v12",
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
            const el = createMarkerElement(stop.visitNumber, stop.isStart);
            const marker = new mapboxgl.Marker({ element: el })
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

    /* Updates Route Geometry when in Changes */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const updateRoute = () => {
            if (!routeGeometry || routeGeometry.coordinates.length === 0) {
                // Remove layer if no route exists
                if (map.getSource("route")) {
                    if (map.getLayer("route-line")){
                        map.removeLayer("route-line");
                    }
                    
                    map.removeSource("route");
                }
                
                return;
            }

            const geojson: GeoJSON.Feature = {
                type: "Feature",
                properties: {},
                geometry: routeGeometry,
            };

            if (map.getSource("route")) {
                (map.getSource("route") as mapboxgl.GeoJSONSource).setData(geojson);
            } else {
                map.addSource("route", { type: "geojson", data: geojson });
                map.addLayer({
                    id: "route-line",
                    type: "line",
                    source: "route",
                    layout: { "line-join": "round", "line-cap": "round" },
                    paint: {
                        "line-color": "#3b82f6",
                        "line-width": 4,
                        "line-opacity": 0.85,
                    },
                });
            }

            const bounds = new mapboxgl.LngLatBounds();
            routeGeometry.coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
            stops.forEach((s) => bounds.extend([s.lng, s.lat]));
            map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
        };

        if (map.isStyleLoaded()) {
            updateRoute();
        } else {
            map.once("load", updateRoute);
        }
    }, [routeGeometry, stops]);

    return (
        <div
        ref={containerRef}
        className="h-full min-h-[400px] w-full overflow-hidden rounded-md"
        />
    );
}