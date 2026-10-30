import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, type Duration, Effect, Exit, Fiber, Layer, Logger, Queue, Scope } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { type PostgresChangesOptions, postgresChanges } from "#postgresChanges.ts";
import { instrumentListener } from "./instrumentListener.ts";
import { listenerEvents } from "./listenerEvents.ts";
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
	const events = yield* listenerEvents;
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
				Effect.tap(() => Queue.offer(events.resyncs, undefined)),
			),
		}),
	).pipe(Effect.provideService(Scope.Scope, scope), Effect.provideService(Logger.CurrentLoggers, events.loggers), Effect.forkScoped);
	yield* Queue.take(events.listeners);
	const binding = yield* Fiber.join(building);
	yield* Queue.take(events.resyncs);
	return {
		binding,
		close: Scope.close(scope, Exit.void),
		closeAtDeadline: () =>
			Effect.gen(function* () {
				const closingScope = yield* Effect.forkScoped(Scope.close(scope, Exit.void));
				yield* Queue.take(events.closings);
				yield* TestClock.adjust(timing.heartbeatTimeout ?? "10 seconds");
				yield* Fiber.join(closingScope);
			}),
		closing: () => closing,
		currentTime: Clock.currentTimeMillis,
		intervalPasses: (duration: Duration.Input) => TestClock.adjust(duration),
		listenerPids: client<{ pid: number }>`select pid from pg_stat_activity where query = ${`LISTEN "${state.channel}"`}`,
		makeUnavailable: () =>
			Effect.sync(() => {
				state.unreachable = true;
			}),
		nextCleanup: Queue.take(events.closings),
		nextListener: Queue.take(events.listeners),
		nextLoss: Queue.take(events.losses),
		nextMutedHeartbeat: Queue.take(events.heartbeats),
		nextReconnect: Queue.take(events.reconnects),
		nextRecovery: Queue.take(events.recoveries),
		nextResync: Queue.take(events.resyncs),
		openStream: streams.open,
		pauseDelivery: () =>
			Effect.sync(() => {
				state.muted = true;
			}),
		restoreAvailability: () =>
			Effect.sync(() => {
				state.unreachable = false;
			}),
		resumeDelivery: () =>
			Effect.sync(() => {
				state.muted = false;
			}),
		state,
		terminate: client`select pg_terminate_backend(pid) from pg_stat_activity where query = ${`LISTEN "${state.channel}"`}`.pipe(Effect.asVoid),
	};
});
