import { expect } from "vitest";
import { github } from "#test/github.ts";
import { pullRequestHasComments } from "#test/writeTraits.ts";

github.it("creates a sticky comment, then edits it in place", [], function* ({ upsertComment, readComments }) {
	const first = yield* upsertComment({ body: "Coverage: 80%", marker: "coverage" });
	expect(first.body).toBe("<!-- coverage -->\nCoverage: 80%");
	const second = yield* upsertComment({ body: "Coverage: 90%", marker: "coverage" });
	expect(second.id).toBe(first.id);
	expect(yield* readComments()).toEqual([{ body: "<!-- coverage -->\nCoverage: 90%", id: first.id, user: { login: "coverage[bot]" } }]);
});

github.it(
	"edits the first marker comment even when it is on the second page",
	[
		pullRequestHasComments([
			{ body: "Review one", id: 1, user: { login: "reviewer" } },
			{ body: "<!-- other -->\nReview two", id: 2, user: { login: "reviewer" } },
			{ body: "Previously posted\n<!-- coverage -->\nOld coverage", id: 3, user: { login: "coverage[bot]" } },
			{ body: "<!-- coverage -->\nDuplicate", id: 4, user: { login: "coverage[bot]" } },
		]),
	],
	function* ({ upsertComment, readComments, requests }) {
		const edited = yield* upsertComment({ body: "New coverage", marker: "coverage" });
		expect(edited).toMatchObject({ body: "<!-- coverage -->\nNew coverage", id: 3 });
		expect(
			requests()
				.filter(({ method }) => method === "GET")
				.map(({ query }) => query.get("page")),
		).toEqual([null, "2"]);
		expect((yield* readComments()).map(({ body }) => body)).toEqual([
			"Review one",
			"<!-- other -->\nReview two",
			"<!-- coverage -->\nNew coverage",
			"<!-- coverage -->\nDuplicate",
		]);
	},
);

github.it(
	"leaves another author's marker comment alone when the caller names an author",
	[pullRequestHasComments([{ body: "<!-- coverage -->\nSomeone else's report", id: 1, user: { login: "another-bot" } }])],
	function* ({ upsertComment, readComments }) {
		const created = yield* upsertComment({ author: "coverage[bot]", body: "Our report", marker: "coverage" });
		expect(created).toMatchObject({ id: 2, user: { login: "coverage[bot]" } });
		yield* upsertComment({ author: "coverage[bot]", body: "Our next report", marker: "coverage" });
		expect(yield* readComments()).toEqual([
			{ body: "<!-- coverage -->\nSomeone else's report", id: 1, user: { login: "another-bot" } },
			{ body: "<!-- coverage -->\nOur next report", id: 2, user: { login: "coverage[bot]" } },
		]);
	},
);

github.it(
	"finds its own bot comment by App id and marker prefix",
	[
		pullRequestHasComments([
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
	function* ({ upsertComment, readComments, requests }) {
		const edited = yield* upsertComment({ appId: 7, body: "Our new report", marker: "coverage" });
		expect(edited).toMatchObject({ body: "<!-- coverage -->\nOur new report", id: 4 });
		expect(
			requests()
				.filter(({ method }) => method === "PATCH")
				.map(({ path }) => path),
		).toEqual(["/repos/acme/widgets/issues/comments/4"]);
		expect((yield* readComments()).map(({ body }) => body)).toEqual([
			"<!-- coverage -->\nHuman report",
			"<!-- coverage -->\nAnother app",
			"Quoted <!-- coverage -->\nOur old quote",
			"<!-- coverage -->\nOur new report",
		]);
	},
);
