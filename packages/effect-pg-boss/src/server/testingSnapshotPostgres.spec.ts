import { Clock, DateTime, Effect, Fiber, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { acceleratedTesting, failingWorker, pausedWorker } from "#test/acceleratedTesting.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"reads the unfinished jobs of two queues in one snapshot and leaves completed jobs out",
	[realPostgres, acceleratedTesting, failingWorker],
	function* ({ admin, followUps, queue, recoverWorker, send, sendFollowUp, settle, snapshot, testing }) {
		const failed = Option.getOrThrow(yield* send(1, { retryLimit: 0 }));
		yield* settle();
		yield* recoverWorker;
		const completed = Option.getOrThrow(yield* send(2));
		expect((yield* settle()).find((job) => job.id === completed)?.state).toBe("completed");

		const claimed = Option.getOrThrow(yield* sendFollowUp("claimed"));
		const laterFollowUp = Option.getOrThrow(yield* sendFollowUp("later", { startAfter: 3600 }));
		const other = yield* admin({ schema: "story_jobs", supervise: false });
		expect((yield* Effect.promise(() => other.fetch(followUps.name))).map((job) => job.id)).toEqual([claimed]);
		const deferred = Option.getOrThrow(yield* send(3, { startAfter: 3600 }));
		yield* testing.waitForIdle.pipe(Effect.timeout("5 seconds"));

		const jobs = yield* snapshot;
		expect(jobs.map(({ data, id, queue: name, state }) => ({ data, id, name, state }))).toEqual([
			{ data: { id: 1 }, id: failed, name: queue.name, state: "failed" },
			{ data: { note: "claimed" }, id: claimed, name: followUps.name, state: "active" },
			{ data: { note: "later" }, id: laterFollowUp, name: followUps.name, state: "created" },
			{ data: { id: 3 }, id: deferred, name: queue.name, state: "created" },
		]);
		const now = yield* Clock.currentTimeMillis;
		const deferredIds = [laterFollowUp, deferred];
		for (const job of jobs) {
			expect(DateTime.isUtc(job.startAfter)).toBe(true);
			expect(DateTime.toEpochMillis(job.startAfter) > now).toBe(deferredIds.includes(job.id));
		}

		const unfinishedOnly = defineQueue({ name: queue.name, schema: Schema.Struct({ id: Schema.Literals(["1", "3"]) }) });
		expect((yield* testing.snapshot([unfinishedOnly])).map((job) => job.data)).toEqual([{ id: "1" }, { id: "3" }]);
		const incompatible = defineQueue({ name: queue.name, schema: Schema.Struct({ id: Schema.Literal("1") }) });
		expect(yield* testing.snapshot([incompatible]).pipe(Effect.flip)).toMatchObject({
			_tag: "PgBossPayloadError",
			direction: "decode",
			queue: queue.name,
		});
	},
);

postgresIt(
	"settles a busy worker through the idle wait without reading while it is busy",
	[realPostgres, acceleratedTesting, pausedWorker],
	function* ({ attempts, recordIdleReads, releaseWorker, send, settle, workerStarted }) {
		const idleReads = recordIdleReads();

		const busy = Option.getOrThrow(yield* send(1));
		yield* workerStarted;
		const settling = yield* settle().pipe(Effect.forkChild);
		const queued = [Option.getOrThrow(yield* send(2)), Option.getOrThrow(yield* send(3))];
		yield* Effect.sleep("500 millis");
		expect(idleReads()).toEqual([]);

		yield* releaseWorker;
		const jobs = yield* Fiber.join(settling).pipe(Effect.timeout("10 seconds"));
		expect(jobs.map(({ id, state }) => ({ id, state })).sort((left, right) => left.id.localeCompare(right.id))).toEqual(
			[busy, ...queued].sort((left, right) => left.localeCompare(right)).map((id) => ({ id, state: "completed" })),
		);
		expect([...attempts].sort((left, right) => left - right)).toEqual([1, 2, 3]);
		const readsPerSettledJob = 2;
		expect(idleReads().length).toBeLessThanOrEqual(readsPerSettledJob * attempts.length);
	},
);
