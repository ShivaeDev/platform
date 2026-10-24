import { expect } from "@effect/vitest";
import { MOVED } from "#test/githubResult.ts";
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
			yield* daemon.follow("all", "watch", [], { follow: true });
			yield* daemon.follow("explicit", "watch", ["one"], { follow: true });
			if (!initialReady) {
				const worker = yield* daemon.dispatch("one");
				daemon.finishReviewedWorker(worker);
				yield* daemon.reviewReady("one");
			}
			const line = "one waiting (waiting on orchestrator): Reviewed PR is ready to merge\n";
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
			yield* daemon.awaitOutput("all", line.repeat(2));
			yield* daemon.awaitOutput("explicit", line.repeat(2));
			expect([daemon.followerOutput("all"), daemon.followerOutput("explicit")]).toEqual([line.repeat(2), line.repeat(2)]);
			expect([daemon.followerRunning("all"), daemon.followerRunning("explicit")]).toEqual([true, true]);
		},
	);
}
