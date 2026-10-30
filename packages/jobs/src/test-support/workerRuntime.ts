import { Deferred, Effect, Fiber, Schema } from "effect";
import { TestClock } from "effect/testing";
import { defineQueue } from "#definition.ts";
import { job } from "#test/fakeClient.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";

export function workerRuntime(runtime: ReturnType<typeof pgBossRuntime>) {
	const events: string[] = [];
	function handler(started: Deferred.Deferred<void>) {
		return Effect.gen(function* () {
			yield* Deferred.succeed(started, undefined);
			yield* Effect.sleep(100);
			events.push("completed");
		}).pipe(
			Effect.onInterrupt(() =>
				Effect.sync(() => {
					events.push("interrupted");
				}),
			),
		);
	}
	return {
		advance: (milliseconds: number) => TestClock.adjust(milliseconds),
		events,
		start: () =>
			Effect.gen(function* () {
				const started = yield* Deferred.make<void>();
				const queue = defineQueue({ name: "runtime-worker", schema: Schema.Struct({}) });
				const worker = yield* runtime.boot([queue.handle(() => handler(started))]);
				const fetched = { ...job(queue.name, {}), startedOn: new Date(0) };
				const dispatched = yield* runtime.dispatch(queue.name, [fetched]).pipe(Effect.exit, Effect.forkChild);
				yield* Deferred.await(started);
				return { finish: Fiber.join(dispatched), stop: worker.stop };
			}),
	};
}
