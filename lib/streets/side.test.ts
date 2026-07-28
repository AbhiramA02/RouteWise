/* This is an automated test file for side.ts's sideOfStreet function */
import {describe, it } from "node:test";
import assert from "node:assert/strict";
import { sideOfStreet } from "./side";

describe("sideOfStreet", () => { // This is the test suite for the sideOfStreet function
    it("northbound N-S street, door east -> east / right", () => { // Describes individual test case
        const segStart: [number, number] = [-118.78, 34.26]; // Only latitude changes (moving north)
        const segEnd: [number, number] = [-118.78, 34.261];
        const snapLng = -118.78;
        const snapLat = 34.2605;
        const r = sideOfStreet({
            doorLng: snapLng + 0.0001, // Door is slightly east of snap point
            doorLat: snapLat,
            snapLng,
            snapLat,
            segStart,
            segEnd,
        });
        assert.equal(r.compassSide, "east"); // Verifies results
        assert.equal(r.side, "right");
    });
    
    it("northbound N-S street, door west -> west / left", () => {
        const segStart: [number, number] = [-118.78, 34.26];
        const segEnd: [number, number] = [-118.78, 34.261];
        const snapLng = -118.78;
        const snapLat = 34.2605;
        const r = sideOfStreet({
            doorLng: snapLng - 0.0001, // Door is slightly west of snap point
            doorLat: snapLat,
            snapLng,
            snapLat,
            segStart,
            segEnd,
        });
        assert.equal(r.compassSide, "west");
        assert.equal(r.side, "left");
    });

    it("eastbound E-W street, door north -> north / left", () => {
        const segStart: [number, number] = [-118.78, 34.26]; // Only longitude changes (moving east)
        const segEnd: [number, number] = [-118.779, 34.26];
        const snapLng = -118.7795;
        const snapLat = 34.26;
        const r = sideOfStreet({
            doorLng: snapLng,
            doorLat: snapLat + 0.0001, // Door is slightly north of snap point
            snapLng,
            snapLat,
            segStart,
            segEnd,
        });
        assert.equal(r.compassSide, "north");
        assert.equal(r.side, "left");
    });

    it("door on snap -> on line", () => {
        const segStart: [number, number] = [-118.78, 34.26];
        const segEnd: [number, number] = [-118.78, 34.261];
        const snapLng = -118.78;
        const snapLat = 34.2605;
        const r = sideOfStreet({
            doorLng: snapLng, // Door is exactly on snap point
            doorLat: snapLat,
            snapLng,
            snapLat,
            segStart,
            segEnd,
        });
        assert.equal(r.side, "on_line"); // Verifies results that it is on the line
        assert.equal(r.compassSide, "on_line");
    });
});