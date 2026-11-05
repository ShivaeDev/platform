import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualitySignal } from "#test/qualitySignal.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	qualitySignal.it(
		`the quality executable handles ${signal}, aborts its running rule and exits as interrupted without an error`,
		[],
		function* ({ isRunning, outcome, receives, ruleAborted, stderr }) {
			expect(yield* isRunning()).toBe(true);

			yield* receives(signal);

			yield* outcomes([
				["quality running", () => isRunning(), false],
				["rule aborted", () => ruleAborted(), true],
				["exit", () => outcome(), "interrupted"],
				["error output", () => stderr(), ""],
			]);
		},
		CLI_TIMEOUT,
	);
}
