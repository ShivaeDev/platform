import { Clock, Deferred, type Duration, Effect, Queue, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { ConnectionError, SqlError } from "effect/sql/SqlError";
import { decodeKeys, resyncPayload } from "./notifyPayload.ts";
import type { PostgresChangesOptions } from "./postgresChanges.ts";

function listenerScope(timeout: Duration.Input) {
	// Release the native connection alongside listener cleanup, even when a listener finalizer stalls.
	return Effect.acquireRelease(Scope.make("parallel"), (scope, exit) =>
		Effect.suspend(() => Scope.closeUnsafe(scope, exit) ?? Effect.void).pipe(Effect.interruptible, Effect.timeoutOption(timeout), Effect.asVoid),
	);
}

export const listenForChanges = Effect.fn("PostgresChanges.listenForChanges")(function* (options: PostgresChangesOptions) {
	const ready = yield* Deferred.make<void, SqlError>();
	const reactivity = yield* Reactivity.Reactivity;
	const { client, channel, resync } = options;
	const timeout = options.heartbeatTimeout ?? "10 seconds";
	function deadline<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(
			Effect.timeoutOrElse({
				duration: timeout,
				orElse: () => Effect.fail(new SqlError({ reason: new ConnectionError({ cause: "PostgreSQL change listener heartbeat timed out" }) })),
			}),
		);
	}
	let lostAt: number | undefined;
	const attempt = Effect.scoped(
		Effect.gen(function* () {
			const scope = yield* listenerScope(timeout);
			const notifications = yield* client.listen(channel).pipe(Scope.provide(scope), deadline);
			const token = JSON.stringify({ heartbeat: crypto.randomUUID() });
			let ack = yield* Deferred.make<void>();
			function receive(payload: string) {
				if (payload === token) {
					return Effect.asVoid(Deferred.succeed(ack, undefined));
				}
				if (payload === resyncPayload) {
					return Effect.asVoid(resync);
				}
				if (!payload.startsWith("[")) {
					return Effect.void;
				}
				return decodeKeys(payload).pipe(
					Effect.flatMap((keys) => Effect.sync(() => reactivity.invalidateUnsafe(keys))),
					Effect.catchCause(() => resync),
				);
			}
			const listening = Effect.forever(
				Effect.flatMap(Queue.takeAll(notifications), (batch) =>
					Effect.forEach(batch, (notification) => receive(notification.payload), { discard: true }),
				),
			);
			const send = Effect.asVoid(client`select pg_notify(${channel}, ${token})`);
			const monitor = Effect.gen(function* () {
				yield* Effect.andThen(send, Deferred.await(ack)).pipe(deadline);
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
						yield* Effect.andThen(send, Deferred.await(ack)).pipe(deadline);
					}),
				);
			});
			yield* Effect.raceFirst(listening, monitor);
		}).pipe(Effect.onExit(() => resync)),
	);
	yield* Effect.forever(
		attempt.pipe(
			Effect.catchCause((cause) =>
				Effect.gen(function* () {
					if (!(yield* Deferred.isDone(ready))) {
						yield* Effect.logError("PostgreSQL change listener startup failed", cause);
						yield* Deferred.failCause(ready, cause);
						return;
					}
					if (lostAt !== undefined) {
						yield* Effect.logDebug("PostgreSQL change listener reconnect failed; retrying", cause);
						return;
					}
					lostAt = yield* Clock.currentTimeMillis;
					yield* Effect.logWarning("PostgreSQL change listener lost; resynchronizing live streams", cause);
				}),
			),
			Effect.andThen(Effect.sleep(options.retryDelay ?? "1 second")),
		),
	).pipe(Effect.forkScoped);
	yield* Deferred.await(ready);
});
