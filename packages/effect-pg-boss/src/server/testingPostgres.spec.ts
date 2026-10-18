import { Effect, Fiber, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { failingWorker, pausedWorker, productionRetries, queues } from "#test/testingStory.ts";

queues.it("reads decoded jobs sent through the queue, including traced sends", [], function* ({ queue, send, testing }) {
	const id = Option.getOrThrow(yield* send(42).pipe(Effect.withSpan("sender")));
	expect(yield* testing.jobs(queue)).toMatchObject([{ data: { id: 42 }, id, state: "created" }]);
	expect(yield* testing.jobs(queue, { queued: true })).toHaveLength(1);
	expect(yield* testing.jobs(queue, { id: crypto.randomUUID() })).toEqual([]);
});

queues.it("fails exactly the next send for the selected queue with the typed enqueue error", [], function* ({ queue, send, testing }) {
	const other = defineQueue({ ...queue, name: "not-the-selected-queue" });
	yield* testing.failNextSend(other);
	expect(Option.isSome(yield* send(1))).toBe(true);
	yield* testing.failNextSend(queue);
	const error = yield* send(2).pipe(Effect.flip);
	expect(error).toMatchObject({ _tag: "PgBossError", operation: "enqueue", queue: queue.name });
	expect(Option.isSome(yield* send(3))).toBe(true);
	expect((yield* testing.jobs(queue)).map((job) => job.data.id).sort()).toEqual([1, 3]);
});

queues.it(
	"expires the final claim after the requested attempts through PostgreSQL supervision",
	[failingWorker],
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

queues.it(
	"overrides production and send retry delays through the test policy",
	[failingWorker],
	function* ({ attempts, queue, send, settle, testing }) {
		yield* send(8, { retryBackoff: true, retryDelay: 120, retryDelayMax: 240, retryLimit: 1 });
		const jobs = yield* settle();
		expect(attempts).toEqual([8, 8]);
		expect(jobs).toMatchObject([{ retryBackoff: false, retryCount: 1, retryDelay: 0, state: "failed" }]);
		expect((yield* testing.jobs(queue))[0]?.retryDelay).toBe(0);
	},
);

queues.it("wakes a waiting kit and remembers changes that happened before it waited", [], function* ({ send, testing }) {
	const before = yield* testing.revision;
	const waiter = yield* testing.waitForChange(before).pipe(Effect.forkChild);
	yield* send(1);
	expect(yield* Fiber.join(waiter)).toBeGreaterThan(before);
	expect(yield* testing.waitForChange(before)).toBeGreaterThan(before);
	const cancelled = yield* testing.waitForChange(yield* testing.revision).pipe(Effect.forkChild);
	yield* Fiber.interrupt(cancelled);
	const next = yield* testing.revision;
	yield* send(2);
	expect(yield* testing.waitForChange(next)).toBeGreaterThan(next);
});

queues.it(
	"wakes on worker settlement and allows success before the expiry attempt",
	[pausedWorker],
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

queues.it("keeps production retries unless the kit selects the test policy", [productionRetries], function* ({ queue, send, testing }) {
	yield* send(10);
	expect(yield* testing.jobs(queue)).toMatchObject([{ retryBackoff: true, retryDelay: 100, retryDelayMax: 200, retryLimit: 5 }]);
});

queues.it("checks installed schema versions and sequential batch budgets without application SQL", [], function* ({ queue, testing }) {
	const version = yield* testing.schemaVersion;
	expect(version).toBeTypeOf("number");
	yield* testing.checkSchemaVersion(version ?? 0);
	expect(yield* testing.checkSchemaVersion(-1).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossTestingError", operation: "checkSchemaVersion" });
	yield* testing.checkBatchWindow(queue, 1000);
	expect(yield* testing.checkBatchWindow(queue, 30_000).pipe(Effect.flip)).toMatchObject({
		_tag: "PgBossTestingError",
		operation: "checkBatchWindow",
	});
	expect(yield* testing.expireAfter(queue, 0).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossTestingError", operation: "expireAfter" });
});

queues.it("rejects durable data that the readout schema cannot decode", [], function* ({ queue, send, testing }) {
	yield* send(42);
	const incompatible = defineQueue({ name: queue.name, schema: Schema.Struct({ id: Schema.Number }) });
	expect(yield* testing.jobs(incompatible).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossPayloadError", direction: "decode", queue: queue.name });
});
