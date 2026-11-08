import { expect } from "vitest";
import { planning } from "#ci/test-support/planning.ts";
import { timingArtifacts } from "#ci/test-support/timingArtifacts.ts";
import { laggingJobs, timingCollection } from "#ci/test-support/timingCollection.ts";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";

const JOBS_PATH = "/repos/owner/repo/actions/runs/42/jobs?filter=latest&per_page=100";

planning.it(
	"the snapshot ignores duplicate cache entries and attempt reports and keeps a recovered file's total cost",
	[workflowJobs({ "tests (1)": 300, "tests (2)": 200 }), timingArtifacts()],
	({ mergeTimingArtifacts }) => {
		const snapshot = mergeTimingArtifacts();

		expect(snapshot).toEqual({
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

timingCollection.it(
	"waits for a later jobs read before publishing test timings",
	[laggingJobs("later"), timingArtifacts()],
	function* ({ startCollection, retryIntervalPasses, collectedSnapshot, jobsReads }) {
		yield* startCollection();
		yield* retryIntervalPasses();
		const snapshot = yield* collectedSnapshot();

		expect(snapshot).toMatchObject({ shardCount: 3, timings: [{ durationMs: 31_000 }, { durationMs: 2000 }] });
		expect(jobsReads()).toEqual([JOBS_PATH, JOBS_PATH]);
	},
);

timingCollection.it(
	"bounds stale jobs reads and publishes an empty snapshot to retain previous timings",
	[laggingJobs("never"), timingArtifacts()],
	function* ({ startCollection, retryIntervalPasses, collectedSnapshot, jobsReads }) {
		yield* startCollection();
		for (let retry = 0; retry < 4; retry += 1) {
			yield* retryIntervalPasses();
		}
		const snapshot = yield* collectedSnapshot();

		expect(snapshot).toEqual({ runId: "42", sha: "main-sha", timings: [] });
		expect(jobsReads()).toEqual([JOBS_PATH, JOBS_PATH, JOBS_PATH, JOBS_PATH, JOBS_PATH]);
	},
);

timingCollection.it(
	"leaves a failed job to the result gate without publishing its timings",
	[laggingJobs("failed"), timingArtifacts()],
	function* ({ startCollection, collectedSnapshot, jobsReads }) {
		yield* startCollection();
		const snapshot = yield* collectedSnapshot();

		expect(snapshot).toEqual({ runId: "42", sha: "main-sha", timings: [] });
		expect(jobsReads()).toEqual([JOBS_PATH]);
	},
);
