import { Effect } from "effect";
import { expect } from "vitest";
import { RemoteHttpError } from "@shivaedev/platform/http-client/errors.ts";
import { github } from "#test/github.ts";
import { commentWritesForbidden, pullRequestHasComments } from "#test/writeTraits.ts";

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
			{ body: "<!-- coverage -->\nOld coverage", id: 3, user: { login: "coverage[bot]" } },
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

github.it("creates a check for a head SHA, starts it, then completes it", [], function* ({ createCheck, updateCheck, readCheck }) {
	const created = yield* createCheck({ headSha: "a".repeat(40), name: "Coverage", status: "queued" });
	expect(created).toMatchObject({ conclusion: null, headSha: "a".repeat(40), name: "Coverage", status: "queued" });
	yield* updateCheck(created.id, { output: { summary: "Measuring", title: "Coverage" }, status: "in_progress" });
	expect(yield* readCheck(created.id)).toMatchObject({ output: { summary: "Measuring" }, status: "in_progress" });
	yield* updateCheck(created.id, {
		conclusion: "success",
		output: { summary: "90% covered", text: "All targets measured", title: "Coverage" },
		status: "completed",
	});
	expect(yield* readCheck(created.id)).toMatchObject({
		conclusion: "success",
		id: created.id,
		output: { summary: "90% covered", text: "All targets measured", title: "Coverage" },
		status: "completed",
	});
});

github.it("a forbidden comment write fails typed and leaves no comment", [commentWritesForbidden], function* ({ upsertComment, readComments }) {
	const error = yield* Effect.flip(upsertComment({ body: "Coverage: 90%", marker: "coverage" }));
	expect(error).toBeInstanceOf(RemoteHttpError);
	expect(error).toMatchObject({ status: 403 });
	expect(yield* readComments()).toEqual([]);
});

github.it("creates a running check with output", [], function* ({ createCheck, readCheck }) {
	const created = yield* createCheck({
		headSha: "b".repeat(40),
		name: "Coverage",
		output: { summary: "Measuring", text: "Targets selected", title: "Coverage" },
		status: "in_progress",
	});
	expect(yield* readCheck(created.id)).toMatchObject({
		headSha: "b".repeat(40),
		output: { summary: "Measuring", text: "Targets selected", title: "Coverage" },
		status: "in_progress",
	});
});
