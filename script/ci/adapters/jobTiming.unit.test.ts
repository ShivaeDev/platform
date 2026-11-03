import { Schema } from "effect";
import { expect, it } from "vitest";
import { JobTiming, jobTiming } from "#ci/adapters/jobTiming.ts";
import { jobDurations } from "#ci/shardCount.ts";
import { staleJobTiming } from "#ci/test-support/staleJobTiming.ts";

const encode = Schema.encodeSync(JobTiming);

it("collects a successful shard's wall time when the job fields lag behind its completed steps", () => {
	const job = encode(jobTiming(staleJobTiming));

	expect(jobDurations({ jobs: [job] }, /^tests \(\d+\)$/u, 1)).toEqual([300_000]);
});

for (const step of [
	{ completedAt: "2026-01-01T00:04:50Z", conclusion: "failure", name: "Test workspace shard", status: "completed" },
	{ completedAt: null, conclusion: null, name: "Test workspace shard", status: "in_progress" },
]) {
	it(`rejects ${step.conclusion === "failure" ? "failed" : "unfinished"} steps despite successful cleanup`, () => {
		const job = encode(jobTiming({ ...staleJobTiming, steps: [step, ...staleJobTiming.steps.slice(1)] }));

		expect(() => jobDurations({ jobs: [job] }, /^tests \(\d+\)$/u, 1)).toThrow("Invalid job timing");
	});
}

it("rejects a shard that has not reached Complete job", () => {
	const job = encode(jobTiming({ ...staleJobTiming, steps: staleJobTiming.steps.slice(0, 1) }));

	expect(() => jobDurations({ jobs: [job] }, /^tests \(\d+\)$/u, 1)).toThrow("Invalid job timing");
});

it("preserves a reported failure even when its steps are successful", () => {
	const job = encode(jobTiming({ ...staleJobTiming, conclusion: "failure" }));

	expect(() => jobDurations({ jobs: [job] }, /^tests \(\d+\)$/u, 1)).toThrow("Invalid job timing");
});
