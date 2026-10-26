import { Clock, DateTime, Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, RetryAt } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";
import { makePgBossTesting } from "#testing.ts";

for (const partition of [false, true]) {
	postgresIt(
		`defers stately siblings without spending retries and resumes them serially (partition: ${partition})`,
		[realPostgres],
		function* ({ boot, admin, until }) {
			const Queue = defineQueue({
				name: "retry-at-stately-siblings",
				queue: { partition, policy: "stately", retryLimit: 0 },
				schema: Schema.Struct({ value: Schema.Number }),
				worker: { batchSize: 1, localConcurrency: 2, pollingIntervalSeconds: 0.5 },
			});
			const testing = makePgBossTesting();
			const attempts = new Map<string, number>();
			const resumed: string[] = [];
			const reported: Error[] = [];
			const release = Promise.withResolvers<void>();
			const at = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 86_400_000);
			function attempt(id: string) {
				return Effect.gen(function* () {
					const count = (attempts.get(id) ?? 0) + 1;
					attempts.set(id, count);
					if (count === 1) {
						yield* new RetryAt({ at, reason: "quota" });
					}
					resumed.push(id);
					if (resumed.length === 1) {
						yield* Effect.promise(() => release.promise);
					}
				});
			}
			const { jobs } = yield* boot([Queue.handle((_, job) => attempt(job.id))], {
				clientFactory: testing.clientFactory,
				onError: (error) => Effect.sync(() => reported.push(error)),
			});
			yield* Effect.addFinalizer(() => Effect.sync(() => release.resolve()));
			const first = Option.getOrThrow(yield* jobs.enqueue(Queue, { value: 1 }, { singletonKey: "shared-account" }));
			yield* until(testing.deferred(Queue), (waiting) => waiting.length === 1);
			const second = Option.getOrThrow(yield* jobs.enqueue(Queue, { value: 2 }, { singletonKey: "shared-account" }));
			yield* until(testing.jobs(Queue), (stored) => stored.length === 2 && stored.every((job) => job.state === "retry" || job.state === "failed"));
			const expected = [first, second].map((id, index) => ({ data: { value: index + 1 }, id, retryCount: 0, singletonKey: "shared-account" }));
			expect(yield* testing.jobs(Queue)).toEqual(
				expect.arrayContaining(expected.map((job) => expect.objectContaining({ ...job, startAfter: DateTime.toDateUtc(at), state: "retry" }))),
			);
			expect(yield* testing.deferred(Queue)).toEqual([
				{ at, reason: "quota" },
				{ at, reason: "quota" },
			]);
			expect(reported).toEqual([]);
			const client = yield* admin();
			expect(yield* Effect.promise(() => client.findJobs(deadLetterQueueName(Queue.name)))).toEqual([]);
			yield* testing.runDeferredNow(Queue);
			yield* until(
				Effect.sync(() => resumed.length),
				(count) => count > 0,
			);
			expect(yield* Effect.promise(() => client.fetch(Queue.name, { includeMetadata: true }))).toEqual([]);
			const resumedJobs = yield* testing.jobs(Queue);
			expect(resumed).toEqual(resumedJobs.filter((job) => job.state === "active").map((job) => job.id));
			expect(resumed).toEqual([expect.stringMatching(/^[a-f0-9-]+$/u)]);
			expect((yield* testing.jobs(Queue)).map((job) => job.state).sort()).toEqual(["active", "retry"]);
			release.resolve();
			yield* until(testing.jobs(Queue), (stored) => stored.length === 2 && stored.every((job) => job.state === "completed"));
			expect(yield* testing.jobs(Queue)).toEqual(expect.arrayContaining(expected.map((job) => expect.objectContaining(job))));
			expect(new Set(resumed)).toEqual(new Set([first, second]));
			expect([...attempts.values()]).toEqual([2, 2]);
			expect(reported).toEqual([]);
			expect(yield* Effect.promise(() => client.findJobs(deadLetterQueueName(Queue.name)))).toEqual([]);
		},
	);
}
