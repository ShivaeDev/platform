import { Duration, Effect, Option } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { acceleratedTesting, alwaysStuckWorker, stuckWorker } from "#test/acceleratedTesting.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"interrupts a stuck attempt at its deadline and completes its retry on the same default worker",
	[realPostgres, acceleratedTesting, stuckWorker],
	function* ({ attempts, interruptions, queue, send, settle, testing, workerIds }) {
		yield* testing.expireAfter(queue, 3);
		yield* testing.expireIn(queue, "1 second");
		const id = Option.getOrThrow(yield* send(7));
		expect(yield* settle()).toMatchObject([{ expireInSeconds: 1, id, retryCount: 1, retryLimit: 2, state: "completed" }]);
		expect(attempts).toEqual([7, 7]);
		expect(interruptions).toEqual([0]);
		expect(workerIds).toEqual([workerIds[0], workerIds[0]]);
	},
);

postgresIt(
	"dead letters a handler that stays stuck through every retry",
	[realPostgres, acceleratedTesting, stuckWorker, alwaysStuckWorker],
	function* ({ attempts, interruptions, queue, send, settle, testing, workerIds }) {
		yield* testing.expireIn(queue, "1 second");
		const id = Option.getOrThrow(yield* send(8, { retryLimit: 1 }));
		expect(yield* settle()).toMatchObject([{ id, output: { message: "handler execution exceeded 1s" }, retryCount: 1, state: "failed" }]);
		expect(attempts).toEqual([8, 8]);
		expect(interruptions).toEqual([0, 0]);
		expect(workerIds).toEqual([workerIds[0], workerIds[0]]);
		const deadLetter = defineQueue({ name: deadLetterQueueName(queue.name), schema: queue.schema });
		expect(yield* testing.jobs(deadLetter)).toMatchObject([{ data: { id: 8 }, sourceId: id, sourceRetryCount: 1 }]);
	},
);

postgresIt(
	"keeps each send's time expiry across later rules and duplicate sends",
	[realPostgres, acceleratedTesting],
	function* ({ queue, send, testing }) {
		const before = Option.getOrThrow(yield* send(1));
		yield* testing.expireIn(queue, "1001 millis");
		const rounded = Option.getOrThrow(yield* send(2));
		yield* testing.expireIn(queue, "1 second");
		const later = Option.getOrThrow(yield* send(3));
		yield* send(2, { id: rounded });
		expect(yield* testing.jobs(queue, { id: before })).toMatchObject([{ expireInSeconds: 60 }]);
		expect(yield* testing.jobs(queue, { id: rounded })).toMatchObject([{ expireInSeconds: 2 }]);
		expect(yield* testing.jobs(queue, { id: later })).toMatchObject([{ expireInSeconds: 1 }]);
	},
);

postgresIt(
	"rejects time expiries shorter than a second or nonfinite with a typed error",
	[realPostgres, acceleratedTesting],
	function* ({ queue, testing }) {
		for (const duration of ["999 millis", "0 seconds", "-1 second", Duration.infinity, Duration.millis(Number.NaN)] as const) {
			expect(yield* testing.expireIn(queue, duration).pipe(Effect.flip)).toMatchObject({
				_tag: "PgBossTestingError",
				operation: "expireIn",
				queue: queue.name,
			});
		}
	},
);
