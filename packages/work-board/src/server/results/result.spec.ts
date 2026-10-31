import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { revisionOf } from "#server/responses/records.ts";
import { boardStory, responsesEnabled } from "#test/boardStory.ts";
import { feedbackEntry, REVIEW_TASK, reviewResult } from "#test/resultReview.ts";
import { aResultAwaitingReview } from "#test/storyTraits.ts";

const REVIEW_PATH = "/_board/item/result.keyboard/";
const awaitingReview = [aResultAwaitingReview(), responsesEnabled()];
const CONFLICT = "conflict: No single result has this ID. It may be missing, share its ID with another file, or sit in a file the Board can't read.";
const UNMATCHED = "Another check has the same ID, so evidence can't be matched to this one.";

boardStory.it(
	"the review of result.keyboard lists the ready work with each check's claimed evidence, missing evidence and unrecorded fields",
	awaitingReview,
	function* ({ reviewChecks }) {
		expect(yield* reviewChecks()).toEqual([
			{
				item: "Keyboard work",
				rows: [
					[
						"Escape restores focus",
						"../evidence/focus.mdFile not found",
						"Focus restored in the recorded check",
						"Actual keyboard check",
						"012345678901",
						"Not recorded",
					],
					["Narrow layout stays readable", "No evidence recorded"],
				],
				status: "Ready",
			},
		]);
	},
);

boardStory.it(
	"a revision request recorded for the current report shows as written for this version and leaves the task unchanged",
	awaitingReview,
	function* ({ fileText, reviewFeedback, reviewReport }) {
		yield* reviewReport("response.revise", "revision");

		yield* outcomes([
			["feedback", () => reviewFeedback(), [feedbackEntry("response.revise", "this version")]],
			["task", () => fileText("items/task.md"), REVIEW_TASK],
		]);
	},
);

boardStory.it(
	"feedback recorded before the report changed shows as written for an earlier version",
	awaitingReview,
	function* ({ edited, reviewFeedback, reviewReport }) {
		yield* reviewReport("response.revise", "revision");
		expect(yield* reviewFeedback()).toEqual([feedbackEntry("response.revise", "this version")]);

		yield* edited("items/result.md", reviewResult("Second report: limitation clarified"));

		expect(yield* reviewFeedback()).toEqual([feedbackEntry("response.revise", "earlier version")]);
	},
);

boardStory.it(
	"an acceptance of the changed report is pinned to its revision and replaces the earlier revision request",
	awaitingReview,
	function* ({ edited, reviewFeedback, reviewReport }) {
		yield* reviewReport("response.revise", "revision");
		yield* edited("items/result.md", reviewResult("Second report: limitation clarified"));

		const accepted = yield* reviewReport("response.accept", "accept", "response.revise");

		expect(accepted.response.reviewedRevision).toBe(revisionOf(reviewResult("Second report: limitation clarified")));
		expect(yield* reviewFeedback()).toEqual([
			{ ...feedbackEntry("response.accept", "this version"), replaces: "/responses/response.revise.md" },
			feedbackEntry("response.revise", "earlier version"),
		]);
	},
);

boardStory.it(
	"feedback on a report that moved shows as written for an earlier version",
	awaitingReview,
	function* ({ movedAndReindexed, reviewFeedback, reviewReport }) {
		yield* reviewReport("response.revise", "revision");

		yield* movedAndReindexed("items/result.md", "items/moved-result.md");

		expect(yield* reviewFeedback()).toEqual([feedbackEntry("response.revise", "earlier version")]);
	},
);

boardStory.it(
	"feedback whose response file moved links to the file where it now is",
	awaitingReview,
	function* ({ movedAndReindexed, reviewFeedback, reviewReport }) {
		yield* reviewReport("response.revise", "revision");

		yield* movedAndReindexed("responses/response.revise.md", "responses/moved-feedback.md");

		expect(yield* reviewFeedback()).toEqual([feedbackEntry("response.revise", "this version", "/responses/moved-feedback.md")]);
	},
);

