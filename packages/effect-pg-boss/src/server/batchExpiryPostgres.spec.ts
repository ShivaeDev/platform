import { Clock, Duration, Effect, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { observeWorker } from "#test/observeWorker.ts";
import { until } from "#test/until.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL batch expiry budgets", () => {
	it("interrupts at the fetch deadline, leaves waiting jobs for expiry, and never overlaps retries", async () => {
		const Queue = defineQueue({
			name: `batch-expiry-${crypto.randomUUID()}`,
			queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
			schema: Schema.Struct({ id: Schema.Number }),
			worker: { batchSize: 4, localConcurrency: 2, pollingIntervalSeconds: 0.5 },
		});
		const client = new PgBoss({
			connectionString: databaseUrl,
			monitorIntervalSeconds: 1,
			schema: "platform_effect_pg_boss_batch_expiry",
			superviseIntervalSeconds: 1,
		});
		const Jobs = makePgBoss("@test/BatchExpiryJobs");
		const fetched = new Map<string, { deadline: number; retry: number }>();
		const batches: number[] = [];
		const observed = observeWorker(client, (jobs) => {
			batches.push(jobs.length);
			for (const job of jobs) {
				if (!("startedOn" in job && job.startedOn instanceof Date)) {
					throw new TypeError("Missing fetched start time");
				}
				fetched.set(job.id, { deadline: job.startedOn.getTime() + job.expireInSeconds * 1000, retry: job.retryCount });
			}
			const decode = Schema.decodeUnknownSync(Queue.schema);
			return [...jobs].sort((left, right) => decode(left.data).id - decode(right.data).id);
		});
		const active = new Map<string, number>();
		const starts: Array<{ id: number; retry: number; remaining: number; budget: number }> = [];
		const interrupted: Array<{ id: number; lateness: number }> = [];
		const finished: number[] = [];
		let peak = 0;
		const worker = Queue.handle(({ id }, job) =>
			Effect.gen(function* () {
				const attempt = fetched.get(job.id);
				if (attempt === undefined) {
					return yield* Effect.die("Missing fetched attempt");
				}
				const remaining = attempt.deadline - (yield* Clock.currentTimeMillis);
				const budget = Duration.toMillis(yield* job.remainingBudget);
				starts.push({ budget, id, remaining, retry: attempt.retry });
				active.set(job.id, (active.get(job.id) ?? 0) + 1);
				peak = Math.max(peak, active.get(job.id) ?? 0);
				const release = Effect.sync(() => active.set(job.id, (active.get(job.id) ?? 1) - 1));
				const recordInterruption = Effect.map(Clock.currentTimeMillis, (now) => interrupted.push({ id, lateness: now - attempt.deadline }));
				yield* Effect.gen(function* () {
					if (attempt.retry === 0) {
						yield* Effect.sleep(id === 0 ? 600 : 2500);
						finished.push(id);
					}
				}).pipe(
					Effect.onInterrupt(() => recordInterruption),
					Effect.ensuring(release),
				);
			}),
		);
		function completedJobs() {
			return until(async () => {
				const jobs = await client.findJobs<{ id: number }>(Queue.name);
				return jobs.length === 4 && jobs.every((job) => job.state === "completed") ? jobs : undefined;
			});
		}
		await client.start();
		try {
			await client.createQueue(Queue.name, Queue.queueOptions);
			await client.insert(
				Queue.name,
				Array.from({ length: 4 }, (_, id) => ({ data: { id }, expireInSeconds: id === 0 || id === 3 ? 4 : 1 })),
			);
			await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						yield* Jobs;
						const stored = yield* Effect.promise(completedJobs);
						expect(batches[0]).toBe(4);
						expect(peak).toBe(1);
						expect(starts.filter(({ retry }) => retry === 0).map(({ id }) => id)).toEqual([0, 1]);
						expect(starts.every(({ remaining }) => remaining > 0)).toBe(true);
						const later = starts.find(({ id, retry }) => id === 1 && retry === 0);
						expect(later?.budget).toBeGreaterThan(0);
						expect(later?.budget).toBeLessThan(500);
						for (const start of starts) {
							expect(Math.abs(start.budget - start.remaining)).toBeLessThan(50);
						}
						expect(interrupted.map(({ id }) => id)).toEqual([1]);
						expect(interrupted[0]?.lateness).toBeGreaterThanOrEqual(-20);
						expect(interrupted[0]?.lateness).toBeLessThan(200);
						expect(finished).toEqual([0]);
						expect(stored.filter((job) => job.data.id !== 0).every((job) => job.retryCount === 1)).toBe(true);
					}).pipe(Effect.provide(Jobs.layer({ clientFactory: () => observed, jobs: [worker] }))),
				),
			);
		} finally {
			await client.start();
			await client.deleteQueue(Queue.name);
			await client.deleteQueue(deadLetterQueueName(Queue.name));
			await client.stop();
		}
	});
});
