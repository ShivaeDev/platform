import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { alwaysFails, collectionFailsOnce, failsTimes, inProjects, passes, rerunStory } from "#test/kit.ts";

rerunStory.it(
	"a test that fails once and then passes is listed in flaky-tests.json with its final JUnit identity and failure message",
	[inProjects("first", "second"), failsTimes(1, { steadyProject: "second" })],
	function* ({ flakyTests, junitResults, run }) {
		yield* run();

		const flaky = yield* flakyTests();
		expect(flaky).toEqual([
			{
				attempts: 2,
				classname: "|first| flaky.spec.ts",
				file: "flaky.spec.ts",
				messages: ["Attempt 1 leaves module state behind"],
				name: "checkout > recovers only in a fresh process",
			},
		]);
		const identities = flaky === "not written" ? flaky : flaky.map(({ classname, file, name }) => ({ classname, file, name }));
		const recovered = (yield* junitResults())
			.filter((test) => test.classname === "|first| flaky.spec.ts" && test.name === "checkout > recovers only in a fresh process")
			.map(({ classname, file, name }) => ({ classname, file, name }));
		expect(identities).toEqual(recovered);
	},
);

rerunStory.it(
	"a test that recovers on its second rerun is listed with three attempts and both failure messages",
	[failsTimes(2)],
	function* ({ flakyTests, run }) {
		yield* run("--reruns", "2");

		expect(yield* flakyTests()).toEqual([
			{
				attempts: 3,
				classname: "flaky.spec.ts",
				file: "flaky.spec.ts",
				messages: ["Attempt 1 leaves module state behind", "Attempt 2 leaves module state behind"],
				name: "checkout > recovers only in a fresh process",
			},
		]);
	},
);

rerunStory.it("a recovered test prints a Flaky line to the job summary", [failsTimes(1)], function* ({ run, summary }) {
	yield* run();

	expect(yield* summary()).toEqual(["- Flaky: flaky.spec.ts — checkout > recovers only in a fresh process"]);
});

rerunStory.it(
	"a test that fails in every attempt is failed in the final JUnit report and not listed as flaky",
	[alwaysFails()],
	function* ({ flakyTests, junitResults, run }) {
		yield* run();

		yield* outcomes([
			["flaky tests", () => flakyTests(), "not written"],
			["JUnit results", () => junitResults(), [{ classname: "broken.spec.ts", file: "broken.spec.ts", name: "stays broken", result: "failed" }]],
		]);
	},
);

rerunStory.it(
	"a file that failed to load and then passed is named in the job summary as a collection failure, not in flaky-tests.json",
	[collectionFailsOnce(), passes()],
	function* ({ flakyTests, run, summary }) {
		yield* run();

		yield* outcomes([
			["flaky tests", () => flakyTests(), "not written"],
			["job summary", () => summary(), ["- Flaky: collected.spec.ts — collection failure"]],
		]);
	},
);

rerunStory.it(
	"a two-project run records two executions per test name and lists only the failed project's test as flaky under its classname",
	[inProjects("first", "second"), failsTimes(1, { steadyProject: "second" })],
	function* ({ flakyTests, run, timesRan }) {
		yield* run();

		yield* outcomes([
			[
				"flaky tests",
				() => flakyTests(),
				[
					{
						attempts: 2,
						classname: "|first| flaky.spec.ts",
						file: "flaky.spec.ts",
						messages: ["Attempt 1 leaves module state behind"],
						name: "checkout > recovers only in a fresh process",
					},
				],
			],
			["times each test ran", () => timesRan(), { "checkout > passes beside it": 2, "checkout > recovers only in a fresh process": 2 }],
		]);
	},
);
