import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Effect, Exit, Fiber, Layer, Queue, Scope } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { type PostgresChangesOptions, postgresChanges } from "#postgresChanges.ts";
import { instrumentListener } from "./instrumentListener.ts";
import { notificationStreams } from "./notificationStreams.ts";
export interface NotifyState {
	channel?: string;
	readonly cleanup?: Effect.Effect<void>;
	connections: number;
	readonly listenerOperations: string[];
	muted: boolean;
	readonly payloads: string[];
	readonly resyncEvents: string[];
	resyncs: number;
	unreachable: boolean;
}
export const startNotifications = Effect.fnUntraced(function* (
	timing: Pick<PostgresChangesOptions, "heartbeatInterval" | "heartbeatTimeout" | "retryDelay"> = {},
	stallCleanup = false,
) {
	const gate = Promise.withResolvers<void>();
	const events = {
		closings: yield* Queue.unbounded<void>(),
		heartbeats: yield* Queue.unbounded<Effect.Effect<void>>(),
		listeners: yield* Queue.unbounded<void>(),
	};
	let closing = 0;
	const state: NotifyState = {
		connections: 0,
		listenerOperations: [],
		muted: false,
		payloads: [],
		resyncEvents: [],
		resyncs: 0,
		unreachable: false,
		...(stallCleanup
			? {
					cleanup: Effect.gen(function* () {
						yield* Effect.sync(() => {
							closing += 1;
							state.listenerOperations.push("cleanup");
						});
						yield* Queue.offer(events.closings, undefined);
						yield* Effect.promise(() => gate.promise);
					}),
				}
			: {}),
	};
	const client = yield* PgClient.PgClient;
	const unavailable = yield* PgClient.make({ host: "127.0.0.1", port: 1 });
	const streams = yield* notificationStreams;
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
				state.listenerOperations.push("listen");
				return instrumentListener((state.unreachable ? unavailable : client).listen(channel), state, events);
			};
		},
	});
	const building = yield* Layer.build(
		postgresChanges({
			...timing,
			channel: state.channel,
			client: instrumented,
			resync: streams.resync.pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						state.resyncs += 1;
						state.resyncEvents.push("resync");
					}),
				),
			),
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
		openStream: streams.open,
		release: () => gate.resolve(),
		state,
	};
});