boardStory.it(
	"a review that replaces moved feedback links to the moved feedback file",
	awaitingReview,
	function* ({ movedAndReindexed, reviewFeedback, reviewReport }) {
		yield* reviewReport("response.revise", "revision");
		yield* movedAndReindexed("responses/response.revise.md", "responses/moved-feedback.md");

		yield* reviewReport("response.accept", "accept", "response.revise");

		expect(yield* reviewFeedback()).toContainEqual({ ...feedbackEntry("response.accept", "this version"), replaces: "/responses/moved-feedback.md" });
	},
);

boardStory.it(
	"a malformed feedback file hides the feedback list and names the file with a link to source problems",
	awaitingReview,
	function* ({ edited, reviewFeedback, reviewReport, unreadableFeedback }) {
		yield* reviewReport("response.valid", "accept");
		expect(yield* reviewFeedback()).toEqual([feedbackEntry("response.valid", "this version")]);

		yield* edited("responses/broken.md", "---\nresponse: [unfinished\n");

		yield* outcomes([
			["feedback", () => reviewFeedback(), []],
			[
				"unreadable",
				() => unreadableFeedback(),
				{ files: [expect.stringMatching(/^responses\/broken\.md: \S/u)], sourceProblems: "/_board/system#source-problems" },
			],
		]);
	},
);

boardStory.it(
	"two feedback files sharing a response id are both listed as unreadable because of the shared id",
	awaitingReview,
	function* ({ edited, fileText, reviewReport, unreadableFeedback }) {
		yield* reviewReport("response.valid", "accept");
		const record = yield* fileText("responses/response.valid.md");

		yield* edited("responses/copy.md", record);

		expect((yield* unreadableFeedback()).files).toEqual([
			"responses/copy.md: Another file uses the same response ID, response.valid.",
			"responses/response.valid.md: Another file uses the same response ID, response.valid.",
		]);
	},
);

boardStory.it("the older result link answers with the same review as the item page", awaitingReview, function* ({ resultReading }) {
	const current = yield* resultReading(REVIEW_PATH);
	expect(current).toMatchObject({ item: "result.keyboard" });

	expect(yield* resultReading("/_board/result?item=result.keyboard")).toEqual(current);
});

boardStory.it("a duplicated result identity makes its review refused as a conflict", awaitingReview, function* ({ edited, resultReading }) {
	yield* edited("items/duplicate.md", reviewResult("Duplicate"));

	expect(yield* resultReading(REVIEW_PATH)).toBe(CONFLICT);
});

boardStory.it("a review asked for work that is not a result is refused as a conflict", awaitingReview, function* ({ resultReading }) {
	expect(yield* resultReading("/_board/item/work.keyboard/")).toBe(CONFLICT);
});

boardStory.it(
	"an acceptance of a CRLF report is pinned to its exact bytes and the report file keeps them",
	awaitingReview,
	function* ({ edited, fileText, reviewedRevisions, reviewFeedback, reviewReport }) {
		const source = reviewResult().replaceAll("\n", "\r\n");
		yield* edited("items/result.md", source);

		const accepted = yield* reviewReport("response.crlf", "accept");

		expect(accepted.response.reviewedRevision).toBe(revisionOf(source));
		yield* outcomes([
			["feedback", () => reviewFeedback(), [feedbackEntry("response.crlf", "this version")]],
			["report", () => fileText("items/result.md"), source],
			["shown revisions", () => reviewedRevisions(), [revisionOf(source)]],
		]);
	},
);

boardStory.it("two checks sharing an id show that evidence cannot be matched to either", awaitingReview, function* ({ edited, reviewChecks }) {
	yield* edited("items/task.md", REVIEW_TASK.replace("id: narrow", "id: focus"));

	expect(yield* reviewChecks()).toEqual([
		{
			item: "Keyboard work",
			rows: [
				["Escape restores focus", UNMATCHED],
				["Narrow layout stays readable", UNMATCHED],
			],
			status: "Ready",
		},
	]);
});
