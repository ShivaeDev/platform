import { expect } from "vitest";
import {
	collectingCoverage,
	customCoverage,
	nodeOnly,
	projectKit,
	sourceMappedGuard,
	withUnitIo,
	withWorktrees,
} from "#quality/test-support/projectKit.ts";
import { unitIoCases } from "#quality/test-support/unitIoCases.ts";

const { it } = projectKit;

it("excludes worktree spec copies from every project", [withWorktrees], function* ({ run, testResults }) {
	const result = yield* run("--project", "*");
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual(["src/b.spec.ts passed"]);
});

it(
	"runs Node tests, unit tests, DOM specs and heavy specs with a separate Node host, without selecting slow or type tests",
	[],
	function* ({ run, testResults, hasCoverage }) {
		const result = yield* run();
		expect(result.status, result.output).toBe(0);
		expect(testResults()).toEqual([
			"e2e/smoke.spec.ts passed",
			"src/document.dom.test.tsx passed",
			"src/double.unit.spec.ts passed",
			"src/double.unit.test.ts passed",
			"src/flow.spec.ts passed",
			"src/host.dom.spec.tsx passed",
			"src/toolchain.heavy.spec.ts passed",
			"src/unit.test.ts passed",
		]);
		expect(hasCoverage()).toBe(false);
	},
);

it("selects heavy files alone on request", [], function* ({ run, testResults }) {
	const result = yield* run("--project", "heavy");
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual(["src/toolchain.heavy.spec.ts passed"]);
});

it("runs slow tests alone when requested", [], function* ({ run, testResults }) {
	const result = yield* run("--project", "slow");
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual(["src/long.slow.test.ts passed"]);
});

it("runs Node-only repositories without installing the DOM plugin", [nodeOnly], function* ({ run, testResults }) {
	const result = yield* run();
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual([
		"e2e/smoke.spec.ts passed",
		"src/double.unit.spec.ts passed",
		"src/double.unit.test.ts passed",
		"src/flow.spec.ts passed",
		"src/toolchain.heavy.spec.ts passed",
		"src/unit.test.ts passed",
	]);
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

it("selects pure unit files alone on request", [], function* ({ run, testResults }) {
	const result = yield* run("--project", "pure");
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual(["src/double.unit.spec.ts passed", "src/double.unit.test.ts passed"]);
});

it("keeps ordinary Node files in the existing unit project", [], function* ({ run, testResults }) {
	const result = yield* run("--project", "unit");
	expect(result.status, result.output).toBe(0);
	expect(testResults()).toEqual(["e2e/smoke.spec.ts passed", "src/flow.spec.ts passed", "src/unit.test.ts passed"]);
});

for (const { call, name, source } of unitIoCases) {
	it(`rejects ${name} in a unit file`, [withUnitIo(source)], function* ({ run, testResults }) {
		const result = yield* run("--maxWorkers", "1", "--no-file-parallelism");
		expect(result.status, result.output).not.toBe(0);
		expect(result.output).toContain(`src/io.unit.test.ts cannot call ${call}`);
		expect(testResults()).toContain("src/io.unit.test.ts failed");
		expect(testResults()).toContain("src/flow.spec.ts passed");
		expect(testResults()).toContain("src/double.unit.test.ts passed");
	});
}

it("keeps a compiled guard active with source maps", [withUnitIo(unitIoCases[0].source), sourceMappedGuard], function* ({ run, testResults }) {
	const result = yield* run();
	expect(result.status, result.output).not.toBe(0);
	expect(result.output).toContain("src/io.unit.test.ts cannot call node:fs.readFileSync");
	expect(testResults()).toContain("src/io.unit.test.ts failed");
	expect(testResults()).toContain("src/double.unit.test.ts passed");
	expect(testResults()).toContain("src/flow.spec.ts passed");
});

it(
	"allows address parsing and in-memory network ranges in a unit file",
	[
		withUnitIo(`
import { BlockList, isIP } from "node:net";
it("normalizes a proxy range", () => {
	const range = new BlockList();
	range.addSubnet("10.0.0.0", 24, "ipv4");
	range.check("10.0.0.2", "ipv4");
	isIP("10.0.0.2");
});`),
	],
	function* ({ run, testResults }) {
		const result = yield* run("--project", "pure");
		expect(result.status, result.output).toBe(0);
		expect(testResults()).toContain("src/io.unit.test.ts passed");
	},
);
