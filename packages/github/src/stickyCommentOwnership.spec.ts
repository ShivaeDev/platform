import { expect } from "vitest";
import { github } from "#test/github.ts";
import { pullRequestHasComments } from "#test/writeTraits.ts";

github.it(
	"a first coverage report posts a comment that starts with the hidden coverage marker",
	[],
	function* ({ commentsOnPullRequest, postReport }) {
		yield* postReport({ body: "Coverage: 80%", marker: "coverage" });

		expect(yield* commentsOnPullRequest()).toEqual(["coverage[bot]: <!-- coverage -->\nCoverage: 80%"]);
	},
);

github.it("a second coverage report edits the first report's comment in place", [], function* ({ commentsOnPullRequest, postReport }) {
	yield* postReport({ body: "Coverage: 80%", marker: "coverage" });
	expect(yield* commentsOnPullRequest()).toEqual(["coverage[bot]: <!-- coverage -->\nCoverage: 80%"]);

	yield* postReport({ body: "Coverage: 90%", marker: "coverage" });

	expect(yield* commentsOnPullRequest()).toEqual(["coverage[bot]: <!-- coverage -->\nCoverage: 90%"]);
});

github.it(
	"a coverage report edits the first comment that contains the marker anywhere, on the second page, and leaves the later duplicate alone",
	[
		pullRequestHasComments("two reviews on page 1 and two coverage comments on page 2", [
			{ body: "Review one", id: 1, user: { login: "reviewer" } },
			{ body: "<!-- other -->\nReview two", id: 2, user: { login: "reviewer" } },
			{ body: "Previously posted\n<!-- coverage -->\nOld coverage", id: 3, user: { login: "coverage[bot]" } },
			{ body: "<!-- coverage -->\nDuplicate", id: 4, user: { login: "coverage[bot]" } },
		]),
	],
	function* ({ commentsOnPullRequest, postReport }) {
		yield* postReport({ body: "New coverage", marker: "coverage" });

		expect(yield* commentsOnPullRequest()).toEqual([
			"reviewer: Review one",
			"reviewer: <!-- other -->\nReview two",
			"coverage[bot]: <!-- coverage -->\nNew coverage",
			"coverage[bot]: <!-- coverage -->\nDuplicate",
		]);
	},
);

github.it(
	"a report for author coverage[bot] posts its own comment beside another-bot's coverage comment",
	[
		pullRequestHasComments("another-bot's coverage comment", [
			{ body: "<!-- coverage -->\nSomeone else's report", id: 1, user: { login: "another-bot" } },
		]),
	],
	function* ({ commentsOnPullRequest, postReport }) {
		yield* postReport({ author: "coverage[bot]", body: "Our report", marker: "coverage" });

		expect(yield* commentsOnPullRequest()).toEqual([
			"another-bot: <!-- coverage -->\nSomeone else's report",
			"coverage[bot]: <!-- coverage -->\nOur report",
		]);
	},
);

github.it(
	"a report for author coverage[bot] edits coverage[bot]'s comment and leaves another-bot's earlier one alone",
	[
		pullRequestHasComments("another-bot's coverage comment followed by coverage[bot]'s", [
			{ body: "<!-- coverage -->\nSomeone else's report", id: 1, user: { login: "another-bot" } },
			{ body: "<!-- coverage -->\nOur report", id: 2, user: { login: "coverage[bot]" } },
		]),
	],
	function* ({ commentsOnPullRequest, postReport }) {
		yield* postReport({ author: "coverage[bot]", body: "Our next report", marker: "coverage" });

		expect(yield* commentsOnPullRequest()).toEqual([
			"another-bot: <!-- coverage -->\nSomeone else's report",
			"coverage[bot]: <!-- coverage -->\nOur next report",
		]);
	},
);

github.it(
	"a report for App 7 edits only App 7's bot comment that starts with the marker",
	[
		pullRequestHasComments("a human's, another App's, a quoting and App 7's coverage comment", [
			{ body: "<!-- coverage -->\nHuman report", id: 1, "performed_via_github_app": { id: 7 }, user: { login: "reviewer", type: "User" } },
			{ body: "<!-- coverage -->\nAnother app", id: 2, "performed_via_github_app": { id: 8 }, user: { login: "other[bot]", type: "Bot" } },
			{
				body: "Quoted <!-- coverage -->\nOur old quote",
				id: 3,
				"performed_via_github_app": { id: 7 },
				user: { login: "coverage[bot]", type: "Bot" },
			},
			{ body: "<!-- coverage -->\nOur old report", id: 4, "performed_via_github_app": { id: 7 }, user: { login: "coverage[bot]", type: "Bot" } },
		]),
	],
	function* ({ commentsOnPullRequest, postReport }) {
		yield* postReport({ appId: 7, body: "Our new report", marker: "coverage" });

		expect(yield* commentsOnPullRequest()).toEqual([
			"reviewer: <!-- coverage -->\nHuman report",
			"other[bot]: <!-- coverage -->\nAnother app",
			"coverage[bot]: Quoted <!-- coverage -->\nOur old quote",
			"coverage[bot]: <!-- coverage -->\nOur new report",
		]);
	},
);
