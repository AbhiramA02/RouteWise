/* This file is used for choosing which stop should be the start of the route */
"use client";

type StopOption = {
    id: string;
    label: string;
};

type StartDepotPickerProps = {
    stops: StopOption[];
    startIndex: number;
    onStartIndexChange: (index: number) => void;
};

export function StartDepotPicker({ stops, startIndex, onStartIndexChange }: StartDepotPickerProps) {
    if (stops.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2 rounded-md border border-slate-600 bg-slate-800 p-3 text-sm">
            <label className="block space-y-1">
                <span className="text-slate-300">Start Route At:</span>
                <select
                value={startIndex}
                onChange={(e) => onStartIndexChange(Number(e.target.value))}
                className="w-full rounded bg-slate-700 px-2 py-1.5 text-white"
                >
                    {stops.map((stop, index) => (
                        <option key={stop.id} value={index}>
                            {stop.label}
                        </option>
                    ))}
                </select>
            </label>
            <p className="text-xs text-slate-400">
                Loop-Style Route: visits each stop once, ends near your start (within 200m walking), 
                without returning to the same address.
            </p>
        </div>
    );
}