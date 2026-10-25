import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Effect, Exit, Fiber, Layer, Queue, Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import * as TestClock from "effect/testing/TestClock";
import { type PostgresChangeClient, type PostgresChangesOptions, type PostgresNotification, postgresChanges } from "#postgresChanges.ts";
export interface NotifyState {
	channel?: string;
	readonly cleanup?: Effect.Effect<void>;
	connections: number;
	muted: boolean;
	readonly payloads: string[];
	resyncs: number;
}
const instrumentListener = Effect.fn("PostgresNotify.instrumentListener")(function* (
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
export const startNotifications = Effect.fnUntraced(function* (
	timing: Pick<PostgresChangesOptions, "heartbeatInterval" | "heartbeatTimeout" | "retryDelay"> = {},
	stallCleanup = false,
) {
	const gate = Promise.withResolvers<void>();
	const events = {
		closings: yield* Queue.unbounded<void>(),
		heartbeats: yield* Queue.unbounded<void>(),
		listeners: yield* Queue.unbounded<void>(),
	};
	let closing = 0;
	const state: NotifyState = {
		connections: 0,
		muted: false,
		payloads: [],
		resyncs: 0,
		...(stallCleanup
			? {
					cleanup: Effect.gen(function* () {
						yield* Effect.sync(() => {
							closing += 1;
						});
						yield* Queue.offer(events.closings, undefined);
						yield* Effect.promise(() => gate.promise);
					}),
				}
			: {}),
	};
	const client = yield* PgClient.PgClient;
	const scope = yield* Scope.make();
	yield* Effect.addFinalizer(() =>
		Effect.andThen(
			Effect.sync(() => gate.resolve()),
			Scope.close(scope, Exit.void),
		),
	);
	state.channel = `notify_${crypto.randomUUID().replaceAll("-", "")}`;
	const instrumented = new Proxy(client, {
		get(target, key, receiver) {
			if (key !== "listen") {
				return Reflect.get(target, key, receiver);
			}
			return (channel: string) => {
				state.connections += 1;
				return instrumentListener(client.listen(channel), state, events);
			};
		},
	});
	const building = yield* Layer.build(
		postgresChanges({
			...timing,
			channel: state.channel,
			client: instrumented,
			resync: Effect.sync(() => {
				state.resyncs += 1;
			}),
		}),
	).pipe(Effect.provideService(Scope.Scope, scope), Effect.forkScoped);
	const clock = yield* Clock.Clock;
	if ("adjust" in clock) {
		yield* Queue.take(events.listeners);
		// The first ping can precede LISTEN; let its retry run only after PostgreSQL is listening.
		yield* TestClock.adjust("50 millis");
	}
	const binding = yield* Fiber.join(building);
	return {
		binding,
		close: Scope.close(scope, Exit.void),
		closing: () => closing,
		nextCleanup: Queue.take(events.closings),
		nextListener: Queue.take(events.listeners),
		nextMutedHeartbeat: Queue.take(events.heartbeats),
		release: () => gate.resolve(),
		state,
	};
});
