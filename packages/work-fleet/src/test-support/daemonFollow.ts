import { Context, Deferred, Effect, Fiber, Stream } from "effect";
import { TestClock } from "effect/testing";
import { invalidateOnCommit } from "@shivaedev/effect-sql/transact.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { AppChanges } from "@shivaedev/platform/server/appHost.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { hostFixture } from "#test/fleetHost.ts";
import { untilOutput } from "#test/follower.ts";
import { type Follower, followerProcess } from "#test/followerProcess.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { snapshotReads, untilReads } from "#test/snapshotReads.ts";
import { startHostDaemon } from "#test/startHostDaemon.ts";
import { storeState } from "#test/storeState.ts";

export const daemonFollow = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const fixture = yield* hostFixture();
		yield* storeState(fixture.host, "one", { stage: "working", step: "working" });
		yield* storeState(fixture.host, "marker", { stage: "released", step: "released" });
		const reads = snapshotReads(fixture.host);
		yield* Effect.addFinalizer(() => reads.restoreIfBroken);
		const clock = yield* TestClock.make();
		const stopped = yield* Deferred.make<void>();
		let delivered = 0;
		const running = yield* reads.observe(
			startHostDaemon(
				readDaemonLayer(fixture.host, {
					handlerClock: clock,
					onCommitSubscriptionStop: Deferred.succeed(stopped, undefined).pipe(Effect.asVoid),
					onSnapshot: () => {
						delivered += 1;
					},
					parts: fixture.parts,
				}),
			),
		);
		return {
			clock,
			delivered: () => delivered,
			fixture,
			followers: new Map<string, Follower>(),
			reads,
			running,
			stopped,
			subscriptions: new Map<string, Fiber.Fiber<void, unknown>>(),
		};
	},
	inspect: (engine) => ({ delivered: engine.delivered(), reads: engine.reads.count() }),
	layer: postgresLayer,
	name: "Fleet daemon follow",
	runIf: postgresEnabled,
	stages: ["observation"],
	verbs: (engine, story) => {
		function advancing<A, E, R>(effect: Effect.Effect<A, E, R>) {
			return Effect.raceFirst(effect, Effect.forever(engine.clock.adjust("500 millis").pipe(Effect.andThen(Effect.sleep("10 millis")))));
		}
		function follower(name: string) {
			const child = engine.followers.get(name);
			if (child === undefined) {
				throw new Error(`Start follower ${name} before reading it`);
			}
			return child;
		}
		return {
			advanceIdle: () => engine.clock.adjust("1 hour").pipe(Effect.andThen(Effect.sleep("100 millis"))),
			advanceUntilReads: (count: number) => advancing(untilReads(engine.reads, count)),
			awaitOutput: (name: string, text: string) => untilOutput(follower(name), text),
			awaitSnapshots: (count: number) => untilReads({ count: engine.delivered }, count),
			awaitSubscriptionStopped: () => Deferred.await(engine.stopped).pipe(Effect.timeout("5 seconds")),
			breakReads: () => engine.reads.breakReads,
			failedReadCount: () => engine.reads.failedCount(),
			failedReads: () => engine.reads.queries().filter((query) => query.failed),
			follow: (name: string, command: "wait" | "watch", workIds: readonly string[]) =>
				Effect.gen(function* () {
					story.tell(`start ${name}: ${command} ${workIds.join(", ")}`);
					const child = yield* followerProcess(engine.fixture.configFile, command, workIds, { port: engine.running.port });
					engine.followers.set(name, child);
				}),
			followerExits: (names: readonly string[]) => advancing(Effect.promise(() => Promise.all(names.map((name) => follower(name).done)))),
			invalidate: () => invalidateOnCommit([`${engine.fixture.host.namespace}_records`]).pipe(Effect.provideContext(engine.running.context)),
			readCount: () => engine.reads.count(),
			restoreReads: () => engine.reads.restoreReads,
			snapshot: () => advancing(engine.running.client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect)),
			storeDone: () =>
				Effect.gen(function* () {
					story.tell("commit one as done and await its change hint");
					const changes = Context.get(engine.running.context, AppChanges);
					const ready = yield* Deferred.make<void>();
					// Commit completion can precede PostgreSQL hint delivery to a restarted follower.
					const committed = yield* changes.stream([fleetRecords.list]).pipe(
						Stream.tap(() => Deferred.succeed(ready, undefined)),
						Stream.filter((hint) => hint._tag === "Changed"),
						Stream.take(1),
						Stream.runDrain,
						Effect.forkScoped,
					);
					yield* Deferred.await(ready);
					yield* storeState(engine.fixture.host, "one", { stage: "done", step: "done" }).pipe(Effect.provideContext(engine.running.context));
					yield* Fiber.join(committed);
				}),
			subscribe: (name: string) =>
				Effect.gen(function* () {
					story.tell(`subscribe ${name} to one`);
					const ready = yield* Deferred.make<unknown>();
					const fiber = yield* engine.running.client("daemon.follow", { workIds: ["one"] }).pipe(
						Stream.tap((states) => Deferred.succeed(ready, states)),
						Stream.runDrain,
						Effect.forkScoped,
					);
					engine.subscriptions.set(name, fiber);
					return yield* Deferred.await(ready);
				}),
			unsubscribe: (name: string) =>
				Effect.gen(function* () {
					const fiber = engine.subscriptions.get(name);
					if (fiber === undefined) {
						return yield* Effect.die(`Subscribe ${name} before stopping it`);
					}
					story.tell(`stop ${name}'s client subscription`);
					yield* Fiber.interrupt(fiber);
				}),
		};
	},
});
