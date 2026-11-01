import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { declaresRetry } from "#test/declaresRetry.ts";
import { rerunStory } from "#test/kit.ts";

for (const kind of ["test", "suite", "object", "skipped test", "rerun"] as const) {
	rerunStory.it(
		`a retry declared on a ${kind} fails the run with every affected file and test and the global recorded retry policy, without recording a recovery`,
		[declaresRetry(kind)],
		function* ({ exitCode, flakyTests, printedError, runExecutable }) {
			yield* runExecutable();

			const names =
				kind === "suite"
					? "retry.spec.ts > checkout > charges once; retry.spec.ts > checkout > sends receipt"
					: "retry.spec.ts > checkout > charges once";
			yield* outcomes([
				["exit code", () => exitCode(), 1],
				[
					"printed error",
					() => printedError(),
					`Retries are global only and recoveries are recorded in flaky-tests.json. Remove per-test and per-suite retry options: ${names}`,
				],
				["flaky tests", () => flakyTests(), "not written"],
			]);
		},
	);
}
