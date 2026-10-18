import { expect } from "vitest";
import { alwaysFails, failsTimes, inProjects, passes, rerunStory } from "#test/kit.ts";

rerunStory.it("a test that fails once and then passes is listed with its JUnit identity", [failsTimes(1)], function* ({ files, reports, runner }) {
	expect((yield* runner.run()).status).toBe(0);
	expect(yield* reports.flakyTests()).toStrictEqual([
		{
			attempts: 2,
			classname: "flaky.spec.ts",
			file: "flaky.spec.ts",
			messages: ["Attempt 1 leaves module state behind"],
			name: "checkout > recovers only in a fresh process",
		},
	]);
	expect(yield* reports.testcases()).toContainEqual({
		classname: "flaky.spec.ts",
		failed: false,
		file: "flaky.spec.ts",
		name: "checkout > recovers only in a fresh process",
	});
	expect(files.read("beside.txt")).toBe("passed\n");
	expect(reports.summary()).toContain("- Flaky: flaky.spec.ts — checkout > recovers only in a fresh process");
});

rerunStory.it("a test that keeps failing stays failed and is not flaky", [alwaysFails()], function* ({ files, reports, runner }) {
	expect((yield* runner.run()).status).toBe(1);
	expect(files.read("broken.txt")).toBe("attempt\nattempt\n");
	expect(yield* reports.testcases()).toEqual([{ classname: "broken.spec.ts", failed: true, file: "broken.spec.ts", name: "stays broken" }]);
	expect(yield* reports.flakyTests()).toBeUndefined();
});

rerunStory.it("a clean run runs once and writes no flaky file", [passes()], function* ({ files, reports, runner }) {
	expect((yield* runner.run()).status).toBe(0);
	expect(files.read("passed.txt")).toBe("passed\n");
	expect(reports.file("tests.attempt-1.json")).toBeUndefined();
	expect(yield* reports.flakyTests()).toBeUndefined();
});

rerunStory.it(
	"a file that runs in two projects keeps one JUnit identity per project and reruns only the failed one",
	[inProjects("first", "second"), failsTimes(1, { steadyProject: "second" })],
	function* ({ files, reports, runner }) {
		expect((yield* runner.run()).status).toBe(0);
		const cases = yield* reports.testcases();
		expect(cases.map(({ classname, name }) => `${classname} ${name}`).toSorted()).toEqual([
			"|first| flaky.spec.ts checkout > passes beside it",
			"|first| flaky.spec.ts checkout > recovers only in a fresh process",
			"|second| flaky.spec.ts checkout > passes beside it",
			"|second| flaky.spec.ts checkout > recovers only in a fresh process",
		]);
		expect(yield* reports.flakyTests()).toStrictEqual([
			{
				attempts: 2,
				classname: "|first| flaky.spec.ts",
				file: "flaky.spec.ts",
				messages: ["Attempt 1 leaves module state behind"],
				name: "checkout > recovers only in a fresh process",
			},
		]);
		expect(files.read("beside.txt")).toBe("passed\npassed\n");
	},
);

rerunStory.it("every rerun counts as an attempt and keeps its failure message", [failsTimes(2)], function* ({ reports, runner }) {
	expect((yield* runner.run("--reruns", "2")).status).toBe(0);
	expect(yield* reports.flakyTests()).toMatchObject([
		{ attempts: 3, messages: ["Attempt 1 leaves module state behind", "Attempt 2 leaves module state behind"] },
	]);
});

rerunStory.it("a test still failing after its last rerun stays failed", [failsTimes(2)], function* ({ files, reports, runner }) {
	expect((yield* runner.run()).status).toBe(1);
	expect(files.read("attempts.txt")).toBe("attempt\nattempt\n");
	expect(yield* reports.flakyTests()).toBeUndefined();
});

rerunStory.it("no reruns fail on the first attempt", [failsTimes(1)], function* ({ files, reports, runner }) {
	expect((yield* runner.run("--reruns", "0")).status).toBe(1);
	expect(files.read("attempts.txt")).toBe("attempt\n");
	expect(reports.file("tests.attempt-1.json")).toBeUndefined();
	expect(yield* reports.flakyTests()).toBeUndefined();
});
