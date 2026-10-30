import { expect } from "vitest";
import { appCi, failingBuild, failingTest, passingTest } from "#quality/test-support/appCi.ts";
import { CLI_EXIT } from "#quality-fixtures/cli.ts";

appCi.it("checks peers then runs the application's lint, types, build and tests", [], function* ({ run, completed }) {
	const result = yield* run();
	expect(result.status, result.stdout + result.stderr).toBe(CLI_EXIT.passed);
	expect(result.stdout).toContain("pnpm peers check");
	expect(completed()).toBe("lint\ntypecheck\nbuild\ntest\n");
});

appCi.it("stops the gate at the failed application command", [failingBuild], function* ({ run, completed }) {
	const result = yield* run();
	expect(result.status).toBe(CLI_EXIT.rejected);
	expect(result.stderr).toContain("pnpm run build failed");
	expect(completed()).toBe("lint\ntypecheck\nbuild\n");
});

for (const [trait, status, failures] of [
	[passingTest, CLI_EXIT.passed, 0],
	[failingTest, CLI_EXIT.rejected, 1],
] as const) {
	appCi.it(`reports coverage and JUnit from one test run with ${failures} failures`, [trait], function* ({ run, completed, read }) {
		const result = yield* run("--coverage");
		expect(result.status, result.stdout + result.stderr).toBe(status);
		expect(completed()).toBe("lint\ntypecheck\nbuild\ntest\n");
		expect(read("tests.log")).toBe("measured\n");
		expect(read("coverage/lcov.info")).toContain("SF:src/double.ts");
		expect(read("coverage/lcov.info")).not.toContain("unvisited.ts");
		expect(read("coverage/junit.xml")).toContain('name="measures doubling"');
		expect(read("coverage/junit.xml")).toContain(`failures="${failures}"`);
	});
}

appCi.it("keeps the ordinary gate free of coverage reports", [passingTest], function* ({ run, hasCoverage, read }) {
	const result = yield* run();
	expect(result.status, result.stdout + result.stderr).toBe(CLI_EXIT.passed);
	expect(read("tests.log")).toBe("measured\n");
	expect(hasCoverage()).toBe(false);
});
