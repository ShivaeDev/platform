import type * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Queue, Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import type { PostgresChangeClient, PostgresNotification } from "#postgresChanges.ts";

export interface ListenerControls {
	cleanupStalls: boolean;
	readonly history: string[];
	readonly payloads: string[];
}

export const listenerEvents = Effect.gen(function* () {
	return {
		cleanups: yield* Queue.unbounded<void>(),
		listeners: yield* Queue.unbounded<void>(),
		resyncs: yield* Queue.unbounded<void>(),
	};
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
			if (notification.payload.startsWith("[")) {
				controls.payloads.push(notification.payload);
			}
			yield* Queue.offer(forwarded, notification);
		}),
	).pipe(
		Effect.catchCause((cause) => Queue.failCause(forwarded, cause)),
		Effect.forkScoped,
	);
	return forwarded;
});

export function instrumentedClient(
	client: PgClient.PgClient,
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
				return instrument(client.listen(channel), controls, events, release);
			};
		},
	});
}
