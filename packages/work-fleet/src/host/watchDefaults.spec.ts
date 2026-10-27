import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

host.it(
	"the bare watcher follows new work and PR transitions with one event per line and no heartbeat",
	[approvedWork(["one"]), humanDelivery],
	function* (daemon) {
		const github = yield* daemon.prApi();
		yield* daemon.watchDefault({ apiUrl: github.url, prInterval: 0.1 });
		yield* daemon.awaitSnapshot();
		expect(daemon.eventOutput()).toBe("");
		const worker = yield* daemon.dispatch("one");
		daemon.finishReviewedWorker(worker);
		yield* daemon.reviewReady("one");
		yield* daemon.awaitOutput("events", "waiting-on-orchestrator ");
		yield* github.awaitPoll();
		github.pull({ merged: true, state: "closed" });
		yield* daemon.awaitOutput("events", "pr-merged ");
		const lines = daemon.eventOutput().split("\n");
		expect(lines.pop()).toBe("");
		expect(lines).toEqual([expect.stringMatching(/^waiting-on-orchestrator .*workId="one"/u), expect.stringMatching(/^pr-merged .*workId="one"/u)]);
		expect(daemon.watchRunning()).toBe(true);
		expect(daemon.eventErrors()).toBe("");
	},
);

host.it("the default watcher omits releases", [approvedWork(["one", "two"])], function* (daemon) {
	yield* daemon.watchDefault();
	yield* daemon.awaitSnapshot();
	const worker = yield* daemon.dispatch("one");
	daemon.finishTurn(worker, "FLEET_QUESTION: Continue?");
	yield* daemon.reconcile("one");
	yield* daemon.awaitOutput("events", "waiting-on-orchestrator ");
	yield* daemon.answer("one", undefined, true);
	const second = yield* daemon.dispatch("two");
	daemon.finishTurn(second, "FLEET_QUESTION: Release this work?");
	yield* daemon.reconcile("two");
	yield* daemon.awaitOutput("events", 'reason="Release this work?"');
	expect(daemon.eventOutput()).not.toContain("released");
});

host.it("--events released includes ownership releases", [approvedWork(["one"])], function* (daemon) {
	yield* daemon.watchDefault({ events: "released" });
	yield* daemon.awaitSnapshot();
	const worker = yield* daemon.dispatch("one");
	daemon.finishTurn(worker, "FLEET_QUESTION: Continue?");
	yield* daemon.reconcile("one");
	yield* daemon.answer("one", undefined, true);
	yield* daemon.awaitOutput("events", 'released workId="one"\n');
	expect(daemon.eventOutput()).toBe('released workId="one"\n');
});

host.it("watch finds the Board from the repository root without --board", [approvedWork(["one"])], function* (daemon) {
	const root = yield* daemon.repositoryWithBoard();
	yield* daemon.watchDefault({ cwd: root });
	yield* daemon.awaitSnapshot();
	const worker = yield* daemon.dispatch("one");
	daemon.finishTurn(worker, "FLEET_QUESTION: Which scope?\nKeep it small.");
	yield* daemon.reconcile("one");
	yield* daemon.awaitOutput("events", "waiting-on-orchestrator ");
	expect(daemon.eventOutput().split("\n")).toEqual([expect.stringContaining('workId="one"'), ""]);
	expect(daemon.eventErrors()).toBe("");
});
