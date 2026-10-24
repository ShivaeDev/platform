import { expect } from "vitest";
import { reviewedPullRequestIsOpen } from "#test/engineDeliveryTraits.ts";
import { engine } from "#test/engineStory.ts";
import { decisionPublicationFails, releasedUnpublishedDecision } from "#test/releasedDecision.ts";

for (const status of ["done", "superseded", "deferred", "dropped"]) {
	engine.it(
		`a released merged PR leaves the orchestrator queue when its Board task is ${status}`,
		[reviewedPullRequestIsOpen(), decisionPublicationFails(), releasedUnpublishedDecision()],
		function* ({ status: readStatus, setBoardStatus, mergePullRequest, restart, schedule, fleet }) {
			expect(yield* readStatus()).toContain("Waiting on orchestrator (1)");
			setBoardStatus("one", status);
			mergePullRequest();
			yield* restart();
			yield* schedule();
			yield* restart();
			expect(yield* readStatus()).toContain("Waiting on orchestrator (0)");
			expect((yield* fleet.get("one")).value).toMatchObject({
				mergedDelivery: { head: "reviewed-head", revision: "merged-revision" },
				releaseReason: "Released after decision publication failed",
				step: "released",
			});
		},
	);
}

for (const owner of ["maintainer", "orchestrator"] as const) {
	engine.it(
		`a released open PR keeps waiting on its ${owner} when the Board task closes`,
		[reviewedPullRequestIsOpen(), decisionPublicationFails(), releasedUnpublishedDecision(owner)],
		function* ({ status, setBoardStatus, schedule }) {
			setBoardStatus("one", "done");
			yield* schedule();
			expect(yield* status()).toContain(`Waiting on ${owner === "maintainer" ? "you" : owner} (1)`);
		},
	);

	engine.it(
		`a released merged PR waits on its ${owner} until the Board task closes later`,
		[reviewedPullRequestIsOpen(), decisionPublicationFails(), releasedUnpublishedDecision(owner)],
		function* ({ status, setBoardStatus, mergePullRequest, restart, schedule }) {
			mergePullRequest();
			yield* schedule();
			expect(yield* status()).toContain(`Waiting on ${owner === "maintainer" ? "you" : owner} (1)`);
			setBoardStatus("one", "done");
			yield* restart();
			yield* schedule();
			expect(yield* status()).toContain(`Waiting on ${owner === "maintainer" ? "you" : owner} (0)`);
		},
	);
}
