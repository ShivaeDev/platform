import { Clock, Deferred, type Duration, Effect, type Exit, Queue, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { decodeKeys } from "./notifyPayload.ts";
import type { PostgresChangesOptions } from "./postgresChanges.ts";

function closeListener(scope: Scope.Closeable, outcome: Exit.Exit<unknown, unknown>, timeout: Duration.Input) {
	return Effect.suspend(() => {
		function bounded(finalizer: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void>) {
			return (exit: Exit.Exit<unknown, unknown>) => finalizer(exit).pipe(Effect.interruptible, Effect.timeoutOption(timeout), Effect.asVoid);
		}
		// Bound each finalizer so a stalled UNLISTEN cannot prevent the native connection release that follows it.
		if (scope.state._tag === "Open") {
			const state = scope.state;
			if (state.finalizer !== undefined) {
				state.finalizer = bounded(state.finalizer);
			}
			if (state.finalizers !== undefined) {
				for (const [key, finalizer] of state.finalizers) {
					state.finalizers.set(key, bounded(finalizer));
				}
			}
		}
		return Scope.closeUnsafe(scope, outcome) ?? Effect.void;
	});
}

export const listenForChanges = Effect.fn("PostgresChanges.listenForChanges")(function* (options: PostgresChangesOptions) {
	const ready = yield* Deferred.make<void>();
	const reactivity = yield* Reactivity.Reactivity;
	const { client, channel, resync } = options;
	const timeout = options.heartbeatTimeout ?? "10 seconds";
	let lostAt: number | undefined;
	const attempt = Effect.scoped(
		Effect.gen(function* () {
			const scope = yield* Effect.acquireRelease(Scope.make(), (listenerScope, exit) => closeListener(listenerScope, exit, timeout));
			const token = JSON.stringify({ heartbeat: crypto.randomUUID() });
			let ack = yield* Deferred.make<void>();
			function receive(payload: string) {
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
			}
			const listening = Effect.gen(function* () {
				const notifications = yield* client.listen(channel).pipe(Scope.provide(scope));
				yield* Effect.forever(
					Effect.flatMap(Queue.takeAll(notifications), (batch) =>
						Effect.forEach(batch, (notification) => receive(notification.payload), { discard: true }),
					),
				);
			});
			const send = Effect.asVoid(client`select pg_notify(${channel}, ${token})`);
			const monitor = Effect.gen(function* () {
				yield* Effect.raceFirst(Deferred.await(ack), Effect.forever(Effect.andThen(send, Effect.sleep("50 millis")))).pipe(Effect.timeout(timeout));
				const streamCount = yield* resync;
				if (lostAt !== undefined) {
					const downtimeMs = (yield* Clock.currentTimeMillis) - lostAt;
					yield* Effect.logInfo("PostgreSQL change listener recovered; resynchronized live streams").pipe(
						Effect.annotateLogs({ downtimeMs, streamCount }),
					);
					lostAt = undefined;
				}
				yield* Deferred.succeed(ready, undefined);
				yield* Effect.forever(
					Effect.gen(function* () {
						yield* Effect.sleep(options.heartbeatInterval ?? "5 seconds");
						ack = yield* Deferred.make<void>();
						yield* Effect.andThen(send, Deferred.await(ack)).pipe(Effect.timeout(timeout));
					}),
				);
			});
			yield* Effect.raceFirst(listening, monitor).pipe(Effect.onExit(() => resync));
		}),
	);
	yield* Effect.forever(
		attempt.pipe(
			Effect.catchCause(() =>
				Effect.gen(function* () {
					if (lostAt !== undefined) {
						yield* Effect.logDebug("PostgreSQL change listener reconnect failed; retrying");
						return;
					}
					lostAt = yield* Clock.currentTimeMillis;
					yield* Effect.logWarning("PostgreSQL change listener lost; resynchronizing live streams");
				}),
			),
			Effect.andThen(Effect.sleep(options.retryDelay ?? "1 second")),
		),
	).pipe(Effect.forkScoped);
	yield* Deferred.await(ready);
});
