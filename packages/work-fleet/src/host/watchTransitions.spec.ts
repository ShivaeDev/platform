import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { delayedRefresh } from "#test/hostCommandDelaysTraits.ts";
import { approvedWork, boardWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

host.it(
	"watch streams review readiness with its reason, PR and reviewed head, then human delivery once",
	[approvedWork(["one"]), humanDelivery],
	function* (daemon) {
		daemon.writeBoard("fleet/status.md", "---\nid: authored-status\n---\n# Keep this authored file\n");
		yield* daemon.watchEvents();
		yield* daemon.awaitSnapshot();
		const worker = yield* daemon.dispatch("one");
		daemon.finishReviewedWorker(worker);
		yield* daemon.reviewReady("one");
		yield* daemon.awaitEvent("waiting-on-orchestrator");
		yield* daemon.reconcile("one");
		daemon.mergePullRequest();
		yield* daemon.reconcile("one");
		yield* daemon.awaitEvent("done");
		yield* daemon.reconcile("one");
		expect(daemon.eventLines()).toEqual([
			{
				head: HEAD,
				kind: "waiting-on-orchestrator",
				pr: PR,
				reason: "Reviewed PR is ready to merge",
				workId: "one",
			},
			{ head: HEAD, kind: "done", pr: PR, workId: "one" },
		]);
		expect(daemon.eventErrors()).toBe("");
	},
);

host.it("watch streams a maintainer decision and release once", [approvedWork(["one"])], function* (daemon) {
	yield* daemon.watchEvents({ events: "waiting-on-you,released" });
	yield* daemon.awaitSnapshot();
	const worker = yield* daemon.dispatch("one");
	daemon.finishTurn(worker, "FLEET_MAINTAINER_QUESTION: Which scope should ship?");
	yield* daemon.reconcile("one");
	yield* daemon.awaitEvent("waiting-on-you");
	yield* daemon.reconcile("one");
	yield* daemon.answer("one", undefined, true);
	yield* daemon.awaitEvent("released");
	yield* daemon.reconcile("one");
	const expected = [
		expect.objectContaining({ kind: "waiting-on-you", reason: "Which scope should ship?", workId: "one" }),
		{ kind: "released", workId: "one" },
	];
	expect(daemon.eventLines()).toEqual(expect.arrayContaining(expected));
	expect(daemon.eventLines()).toHaveLength(expected.length);
});

host.it("watch reports a background dispatch failure once", [approvedWork(["one"]), delayedRefresh(true)], function* (daemon) {
	yield* daemon.watchEvents();
	yield* daemon.awaitSnapshot();
	yield* daemon.acknowledgeDispatch("one");
	yield* daemon.awaitDelay();
	yield* daemon.releaseDelay();
	const failed = yield* daemon.dispatchOutcome("one");
	yield* daemon.awaitEvent("dispatch-failed");
	yield* daemon.requestStatus();
	expect(daemon.eventLines()).toEqual([{ kind: "dispatch-failed", reason: failed.error, workId: "one" }]);
});

host.it("watch reports an answer that failed to apply once", [approvedWork(["one"])], function* (daemon) {
	yield* daemon.dispatch("one");
	yield* daemon.watchEvents();
	yield* daemon.awaitSnapshot();
	yield* daemon.failAnswerQueue();
	yield* daemon.request("daemon.answer", {
		text: "Keep the public interface unchanged.",
		workId: "one",
	});
	yield* daemon.awaitEvent("answer-failed");
	yield* daemon.requestStatus();
	expect(daemon.eventLines()).toEqual([
		{
			kind: "answer-failed",
			reason: expect.stringMatching(/\S/u),
			workId: "one",
		},
	]);
});

host.it(
	"watch filters events and ignores ordinary dependency and area waits",
	[
		boardWork({
			"one.md": task("one", "approved").replace("fleet: approved", "fleet: approved\nareas:\n  - shared"),
			"three.md": task("three", "approved").replace("fleet: approved", "fleet: approved\nrelationships:\n  - kind: depends_on\n    target: two"),
			"two.md": task("two", "approved").replace("fleet: approved", "fleet: approved\nareas:\n  - shared"),
		}),
	],
	function* (daemon) {
		yield* daemon.watchEvents({ events: "dispatch-failed,released" });
		yield* daemon.awaitSnapshot();
		yield* daemon.dispatch("one");
		yield* daemon.acknowledgeDispatch("two");
		expect((yield* daemon.dispatchOutcome("two")).error).toContain("waiting for area");
		yield* daemon.acknowledgeDispatch("three");
		expect((yield* daemon.dispatchOutcome("three")).error).toContain("waiting for dependency");
		yield* daemon.workerQuestion();
		yield* daemon.answer("one", undefined, true);
		yield* daemon.awaitEvent("released");
		expect(daemon.eventLines()).toEqual([{ kind: "released", workId: "one" }]);
	},
);

host.it("watch reports stalled working work once until it advances", [approvedWork(["one"])], function* (daemon) {
	yield* daemon.watchEvents({
		events: "stuck,waiting-on-orchestrator",
		stuckAfter: 0.2,
	});
	yield* daemon.awaitSnapshot();
	const worker = yield* daemon.dispatch("one");
	yield* daemon.awaitEvent("stuck");
	daemon.finishTurn(worker, "FLEET_QUESTION: Should I continue?");
	yield* daemon.reconcile("one");
	yield* daemon.awaitEvent("waiting-on-orchestrator");
	expect(daemon.eventLines()).toEqual([
		{ kind: "stuck", reason: "No progress for 0.2 seconds", workId: "one" },
		{
			kind: "waiting-on-orchestrator",
			reason: "Should I continue?",
			workId: "one",
		},
	]);
});
