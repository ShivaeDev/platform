import assert from "node:assert/strict";
import { planning } from "#ci/test-support/planning.ts";
import { timingArtifacts } from "#ci/test-support/timingArtifacts.ts";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";

planning.it(
	"the snapshot ignores duplicate cache entries and attempt reports and keeps a recovered file's total cost",
	[workflowJobs({ "tests (1)": 300, "tests (2)": 200 }), timingArtifacts()],
	({ mergeTimingArtifacts }) => {
		const snapshot = mergeTimingArtifacts();

		assert.deepEqual(snapshot, {
			runId: "42",
			sha: "main-sha",
			shardCount: 3,
			timings: [
				{ durationMs: 31_000, name: "@shivaedev/skills:unit:packages/skills/src/checkSkills.test.ts" },
				{ durationMs: 2000, name: "quality:unit:steady.test.ts" },
			],
		});
	},
);
