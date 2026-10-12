import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { type HostFixture, storeState } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { type snapshotReads, untilReads, withSnapshotDaemon } from "#test/snapshotReads.ts";

const test = postgresTests("live");

type SnapshotReads = Effect.Success<ReturnType<typeof snapshotReads>>;

function transientStory(command: "wait" | "watch") {
	return Effect.fn("DaemonFollowTest.transientStory")(function* (fixture: HostFixture, port: number, reads: SnapshotReads) {
		yield* reads.breakReads;
		return yield* withFollower(fixture.configFile, command, ["one"], { port }, (follower) =>
			Effect.gen(function* () {
				yield* untilReads(reads, 11);
				yield* reads.restoreReads;
				yield* untilReads(reads, 13);
				yield* reads.breakReads;
				const before = reads.count();
				yield* untilReads(reads, before + 11);
				const client = yield* daemonClient(port);
				const cached = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect);
				expect(cached).toEqual([[{ outcome: {}, stage: "executing", workId: "one" }]]);
				yield* reads.restoreReads;
				yield* storeState(fixture.host, "one", { stage: "completed" });
				expect(yield* Effect.promise(() => follower.done)).toEqual({ code: 0, stderr: "", stdout: "one completed" });
			}),
		);
	});
}

const persistentStory = Effect.fn("DaemonFollowTest.persistentStory")(function* (fixture: HostFixture, port: number, reads: SnapshotReads) {
	return yield* withFollower(fixture.configFile, "wait", ["one"], { port }, (waiter) =>
		withFollower(fixture.configFile, "watch", ["marker", "one"], { port }, (watcher) =>
			Effect.gen(function* () {
				yield* untilOutput(watcher, "marker released\n");
				yield* Effect.sleep("1 second");
				const before = reads.failedCount();
				yield* reads.breakReads;
				const results = yield* Effect.promise(() => Promise.all([waiter.done, watcher.done]));
				for (const result of results) {
					expect(result.code).toBe(1);
					expect(result.stderr).toContain("Fleet daemon could not read work states after 20 consecutive attempts");
				}
				expect(reads.failedCount() - before).toBe(20);
			}),
		),
	);
});

const idleStory = Effect.fn("DaemonFollowTest.idleStory")(function* (fixture: HostFixture, port: number, reads: SnapshotReads) {
	yield* Effect.sleep("1 second");
	expect(reads.count()).toBe(0);
	const client = yield* daemonClient(port);
	const first = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.runDrain, Effect.forkScoped);
	yield* untilReads(reads, 1);
	const ready = yield* Deferred.make<void>();
	const second = yield* client("daemon.follow", { workIds: ["one"] }).pipe(
		Stream.tap((states) => Effect.sync(() => expect(states).toEqual([{ outcome: {}, stage: "executing", workId: "one" }]))),
		Stream.tap(() => Deferred.succeed(ready, undefined)),
		Stream.runDrain,
		Effect.forkScoped,
	);
	yield* Deferred.await(ready);
	yield* Fiber.interrupt(first);
	const remaining = reads.count();
	yield* untilReads(reads, remaining + 2);
	yield* Fiber.interrupt(second);
	yield* Effect.sleep("1 second");
	const stopped = reads.count();
	yield* Effect.sleep("1 second");
	expect(reads.count()).toBe(stopped);
	yield* storeState(fixture.host, "one", { stage: "completed" });
	const restarted = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect);
	expect(restarted).toEqual([[{ outcome: {}, stage: "completed", workId: "one" }]]);
	expect(reads.count()).toBe(stopped + 1);
});

for (const command of ["wait", "watch"] as const) {
	test(
		`${command} survives transient PostgreSQL read failures before and after its first snapshot`,
		() => withSnapshotDaemon(transientStory(command)),
		30_000,
	);
}

test("a persistent PostgreSQL failure ends every wait and watch after 20 shared attempts", () => withSnapshotDaemon(persistentStory), 30_000);
test(
	"the shared poller stays idle without followers, stops after the last one and restarts with fresh state",
	() => withSnapshotDaemon(idleStory),
	30_000,
);
