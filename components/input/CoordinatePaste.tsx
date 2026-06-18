/* The purpose of this file is to make a textarea component which users paste coordinates into. */
"use client";

type CoordinatePasteProps = {
    value: string;
    onChange: (text: string) => void;
};

export function CoordinatePaste({ value, onChange }: CoordinatePasteProps) {
    return (
        <div className="space-y-2">
            <label
                htmlFor="coordinates"
                className="block text-sm font-medium text-white"
            >
                Paste Coordinates
            </label>

            <p className="text-sm text-slate-300">
                Enter one coordinate per line. <br />Coordinates may be comma-separated or tab-separated.
            </p>

            <textarea
                id="coordinates"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={8}
                className="w-full rounded-md border border-slate-600 bg-slate-800 p-3 font-mono text-sm text-white"
                placeholder={`37.7749,-122.4194\n37.7750,-122.4180`}
            />
        </div>
    );
}

