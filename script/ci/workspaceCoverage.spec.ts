import { expect } from "vitest";
import { planning } from "#ci/test-support/planning.ts";

planning.it("reports covered package lines and untested workspace files", [], function* ({ readCoverage }) {
	const successfulExit = 0;
	const untestedLines = 0;
	const coverage = yield* readCoverage("packages/skills/src/checkSkills.test.ts");
	expect(coverage.status, coverage.output).toBe(successfulExit);
	expect(coverage.hitLines("packages/skills/src/checkSkills.ts")).toBeGreaterThan(0);
	expect(coverage.hitLines("packages/work-fleet/src/cli.ts")).toBe(untestedLines);
});
