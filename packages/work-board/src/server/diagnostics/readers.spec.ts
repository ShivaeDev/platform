import { Effect } from "effect";
import { expect } from "vitest";
import { SourceFailure } from "#diagnostics/source.ts";
import { codexLimits } from "#server/diagnostics/codexLimits.ts";
import { githubLimits } from "#server/diagnostics/githubLimits.ts";
import { health } from "#test/diagnostics.ts";
import { configuredSources, diagnosticsStory } from "#test/diagnosticsStory.ts";

for (const [recorded, github] of [
	["no GitHub field", undefined],
	["an empty GitHub list", []],
] as const) {
	diagnosticsStory.it(
		`a Fleet health snapshot with ${recorded} shows GitHub as not configured because Fleet has not recorded a response`,
		[configuredSources({ github: githubLimits(Effect.succeed({ ...health, github })) })],
		function* ({ sourceStates }) {
			expect(yield* sourceStates()).toMatchObject({ github: "not-configured: Fleet has not recorded a GitHub response yet" });
		},
	);
}

diagnosticsStory.it(
	"GitHub keeps Fleet's failure when the health snapshot cannot be read",
	[
		configuredSources({
			github: githubLimits(Effect.fail(new SourceFailure({ kind: "error", message: "Fleet health snapshot could not be read" }))),
		}),
	],
	function* ({ sourceStates }) {
		expect(yield* sourceStates()).toMatchObject({ github: "error: Fleet health snapshot could not be read" });
	},
);

for (const [shape, value] of [
	["an answer without rate limits", {}],
	["a negative used percentage", { rateLimits: { primary: { usedPercent: -1 }, secondary: null } }],
] as const) {
	diagnosticsStory.it(
		`Codex ${shape} is an error naming invalid usage windows`,
		[configuredSources({ codex: codexLimits(Effect.succeed(value)) })],
		function* ({ sourceStates }) {
			expect(yield* sourceStates()).toMatchObject({ codex: "error: Codex returned invalid usage windows" });
		},
	);
}

diagnosticsStory.it(
	"Codex reporting no usage windows is ready with both windows empty",
	[configuredSources({ codex: codexLimits(Effect.succeed({ rateLimits: { primary: null, secondary: null } })) })],
	function* ({ codexWindows }) {
		expect(yield* codexWindows()).toEqual({ primary: null, secondary: null });
	},
);
