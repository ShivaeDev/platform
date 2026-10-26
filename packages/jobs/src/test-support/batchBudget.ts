import { Clock, Duration, Effect, Schema } from "effect";
import type { Job } from "pg-boss";
import { defineQueue } from "#definition.ts";

export function batchBudget() {
	const Queue = defineQueue({
		name: "batch-expiry",
		queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
		schema: Schema.Struct({ id: Schema.Number }),
		worker: { batchSize: 4, pollingIntervalSeconds: 0.5 },
	});
	const decode = Schema.decodeUnknownSync(Queue.schema);
	const fetched = new Map<string, { deadline: number; retry: number }>();
	const batches: number[] = [];
	const fetchedBatches: number[][] = [];
	const overlapping: string[] = [];
	const peerRetries: number[] = [];
	function record(jobs: readonly Job<unknown>[]) {
		batches.push(jobs.length);
		fetchedBatches.push(jobs.map((job) => decode(job.data).id).sort());
		for (const job of jobs) {
			if (!("startedOn" in job && job.startedOn instanceof Date)) {
				throw new TypeError("Missing fetched start time");
			}
			fetched.set(job.id, { deadline: job.startedOn.getTime() + job.expireInSeconds * 1000, retry: job.retryCount });
		}
		return [...jobs].sort((left, right) => decode(left.data).id - decode(right.data).id);
	}
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
			if (active.has(job.id) && active.get(job.id) !== 0) {
				overlapping.push(job.id);
			}
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
	return { batches, fetchedBatches, finished, interrupted, overlapping, peak: () => peak, peerRetries, queue: Queue, record, starts, worker };
}
