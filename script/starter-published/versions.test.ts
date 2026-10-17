import assert from "node:assert/strict";
import { test as it } from "node:test";
import { Effect } from "effect";
import { checkPins, currentPin } from "./versions.ts";

it("accepts npm latest and a newer workspace release candidate", () => {
	assert.equal(currentPin("0.2.1", "0.2.1", "0.2.0"), true);
	for (const [pin, latest] of [
		["0.2.2", "0.2.1"],
		["0.3.0", "0.2.9"],
		["1.0.0", "0.99.99"],
		["0.10.0", "0.9.0"],
	] as const) {
		assert.equal(currentPin(pin, latest, pin), true);
	}
});

it("rejects lagging pins and unpublished versions outside the workspace release", () => {
	for (const [pin, latest, workspace] of [
		["0.2.0", "0.2.1", "0.2.1"],
		["0.2.1", "0.2.1", "0.3.0"],
		["0.2.0", "0.2.1", "0.2.0"],
		["0.2.2", "0.2.1", "0.3.0"],
		["0.9.0", "0.10.0", "0.9.0"],
		["0.3.0-rc.1", "0.2.1", "0.3.0-rc.1"],
	] as const) {
		assert.equal(currentPin(pin, latest, workspace), false);
	}
});

it("fails the release check with the stale package, pin and latest release", async () => {
	const name = "@shivaedev/local-postgres";
	await assert.rejects(
		Effect.runPromise(checkPins({ [name]: "0.2.0" }, { [name]: "0.2.1" }, () => Effect.succeed("0.2.1"))),
		/local-postgres: generated app pins 0\.2\.0, but npm latest is 0\.2\.1/u,
	);
	await Effect.runPromise(checkPins({ [name]: "0.2.1" }, { [name]: "0.2.1" }, () => Effect.succeed("0.2.1")));
});

it("fails closed when the registry cannot supply a version", async () => {
	await assert.rejects(
		Effect.runPromise(checkPins({ "@shivaedev/types": "0.2.1" }, {}, () => Effect.fail(new Error("registry unavailable")))),
		/registry unavailable/u,
	);
});
