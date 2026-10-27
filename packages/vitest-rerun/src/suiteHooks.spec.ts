import { expect } from "vitest";
import { hookFails, inProjects, passes, rerunStory } from "#test/kit.ts";

for (const hook of ["beforeAll", "afterAll"] as const) {
	rerunStory.it(
		`${hook} recovers in a fresh process and records the failed suite`,
		[hookFails(hook), passes(), inProjects("hooks")],
		function* ({ files, reports, runner }) {
			expect((yield* runner.spawn()).status).toBe(0);
			const pids = files.read(`${hook}.txt`)?.trim().split("\n");
			expect(pids).toEqual([expect.stringMatching(/^\d+$/u), expect.stringMatching(/^\d+$/u)]);
			expect(pids?.[1]).not.toBe(pids?.[0]);
			expect(files.read("inside.txt")).toBe(hook === "beforeAll" ? "passed\n" : "passed\npassed\n");
			expect(files.read("outside.txt")).toBe("passed\n");
			expect(files.read("passed.txt")).toBe("passed\n");
			expect(yield* reports.flakyTests()).toStrictEqual([
				{
					attempts: 2,
					classname: "|hooks| hooks.spec.ts",
					file: "hooks.spec.ts",
					messages: [`${hook} fails on attempt 1`],
					name: "checkout > payment (suite hook)",
				},
			]);
			expect(reports.summary()).toContain("- Flaky: |hooks| hooks.spec.ts — checkout > payment (suite hook)");
			expect((yield* reports.json()).success).toBe(true);
			expect(yield* reports.testcases()).toContainEqual({
				classname: "|hooks| hooks.spec.ts",
				failed: false,
				file: "hooks.spec.ts",
				name: "checkout > payment > runs inside the suite",
			});
		},
	);

	rerunStory.it(`${hook} keeps the run red when it still fails`, [hookFails(hook, 2)], function* ({ files, reports, runner }) {
		expect((yield* runner.run()).status).toBe(1);
		expect(files.read(`${hook}.txt`)?.trim().split("\n")).toEqual([expect.stringMatching(/^\d+$/u), expect.stringMatching(/^\d+$/u)]);
		expect((yield* reports.json()).success).toBe(false);
		expect(reports.file("tests.junit.xml")).toContain(`${hook} fails on attempt 2`);
		expect(yield* reports.flakyTests()).toBeUndefined();
	});

	rerunStory.it(`${hook} at file level records every failed attempt before recovering`, [hookFails(hook, 2, true)], function* ({ reports, runner }) {
		expect((yield* runner.run("--reruns", "2")).status).toBe(0);
		expect(yield* reports.flakyTests()).toStrictEqual([
			{
				attempts: 3,
				classname: "hooks.spec.ts",
				file: "hooks.spec.ts",
				messages: [`${hook} fails on attempt 1`, `${hook} fails on attempt 2`],
				name: "hooks.spec.ts (suite hook)",
			},
		]);
		expect((yield* reports.json()).success).toBe(true);
	});
}
