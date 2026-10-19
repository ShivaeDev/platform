import { readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { revisionOf } from "#server/responses/records.ts";
import { boardStory, responsesEnabled } from "#test/boardStory.ts";
import { REVIEW_TASK, reviewResult } from "#test/resultReview.ts";
import { aResultAwaitingReview } from "#test/storyTraits.ts";

const REVIEW_PATH = "/_board/item/result.keyboard/";

boardStory.it(
	"reads finished result and in-review work separately on the item page through real HTTP and the typed result contract",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ notes, board, readResult }) {
		const before = readdirSync(notes.root);
		const page = yield* Effect.promise(() => fetch(board.url + REVIEW_PATH));
		expect(page.status).toBe(200);
		const body = yield* readResult();
		expect(body).toContain(">In review</span>");
		expect(body).toContain("No evidence recorded");
		expect(body).toContain("Not recorded");
		expect(body).toContain("File not found");
		expect(body).toContain("can&#x27;t tell whether they are still current");
		expect(body).toContain("doesn&#x27;t compare revisions with your checkout");
		expect(readdirSync(notes.root)).toEqual(before);
		expect(readFileSync(join(notes.root, "items/task.md"), "utf8")).toBe(REVIEW_TASK);
		expect(yield* Effect.promise(async () => (await fetch(`${board.url}/items/result.md`)).text())).toContain("data-board-react-root");
	},
);

boardStory.it(
	"records revision request and exact-version acceptance without changing task status or inventing missing evidence",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ notes, editFile, readResult, reviewReport }) {
		const first = yield* reviewReport("response.revise", "revision");
		expect(yield* readResult()).toContain('data-matching="true"');
		editFile("items/result.md", reviewResult("Second report: limitation clarified"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain('data-matching="false"'))),
			{ interval: "50 millis", times: 20 },
		);
		const second = yield* reviewReport("response.accept", "accept", first.id);
		const body = yield* readResult();
		expect(second.response.reviewedRevision).toBe(revisionOf(reviewResult("Second report: limitation clarified")));
		expect(second.response.reviewedRevision).not.toBe(first.response.reviewedRevision);
		expect(body).toContain("Accept this exact report version with the stated limitations");
		expect(body).toContain("Replaces earlier feedback");
		expect(body).toContain('data-matching="true"');
		expect(body).toContain('data-matching="false"');
		expect(readFileSync(join(notes.root, "items/task.md"), "utf8")).toBe(REVIEW_TASK);
		editFile("items/result.md", reviewResult("Third report after acceptance"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).not.toContain('data-matching="true"'))),
			{ interval: "50 millis", times: 20 },
		);
	},
);

boardStory.it(
	"qualifies moved reviewed sources and links moved response records through their actual paths",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ notes, readResult, reviewReport }) {
		const saved = yield* reviewReport("response.moved", "revision");
		renameSync(join(notes.root, "items/result.md"), join(notes.root, "items/moved-result.md"));
		renameSync(join(notes.root, `responses/${saved.id}.md`), join(notes.root, "responses/moved-feedback.md"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain('data-matching="false"'))),
			{ interval: "50 millis", times: 20 },
		);
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain('href="/responses/moved-feedback.md"'))),
			{ interval: "50 millis", times: 20 },
		);
		yield* reviewReport("response.followup", "accept", saved.id);
		expect(yield* readResult()).toContain('Replaces earlier feedback <a href="/responses/moved-feedback.md">');
	},
);

boardStory.it(
	"keeps malformed or ambiguous feedback unknown rather than claiming no acceptance exists",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ notes, editFile, readResult, reviewReport }) {
		const saved = yield* reviewReport("response.valid", "accept");
		editFile("responses/broken.md", "---\nresponse: [unfinished\n");
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain("Some feedback couldn&#x27;t be read"))),
			{ interval: "50 millis", times: 20 },
		);
		const malformed = yield* readResult();
		expect(malformed).not.toMatch(/no feedback yet/iu);
		expect(malformed).toMatch(/<li><a [^>]*href="\/responses\/broken\.md">responses\/broken\.md<\/a>: [^<]+<\/li>/u);
		expect(malformed).toContain('href="/_board/system#source-problems"');
		// Re-establish readable history before introducing a duplicate identity.
		editFile("responses/broken.md", "Ordinary Markdown without a response record.\n");
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain('data-matching="true"'))),
			{ interval: "50 millis", times: 20 },
		);
		editFile("responses/broken.md", readFileSync(join(notes.root, `responses/${saved.id}.md`), "utf8"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) =>
				Effect.try(() => {
					expect(rendered).toContain("Some feedback couldn&#x27;t be read");
					for (const file of ["responses/broken.md", `responses/${saved.id}.md`]) {
						expect(rendered).toContain(`>${file}</a>: Another file uses the same response ID, ${saved.id}.</li>`);
					}
				}),
			),
			{ interval: "50 millis", times: 20 },
		);
	},
);

boardStory.it(
	"rejects ambiguous result identities and non-result work rather than guessing a reviewed item",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ client, editFile }) {
		editFile("items/duplicate.md", reviewResult("Duplicate"));
		yield* Effect.promise(() =>
			expect
				.poll(() =>
					client.run(client.api.result.run({ url: REVIEW_PATH })).then(
						() => "readable",
						(error: unknown) => String(error),
					),
				)
				.toContain("Conflict"),
		);
		yield* Effect.promise(() =>
			expect(client.run(client.api.result.run({ url: "/_board/item/work.keyboard/" }))).rejects.toMatchObject({ _tag: "Conflict" }),
		);
	},
);

boardStory.it(
	"pins CRLF source feedback to exact bytes rather than a normalized report",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ client, notes, editFile, readResult, reviewReport }) {
		const source = reviewResult().replaceAll("\n", "\r\n");
		editFile("items/result.md", source);
		yield* Effect.promise(() =>
			expect.poll(() => client.run(client.api.result.run({ url: REVIEW_PATH })).then((data) => data.revision)).toBe(revisionOf(source)),
		);
		const saved = yield* reviewReport("response.crlf", "accept");
		expect(saved.response.reviewedRevision).toBe(revisionOf(source));
		const reviewed = yield* readResult();
		expect(reviewed).toContain('data-matching="true"');
		expect(reviewed).toContain(revisionOf(source));
		expect(readFileSync(join(notes.root, "items/result.md"), "utf8")).toBe(source);
	},
);

boardStory.it(
	"keeps duplicate criterion identities unresolved instead of assigning claims to either criterion",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ editFile, readResult }) {
		editFile("items/task.md", REVIEW_TASK.replace("id: narrow", "id: focus"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) =>
				Effect.try(() => expect(rendered).toContain("Another check has the same ID, so evidence can&#x27;t be matched to this one")),
			),
			{ interval: "50 millis", times: 20 },
		);
	},
);
