import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Exit, Layer, Queue, Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";
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
) {
	const notifications = yield* listening;
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
			}
		}),
	).pipe(
		Effect.catchCause((cause) => Queue.failCause(instrumented, cause)),
		Effect.forkScoped,
	);
	return instrumented;
});
export function waitFor(check: () => boolean): Effect.Effect<void> {
	return Effect.suspend(() => (check() ? Effect.void : Effect.andThen(Effect.sleep("10 millis"), waitFor(check)))).pipe(
		Effect.timeout("5 seconds"),
		Effect.orDie,
	);
}
export const startNotifications = Effect.fnUntraced(function* (
	timing: Pick<PostgresChangesOptions, "heartbeatInterval" | "heartbeatTimeout" | "retryDelay"> = {},
	stallCleanup = false,
) {
	const gate = Promise.withResolvers<void>();
	let closing = 0;
	const state: NotifyState = {
		connections: 0,
		muted: false,
		payloads: [],
		resyncs: 0,
		...(stallCleanup
			? {
					cleanup: Effect.andThen(
						Effect.sync(() => {
							closing += 1;
						}),
						Effect.promise(() => gate.promise),
					),
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
				return instrumentListener(client.listen(channel), state);
			};
		},
	});
	const binding = yield* Layer.build(
		postgresChanges({
			...timing,
			channel: state.channel,
			client: instrumented,
			resync: Effect.sync(() => {
				state.resyncs += 1;
			}),
		}),
	).pipe(Effect.provideService(Scope.Scope, scope));
	return { binding, close: Scope.close(scope, Exit.void), closing: () => closing, release: () => gate.resolve(), state };
});
