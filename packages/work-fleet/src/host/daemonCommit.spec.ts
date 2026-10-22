import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { approvedWork, host } from "#test/hostStory.ts";
import { statusRecord } from "#test/status.ts";

host.it("a daemon command commit reaches a CLI follower without periodic PostgreSQL reads", [approvedWork(["one"])], function* (daemon) {
	yield* daemon.follow("watcher", "watch", ["one"]);
	yield* daemon.awaitSnapshot();
	yield* Effect.sleep("1200 millis");
	expect(daemon.snapshotReadCount()).toBe(1);
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started);
	yield* daemon.reconcile("one");
	yield* daemon.awaitOutput("watcher", "one waiting");
	expect(yield* daemon.followerExit("watcher")).toMatchObject({ code: 0, stderr: "" });
});

host.it("a rolled-back daemon store write sends no snapshot or refresh query", [], function* (daemon) {
	yield* daemon.subscribe(["one"]);
	expect(yield* daemon.rollbackInsert(statusRecord("one"), "rollback").pipe(Effect.flip)).toBe("rollback");
	expect(yield* daemon.loadStoredRecord("one")).toBeUndefined();
	yield* Effect.sleep("1200 millis");
	expect(daemon.snapshots()).toEqual([[]]);
	expect(daemon.snapshotReadCount()).toBe(1);
});
