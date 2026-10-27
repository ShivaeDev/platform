import { Clock, DateTime, Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, RetryAt } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";
import { makePgBossTesting } from "#testing.ts";

for (const cause of ["expiry", "heartbeat"] as const) {
	postgresIt(
		`keeps the deferral limit after native ${cause} replaces job output`,
		[realPostgres],
		function* ({ boot, admin, expireClaim, until, untilJob }) {
			const Queue = defineQueue({
				name: `retry-at-${cause}`,
				queue: {
					expireInSeconds: cause === "expiry" ? 1 : 900,
					heartbeatSeconds: 10,
					maxDeferrals: 1,
					retryBackoff: false,
					retryDelay: 0,
					retryLimit: 2,
				},
				schema: Schema.Struct({}),
				worker: { batchSize: 1, pollingIntervalSeconds: 0.5 },
			});
			const testing = makePgBossTesting();
			const at = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 86_400_000);
			const first = yield* boot([Queue.handle(() => Effect.fail(new RetryAt({ at, reason: "quota" })))], {
				clientFactory: testing.clientFactory,
			});
			const id = Option.getOrThrow(yield* first.jobs.enqueue(Queue, {}));
			yield* until(testing.deferred(Queue), (waiting) => waiting.length === 1);
			yield* first.stop;
			const client = yield* admin({ monitorIntervalSeconds: 1, supervise: false });
			yield* Effect.promise(() => client.update(Queue.name, {}, { id, startAfter: 0 }));
			const claimed = yield* Effect.promise(() => client.fetch(Queue.name, { includeMetadata: true }));
			const claim = claimed[0];
			if (claim === undefined) {
				return yield* Effect.die(new Error("The deferred job was not available to claim"));
			}
			expect(claim.id).toBe(id);
			yield* expireClaim(client, claim, cause);
			const expired = yield* Effect.promise(() => client.findJobs(Queue.name, { id }));
			expect(expired).toMatchObject([{ retryCount: 0, state: "retry" }]);
			expect(expired[0]?.output).not.toHaveProperty("jobDeferral");
			expect(expired[0]?.output).toMatchObject({ value: { message: cause === "expiry" ? "job timed out" : "job heartbeat timeout" } });
			const restarted = makePgBossTesting();
			const attempts: string[] = [];
			const second = yield* boot(
				[
					Queue.handle((_, job) => {
						attempts.push(job.id);
						return attempts.length === 1 ? Effect.fail(new RetryAt({ at, reason: "quota after timeout" })) : Effect.void;
					}),
				],
				{ clientFactory: restarted.clientFactory },
			);
			expect((yield* untilJob(second.jobs, Queue, id, "completed")).retryCount).toBe(Queue.queueOptions.retryLimit);
			expect(attempts).toEqual([id, id]);
			expect(yield* restarted.deferred(Queue)).toEqual([]);
		},
	);
}

postgresIt("starts a fresh deferral budget when a deleted job ID is reused", [realPostgres], function* ({ boot, admin, until }) {
	const Queue = defineQueue({
		name: "retry-at-reused-id",
		queue: { maxDeferrals: 1, retryLimit: 0 },
		schema: Schema.Struct({}),
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const testing = makePgBossTesting();
	const at = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 86_400_000);
	const { jobs } = yield* boot([Queue.handle(() => Effect.fail(new RetryAt({ at, reason: "quota" })))], { clientFactory: testing.clientFactory });
	const id = Option.getOrThrow(yield* jobs.enqueue(Queue, {}));
	yield* until(testing.deferred(Queue), (waiting) => waiting.length === 1);
	const client = yield* admin();
	yield* Effect.promise(() => client.deleteJob(Queue.name, id));
	expect(yield* jobs.enqueue(Queue, {}, { id })).toEqual(Option.some(id));
	yield* until(testing.deferred(Queue), (waiting) => waiting.length === 1);
	expect(yield* testing.jobs(Queue)).toMatchObject([{ id, retryCount: 0, state: "retry" }]);
});
