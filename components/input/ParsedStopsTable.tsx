/* The purpose of this file is to display the result of coordinate parsing/validation in a table. */
import type { ParseResult, ParsedStop } from "@/lib/validation/coordinates";

type ParsedStopsTableProps = {
    result: ParseResult;
};

function formatCoordinate(value: number | null): string {
    if (value === null) return "-";
    return value.toFixed(6);
}

function getStatusBadge(stop: ParsedStop) {
    if (stop.status === "valid") {
        return (
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                Valid
            </span>
        );
    }

    if (stop.status === "invalid") {
        return (
            <div className="space-y-1">
                <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                    Invalid
                </span>
                <p className="text-xs text-red-600">
                    {stop.errors[0] ?? "Invalid coordinate"}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                Duplicate
            </span>
            <p className="text-xs text-amber-700">
                Duplicate of line {stop.duplicateOfLine}
            </p>
        </div>
    );
}

export function ParsedStopsTable({ result }: ParsedStopsTableProps) {
    if (result.stops.length === 0) {
        return (
            <p className="text-sm text-gray-500">
                Paste coordinates above to see them listed here.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600">
                {result.validCount} valid · {result.invalidCount} invalid ·{" "}
                {result.duplicateCount} duplicates
            </p>

            <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">#</th>
                            <th className="px-3 py-2 text-left font-medium">Lat</th>
                            <th className="px-3 py-2 text-left font-medium">Lng</th>
                            <th className="px-3 py-2 text-left font-medium">Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        {result.stops.map((stop) => (
                            <tr key={stop.id} className="border-t">
                                <td className="px-3 py-2">{stop.lineNumber}</td>
                                <td className="px-3 py-2 font-mono">
                                    {formatCoordinate(stop.lat)}
                                </td>
                                <td className="px-3 py-2 font-mono">
                                    {formatCoordinate(stop.lng)}
                                </td>
                                <td className="px-3 py-2">{getStatusBadge(stop)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}