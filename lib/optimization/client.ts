/* This file contains a straightforward path to communicate with Optimization API*/
import type { OptimizeRequest, OptimizeResponse } from "@/lib/optimization/types";

export async function fetchOptimize(request: OptimizeRequest): Promise<OptimizeResponse> {
    //Sends Optimization Request to API
    const response = await fetch("/api/optimize", {
        method: "POST",
        headers: {// Request is in JSON Format
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request), // Convert Request to JSON
    });

    if (!response.ok) { //If Request Fails Get Error Message
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Optimize request failed");
    }

    return response.json(); // Return Duration/Distance Matrices Response as JSON
}