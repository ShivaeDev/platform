import { expect } from "vitest";
import { collectingCoverage, customCoverage, nodeOnly, projectKit, withWorktrees } from "#quality/test-support/projectKit.ts";

const { it } = projectKit;
const SUCCESS = 0;

it("excludes worktree spec copies from every project", [withWorktrees], function* ({ run, testResults }) {
	const result = yield* run("--project", "*");
	expect(result.status, result.output).toBe(SUCCESS);
	expect(testResults()).toEqual(["src/b.spec.ts passed"]);
});

it(
	"runs Node tests and DOM specs with a separate Node host, without selecting slow or type tests",
	[],
	function* ({ run, testResults, hasCoverage }) {
		const result = yield* run();
		expect(result.status, result.output).toBe(0);
		expect(testResults()).toEqual([
			"e2e/smoke.spec.ts passed",
			"src/document.dom.test.tsx passed",
			"src/flow.spec.ts passed",
			"src/host.dom.spec.tsx passed",
			"src/unit.test.ts passed",
		]);
		expect(hasCoverage()).toBe(false);
	},
);

it("runs slow tests alone when requested", [], function* ({ run, testResults }) {
	const result = yield* run("--project", "slow");
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual(["src/long.slow.test.ts passed"]);
});

it("runs Node-only repositories without installing the DOM plugin", [nodeOnly], function* ({ run, testResults }) {
	const result = yield* run();
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual(["e2e/smoke.spec.ts passed", "src/flow.spec.ts passed", "src/unit.test.ts passed"]);
});

it("collects executed and unvisited source coverage while leaving test fixtures out", [collectingCoverage], function* ({ run, coverageFiles }) {
	const result = yield* run();
	expect(result.status, result.output).toBe(0);
	expect(coverageFiles()).toEqual([
		{ hits: [expect.any(Number)], path: "src/double.ts" },
		{ hits: [expect.any(Number)], path: "src/label.ts" },
		{ hits: [0], path: "src/unvisited.ts" },
	]);
	expect(coverageFiles()[0]?.hits[0]).toBeGreaterThan(0);
	expect(coverageFiles()[1]?.hits[0]).toBeGreaterThan(0);
});

it("accepts native Vitest coverage options in the shared config", [customCoverage], function* ({ run, coverageFiles }) {
	const result = yield* run();
	expect(result.status, result.output).toBe(0);
	expect(coverageFiles()).toEqual([{ hits: [expect.any(Number)], path: "src/double.ts" }]);
	expect(coverageFiles()[0]?.hits[0]).toBeGreaterThan(0);
});
