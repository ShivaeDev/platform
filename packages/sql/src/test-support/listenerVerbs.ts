import { Deferred, type Duration, Effect, Exit, Fiber, Layer, Logger, Queue, Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import * as TestClock from "effect/testing/TestClock";
import { type PostgresChangeClient, type PostgresNotification, postgresChanges } from "#postgresChanges.ts";
import type { ChangeFeedEngine } from "./changeFeedEngine.ts";
import { instrumentedClient } from "./changeFeedListener.ts";
import { endingOf } from "./outcome.ts";

export function startFeed(engine: ChangeFeedEngine, channel: string, client: PostgresChangeClient) {
	const { events } = engine;
	const resync = Effect.tap(engine.streams.resync, () =>
		Effect.andThen(
			Effect.sync(() => {
				engine.resyncs += 1;
			}),
			Queue.offer(events.resyncs, undefined),
		),
	);
	return Layer.build(postgresChanges({ ...engine.timing, channel, client, resync })).pipe(
		Effect.tap((binding) =>
			Effect.sync(() => {
				engine.binding = binding;
			}),
		),
		Effect.provideService(Scope.Scope, engine.feedScope),
		Effect.provideService(Logger.CurrentLoggers, events.loggers),
	);
}

function stallingClient(engine: ChangeFeedEngine, phase: "acquisition" | "heartbeat", stalled: Deferred.Deferred<void>): PostgresChangeClient {
	const { client } = engine;
	function listen(channel: string) {
		return Effect.gen(function* () {
			if (phase === "heartbeat") {
				yield* client.listen(channel);
			}
			yield* Deferred.succeed(stalled, undefined);
			return yield* phase === "acquisition" ? Effect.never : Queue.unbounded<PostgresNotification, SqlError>();
		});
	}
	return new Proxy(client, { get: (target, key, receiver) => (key === "listen" ? listen : Reflect.get(target, key, receiver)) });
}

function deepestReason(cause: string) {
	const reasons = [...cause.matchAll(/\[cause\]: (?:[\w/]+Error: |Error: )?(?<reason>.+)/gu)].map((match) => match.groups?.reason ?? "");
	return reasons.at(-1) ?? cause.split("\n")[0] ?? "";
}

function logLine(entry: ChangeFeedEngine["logs"][number]) {
	const annotations = Object.entries(entry.annotations).map(([name, value]) => `${name} ${String(value)}`);
	const reason = deepestReason(entry.cause);
	return [
		`${entry.level}: ${String(entry.message)}`,
		...(annotations.length > 0 ? [`(${annotations.join(", ")})`] : []),
		...(reason === "" ? [] : [`after ${reason}`]),
	].join(" ");
}

export function listenerVerbs(engine: ChangeFeedEngine, tell: (line: string) => void) {
	const { client, controls, events } = engine;
	return {
		closeFeed: () =>
			Effect.gen(function* () {
				tell("the application closes the change feed while the listener cleanup stalls");
				const closing = yield* Effect.forkChild(Scope.close(engine.feedScope, Exit.void));
				yield* Queue.take(events.cleanups);
				yield* TestClock.adjust(engine.timing.heartbeatTimeout);
				return Exit.isSuccess(yield* Fiber.await(closing)) ? "closed" : "failed to close";
			}),
		closeLiveStream: (name: string) =>
			Effect.suspend(() => {
				tell(`the ${name} live stream closes`);
				return Effect.asVoid(engine.streams.close(name));
			}),
		databaseBecomesReachable: () =>
			Effect.sync(() => {
				tell("the database becomes reachable again");
				controls.unreachable = false;
			}),
		databaseBecomesUnreachable: () =>
			Effect.sync(() => {
				tell("the database stops accepting new listener connections");
				controls.unreachable = true;
			}),
		deliveryResumes: () =>
			Effect.sync(() => {
				tell("the listener connection delivers notifications again");
				controls.muted = false;
			}),
		heartbeatGoesUnanswered: () =>
			Effect.gen(function* () {
				tell("the listener connection stops delivering, and the next heartbeat goes unanswered past its timeout");
				controls.muted = true;
				yield* TestClock.adjust(engine.timing.heartbeatInterval);
				yield* Queue.take(events.heldHeartbeats);
				yield* TestClock.adjust(engine.timing.heartbeatTimeout);
				yield* Queue.take(events.resyncs);
			}),
		listenerCleanupDeadlinePasses: () =>
			Effect.gen(function* () {
				tell("the heartbeat timeout passes again while the old listener's cleanup stalls");
				yield* TestClock.adjust(engine.timing.heartbeatTimeout);
				yield* Queue.take(events.losses);
			}),
		listenerConnectionIsTerminated: () =>
			Effect.gen(function* () {
				tell("PostgreSQL terminates the listener connection");
				yield* client`select pg_terminate_backend(pid) from pg_stat_activity where query = ${`LISTEN "${engine.channel}"`}`.pipe(Effect.orDie);
				yield* Queue.take(events.losses);
			}),
		listenerConnections: () =>
			Effect.map(
				client<{ readonly pid: number }>`select pid from pg_stat_activity where query = ${`LISTEN "${engine.channel}"`}`.pipe(Effect.orDie),
				(connections) => connections.map(() => "listening on the feed channel"),
			),
		listenerHistory: () => Effect.sync(() => [...controls.history]),
		listenerLog: () => Effect.sync(() => engine.logs.map(logLine)),
		listenerReconnects: () =>
			Effect.gen(function* () {
				tell("the retry delay passes, and the listener listens again and answers its heartbeat");
				yield* TestClock.adjust(engine.timing.retryDelay);
				yield* Queue.take(events.listeners);
				yield* Queue.take(events.recoveries);
			}),
		listenerReconnectsAnsweringItsHeartbeatAfter: (delay: Duration.Input) =>
			Effect.gen(function* () {
				tell(`the retry delay passes, the listener listens again, and its heartbeat is answered ${delay} later`);
				controls.muted = true;
				yield* TestClock.adjust(engine.timing.retryDelay);
				yield* Queue.take(events.listeners);
				yield* TestClock.adjust(delay);
				const heartbeat = yield* Queue.take(events.heldHeartbeats);
				controls.muted = false;
				yield* heartbeat;
				yield* Queue.take(events.recoveries);
			}),
		liveStreamResyncs: () => Effect.sync(() => engine.streams.resyncs()),
		openLiveStream: (name: string) =>
			Effect.suspend(() => {
				tell(`the ${name} live stream opens`);
				return engine.streams.open(name);
			}),
		reconnectFails: () =>
			Effect.gen(function* () {
				tell("the retry delay passes, and the listener fails to reconnect");
				yield* TestClock.adjust(engine.timing.retryDelay);
				yield* Queue.take(events.reconnectFailures);
			}),
		startFeedListeningOn: (channel: string) =>
			Effect.suspend(() => {
				tell(`the change feed starts listening on ${JSON.stringify(channel)}`);
				return Effect.tap(
					endingOf(startFeed(engine, channel, instrumentedClient(client, engine.unreachable, controls, events, engine.stalledCleanup))),
					(ending) => Effect.sync(() => engine.endings.push(ending)),
				);
			}),
		startFeedWhoseListenStalls: (phase: "acquisition" | "heartbeat") =>
			Effect.gen(function* () {
				tell(`the change feed starts, and its first LISTEN stalls in its ${phase} past the heartbeat timeout`);
				const stalled = yield* Deferred.make<void>();
				const starting = yield* Effect.forkChild(endingOf(startFeed(engine, engine.channel, stallingClient(engine, phase, stalled))));
				yield* Deferred.await(stalled);
				yield* TestClock.adjust(engine.timing.heartbeatTimeout);
				return yield* Fiber.join(starting);
			}),
	};
}
