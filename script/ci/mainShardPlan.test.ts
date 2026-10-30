import { expect } from "vitest";
import { measuredMain } from "#ci/test-support/measuredMain.ts";
import { planning } from "#ci/test-support/planning.ts";

planning.it("pins independent snapshots, skips invalid provenance and keeps four test shards", [measuredMain()], function* ({ planMain }) {
	expect(yield* planMain()).toEqual({
		consumers: { artifactId: "4300", count: 5, runId: "43" },
		tests: { artifactId: "4200", count: 4, runId: "42" },
	});
});

planning.it("logs the cause before falling back to eight shards without access", [measuredMain("denied")], function* ({ planMain, planningLogs }) {
	expect(yield* planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "", count: 8, runId: "" } });
	expect(planningLogs()).toContain("Cannot read main timing snapshots");
	expect(planningLogs()).toContain("RemoteUnauthorized");
});

planning.it("keeps the independent test plan when consumer timings are missing", [measuredMain("missing consumers")], function* ({ planMain }) {
	expect(yield* planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "4200", count: 4, runId: "42" } });
});

planning.it("rejects artifacts replaced while selecting their counts", [measuredMain("replaced")], function* ({ planMain }) {
	const plan = yield* planMain();
	expect(plan.tests.runId).toBe("");
	expect(plan.consumers.runId).toBe("");
});

for (const mode of ["invalid runs", "invalid artifacts", "unreadable snapshot"] as const) {
	planning.it(`logs ${mode} before using the fallback`, [measuredMain(mode)], function* ({ planMain, planningLogs }) {
		expect(yield* planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "", count: 8, runId: "" } });
		expect(planningLogs()).toContain(mode === "unreadable snapshot" ? "download failed" : "SchemaError");
	});
}
