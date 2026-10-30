import { Deferred, Effect, Fiber, Schema } from "effect";
import { defineQueue } from "#definition.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";

export const gracefulShutdown = Effect.fnUntraced(function* (runtime: ReturnType<typeof pgBossRuntime>, shared: boolean) {
	const active = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const stopping = Promise.withResolvers<void>();
	const events: string[] = [];
	const client = runtime.native();
	const queue = defineQueue({ name: "graceful-shutdown", schema: Schema.Struct({ id: Schema.String }), worker: { pollingIntervalSeconds: 0.5 } });
	function handle(payload: { readonly id: string }) {
		return Effect.gen(function* () {
			yield* Deferred.succeed(active, undefined);
			yield* Deferred.await(release);
			events.push(payload.id);
		}).pipe(
			Effect.onInterrupt(() =>
				Effect.sync(() => {
					events.push("interrupted");
				}),
			),
		);
	}
	const clientOptions = { clientCacheKey: Symbol("graceful-shutdown"), clientFactory: () => client };
	if (shared) {
		yield* runtime.boot([queue], clientOptions);
	}
	const worker = yield* runtime.boot([queue.handle(handle)], clientOptions, "parallel");
	const stop = client.stop.bind(client);
	client.stop = (options) => {
		stopping.resolve();
		return stop(options);
	};
	const offWork = client.offWork.bind(client);
	client.offWork = (name, options) => {
		stopping.resolve();
		return offWork(name, options);
	};
	yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined));
	return {
		active: Deferred.await(active),
		events,
		release: Deferred.succeed(release, undefined),
		send: (id: string) => worker.jobs.enqueue(queue, { id }),
		stop: Effect.gen(function* () {
			const closing = yield* worker.stop.pipe(Effect.forkChild);
			yield* Effect.promise(() => stopping.promise);
			return Fiber.join(closing);
		}),
	};
});
