import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

host.it(
	"the default follow watcher reports readiness once and keeps merged PRs and done work quiet",
	[approvedWork(["one", "two"]), humanDelivery],
	function* (daemon) {
		const github = yield* daemon.prApi();
		yield* daemon.watchDefault({ apiUrl: github.url, follow: true, prInterval: 0.1 });
		yield* daemon.awaitSnapshot();
		expect(daemon.eventOutput()).toBe("");
		const worker = yield* daemon.dispatch("one");
		daemon.finishReviewedWorker(worker);
		yield* daemon.reviewReady("one");
		yield* daemon.awaitOutput("events", "waiting-on-orchestrator ");
		yield* github.awaitPoll();
		github.pull({ merged: true, state: "closed" });
		yield* github.awaitRequests(
			"/repos/example/repository/pulls?state=open&per_page=100",
			github.requests().filter(({ path }) => path.includes("?state=open")).length + 2,
		);
		daemon.mergePullRequest();
		yield* daemon.reconcile("one");
		const next = yield* daemon.dispatch("two");
		daemon.finishTurn(next, "FLEET_QUESTION: Confirm next scope");
		yield* daemon.reconcile("two");
		yield* daemon.awaitOutput("events", 'reason="Confirm next scope"');
		yield* daemon.stopWatch();
		const lines = daemon.eventOutput().split("\n");
		expect(lines.pop()).toBe("");
		expect(lines).toEqual([
			expect.stringMatching(/^waiting-on-orchestrator .*workId="one"/u),
			'waiting-on-orchestrator workId="two" reason="Confirm next scope"',
		]);

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
