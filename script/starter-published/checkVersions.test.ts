import assert from "node:assert/strict";
import { test as it } from "node:test";
import { Effect } from "effect";
import { checkVersions } from "./checkVersions.ts";

it("checks every recorded pin against npm latest, including documentation-only dependencies", async () => {
	const pins = { "@shivaedev/local-postgres": "0.2.1", "@shivaedev/types": "0.2.1" };
	const checked: string[] = [];
	await Effect.runPromise(
		checkVersions(pins, (name) => {
			checked.push(name);
			return Effect.succeed("0.2.1");
		}),
	);
	assert.deepEqual(
		checked.sort((a, b) => a.localeCompare(b)),
		Object.keys(pins).sort((a, b) => a.localeCompare(b)),
	);
});

it("blocks a create-app release when a pin lags the latest published version", async () => {
	await assert.rejects(
		Effect.runPromise(checkVersions({ "@shivaedev/local-postgres": "0.2.0" }, () => Effect.succeed("0.2.1"))),
		/template pins 0\.2\.0, but npm latest is 0\.2\.1/u,
	);
});

it("fails closed when the registry cannot report the latest version", async () => {
	await assert.rejects(
		Effect.runPromise(checkVersions({ "@shivaedev/types": "0.2.1" }, () => Effect.fail(new Error("Registry unavailable")))),
		/Registry unavailable/u,
	);
});

it("pins a newer workspace release shipped with the command and compares version segments numerically", async () => {
	const name = "@shivaedev/platform";
	const workspace = { [name]: "0.10.0" };
	await Effect.runPromise(checkVersions(workspace, () => Effect.succeed("0.9.0"), workspace));
	await assert.rejects(Effect.runPromise(checkVersions({ [name]: "0.9.0" }, () => Effect.succeed("0.9.0"), workspace)), /Pin 0\.10\.0/u);
	await assert.rejects(Effect.runPromise(checkVersions({ [name]: "0.8.0" }, () => Effect.succeed("0.9.0"), { [name]: "0.8.0" })), /Pin 0\.9\.0/u);
});
