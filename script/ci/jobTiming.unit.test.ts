import { expect, it } from "vitest";
import { finalJobTiming } from "#ci/jobTiming.ts";

const job = { completedAt: "2026-01-01T00:05:00Z", conclusion: "success", name: "tests (11)", startedAt: "2026-01-01T00:00:00Z" };

for (const missing of [{ conclusion: null }, { completedAt: null }, { startedAt: null }]) {
	it(`waits for the job's ${Object.keys(missing)[0]} field`, () => {
		expect(finalJobTiming({ ...job, ...missing })).toBe(false);
	});
}

it("treats a failed job as final so its own result can fail the gate", () => {
	expect(finalJobTiming({ ...job, conclusion: "failure" })).toBe(true);
});
