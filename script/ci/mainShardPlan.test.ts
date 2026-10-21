import { expect } from "vitest";
import { measuredMain } from "#ci/test-support/measuredMain.ts";
import { planning } from "#ci/test-support/planning.ts";

planning.it("pins independent snapshots, skips invalid provenance and keeps four test shards", [measuredMain()], ({ planMain }) => {
	expect(planMain()).toEqual({
		consumers: { artifactId: "4300", count: 5, runId: "43" },
		tests: { artifactId: "4200", count: 4, runId: "42" },
	});
});

planning.it("falls back to eight shards without access", [measuredMain("denied")], ({ planMain }) => {
	expect(planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "", count: 8, runId: "" } });
});

planning.it("keeps the independent test plan when consumer timings are missing", [measuredMain("missing consumers")], ({ planMain }) => {
	expect(planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "4200", count: 4, runId: "42" } });
});

planning.it("rejects artifacts replaced while selecting their counts", [measuredMain("replaced")], ({ planMain }) => {
	const plan = planMain();
	expect(plan.tests.runId).toBe("");
	expect(plan.consumers.runId).toBe("");
});
