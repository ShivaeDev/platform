import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";
import { codexResponse, health } from "#test/diagnostics.ts";
import { rawDaemonSnapshot } from "#test/workspaceBoardTraits.ts";

const unknownGithubLimits = rawDaemonSnapshot(
	(observedAt) => ({
		codex: { observedAt, state: "ready", value: codexResponse.rateLimits },
		fleet: { observedAt, state: "ready", value: { ...health, observedAt } },
		github: { observedAt, state: "ready", value: { windows: [] } },
	}),
	"GitHub limits in a shape this Board does not know",
);

boardStory.it(
	"GitHub limits of an unknown shape show as a GitHub decode failure while Codex usage and Fleet health still show",
	[unknownGithubLimits],
	function* ({ systemCards, systemCardText }) {
		yield* outcomes([
			["cards", () => systemCards(), { codex: "ready", fleet: "ready", github: "error" }],
			["codex card", () => systemCardText("codex"), expect.stringContaining("24% used")],
			["fleet card", () => systemCardText("fleet"), expect.stringContaining("3 / 8")],
			["github card", () => systemCardText("github"), expect.stringMatching(/GitHub diagnostics decode failed: Expected/u)],
		]);
	},
);

boardStory.it(
	"a daemon snapshot of an unknown shape shows a decode failure for every source",
	[rawDaemonSnapshot(() => null, "a snapshot that is not an object")],
	function* ({ systemCards, systemText }) {
		yield* outcomes([
			["cards", () => systemCards(), { codex: "error", fleet: "error", github: "error" }],
			[
				"text",
				() => systemText(),
				expect.stringMatching(/Codex diagnostics decode failed.*GitHub diagnostics decode failed.*Fleet diagnostics decode failed/u),
			],
		]);
	},
);
