import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineSchedule } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("interrupts at the fetch deadline, leaves waiting jobs for expiry, and never overlaps retries", [realPostgres], function* ({ budgets }) {
	yield* budgets.seed();
	yield* budgets.start();
	yield* budgets.firstClaim;
	yield* budgets.startPeer();
	const stored = yield* budgets.completed();
	expect(stored.map(({ data, state }) => ({ data, state })).sort((left, right) => left.data.id - right.data.id)).toEqual(
		[0, 1, 2, 3].map((id) => ({ data: { id }, state: "completed" })),
	);
	expect(budgets.fetchedBatches[0]).toEqual([0, 1, 2, 3]);
	expect(budgets.peerRetries).toContain(1);
	expect(budgets.overlapping).toEqual([]);
	expect(budgets.starts.filter(({ retry }) => retry === 0).map(({ id }) => id)).toEqual([0, 1]);
	expect(budgets.starts.every(({ remaining }) => remaining > 0)).toBe(true);
	const later = budgets.starts.find(({ id, retry }) => id === 1 && retry === 0);
	expect(later?.budget).toBeGreaterThan(0);
	expect(later?.budget).toBeLessThan(500);
	for (const start of budgets.starts) {
		expect(Math.abs(start.budget - start.remaining)).toBeLessThan(50);
	}
	expect(budgets.interrupted.map(({ id }) => id)).toEqual([1]);
	expect(budgets.interrupted[0]?.lateness).toBeGreaterThanOrEqual(-20);
	expect(budgets.interrupted[0]?.lateness).toBeLessThan(200);
	expect(budgets.finished).toEqual([0]);
	expect(stored.filter((job) => job.data.id !== 0).every((job) => job.retryCount === 1)).toBe(true);
});

postgresIt(
	"interrupts a scheduled effect at its deadline and leaves its failure to pg-boss",
	[realPostgres],
	function* ({ boot, native, untilJobs }) {
		const schedule = defineSchedule({ cron: "0 * * * *", name: "scheduled-expiry", queue: { expireInSeconds: 1, retryLimit: 0 } });
		const client = native();
		let interrupted = false;
		const recordInterruption = Effect.sync(() => {
			interrupted = true;
		});
		const worker = schedule.run(Effect.never.pipe(Effect.onInterrupt(() => recordInterruption)));
		const { jobs: service } = yield* boot([worker], { clientFactory: () => client });
		yield* Effect.promise(() => client.send(schedule.name));
		const stored = yield* untilJobs(client, schedule.name, (jobs) => jobs.length === 1 && jobs[0]?.state === "failed");
		expect(interrupted).toBe(true);
		expect(stored).toMatchObject([{ output: { message: "handler execution exceeded 1s" }, retryCount: 0, state: "failed" }]);
		const listed = yield* service.failedJobs({ name: schedule.name, schema: Schema.Null }, { limit: 1 });
		expect(listed.jobs.map((job) => job.output)).toEqual([{ _tag: "Error", message: "handler execution exceeded 1s" }]);
	},
);
