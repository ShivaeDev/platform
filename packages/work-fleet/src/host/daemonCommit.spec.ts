import { expect } from "@effect/vitest";
import { Deferred, Effect, Stream } from "effect";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { FleetRepository } from "#engine/repository.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { finishWorkers } from "#test/engine.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { snapshotReads } from "#test/snapshotReads.ts";
import { statusRecord } from "#test/status.ts";

const test = postgresTests("live");

const commitStory = Effect.fn("DaemonCommitTest.commitStory")(function* (fixture: HostFixture, port: number, snapshot: Promise<void>) {
	const reads = yield* snapshotReads(fixture.host);
	const client = yield* daemonClient(port);
	yield* withFollower(fixture.configFile, "watch", ["one"], { port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => snapshot);
			yield* Effect.sleep("1200 millis");
			expect(reads.count()).toBe(1);
			yield* client("daemon.dispatch", { workId: "one" });
			finishWorkers(fixture.provider);
			yield* client("fleet.reconcile", { workId: "one" });
			yield* untilOutput(follower, "one needs-human");
			expect(yield* Effect.promise(() => follower.done)).toMatchObject({ code: 0, stderr: "" });
		}),
	);
});

const rollbackStory = Effect.fn("DaemonCommitTest.rollbackStory")(function* (fixture: HostFixture, port: number) {
	const reads = yield* snapshotReads(fixture.host);
	const ready = yield* Deferred.make<void>();
	const received: unknown[] = [];
	const client = yield* daemonClient(port);
	yield* client("daemon.follow", { workIds: ["one"] }).pipe(
		Stream.tap((states) => Effect.sync(() => received.push(states))),
		Stream.tap(() => Deferred.succeed(ready, undefined)),
		Stream.runDrain,
		Effect.forkScoped,
	);
	yield* Deferred.await(ready);
	const store = yield* FleetRepository;
	const result = yield* transact(store.insert(statusRecord("one")).pipe(Effect.andThen(Effect.fail("rollback"))), {
		onSqlError: (error) => error,
	}).pipe(Effect.flip);
	expect(result).toBe("rollback");
	expect(yield* store.load("one")).toBeUndefined();
	yield* Effect.sleep("1200 millis");
	expect(received).toEqual([[]]);
	expect(reads.count()).toBe(1);
});

test("a daemon command commit reaches a CLI follower without periodic PostgreSQL reads", () =>
	withHost({ "one.md": task("one", "approved") }, {}, (fixture) => {
		const snapshot = Promise.withResolvers<void>();
		return withReadDaemon(
			fixture.host,
			(port) => commitStory(fixture, port, snapshot.promise),
			fixture.parts,
			() => snapshot.resolve(),
		);
	}));

test("a rolled-back daemon store write sends no snapshot or refresh query", () =>
	withHost({}, {}, (fixture) => withReadDaemon(fixture.host, (port) => rollbackStory(fixture, port), fixture.parts)));
