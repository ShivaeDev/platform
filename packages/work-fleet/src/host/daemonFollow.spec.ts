import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { invalidateOnCommit } from "@shivaedev/effect-sql/transact.ts";
import { daemonClient } from "#host/daemonClient.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { type SnapshotDaemon, untilReads, withSnapshotDaemon } from "#test/snapshotReads.ts";
import { storeState } from "#test/storeState.ts";

const test = postgresTests("live");

function transientStory(command: "wait" | "watch") {
	return Effect.fn("DaemonFollowTest.transientStory")(function* (fixture: HostFixture, { advancing, port, reads }: SnapshotDaemon) {
		const client = yield* daemonClient(port);
		yield* reads.breakReads;
		return yield* withFollower(fixture.configFile, command, ["one"], { port }, (follower) =>
			Effect.gen(function* () {
				yield* advancing(untilReads(reads, 11));
				yield* reads.restoreReads;
				const recovered = yield* advancing(client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect));
				expect(recovered).toEqual([[{ outcome: {}, stage: "working", workId: "one" }]]);
				yield* reads.breakReads;
				const before = reads.count();
				yield* invalidateOnCommit([`${fixture.host.namespace}_records`]);
				yield* advancing(untilReads(reads, before + 11));
				const cached = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect);
				expect(cached).toEqual([[{ outcome: {}, stage: "working", workId: "one" }]]);
				yield* reads.restoreReads;
				yield* storeState(fixture.host, "one", { stage: "done", step: "done" });
				expect(yield* advancing(Effect.promise(() => follower.done))).toEqual({ code: 0, stderr: "", stdout: "one done" });
			}),
		);
	});
}

const persistentStory = Effect.fn("DaemonFollowTest.persistentStory")(function* (
	fixture: HostFixture,
	{ advancing, delivered, port, reads }: SnapshotDaemon,
) {
	return yield* withFollower(fixture.configFile, "wait", ["one"], { port }, (waiter) =>
		withFollower(fixture.configFile, "watch", ["marker", "one"], { port }, (watcher) =>
			Effect.gen(function* () {
				yield* untilOutput(watcher, "marker released\n");
				yield* untilReads({ count: delivered }, 2);
				const before = reads.failedCount();
				yield* reads.breakReads;
				yield* invalidateOnCommit([`${fixture.host.namespace}_records`]);
				const results = yield* advancing(Effect.promise(() => Promise.all([waiter.done, watcher.done])));
				for (const result of results) {
					expect(result.code).toBe(1);
					expect(result.stderr).toContain("Fleet daemon could not read work states after 20 consecutive attempts");
				}
				expect(reads.failedCount() - before).toBe(20);
			}),
		),
	);
});

const idleStory = Effect.fn("DaemonFollowTest.idleStory")(function* (fixture: HostFixture, { clock, port, reads }: SnapshotDaemon) {
	const settle = clock.adjust("1 hour").pipe(Effect.andThen(Effect.sleep("100 millis")));
	yield* settle;
	expect(reads.count()).toBe(0);
	const client = yield* daemonClient(port);
	const first = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.runDrain, Effect.forkScoped);
	yield* untilReads(reads, 1);
	const ready = yield* Deferred.make<void>();
	const second = yield* client("daemon.follow", { workIds: ["one"] }).pipe(
		Stream.tap((states) => Effect.sync(() => expect(states).toEqual([{ outcome: {}, stage: "working", workId: "one" }]))),
		Stream.tap(() => Deferred.succeed(ready, undefined)),
		Stream.runDrain,
		Effect.forkScoped,
	);
	yield* Deferred.await(ready);
	yield* Fiber.interrupt(first);
	const remaining = reads.count();
	yield* settle;
	expect(reads.count()).toBe(remaining);
	yield* Fiber.interrupt(second);
	yield* settle;
	const stopped = reads.count();
	yield* settle;
	expect(reads.count()).toBe(stopped);
	yield* storeState(fixture.host, "one", { stage: "done", step: "done" });
	const restarted = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect);
	expect(restarted).toEqual([[{ outcome: {}, stage: "done", workId: "one" }]]);
	expect(reads.count()).toBe(stopped + 1);
});

for (const command of ["wait", "watch"] as const) {
	test(`${command} survives transient PostgreSQL read failures before and after its first snapshot`, () =>
		withSnapshotDaemon(transientStory(command)));
}

test("a persistent PostgreSQL failure ends every wait and watch after 20 shared attempts", () => withSnapshotDaemon(persistentStory));
test("the shared commit subscription never polls, stops after the last follower and restarts with fresh state", () => withSnapshotDaemon(idleStory));
