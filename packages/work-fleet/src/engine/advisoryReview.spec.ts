import { expect } from "@effect/vitest";
import { reviewedPullRequestIsOpen } from "#test/engineDeliveryTraits.ts";
import { engine } from "#test/engineStory.ts";
import { advisoryReviews, markdownWork, reviewerStillRunning } from "#test/engineTraits.ts";

const TLDR = "Verdict: request changes\n- The empty state does not explain the next action.";
const DETAILS =
	"### Empty state\nClaim: No next action.\nEvidence: The empty view only says Empty.\nLikelihood in real use: likely.\nImpact: New users cannot start.\nSuggested fix: Link to creation.";
const review = `## TL;DR\n\n${TLDR}\n\n## Details\n\n${DETAILS}\n\nFLEET_REVIEW: ${JSON.stringify({ evidence: ["Inspected exact diff"], findings: ["Add the next action"], head: "reviewed-head", verdict: "changes" })}`;

for (const output of [review, "Please add a next action. FLEET_REVIEW: invalid JSON"]) {
	engine.it(
		`advisory review retains ${output === review ? "requested changes" : "a malformed reply"} and waits for human merge without worker repair`,
		[advisoryReviews(), markdownWork(), reviewedPullRequestIsOpen(), reviewerStillRunning()],
		function* ({
			prepareWork,
			dispatch,
			finishWorkers,
			reconcile,
			turnReports,
			readBoardPublication,
			readBoardWork,
			restart,
			providerStarts,
			mergePullRequest,
		}) {
			yield* prepareWork("one");
			yield* dispatch("one");
			finishWorkers();
			const reviewing = yield* reconcile("one");
			yield* turnReports(reviewing, output);
			const ready = (yield* reconcile("one")).value;
			expect(ready.step).toBe("waiting");
			expect(ready.decision?.code).toBe("reviewed-pr-ready");
			expect(ready.review?.verdict).toBe(output === review ? "changes" : "unavailable");
			expect(ready.checks?.passed).toBe(true);
			const document = ready.review?.document;
			expect(document).toBeDefined();
			const path = document?.publication.sourcePath ?? "missing";
			const published = readBoardPublication(path);
			expect(published.fields.kind).toBe("report");
			expect(published.fields.relationships).toEqual([{ kind: "informs", target: "one" }]);
			expect(published.body).toContain(output);
			if (output === review) {
				expect(published.body.indexOf("## TL;DR")).toBeLessThan(published.body.indexOf("## Details"));
				expect(document?.tldr).toBe(TLDR);
			} else {
				expect(published.body).toContain("Malformed review:");
				expect(document?.tldr).toContain("Malformed review:");
			}
			expect(ready.decision?.links).toContain(path);
			expect(ready.decision?.review).toEqual(document);
			const decision = readBoardWork(ready.decision?.published?.sourcePath ?? "missing");
			expect(decision).toContain(`[Review document](/${path})`);
			expect(decision).toContain(document?.tldr);
			yield* restart();
			yield* reconcile("one");
			expect(providerStarts().map((start) => start.access)).toEqual([undefined, "read-only"]);
			mergePullRequest();
			expect((yield* reconcile("one")).value.step).toBe("done");
		},
	);
}
