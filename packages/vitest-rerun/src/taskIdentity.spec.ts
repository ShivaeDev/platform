import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changesIdentity, rerunStory } from "#test/kit.ts";

for (const [change, unexpected, original] of [
	["test name", "renamed recovery", "checkout > recovers"],
	["suite name", "renamed checkout", "checkout > recovers"],
	["task kind", "pending checkout", "recovers"],
] as const) {
	rerunStory.it(
		`a rerun that changes a ${change} at the same position is refused without changing earlier final reports or recording a recovery`,
		[changesIdentity(change)],
		function* ({ exitCode, flakyTests, jsonResults, printedError, reportContents, runExecutable }) {
			yield* runExecutable();

			yield* outcomes([
				["exit code", () => exitCode(), 1],
				["printed error", () => printedError(), `Rerun collected an unexpected test: ${unexpected}`],
				["flaky tests", () => flakyTests(), "not written"],
				["final JSON results", () => jsonResults(), { [original]: "failed" }],
			]);
			for (const extension of ["json", "junit.xml"]) {
				expect(yield* reportContents(`tests.${extension}`)).toBe(yield* reportContents(`tests.attempt-1.${extension}`));
			}
		},
	);
}
