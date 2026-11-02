import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failsTimes, passes, rerunStory } from "#test/kit.ts";

for (const name of ["--reruns", "--output-dir"]) {
	for (const args of [[name], [name, "--silent"], [name, "--"], [`${name}=`]]) {
		rerunStory.it(
			`${args.join(" ")} exits 2 naming the incomplete option before any test runs or reports are written`,
			[passes()],
			function* ({ runExecutable, exitCode, printedError, timesRan, reports }) {
				yield* runExecutable(...args);

				yield* outcomes([
					["exit code", () => exitCode(), 2],
					["diagnostic", () => printedError(), `${name} expects a value`],
					["reports", () => reports(), []],
				]);
				expect(yield* timesRan()).toEqual({});
			},
		);
	}
}

for (const args of [
	["--reruns", "2", "--output-dir", "chosen reports"],
	["--reruns=2", "--output-dir=chosen reports"],
]) {
	rerunStory.it(
		`${args.join(" ")} gives a test two reruns and writes reports to the chosen directory`,
		[failsTimes(2)],
		function* ({ runExecutable, exitCode, timesRan, reports }) {
			yield* runExecutable(...args);

			yield* outcomes([
				["exit code", () => exitCode(), 0],
				["times each test ran", () => timesRan(), { "checkout > passes beside it": 1, "checkout > recovers only in a fresh process": 3 }],
				["chosen reports", () => reports("chosen reports"), expect.arrayContaining(["tests.json", "tests.junit.xml", "flaky-tests.json"])],
			]);
		},
	);
}
