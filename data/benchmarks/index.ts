import { SAMPLE_STOPS_TEXT } from "@/data/sample-stops";
import { LINEAR_STREET_META, LINEAR_STREET_STOPS_TEXT } from "@/data/benchmarks/linear-street";
import { TWO_POCKET_META, TWO_POCKET_STOPS_TEXT } from "@/data/benchmarks/two-pocket";

export type Benchmark = {
    id: string;
    name: string;
    description: string;
    stopsText: string;
    startIndex: number;
};

export const BENCHMARKS: Benchmark[] = [
    {
        id: "sample",
        name: "Community Set",
        description: "Community Data with 25 Stops",
        stopsText: SAMPLE_STOPS_TEXT,
        startIndex: 0,
    },
    {
        ...LINEAR_STREET_META,
        stopsText: LINEAR_STREET_STOPS_TEXT,
    },
    {
        ...TWO_POCKET_META,
        stopsText: TWO_POCKET_STOPS_TEXT,
    },
];