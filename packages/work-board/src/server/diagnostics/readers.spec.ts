import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { SourceFailure } from "#diagnostics/source.ts";
import { codexResponse, githubObservations, health } from "#test/diagnostics.ts";
import { codexLimits } from "./codexLimits.ts";
import { githubLimits } from "./githubLimits.ts";

it.live("reads Codex windows and the GitHub observations Fleet recorded from its own responses", function* () {
	expect(yield* codexLimits(Effect.succeed(codexResponse))).toEqual(codexResponse.rateLimits);
	expect(yield* githubLimits(Effect.succeed(health))).toEqual(githubObservations);
	expect(yield* codexLimits(Effect.succeed({ rateLimits: { primary: null, secondary: null } }))).toEqual({ primary: null, secondary: null });
});

it.live("GitHub limits are not configured until Fleet records a response and keep Fleet's own failure", function* () {
	for (const github of [undefined, []]) {
		expect(yield* githubLimits(Effect.succeed({ ...health, github })).pipe(Effect.flip)).toMatchObject({
			kind: "not-configured",
			message: "Fleet has not recorded a GitHub response yet",
		});
	}
	const offline = new SourceFailure({ kind: "error", message: "Fleet health snapshot could not be read" });
	expect(yield* githubLimits(Effect.fail(offline)).pipe(Effect.flip)).toBe(offline);
});

it.live("rejects unknown and invalid Codex responses", function* () {
	for (const value of [{}, { rateLimits: { primary: { usedPercent: -1 }, secondary: null } }]) {
		expect(yield* codexLimits(Effect.succeed(value)).pipe(Effect.flip)).toMatchObject({
			kind: "error",
			message: "Codex returned invalid usage windows",
		});
	}
});
