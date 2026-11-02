import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { HEAD, MOVED, PR } from "#test/githubResult.ts";
import { approvedWork, boardWork, host, storedWork } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

host.it("pnpm -s fleet watch --follow prints only actionable event lines", [approvedWork(["one"])], function* (daemon) {
	yield* daemon.watchDefault({ follow: true, pnpm: true, prEvents: false });
	yield* daemon.awaitSnapshot();
	const worker = yield* daemon.dispatch("one");

	daemon.finishTurn(worker, "FLEET_MAINTAINER_QUESTION: Which scope?");
	yield* daemon.reconcile("one");
	yield* daemon.awaitOutput("events", 'reason="Which scope?"');

	expect(daemon.eventOutput()).toBe('waiting-on-you workId="one" reason="Which scope?"\n');
});

host.it(
	"the default watch reports the same waiting reason once per work item and head across repair",
	[approvedWork(["one"]), humanDelivery],
	function* (daemon) {
		yield* daemon.watchDefault({ follow: true, json: true, prEvents: false });
		yield* daemon.awaitSnapshot();
		const worker = yield* daemon.dispatch("one");
		daemon.finishReviewedWorker(worker);
		yield* daemon.reviewReady("one");
		yield* daemon.awaitEvent("waiting-on-orchestrator");
		yield* daemon.answer("one", "Check the same revision again.");
		yield* daemon.reconcile("one");
		const repair = yield* daemon.waitForRecord(
			"one",
			(record) => record.attempts.at(-1)?.role === "repair" && record.attempts.at(-1)?.receipt !== undefined,
		);
		daemon.finishReviewedWorker(repair);
		yield* daemon.reviewReady("one");
		yield* daemon.reconcile("one");
		yield* daemon.answer("one", "Change the revision.");
		yield* daemon.reconcile("one");
		const changed = yield* daemon.waitForRecord(
			"one",
			(record) => record.attempts.at(-1)?.role === "repair" && record.attempts.at(-1)?.receipt !== undefined,
		);
		daemon.finishReviewedWorker(changed, MOVED);
		yield* daemon.reviewReady("one");
		yield* daemon.awaitOutput("events", `"head":"${MOVED}"`);

		expect(daemon.eventLines()).toEqual(
			[HEAD, MOVED].map((head) => ({ head, kind: "waiting-on-orchestrator", pr: PR, reason: "Reviewed PR is ready to merge", workId: "one" })),
		);
	},
);

host.it(
	"requeued Board changes and unsubstantiated release holds stay quiet",
	[
		storedWork("queued", "queued", {
			blocker: "Board context changed",
			decision: {
				attentionOwner: "orchestrator",
				code: "fleet-stale",
				id: "old",
				links: [],
				reason: "Board context changed",
				recommendation: "retry",
			},
		}),
		storedWork("release", "waiting", {
			attentionOwner: "orchestrator",
			blocker: "Release PR #8 is stuck",
			releaseWindow: { observedAt: 100, pr: PR, progress: HEAD },
		}),
		boardWork({ "one.md": task("one", "approved"), "queued.md": task("queued", "approved"), "release.md": task("release", "approved") }),
	],
	function* (daemon) {
		const github = yield* daemon.prApi();
		yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
		yield* daemon.awaitSnapshot();
		const worker = yield* daemon.dispatch("one");
		daemon.finishTurn(worker, "FLEET_QUESTION: Which scope?");
		yield* daemon.reconcile("one");
		yield* daemon.awaitEvent("waiting-on-orchestrator");

		expect(daemon.eventLines()).toEqual([{ kind: "waiting-on-orchestrator", reason: "Which scope?", workId: "one" }]);
	},
);

host.it(
	"ordinary capacity dispatch deferrals stay quiet",
	[boardWork({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, { concurrency: 1 })],
	function* (daemon) {
		yield* daemon.watchDefault({ follow: true, json: true, prEvents: false });
		yield* daemon.awaitSnapshot();
		const worker = yield* daemon.dispatch("one");
		yield* daemon.acknowledgeDispatch("two");
		const deferred = yield* daemon.dispatchOutcome("two");
		expect(deferred.error).toContain("capacity is occupied");

		daemon.finishTurn(worker, "FLEET_QUESTION: Which scope?");
		yield* daemon.reconcile("one");
		yield* daemon.awaitEvent("waiting-on-orchestrator");

		expect(daemon.eventLines()).toEqual([{ kind: "waiting-on-orchestrator", reason: "Which scope?", workId: "one" }]);
	},
);
