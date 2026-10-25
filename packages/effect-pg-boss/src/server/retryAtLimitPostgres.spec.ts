import { Clock, DateTime, Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, defineSchedule, RetryAt } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";
import { makePgBossTesting } from "#testing.ts";

postgresIt("exhausts the default ten deferrals before spending a normal retry", [realPostgres], function* ({ boot, untilJob }) {
	const Queue = defineQueue({
		name: "retry-at-limit",
		queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
		schema: Schema.Struct({}),
		worker: { batchSize: 1, pollingIntervalSeconds: 0.5 },
	});
	const attempts: string[] = [];
	const { jobs } = yield* boot([
		Queue.handle((_, job) => {
			attempts.push(job.id);
			return attempts.length <= 11 ? Effect.fail(new RetryAt({ at: DateTime.makeUnsafe(0), reason: "still limited" })) : Effect.void;
		}),
	]);
	const id = Option.getOrThrow(yield* jobs.enqueue(Queue, {}));
	const completed = yield* untilJob(jobs, Queue, id, "completed");
	expect(attempts).toEqual(Array.from({ length: 12 }, () => id));
	expect(completed.retryCount).toBe(Queue.queueOptions.retryLimit);
});

postgresIt(
	"keeps the per-job limit across worker restarts and falls back to a failed attempt",
	[realPostgres],
	function* ({ boot, until, untilJob }) {
		const Queue = defineQueue({
			name: "retry-at-restart",
			queue: { maxDeferrals: 1, retryBackoff: false, retryDelay: 0, retryLimit: 1 },
			schema: Schema.Struct({}),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const testing = makePgBossTesting();
		const future = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 86_400_000);
		const first = yield* boot([Queue.handle(() => Effect.fail(new RetryAt({ at: future, reason: "quota" })))], {
			clientFactory: testing.clientFactory,
		});
		const id = Option.getOrThrow(yield* first.jobs.enqueue(Queue, {}));
		yield* until(testing.deferred(Queue), (waiting) => waiting.length === 1);
		yield* first.stop;
		const restarted = makePgBossTesting();
		const attempts: string[] = [];
		const second = yield* boot(
			[
				Queue.handle((_, job) => {
					attempts.push(job.id);
					return attempts.length === 1 ? Effect.fail(new RetryAt({ at: DateTime.makeUnsafe(0), reason: "quota" })) : Effect.void;
				}),
			],
			{ clientFactory: restarted.clientFactory },
		);
		yield* restarted.runDeferredNow(Queue);
		expect((yield* untilJob(second.jobs, Queue, id, "completed")).retryCount).toBe(Queue.queueOptions.retryLimit);
		expect(attempts).toEqual([id, id]);
	},
);

postgresIt("defers scheduled effects and treats a zero limit as an ordinary failure", [realPostgres], function* ({ boot, admin, untilJobs }) {
	const Schedule = defineSchedule({
		cron: "0 0 1 1 *",
		name: "retry-at-schedule",
		queue: { maxDeferrals: 1, retryLimit: 0 },
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const Disabled = defineSchedule({
		cron: "0 0 1 1 *",
		name: "retry-at-disabled",
		queue: { maxDeferrals: 0, retryLimit: 0 },
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const at = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 86_400_000);
	yield* boot([
		Schedule.run(Effect.fail(new RetryAt({ at, reason: "scheduled quota" }))),
		Disabled.run(Effect.fail(new RetryAt({ at, reason: "disabled" }))),
	]);
	const client = yield* admin();
	const id = yield* Effect.promise(() => client.send(Schedule.name, { retained: true }, { singletonKey: "schedule-key" }));
	yield* Effect.promise(() => client.send(Disabled.name));
	const waiting = yield* untilJobs(client, Schedule.name, (stored) => stored[0]?.state === "retry");
	expect(waiting).toMatchObject([{ data: { retained: true }, id, retryCount: 0, singletonKey: "schedule-key", startAfter: DateTime.toDateUtc(at) }]);
	expect(yield* untilJobs(client, Disabled.name, (stored) => stored[0]?.state === "failed")).toMatchObject([
		{ output: { _tag: "RetryAt", reason: "disabled" }, retryCount: 0 },
	]);
});
