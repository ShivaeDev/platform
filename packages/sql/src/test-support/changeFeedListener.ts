import type * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Logger, Queue, Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import type { PostgresChangeClient, PostgresNotification } from "#postgresChanges.ts";

export interface ListenerControls {
	cleanupStalls: boolean;
	readonly history: string[];
	muted: boolean;
	readonly payloads: string[];
	unreachable: boolean;
}

export const listenerEvents = Effect.gen(function* () {
	const events = {
		cleanups: yield* Queue.unbounded<void>(),
		heldHeartbeats: yield* Queue.unbounded<Effect.Effect<void>>(),
		listeners: yield* Queue.unbounded<void>(),
		losses: yield* Queue.unbounded<void>(),
		reconnectFailures: yield* Queue.unbounded<void>(),
		recoveries: yield* Queue.unbounded<void>(),
		resyncs: yield* Queue.unbounded<void>(),
	};
	const loggers = yield* Logger.CurrentLoggers;
	const logger = Logger.make((options) => {
		switch (options.logLevel) {
			case "Debug":
				Queue.offerUnsafe(events.reconnectFailures, undefined);
				break;
			case "Info":
				Queue.offerUnsafe(events.recoveries, undefined);
				break;
			case "Warn":
				Queue.offerUnsafe(events.losses, undefined);
				break;
		}
	});
	return { ...events, loggers: new Set([...loggers, logger]) };
});

export type ListenerEvents = Effect.Success<typeof listenerEvents>;

const instrument = Effect.fnUntraced(function* (
	listening: ReturnType<PostgresChangeClient["listen"]>,
	controls: ListenerControls,
	events: ListenerEvents,
	release: Effect.Effect<void>,
) {
	const notifications = yield* listening;
	const scope = yield* Effect.scope;
	if (controls.cleanupStalls) {
		yield* Scope.addFinalizer(
			scope,
			Effect.andThen(
				Effect.sync(() => controls.history.push("cleanup")),
				Effect.andThen(Queue.offer(events.cleanups, undefined), release),
			),
		);
	}
	yield* Queue.offer(events.listeners, undefined);
	const forwarded = yield* Queue.unbounded<PostgresNotification, SqlError>();
	yield* Effect.forever(
		Effect.gen(function* () {
			const notification = yield* Queue.take(notifications);
			const keys = notification.payload.startsWith("[");
			if (keys) {
				controls.payloads.push(notification.payload);
			}
			if (!controls.muted) {
				yield* Queue.offer(forwarded, notification);
			} else if (!keys) {
				yield* Queue.offer(events.heldHeartbeats, Effect.asVoid(Queue.offer(forwarded, notification)));
			}
		}),
	).pipe(
		Effect.catchCause((cause) => Queue.failCause(forwarded, cause)),
		Effect.forkScoped,
	);
	return forwarded;
});

export function instrumentedClient(
	client: PgClient.PgClient,
	unreachable: PgClient.PgClient,
	controls: ListenerControls,
	events: ListenerEvents,
	release: Effect.Effect<void>,
): PostgresChangeClient {
	return new Proxy(client, {
		get(target, key, receiver) {
			if (key !== "listen") {
				return Reflect.get(target, key, receiver);
			}
			return (channel: string) => {
				controls.history.push("listen");
				return instrument((controls.unreachable ? unreachable : client).listen(channel), controls, events, release);
			};
		},
	});
}
