import { Effect, Fiber, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { acceleratedTesting, failingWorker, pausedWorker, productionRetries } from "#test/acceleratedTesting.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"reads decoded jobs sent through the queue, including traced sends",
	[realPostgres, acceleratedTesting],
	function* ({ queue, send, testing }) {
		const id = Option.getOrThrow(yield* send(42).pipe(Effect.withSpan("sender")));
		expect(yield* testing.jobs(queue)).toMatchObject([{ data: { id: 42 }, id, state: "created" }]);
		expect(yield* testing.jobs(queue, { queued: true })).toMatchObject([{ data: { id: 42 }, id, state: "created" }]);
		expect(yield* testing.jobs(queue, { id: crypto.randomUUID() })).toEqual([]);
	},
);

postgresIt(
	"preserves the native client's prototype members",
	[realPostgres, acceleratedTesting],
	function* ({ testingClient, queue, send, testing }) {
		const id = Option.getOrThrow(yield* send(15));
		expect(yield* testing.jobs(queue)).toMatchObject([{ data: { id: 15 }, id, state: "created" }]);
		expect(testingClient().constructor).not.toBe(Object);
		expect(testingClient().valueOf()).not.toBe(testingClient());
	},
);

postgresIt(
	"fails exactly the next send for the selected queue with the typed enqueue error",
	[realPostgres, acceleratedTesting],
	function* ({ queue, send, testing }) {
		const other = defineQueue({ ...queue, name: "not-the-selected-queue" });
		yield* testing.failNextSend(other);
		expect(Option.isSome(yield* send(1))).toBe(true);
		yield* testing.failNextSend(queue);
		const error = yield* send(2).pipe(Effect.flip);
		expect(error).toMatchObject({ _tag: "PgBossError", operation: "enqueue", queue: queue.name });
		expect(Option.isSome(yield* send(3))).toBe(true);
		expect((yield* testing.jobs(queue)).map((job) => job.data.id).sort()).toEqual([1, 3]);
	},
);

postgresIt(
	"expires the final claim after the requested attempts through PostgreSQL supervision",
	[realPostgres, acceleratedTesting, failingWorker],
	function* ({ attempts, queue, send, settle, testing }) {
		yield* testing.expireAfter(queue, 3);
		const id = Option.getOrThrow(yield* send(7));
		const jobs = yield* settle();
		expect(attempts).toEqual([7, 7]);
		expect(jobs).toMatchObject([{ id, output: { value: { message: "job timed out" } }, retryCount: 2, retryLimit: 2, state: "failed" }]);
		const deadLetter = defineQueue({ name: deadLetterQueueName(queue.name), schema: queue.schema });
		expect(yield* testing.jobs(deadLetter)).toMatchObject([{ data: { id: 7 }, sourceId: id, sourceRetryCount: 2 }]);
	},
);

postgresIt(
	"overrides production and send retry delays through the test policy",
	[realPostgres, acceleratedTesting, failingWorker],
	function* ({ attempts, queue, send, settle, testing }) {
		yield* send(8, { retryBackoff: true, retryDelay: 120, retryDelayMax: 240, retryLimit: 1 });
		const jobs = yield* settle();
		expect(attempts).toEqual([8, 8]);
		expect(jobs).toMatchObject([{ retryBackoff: false, retryCount: 1, retryDelay: 0, state: "failed" }]);
		expect((yield* testing.jobs(queue))[0]?.retryDelay).toBe(0);
	},
);

postgresIt(
	"wakes a waiting kit and remembers changes that happened before it waited",
	[realPostgres, acceleratedTesting],
	function* ({ send, testing }) {
		const before = yield* testing.revision;
		const waiter = yield* testing.waitForChange(before).pipe(Effect.forkChild);
		yield* send(1);
		expect(yield* Fiber.join(waiter)).toBeGreaterThan(before);
		expect(yield* testing.waitForChange(before)).toBeGreaterThan(before);
	},
);

postgresIt(
	"wakes on worker settlement and allows success before the expiry attempt",
	[realPostgres, acceleratedTesting, pausedWorker],
	function* ({ attempts, queue, releaseWorker, send, settle, testing, workerStarted }) {
		yield* testing.expireAfter(queue, 3);
		yield* send(9);
		yield* workerStarted;
		const revision = yield* testing.revision;
		const waiter = yield* testing.waitForChange(revision).pipe(Effect.forkChild);
		yield* releaseWorker;
		expect(yield* Fiber.join(waiter)).toBeGreaterThan(revision);
		expect(yield* settle()).toMatchObject([{ retryCount: 0, state: "completed" }]);
		expect(attempts).toEqual([9]);
	},
);

postgresIt(
	"keeps production retries unless the kit selects the test policy",
	[realPostgres, acceleratedTesting, productionRetries],
	function* ({ queue, send, testing }) {
		yield* send(10);
		expect(yield* testing.jobs(queue)).toMatchObject([{ retryBackoff: true, retryDelay: 100, retryDelayMax: 200, retryLimit: 5 }]);
	},
);

postgresIt(
	"checks installed schema versions and sequential batch budgets without application SQL",
	[realPostgres, acceleratedTesting],
	function* ({ queue, testing }) {
		const version = yield* testing.schemaVersion;
		yield* testing.checkSchemaVersion(version ?? 0);
		expect(yield* testing.checkSchemaVersion(-1).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossTestingError", operation: "checkSchemaVersion" });
		yield* testing.checkBatchWindow(queue, 1000);
		expect(yield* testing.checkBatchWindow(queue, 30_000).pipe(Effect.flip)).toMatchObject({
			_tag: "PgBossTestingError",
			operation: "checkBatchWindow",
		});
		expect(yield* testing.expireAfter(queue, 0).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossTestingError", operation: "expireAfter" });
	},
);

postgresIt("rejects durable data that the readout schema cannot decode", [realPostgres, acceleratedTesting], function* ({ queue, send, testing }) {
	yield* send(42);
	const incompatible = defineQueue({ name: queue.name, schema: Schema.Struct({ id: Schema.Number }) });
	expect(yield* testing.jobs(incompatible).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossPayloadError", direction: "decode", queue: queue.name });
});
