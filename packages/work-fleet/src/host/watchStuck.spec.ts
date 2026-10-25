import { expect } from "@effect/vitest";
import { HEAD, PR } from "#test/githubResult.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";
import { runningReviewer } from "#test/runningReviewer.ts";

host.it(
	"watch reports stalled reviewing work once and rearms after observed reviewer progress",
	[approvedWork(["one"]), humanDelivery, runningReviewer],
	function* (daemon) {
		const worker = yield* daemon.dispatch("one");
		yield* daemon.watchEvents({
			events: "stuck,waiting-on-orchestrator",
			stuckAfter: 1,
		});
		yield* daemon.awaitSnapshot();
		daemon.finishReviewedWorker(worker);
		const reviewing = yield* daemon.reconcile("one");
		expect(reviewing.stage).toBe("reviewing");
		yield* daemon.awaitEvent("stuck");
		const first = daemon.eventOutput();
		daemon.observeProgress(yield* daemon.get("one"));
		yield* daemon.reconcile("one");
		yield* daemon.awaitOutput("events", first.repeat(2));
		daemon.finishTurn(yield* daemon.get("one"));
		yield* daemon.reviewReady("one");
		yield* daemon.awaitEvent("waiting-on-orchestrator");
		expect(daemon.eventLines()).toEqual([
			{
				head: HEAD,
				kind: "stuck",
				pr: PR,
				reason: "No progress for 1 seconds",
				workId: "one",
			},
			{
				head: HEAD,
				kind: "stuck",
				pr: PR,
				reason: "No progress for 1 seconds",
				workId: "one",
			},
			{
				head: HEAD,
				kind: "waiting-on-orchestrator",
				pr: PR,
				reason: "Reviewed PR is ready to merge",
				workId: "one",
			},
		]);
	},
);
