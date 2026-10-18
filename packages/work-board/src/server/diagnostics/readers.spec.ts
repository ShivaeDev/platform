import { Effect } from "effect";
import { expect } from "vitest";
import { SourceFailure } from "#diagnostics/source.ts";
import { codexLimits } from "#server/diagnostics/codexLimits.ts";
import { githubLimits } from "#server/diagnostics/githubLimits.ts";
import { health } from "#test/diagnostics.ts";
import { configuredSources, diagnosticsStory } from "#test/diagnosticsStory.ts";

for (const github of [undefined, []]) {
	diagnosticsStory.it(
		`discloses unrecorded GitHub observations (${JSON.stringify(github)})`,
		[configuredSources({ github: githubLimits(Effect.succeed({ ...health, github })) })],
		function* ({ readDiagnostics }) {
			expect((yield* readDiagnostics()).github).toMatchObject({ cause: "Fleet has not recorded a GitHub response yet", state: "not-configured" });
		},
	);
}
diagnosticsStory.it(
	"keeps Fleet's failure when GitHub observations cannot be read",
	[
		configuredSources({
			github: githubLimits(Effect.fail(new SourceFailure({ kind: "error", message: "Fleet health snapshot could not be read" }))),
		}),
	],
	function* ({ readDiagnostics }) {
		expect((yield* readDiagnostics()).github).toMatchObject({ cause: "Fleet health snapshot could not be read", state: "error" });
	},
);
for (const value of [{}, { rateLimits: { primary: { usedPercent: -1 }, secondary: null } }]) {
	diagnosticsStory.it(
		`rejects invalid Codex usage windows (${JSON.stringify(value)})`,
		[configuredSources({ codex: codexLimits(Effect.succeed(value)) })],
		function* ({ readDiagnostics }) {
			expect((yield* readDiagnostics()).codex).toMatchObject({ cause: "Codex returned invalid usage windows", state: "error" });
		},
	);
}
diagnosticsStory.it(
	"keeps unreported Codex windows distinct from a failed source",
	[configuredSources({ codex: codexLimits(Effect.succeed({ rateLimits: { primary: null, secondary: null } })) })],
	function* ({ readDiagnostics }) {
		expect((yield* readDiagnostics()).codex).toMatchObject({ state: "ready", value: { primary: null, secondary: null } });
	},
);
