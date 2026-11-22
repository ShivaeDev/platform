import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { passes, rerunStory } from "#test/kit.ts";
import { configExcludes, filesRecordTheirRun, LOCATED, SECOND_LINE, twoTestsInOneFile, typeTest } from "#test/vitestOptions.ts";

rerunStory.it(
	"--exclude adds to the config's exclude, so neither the file it names nor the file the config excludes runs, as under the Vitest CLI",
	[configExcludes("excluded.spec.ts"), filesRecordTheirRun("excluded.spec.ts", "other.spec.ts", "kept.spec.ts")],
	function* ({ runExecutable, timesRan }) {
		yield* runExecutable("--exclude", "other.spec.ts");

		expect(yield* timesRan()).toEqual({ "kept.spec.ts": 1 });
	},
);

rerunStory.it(
	"a file filter with a line runs only the test on that line, as under the Vitest CLI",
	[twoTestsInOneFile()],
	function* ({ runExecutable, timesRan }) {
		yield* runExecutable(`${LOCATED}:${SECOND_LINE}`);

		expect(yield* timesRan()).toEqual({ "second": 1 });
	},
);

rerunStory.it(
	"--typecheck.only turns type checking on and runs only the type tests, as under the Vitest CLI",
	[typeTest(), passes()],
	function* ({ jsonResults, runExecutable }) {
		yield* runExecutable("--typecheck.only");

		expect(yield* jsonResults()).toEqual({ "types.test-d.ts > types hold": "passed" });
	},
);

for (const mode of ["--clearCache", "--listTags", "--mergeReports"]) {
	rerunStory.it(
		`${mode}, a Vitest mode that runs no tests, exits 2 saying to run it with vitest directly, and no test runs`,
		[passes()],
		function* ({ printedError, runExecutable, exitCode, timesRan }) {
			yield* runExecutable(mode);

			yield* outcomes([
				["exit code", () => exitCode(), 2],
				["diagnostic", () => printedError(), `${mode} runs no tests, so vitest-rerun cannot run it; run vitest ${mode} directly`],
			]);
			expect(yield* timesRan()).toEqual({});
		},
	);
}
