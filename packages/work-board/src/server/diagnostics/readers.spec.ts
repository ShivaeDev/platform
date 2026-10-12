import process from "node:process";
import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { codexResponse, githubResponse } from "#test/diagnostics.ts";
import { codexLimits } from "./codexLimits.ts";
import { githubLimits } from "./githubLimits.ts";
import { readCommand } from "./readCommand.ts";

it.live("reads both Codex windows and GitHub resource limits from synthetic protocol responses", function* () {
	expect(yield* codexLimits(Effect.succeed(codexResponse))).toEqual(codexResponse.rateLimits);
	expect(yield* githubLimits(Effect.succeed(JSON.stringify(githubResponse)))).toEqual(githubResponse.resources);
	expect(yield* codexLimits(Effect.succeed({ rateLimits: { primary: null, secondary: null } }))).toEqual({ primary: null, secondary: null });
});

it.live("rejects unknown, malformed and invalid source responses", function* () {
	for (const value of [{}, { rateLimits: { primary: { usedPercent: -1 }, secondary: null } }]) {
		expect(yield* codexLimits(Effect.succeed(value)).pipe(Effect.flip)).toMatchObject({
			kind: "error",
			message: "Codex returned invalid usage windows",
		});
	}
	for (const value of ["not json", "{}", JSON.stringify({ resources: { core: { limit: -1 }, graphql: {} } })]) {
		expect(yield* githubLimits(Effect.succeed(value)).pipe(Effect.flip)).toMatchObject({
			kind: "error",
			message: "GitHub returned invalid rate limits",
		});
	}
});

it.live("missing CLI and missing gh auth are not configured; other command errors keep their cause", function* () {
	expect(yield* readCommand("/missing-synthetic-cli", []).pipe(Effect.flip)).toMatchObject({ kind: "not-configured" });
	expect(
		yield* readCommand(process.execPath, ["-e", "process.stderr.write('Please run gh auth login');process.exit(1)"]).pipe(Effect.flip),
	).toMatchObject({ kind: "not-configured" });
	expect(
		yield* readCommand(process.execPath, ["-e", "process.stderr.write('Synthetic upstream failure');process.exit(1)"]).pipe(Effect.flip),
	).toMatchObject({ kind: "error", message: "Synthetic upstream failure" });
});
