import { expect } from "vitest";
import { acceleratedTesting, failingWorker, pausedWorker, pendingExpiryRules } from "#test/acceleratedTesting.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"wakes on terminal native timeout after pg-boss fails the interrupted attempt",
	[realPostgres, acceleratedTesting, pausedWorker],
	function* ({ attempts, send, settle, workerStarted }) {
		yield* send(14, { expireInSeconds: 1, retryLimit: 0 });
		yield* workerStarted;
		expect(yield* settle()).toMatchObject([
			{ data: { id: 14 }, output: { message: expect.stringContaining("handler execution exceeded 1s") }, retryCount: 0, state: "failed" },
		]);
		expect(attempts).toEqual([14]);
	},
);

postgresIt(
	"applies expiry only to subsequent sends and preserves earlier rules",
	[realPostgres, acceleratedTesting, failingWorker, pendingExpiryRules],
	function* ({ attempts, settle }) {
		const jobs = yield* settle();
		expect(attempts.filter((id) => id === 11)).toEqual([11]);
		expect(attempts).not.toContain(12);
		expect(attempts.filter((id) => id === 13)).toEqual([13, 13]);
		expect(jobs.find((job) => job.data.id === 11)).toMatchObject({ retryCount: 0, retryLimit: 0, state: "failed" });
		expect(jobs.find((job) => job.data.id === 12)).toMatchObject({
			output: { value: { message: "job timed out" } },
			retryCount: 0,
			retryLimit: 0,
			state: "failed",
		});
		expect(jobs.find((job) => job.data.id === 13)).toMatchObject({
			output: { value: { message: "job timed out" } },
			retryCount: 2,
			retryLimit: 2,
			state: "failed",
		});
	},
);
