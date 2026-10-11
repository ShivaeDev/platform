import { Deferred, Effect, Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { decodeKeys } from "./notifyPayload.ts";
import type { PostgresChangesOptions } from "./postgresChanges.ts";

export const listenForChanges = Effect.fn("PostgresChanges.listenForChanges")(function* (options: PostgresChangesOptions) {
	const ready = yield* Deferred.make<void>();
	const reactivity = yield* Reactivity.Reactivity;
	const { client, channel, resync } = options;
	const attempt = Effect.scoped(
		Effect.gen(function* () {
			const token = JSON.stringify({ heartbeat: crypto.randomUUID() });
			let ack = yield* Deferred.make<void>();
			const listening = client.listen(channel).pipe(
				Stream.runForEach((payload) => {
					if (payload === token) {
						return Effect.asVoid(Deferred.succeed(ack, undefined));
					}
					if (!payload.startsWith("[")) {
						return Effect.void;
					}
					return decodeKeys(payload).pipe(
						Effect.flatMap((keys) => Effect.sync(() => reactivity.invalidateUnsafe(keys))),
						Effect.catchCause(() => resync),
					);
				}),
			);
			const send = Effect.asVoid(client`select pg_notify(${channel}, ${token})`);
			const monitor = Effect.gen(function* () {
				yield* Effect.raceFirst(Deferred.await(ack), Effect.forever(Effect.andThen(send, Effect.sleep("50 millis")))).pipe(
					Effect.timeout(options.heartbeatTimeout ?? "10 seconds"),
				);
				yield* resync;
				yield* Deferred.succeed(ready, undefined);
				yield* Effect.forever(
					Effect.gen(function* () {
						yield* Effect.sleep(options.heartbeatInterval ?? "5 seconds");
						ack = yield* Deferred.make<void>();
						yield* Effect.andThen(send, Deferred.await(ack)).pipe(Effect.timeout(options.heartbeatTimeout ?? "10 seconds"));
					}),
				);
			});
			yield* Effect.raceFirst(listening, monitor);
		}),
	);
	yield* Effect.forever(
		attempt.pipe(
			Effect.andThen(resync),
			Effect.catchCause((cause) => Effect.andThen(resync, Effect.logWarning("PostgreSQL change listener lost; resynchronizing live streams", cause))),
			Effect.andThen(Effect.sleep(options.retryDelay ?? "1 second")),
		),
	).pipe(Effect.forkScoped);
	yield* Deferred.await(ready);
});
