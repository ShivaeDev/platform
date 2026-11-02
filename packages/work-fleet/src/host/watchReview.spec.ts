import { expect } from "@effect/vitest";
import { HEAD, MOVED, PR } from "#test/githubResult.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

for (const initialReady of [true, false]) {
	host.it(
		`watch --follow with all and explicit IDs reports real review completion with initial readiness=${initialReady}`,
		[approvedWork(["one"]), humanDelivery],
		function* (daemon) {
			if (initialReady) {
				const worker = yield* daemon.dispatch("one");
				daemon.finishReviewedWorker(worker);
				yield* daemon.reviewReady("one");
			}
			yield* daemon.follow("all", "watch", [], { follow: true, json: true, prEvents: false });
			yield* daemon.follow("explicit", "watch", ["one"], { follow: true, json: true, prEvents: false });
			if (!initialReady) {
				const worker = yield* daemon.dispatch("one");
				daemon.finishReviewedWorker(worker);
				yield* daemon.reviewReady("one");
			}
			const line = `"head":"${HEAD}"`;
			yield* daemon.awaitOutput("all", line);
			yield* daemon.awaitOutput("explicit", line);
			expect((yield* daemon.answer("one", "Keep the loading indicator visible.")).step).toBe("repairing");
			yield* daemon.reconcile("one");
			const repair = yield* daemon.waitForRecord(
				"one",
				(record) => record.attempts.at(-1)?.role === "repair" && record.attempts.at(-1)?.receipt !== undefined,
			);
			daemon.finishReviewedWorker(repair, MOVED);
			yield* daemon.reviewReady("one");
			yield* daemon.awaitOutput("all", `"head":"${MOVED}"`);
			yield* daemon.awaitOutput("explicit", `"head":"${MOVED}"`);
			const expected = [HEAD, MOVED].map((head) => ({
				head,
				kind: "waiting-on-orchestrator",
				pr: PR,
				reason: "Reviewed PR is ready to merge",
				workId: "one",
			}));
			expect(daemon.followerEvents("all")).toEqual(expected);
			expect(daemon.followerEvents("explicit")).toEqual(expected);
			expect([daemon.followerRunning("all"), daemon.followerRunning("explicit")]).toEqual([true, true]);
		},
	);
}
