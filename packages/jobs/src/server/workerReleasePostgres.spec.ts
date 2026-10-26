import { Deferred, Effect, Fiber, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"drains active jobs, pauses every queue, and resumes jobs queued while paused",
	[realPostgres],
	function* ({ workerRelease, until, logs }) {
		const release = yield* workerRelease;
		const First = defineQueue({ name: "release-first", schema: Schema.Struct({ id: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });
		const Second = defineQueue({ name: "release-second", schema: Schema.Struct({ id: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });
		const Third = defineQueue({ name: "another-layer", schema: Schema.Struct({ id: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });
		const started = yield* Deferred.make<void>();
		const finish = yield* Deferred.make<void>();
		const completed: number[] = [];
		const runtime = yield* release.boot([
			First.handle(({ id }) =>
				Effect.gen(function* () {
					if (id === 1) {
						yield* Deferred.succeed(started, undefined);
						yield* Deferred.await(finish);
					}
					completed.push(id);
				}),
			),
			Second.handle(({ id }) =>
				Effect.sync(() => {
					completed.push(id);
				}),
			),
		]);
		const sibling = yield* release.boot([
			Third.handle(({ id }) =>
				Effect.sync(() => {
					completed.push(id);
				}),
			),
		]);
		yield* runtime.jobs.enqueue(First, { id: 1 });
		yield* Deferred.await(started);
		const closing = yield* release.close.pipe(Effect.forkScoped);
		yield* runtime.jobs.enqueue(Second, { id: 3 });
		yield* sibling.jobs.enqueue(Third, { id: 4 });
		yield* Effect.sleep("1200 millis");
		expect(completed).toEqual([]);
		yield* Deferred.succeed(finish, undefined);
		yield* Fiber.join(closing);
		expect(completed).toEqual([1]);
		yield* runtime.jobs.enqueue(First, { id: 2 });
		yield* Effect.sleep("1200 millis");
		expect(completed).toEqual([1]);
		yield* release.open;
		yield* until(
			Effect.sync(() => [...completed].sort()),
			(ids) => ids.length === 4,
		);
		expect([...completed].sort()).toEqual([1, 2, 3, 4]);
		expect(logs.filter(({ message }) => String(message).startsWith("Workers ")).map(({ message }) => String(message))).toEqual([
			"Workers paused for another database release",
			"Workers paused for another database release",
			"Workers resumed for database release",
			"Workers resumed for database release",
		]);
	},
);

postgresIt("accepts producer work while workers wait for release ownership", [realPostgres], function* ({ workerRelease, until }) {
	const release = yield* workerRelease;
	yield* release.close;
	const Queue = defineQueue({ name: "waiting-release", schema: Schema.Struct({ id: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });
	const handled: number[] = [];
	const runtime = yield* release.boot([
		Queue.handle(({ id }) =>
			Effect.sync(() => {
				handled.push(id);
			}),
		),
	]);
	yield* runtime.jobs.enqueue(Queue, { id: 42 });
	yield* Effect.sleep("1200 millis");
	expect(handled).toEqual([]);
	yield* release.open;
	yield* until(
		Effect.sync(() => handled),
		(ids) => ids.length > 0,
	);
	expect(handled).toEqual([42]);
});
