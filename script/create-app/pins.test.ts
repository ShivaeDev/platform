import assert from "node:assert/strict";
import { test as it } from "node:test";
import { checkPins } from "./pins.ts";

it("rejects stale pins against npm, including packages without a direct app dependency", async () => {
	const pins = { "@shivaedev/local-postgres": "0.2.0", "@shivaedev/types": "0.2.0" };
	await assert.rejects(
		checkPins(pins, pins, async () => "0.2.1"),
		(error: Error) => {
			assert.match(error.message, /local-postgres: pinned 0.2.0, expected 0.2.1/u);
			assert.match(error.message, /types: pinned 0.2.0, expected 0.2.1/u);
			return true;
		},
	);
});

it("requires versions released in the same commit without treating npm's older latest as stale", async () => {
	const name = "@shivaedev/platform";
	await checkPins({ [name]: "0.10.0" }, { [name]: "0.10.0" }, async () => "0.9.9");
	await assert.rejects(
		checkPins({ [name]: "0.9.9" }, { [name]: "0.10.0" }, async () => "0.9.9"),
		/expected 0.10.0/u,
	);
});

it("accepts current published pins and fails closed on registry errors", async () => {
	const pins = { "@shivaedev/types": "0.2.1" };
	await checkPins(pins, pins, async () => "0.2.1");
	await assert.rejects(
		checkPins(pins, pins, () => Promise.reject(new Error("npm unavailable"))),
		/npm unavailable/u,
	);
});
