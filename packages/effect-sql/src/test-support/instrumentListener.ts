import { Effect, Queue, Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import type { PostgresChangeClient, PostgresNotification } from "#postgresChanges.ts";
import type { NotifyState } from "./postgresNotify.ts";

export const instrumentListener = Effect.fn("PostgresNotify.instrumentListener")(function* (
	listening: ReturnType<PostgresChangeClient["listen"]>,
	state: NotifyState,
	events: { readonly heartbeats: Queue.Queue<void>; readonly listeners: Queue.Queue<void> },
) {
	const notifications = yield* listening;
	yield* Queue.offer(events.listeners, undefined);
	const scope = yield* Effect.scope;
	const instrumented = yield* Queue.unbounded<PostgresNotification, SqlError>();
	let registered = false;
	yield* Effect.forever(
		Effect.gen(function* () {
			const notification = yield* Queue.take(notifications);
			if (notification.payload.startsWith("[")) {
				state.payloads?.push(notification.payload);
			}
			if (!registered && state.cleanup !== undefined) {
				registered = true;
				yield* Scope.addFinalizer(scope, state.cleanup);
			}
			if (!state.muted) {
				yield* Queue.offer(instrumented, notification);
			} else if (!notification.payload.startsWith("[")) {
				yield* Queue.offer(events.heartbeats, undefined);
			}
		}),
	).pipe(
		Effect.catchCause((cause) => Queue.failCause(instrumented, cause)),
		Effect.forkScoped,
	);
	return instrumented;
});
