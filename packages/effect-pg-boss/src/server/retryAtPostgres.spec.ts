import { Clock, DateTime, Effect, Exit, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, RetryAt } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { makePgBossTesting } from "#testing.ts";

postgresIt(
	"defers the same singleton job without spending a retry or reporting an error, and ends its span OK",
	[realPostgres],
	function* ({ boot, admin, until }) {
		const Queue = defineQueue({
			name: "retry-at-identity",
			queue: { policy: "stately", retryLimit: 0 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const testing = makePgBossTesting();
		const { spans, tracer } = recordingTracer();
		const reported: Error[] = [];
		const attempts: string[] = [];
		const at = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 86_400_000);
		const { jobs } = yield* boot(
			[
				Queue.handle((_, job) => {
					attempts.push(job.id);
					return attempts.length === 1 ? Effect.fail(new RetryAt({ at, reason: "provider quota" })) : Effect.void;
				}),
			],
			{ clientFactory: testing.clientFactory, onError: (error) => Effect.sync(() => reported.push(error)) },
		).pipe(Effect.withTracer(tracer));
		const id = Option.getOrThrow(yield* jobs.enqueue(Queue, { id: 42 }, { singletonKey: "account-42" }));
		yield* until(testing.deferred(Queue), (waiting) => waiting.length === 1);
		const storedJobs = yield* testing.jobs(Queue);
		expect(storedJobs).toMatchObject([
			{ data: { id: 42 }, id, retryCount: 0, singletonKey: "account-42", startAfter: DateTime.toDateUtc(at), state: "retry" },
		]);
		expect(yield* testing.deferred(Queue)).toEqual([{ at, reason: "provider quota" }]);
		expect(reported).toEqual([]);
		const client = yield* admin();
		expect(yield* Effect.promise(() => client.findJobs(deadLetterQueueName(Queue.name)))).toEqual([]);
		const span = yield* until(
			Effect.sync(() => spans.find((current) => current.name === Queue.name)),
			(recorded) => recorded?.status._tag === "Ended",
		);
		expect(span?.status._tag === "Ended" && Exit.isSuccess(span.status.exit)).toBe(true);
		expect(span?.events).toEqual([["job.deferred", expect.any(BigInt), { at: DateTime.formatIso(at), reason: "provider quota" }]]);
		const revision = yield* testing.revision;
		yield* testing.runDeferredNow(Queue);
		expect(yield* testing.waitForChange(revision)).toBeGreaterThan(revision);
		yield* until(testing.jobs(Queue), (stored) => stored[0]?.state === "completed");
		expect(attempts).toEqual([id, id]);
		expect(yield* testing.jobs(Queue)).toMatchObject([{ data: { id: 42 }, id, retryCount: 0, singletonKey: "account-42" }]);
		expect(yield* testing.deferred(Queue)).toEqual([]);
		expect(reported).toEqual([]);
	},
);

postgresIt("waits until RetryAt becomes due and runs through the notify polling backstop", [realPostgres], function* ({ boot, untilJob, until }) {
	const Queue = defineQueue({
		name: "retry-at-due",
		queue: { notify: true },
		schema: Schema.Struct({}),
		worker: { notifyPollingIntervalSeconds: 0.5, pollingIntervalSeconds: 0.5 },
	});
	const attempts: number[] = [];
	let at = DateTime.makeUnsafe(0);
	const { jobs } = yield* boot(
		[
			Queue.handle(() =>
				Effect.gen(function* () {
					attempts.push(yield* Clock.currentTimeMillis);
					if (attempts.length === 1) {
						at = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 1500);
						yield* new RetryAt({ at, reason: "slow down" });
					}
				}),
			),
		],
		{ useListenNotify: true },
	);
	const id = Option.getOrThrow(yield* jobs.enqueue(Queue, {}));
	const waiting = yield* untilJob(jobs, Queue, id, "retry");
	expect(waiting.startAfter).toEqual(DateTime.toDateUtc(at));
	yield* Effect.sleep("300 millis");
	expect(attempts).toHaveLength(1);
	yield* until(
		Effect.sync(() => attempts.length),
		(count) => count === 2,
	);
	expect(attempts[1]).toBeGreaterThanOrEqual(DateTime.toEpochMillis(at));
	expect((yield* untilJob(jobs, Queue, id, "completed")).retryCount).toBe(0);
});
