import { Effect, Option } from "effect";
import { expect } from "vitest";
import { deadLetterQueueName } from "#health.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";
import { singletonQueue } from "#test/singletonQueue.ts";

postgresIt("serializes tagged jobs for one entity while other keys run in parallel", [realPostgres], function* ({ boot, until, untilJob }) {
	const Queue = singletonQueue();
	const release = Promise.withResolvers<void>();
	const active = new Map<number, number>();
	const overlaps: number[] = [];
	const started: string[] = [];
	const worker = Queue.handle((payload) =>
		Effect.gen(function* () {
			const count = (active.get(payload.pullRequestId) ?? 0) + 1;
			active.set(payload.pullRequestId, count);
			if (count > 1) {
				overlaps.push(payload.pullRequestId);
			}
			started.push(`${payload._tag}:${payload.pullRequestId}`);
			yield* Effect.promise(() => release.promise).pipe(
				Effect.ensuring(Effect.sync(() => active.set(payload.pullRequestId, (active.get(payload.pullRequestId) ?? 1) - 1))),
			);
		}),
	);
	const first = yield* boot([worker]);
	const peer = yield* boot([worker]);
	yield* Effect.addFinalizer(() => Effect.sync(() => release.resolve()));
	const refresh = Option.getOrThrow(yield* first.jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }));
	yield* until(
		Effect.sync(() => started.length),
		(count) => count === 1,
	);
	const reconcile = Option.getOrThrow(yield* peer.jobs.enqueue(Queue, { _tag: "Reconcile", pullRequestId: 42 }));
	const other = Option.getOrThrow(yield* peer.jobs.enqueue(Queue, { _tag: "Reconcile", pullRequestId: 99 }));
	yield* until(
		Effect.sync(() => started.length),
		(count) => count >= 2,
	);
	expect(started).toEqual(["Refresh:42", "Reconcile:99"]);
	expect([...active]).toEqual([
		[42, 1],
		[99, 1],
	]);
	expect(Option.getOrThrow(yield* first.jobs.getJob(Queue, reconcile))).toMatchObject({ singletonKey: "pr:42", state: "created" });
	expect(Option.getOrThrow(yield* first.jobs.getJob(Queue, other))).toMatchObject({ singletonKey: "pr:99", state: "active" });
	release.resolve();
	for (const id of [refresh, reconcile, other]) {
		yield* untilJob(first.jobs, Queue, id, "completed");
	}
	expect(started).toHaveLength(3);
	expect(overlaps).toEqual([]);
});

postgresIt("lets the next job use an entity key while an earlier job waits to retry", [realPostgres], function* ({ boot, untilJob }) {
	const Queue = singletonQueue({ retryBackoff: false, retryDelay: 3600, retryLimit: 1 });
	const handled: string[] = [];
	const { jobs } = yield* boot([
		Queue.handle(({ _tag }) => {
			handled.push(_tag);
			return _tag === "Refresh" ? Effect.fail(new Error("provider unavailable")) : Effect.void;
		}),
	]);
	const first = Option.getOrThrow(yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }));
	expect(yield* untilJob(jobs, Queue, first, "retry")).toMatchObject({ singletonKey: "pr:42" });
	const next = Option.getOrThrow(yield* jobs.enqueue(Queue, { _tag: "Reconcile", pullRequestId: 42 }));
	expect(yield* untilJob(jobs, Queue, next, "completed")).toMatchObject({ singletonKey: "pr:42" });
	expect(Option.getOrThrow(yield* jobs.getJob(Queue, first)).state).toBe("retry");
	expect(handled).toEqual(["Refresh", "Reconcile"]);
});

postgresIt("dead-letters an exhausted job and leaves its entity key available", [realPostgres], function* ({ boot, admin, untilJob, untilJobs }) {
	const Queue = singletonQueue({ retryBackoff: false, retryDelay: 0, retryLimit: 1 });
	const client = yield* admin();
	let attempts = 0;
	const { jobs } = yield* boot([
		Queue.handle(({ _tag }) => {
			if (_tag === "Reconcile") {
				return Effect.void;
			}
			attempts += 1;
			return Effect.fail(new Error("provider unavailable"));
		}),
	]);
	const first = Option.getOrThrow(yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }));
	expect(yield* untilJob(jobs, Queue, first, "failed")).toMatchObject({ retryCount: 1, singletonKey: "pr:42" });
	expect(yield* untilJobs(client, deadLetterQueueName(Queue.name), (entries) => entries.length > 0)).toMatchObject([
		{ data: { _tag: "Refresh", pullRequestId: "42" }, sourceName: Queue.name },
	]);
	const next = Option.getOrThrow(yield* jobs.enqueue(Queue, { _tag: "Reconcile", pullRequestId: 42 }));
	expect(yield* untilJob(jobs, Queue, next, "completed")).toMatchObject({ singletonKey: "pr:42" });
	expect(attempts).toBe(2);
});
