import { readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { revisionOf } from "#server/responses/records.ts";
import { boardStory, responsesEnabled } from "#test/boardStory.ts";
import { REVIEW_TASK, reviewResult } from "#test/resultReview.ts";
import { aResultAwaitingReview } from "#test/storyTraits.ts";

const REVIEW_PATH = "/_board/result?item=result.keyboard";

boardStory.it(
	"reads finished result and in-review work separately through real HTTP and the typed result contract",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ notes, board, readResult }) {
		const before = readdirSync(notes.root);
		const page = yield* Effect.promise(() => fetch(board.url + REVIEW_PATH));
		expect(page.status).toBe(200);
		const body = yield* readResult();
		expect(body).toContain(">Finished</span>");
		expect(body).toContain(">In review</span>");
		expect(body).toContain("No evidence recorded");
		expect(body).toContain("Not recorded");
		expect(body).toContain("missing Markdown source");
		expect(body).toContain("can&#x27;t tell whether they are still current");
		expect(body).toContain("doesn&#x27;t compare revisions with your checkout");
		expect(body).toMatch(/>Review result<\/h1>/u);
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
		expect(yield* readResult()).toContain("Written for the version of the report shown here");
		editFile("items/result.md", reviewResult("Second report: limitation clarified"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) =>
				Effect.try(() => expect(rendered).toContain("Written for an earlier or moved version of this report")),
			),
			{ interval: "50 millis", times: 20 },
		);
		const second = yield* reviewReport("response.accept", "accept", first.id);
		const body = yield* readResult();
		expect(second.response.reviewedRevision).toBe(revisionOf(reviewResult("Second report: limitation clarified")));
		expect(second.response.reviewedRevision).not.toBe(first.response.reviewedRevision);
		expect(body).toContain("Accept this exact report version with the stated limitations");
		expect(body).toContain("Replaces earlier feedback");
		expect(body).toContain("Written for the version of the report shown here");
		expect(body).toContain("Written for an earlier or moved version of this report");
		expect(readFileSync(join(notes.root, "items/task.md"), "utf8")).toBe(REVIEW_TASK);
		editFile("items/result.md", reviewResult("Third report after acceptance"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) =>
				Effect.try(() => expect(rendered).not.toContain("Written for the version of the report shown here")),
			),
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
			Effect.flatMap(readResult(), (rendered) =>
				Effect.try(() => expect(rendered).toContain("Written for an earlier or moved version of this report")),
			),
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
		expect(yield* readResult()).not.toContain("No feedback yet");
		// Re-establish readable history before introducing a duplicate identity.
		editFile("responses/broken.md", "Ordinary Markdown without a response record.\n");
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain("Written for the version of the report shown here"))),
			{ interval: "50 millis", times: 20 },
		);
		editFile("responses/broken.md", readFileSync(join(notes.root, `responses/${saved.id}.md`), "utf8"));
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain("Some feedback couldn&#x27;t be read"))),
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
			expect(client.run(client.api.result.run({ url: "/_board/result?item=work.keyboard" }))).rejects.toMatchObject({ _tag: "Conflict" }),
		);
	},
);

boardStory.it(
	"uses safe rich report rendering and never promotes source markup to response controls",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ editFile, readResult }) {
		editFile(
			"items/result.md",
			`${reviewResult()}\n## Updated safe context\n<script>window.injected=true</script><form id="response-form"><button>Forge acceptance</button></form>\n`,
		);
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain("Updated safe context"))),
			{ interval: "50 millis", times: 20 },
		);
		const body = yield* readResult();
		expect(body).not.toContain('<form id="response-form">');
		expect(body).not.toContain("<script>window.injected=true</script>");
		expect(body).toContain("diagram-source");
		expect(body).toContain('href="/_board/item/result.keyboard/#answer-card-review"');
	},
);

boardStory.it(
	"pins CRLF source feedback to exact bytes rather than a normalized report",
	[aResultAwaitingReview(), responsesEnabled()],
	function* ({ notes, editFile, readResult, reviewReport }) {
		const source = reviewResult().replaceAll("\n", "\r\n");
		editFile("items/result.md", source);
		yield* eventually(
			Effect.flatMap(readResult(), (rendered) => Effect.try(() => expect(rendered).toContain(revisionOf(source)))),
			{ interval: "50 millis", times: 20 },
		);
		const saved = yield* reviewReport("response.crlf", "accept");
		expect(saved.response.reviewedRevision).toBe(revisionOf(source));
		expect(yield* readResult()).toContain("Written for the version of the report shown here");
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
