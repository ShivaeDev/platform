import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRun } from "#test/vitestRun.ts";

vitestRun.it(
	"a file Layer interrupted during acquisition releases its connection before file completion without unhandled errors",
	[],
	function* ({ lifecycle, outcome, runsPendingLayerFile, unhandledErrors }) {
		yield* runsPendingLayerFile();

		yield* outcomes([
			["test outcome", () => outcome("a test waiting for its file Layer"), "failed: Test timed out in 25ms."],
			[
				"lifecycle",
				() => lifecycle(),
				["the Layer is waiting for startup", "the pending Layer released its connection", "Vitest reported the file complete"],
			],
			["unhandled errors", () => unhandledErrors(), []],
		]);
	},
);
