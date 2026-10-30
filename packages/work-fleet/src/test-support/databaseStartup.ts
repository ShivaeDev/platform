import { Clock, Context, Deferred, Duration, Effect, Fiber, Layer, Option, Queue, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { TestClock } from "effect/testing";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { HostFailure, resolveHost } from "#host/config.ts";
import { daemonLayer } from "#host/daemon.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { delayedPostgres } from "#test/delayedPostgres.ts";
import { hostFixture } from "#test/fleetHost.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

export const databaseStartup = storyKit({
	around: withIsolatedDatabase,
	*create() {
		const fixture = yield* hostFixture();
		const database = yield* delayedPostgres(fixture.host.databaseUrl);
		const logs = captureLogs();
		const clock = yield* Clock.Clock;
		const sleeps = yield* Queue.unbounded<number>();
		const ready = yield* Deferred.make<number>();
		const host = resolveHost(fixture.host.boardDir, { ...fixture.host.config, database: { ...fixture.host.config.database, url: database.url } });
		const boot = Effect.gen(function* () {
			const context = yield* Layer.build(daemonLayer(host, fixture.parts, 0));
			const address = Context.get(context, HttpServer.HttpServer).address;
			if (!NetAddress.isInetAddress(address)) {
				return yield* Effect.die("Expected a TCP Fleet daemon");
			}
			yield* Deferred.succeed(ready, address.port);
			return yield* Effect.never;
		}).pipe(
			Effect.scoped,
			Effect.provide(logs.layer),
			Effect.provideService(Clock.Clock, {
				...clock,
				sleep: (duration) =>
					Effect.gen(function* () {
						const millis = Duration.toMillis(duration);
						// The driver's five-second connection deadline is separate from Fleet's backoff.
						if (millis >= 1000 && millis <= 10_000 && millis !== 5000) {
							yield* Queue.offer(sleeps, millis);
						}
						yield* clock.sleep(duration);
					}),
			}),
		);
		return { boot, database, logs, ready, running: Option.none<Fiber.Fiber<never, unknown>>(), sleeps };
	},
	inspect: (engine) => ({ logs: engine.logs.entries }),
	layer: postgresLayer,
	name: "Fleet database startup",
	runIf: postgresEnabled,
	stages: ["startup"],
	verbs: (engine, story) => {
		function running() {
			return Option.getOrThrow(engine.running);
		}
		return {
			advance: (duration: Duration.Input) => {
				story.tell(`${duration} pass during daemon startup`);
				return TestClock.adjust(duration);
			},
			failure: () => Fiber.join(running()).pipe(Effect.catch((error) => (error instanceof HostFailure ? Effect.succeed(error) : Effect.die(error)))),
			isRunning: () => Effect.sync(() => running().pollUnsafe() === undefined),
			logs: () => Effect.sync(() => engine.logs.entries.flatMap((entry) => entry.message)),
			nextRetry: () =>
				Effect.raceFirst(Queue.take(engine.sleeps), Fiber.join(running())).pipe(Effect.map((millis) => Duration.format(Duration.millis(millis)))),
			snapshot: () =>
				Effect.scoped(
					Effect.gen(function* () {
						const port = yield* Effect.raceFirst(Deferred.await(engine.ready), Fiber.join(running()));
						const client = yield* daemonClient(port);
						return yield* client("daemon.follow", { workIds: [] }).pipe(Stream.take(1), Stream.runCollect);
					}),
				),
			startDaemon: () =>
				Effect.gen(function* () {
					story.tell("start the daemon before PostgreSQL accepts connections");
					engine.running = Option.some(yield* engine.boot.pipe(Effect.forkScoped));
				}),
			startDatabase: () => {
				story.tell("start the PostgreSQL endpoint backed by the story's isolated database");
				return engine.database.start();
			},
			stopDaemon: () => {
				story.tell("stop the daemon while it waits for PostgreSQL");
				return Fiber.interrupt(running());
			},
		};
	},
});
