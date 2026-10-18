import assert from "node:assert/strict";
import { test as it } from "node:test";
import { workspaceCoverage } from "#ci/test-support/workspaceCoverage.ts";

it("workspace coverage counts the lines a package's tests run and lists every package's untested files", () => {
	const coverage = workspaceCoverage("packages/skills/src/checkSkills.test.ts");
	assert.equal(coverage.status, 0, coverage.output);
	assert.ok((coverage.hitLines("packages/skills/src/checkSkills.ts") ?? 0) > 0, "checkSkills.ts has no covered lines");
	assert.equal(coverage.hitLines("packages/work-fleet/src/cli.ts"), 0);
});
