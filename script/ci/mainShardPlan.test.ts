import { expect } from "vitest";
import { measuredQueue } from "#ci/test-support/measuredQueue.ts";
import { planning } from "#ci/test-support/planning.ts";

planning.it(
	"pins independent green main merge-queue snapshots, rejects mismatched SHAs and keeps four test shards",
	[measuredQueue()],
	function* ({ planMain }) {
		expect(yield* planMain()).toEqual({
			consumers: { artifactId: "4300", count: 5, runId: "43" },
			tests: { artifactId: "4200", count: 4, runId: "42" },
		});
	},
);

planning.it(
	"logs the cause and uses 25 test shards and eight consumer shards without access",
	[measuredQueue("denied")],
	function* ({ planMain, planningLogs }) {
		expect(yield* planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "", count: 25, runId: "" } });
		expect(planningLogs()).toContain("Cannot read merge-queue timing snapshots");
		expect(planningLogs()).toContain("RemoteUnauthorized");
	},
);

planning.it("keeps the independent test plan when consumer timings are missing", [measuredQueue("missing consumers")], function* ({ planMain }) {
	expect(yield* planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "4200", count: 4, runId: "42" } });
});

planning.it(
	"uses 25 test shards and eight consumer shards before the queue publishes snapshots",
	[measuredQueue("missing snapshots")],
	function* ({ planMain }) {
		const plan = yield* planMain();

		expect(plan).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "", count: 25, runId: "" } });
	},
);

planning.it("rejects artifacts replaced while selecting their counts", [measuredQueue("replaced")], function* ({ planMain }) {
	const plan = yield* planMain();
	expect(plan.tests.runId).toBe("");
	expect(plan.consumers.runId).toBe("");
});

for (const mode of ["invalid runs", "invalid artifacts", "unreadable snapshot"] as const) {
	planning.it(`logs ${mode} before using the fallback`, [measuredQueue(mode)], function* ({ planMain, planningLogs }) {
		expect(yield* planMain()).toEqual({ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "", count: 25, runId: "" } });
		expect(planningLogs()).toContain(mode === "unreadable snapshot" ? "download failed" : "SchemaError");
	});
}
