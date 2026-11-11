import { Deferred, Effect, Exit, Fiber, Layer, Queue, Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import * as TestClock from "effect/testing/TestClock";
import { type PostgresChangeClient, type PostgresNotification, postgresChanges } from "#postgresChanges.ts";
import type { ChangeFeedEngine } from "#test/changeFeedEngine.ts";
import { instrumentedClient } from "#test/changeFeedListener.ts";
import { endingOf } from "#test/outcome.ts";

export function startFeed(engine: ChangeFeedEngine, channel: string, client: PostgresChangeClient) {
	const { events } = engine;
	const resync = Effect.as(Queue.offer(events.resyncs, undefined), 0);
	return Layer.build(postgresChanges({ ...engine.timing, channel, client, resync })).pipe(
		Effect.tap((binding) =>
			Effect.sync(() => {
				engine.binding = binding;
			}),
		),
		Effect.provideService(Scope.Scope, engine.feedScope),
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
		listenerLog: () => Effect.sync(() => engine.logs.map(logLine)),
		startFeedListeningOn: (channel: string) =>
			Effect.suspend(() => {
				tell(`the change feed starts listening on ${JSON.stringify(channel)}`);
				return Effect.tap(endingOf(startFeed(engine, channel, instrumentedClient(client, controls, events, engine.stalledCleanup))), (ending) =>
					Effect.sync(() => engine.endings.push(ending)),
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
