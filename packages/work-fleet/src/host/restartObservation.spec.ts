import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";
import { pacedHost } from "#test/pacedHost.ts";
import { runningReviewer } from "#test/runningReviewer.ts";

for (const launch of ["before", "after"] as const) {
	host.it(
		`a worker launched ${launch} restart reaches review and orchestrator handoff despite GitHub pacing`,
		[humanDelivery, runningReviewer, pacedHost],
		function* (daemon) {
			yield* daemon.awaitSchedulerPause();
			if (launch === "before") {
				daemon.writeBoard("one.md", task("one", "approved"));
				yield* daemon.dispatch("one");
			}
			yield* daemon.stop();
			yield* daemon.start();
			yield* daemon.awaitSchedulerPause();
			if (launch === "after") {
				daemon.writeBoard("one.md", task("one", "approved"));
				yield* daemon.dispatch("one");
			}
			const worker = yield* daemon.get("one");
			expect(worker.stage).toBe("working");
			yield* daemon.follow("handoff", "watch", ["one"], { follow: true });
			daemon.finishReviewedWorker(worker);
			const reviewing = yield* daemon.waitForRecord(
				"one",
				(record) => record.attempts.at(-1)?.role === "reviewer" && record.attempts.at(-1)?.receipt !== undefined,
			);
			expect(reviewing.stage).toBe("reviewing");
			daemon.finishTurn(reviewing);
			const ready = yield* daemon.waitForRecord("one", (record) => record.decision?.code === "reviewed-pr-ready");
			yield* daemon.awaitOutput("handoff", "one waiting (waiting on orchestrator): Reviewed PR is ready to merge\n");
			expect(ready).toMatchObject({
				checks: { head: HEAD, passed: true },
				result: { head: HEAD, pr: PR },
				review: { head: HEAD, verdict: "approved" },
				stage: "waiting",
			});
			expect(ready.attempts.map(({ role }) => role)).toEqual(["worker", "reviewer"]);
			expect(ready.attempts[0]?.receipt).toEqual(worker.attempts[0]?.receipt);
		},
	);
}
