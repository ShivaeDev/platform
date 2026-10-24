import { expect } from "@effect/vitest";
import { daemonFollow } from "#test/daemonFollow.ts";

for (const command of ["wait", "watch"] as const) {
	daemonFollow.it(`${command} survives transient PostgreSQL read failures before and after its first snapshot`, [], function* (daemon) {
		yield* daemon.breakReads();
		yield* daemon.follow("follower", command, ["one"]);
		yield* daemon.advanceUntilReads(11);
		yield* daemon.restoreReads();
		expect(yield* daemon.snapshot()).toEqual([[{ outcome: {}, stage: "working", workId: "one" }]]);
		yield* daemon.breakReads();
		const before = daemon.readCount();
		yield* daemon.invalidate();
		yield* daemon.advanceUntilReads(before + 11);
		expect(yield* daemon.snapshot()).toEqual([[{ outcome: {}, stage: "working", workId: "one" }]]);
		yield* daemon.restoreReads();
		yield* daemon.storeDone();
		expect(yield* daemon.followerExits(["follower"])).toEqual([{ code: 0, stderr: "", stdout: "one done" }]);
	});
}

daemonFollow.it("a persistent PostgreSQL failure ends every wait and watch after 20 shared attempts", [], function* (daemon) {
	yield* daemon.follow("waiter", "wait", ["one"]);
	yield* daemon.follow("watcher", "watch", ["marker", "one"]);
	yield* daemon.awaitOutput("watcher", "marker released\n");
	yield* daemon.awaitSnapshots(2);
	const before = daemon.failedReadCount();
	yield* daemon.breakReads();
	yield* daemon.invalidate();
	const results = yield* daemon.followerExits(["waiter", "watcher"]);
	for (const result of results) {
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("Fleet daemon could not read work states after 20 consecutive attempts");
	}
	expect(daemon.failedReadCount() - before).toBe(20);
});

daemonFollow.it("the shared commit subscription never polls, stops after the last follower and restarts with fresh state", [], function* (daemon) {
	yield* daemon.advanceIdle();
	expect(daemon.readCount()).toBe(0);
	yield* daemon.subscribe("first");
	expect(yield* daemon.subscribe("second")).toEqual([{ outcome: {}, stage: "working", workId: "one" }]);
	yield* daemon.unsubscribe("first");
	const remaining = daemon.readCount();
	yield* daemon.advanceIdle();
	expect(daemon.readCount()).toBe(remaining);
	yield* daemon.unsubscribe("second");
	yield* daemon.awaitSubscriptionStopped();
	const stopped = daemon.readCount();
	yield* daemon.advanceIdle();
	expect(daemon.readCount()).toBe(stopped);
	yield* daemon.storeDone();
	expect(daemon.readCount()).toBe(stopped);
	expect(yield* daemon.snapshot()).toEqual([[{ outcome: {}, stage: "done", workId: "one" }]]);
	expect(daemon.readCount()).toBe(stopped + 1);
});
