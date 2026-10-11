import { readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#browser/client.ts";
import type { DraftInput } from "#browser/responses/schema.ts";
import { revisionOf } from "#responses/records.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { REVIEW_TASK, reviewResult } from "#test/resultReview.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;

const REVIEW_PATH = "/_board/result?item=result.keyboard";

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK });
	board = yield* startBoard(notes.root, undefined, undefined, true);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
});

const html = Effect.fn("Test.html")(function* () {
	return (yield* Effect.promise(() => client.run(client.api.page.run({ url: REVIEW_PATH })))).html;
});

const record = Effect.fn("Test.record")(function* (id: string, choice: string, supersedes?: string) {
	const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "result.keyboard", request: "review" })));
	const question = yield* Effect.promise(() =>
		client.mutate(client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision })),
	);
	const draft: DraftInput = {
		answers: [
			{
				prompt: "verdict",
				selected: [choice],
				text:
					choice === "revision"
						? "Please record the narrow-screen limitation."
						: "Accept this report version; the missing criterion is still not proved.",
			},
		],
		author: "maintainer",
		body: "Human review of the stated limitations.",
		id,
		question: question.id,
		...(supersedes ? { supersedes } : {}),
		type: "answer",
	};
	return yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(draft)));
});

afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

it.live("reads finished result and in-review work separately through real HTTP and the native page contract", function* () {
	yield* open();
	const before = readdirSync(notes.root);
	const page = yield* Effect.promise(() => fetch(board.url + REVIEW_PATH));
	expect(page.status).toBe(200);
	const body = yield* Effect.promise(() => page.text());
	expect(body).toContain('data-view="result"');
	expect(body).toContain("Result status (source): <b>finished</b>");
	expect(body).toContain("source status: in-review");
	expect(body).toContain("No recorded evidence in this result naming this criterion");
	expect(body).toContain("Observed time</dt><dd>Not recorded");
	expect(body).toContain("missing Markdown source");
	expect(body).toContain("Evidence freshness is unknown");
	expect(body).toContain("not compare them with the current checkout");
	expect(yield* html()).toContain("Review returned result");
	expect(readdirSync(notes.root)).toEqual(before);
	expect(readFileSync(join(notes.root, "items/task.md"), "utf8")).toBe(REVIEW_TASK);
	expect(yield* Effect.promise(async () => (await fetch(`${board.url}/items/result.md`)).text())).toContain(`href="${REVIEW_PATH}"`);
});

it.live("records revision request and exact-version acceptance without changing task status or inventing missing evidence", function* () {
	yield* open();
	const first = yield* record("response.revise", "revision");
	expect(yield* html()).toContain("Feedback on this exact result revision");
	notes.write("items/result.md", reviewResult("Second report: limitation clarified"));
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain("Earlier or moved result context"))),
		{ interval: "50 millis", times: 20 },
	);
	const second = yield* record("response.accept", "accept", first.id);
	const body = yield* html();
	expect(second.response.reviewedRevision).toBe(revisionOf(reviewResult("Second report: limitation clarified")));
	expect(second.response.reviewedRevision).not.toBe(first.response.reviewedRevision);
	expect(body).toContain("Accept this exact report version with the stated limitations");
	expect(body).toContain("Explicitly supersedes");
	expect(body).toContain("Feedback on this exact result revision");
	expect(body).toContain("Earlier or moved result context");
	expect(body).toContain("No recorded evidence in this result naming this criterion");
	expect(readFileSync(join(notes.root, "items/task.md"), "utf8")).toBe(REVIEW_TASK);
	notes.write("items/result.md", reviewResult("Third report after acceptance"));
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).not.toContain("Feedback on this exact result revision"))),
		{ interval: "50 millis", times: 20 },
	);
});

it.live("qualifies moved reviewed sources and links moved response records through their actual paths", function* () {
	yield* open();
	const saved = yield* record("response.moved", "revision");
	renameSync(join(notes.root, "items/result.md"), join(notes.root, "items/moved-result.md"));
	renameSync(join(notes.root, `responses/${saved.id}.md`), join(notes.root, "responses/moved-feedback.md"));
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain("Earlier or moved result context"))),
		{ interval: "50 millis", times: 20 },
	);
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain('href="/responses/moved-feedback.md"'))),
		{ interval: "50 millis", times: 20 },
	);
	yield* record("response.followup", "accept", saved.id);
	expect(yield* html()).toContain('Explicitly supersedes <a href="/responses/moved-feedback.md">');
});

it.live("keeps malformed or ambiguous feedback unknown rather than claiming no acceptance exists", function* () {
	yield* open();
	const saved = yield* record("response.valid", "accept");
	notes.write("responses/broken.md", "---\nresponse: [unfinished\n");
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain("Response history is unknown or ambiguous"))),
		{ interval: "50 millis", times: 20 },
	);
	expect(yield* html()).not.toContain("No readable response is recorded");
	// Re-establish readable history before introducing a duplicate identity.
	notes.write("responses/broken.md", "Ordinary Markdown without a response record.\n");
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain("Feedback on this exact result revision"))),
		{ interval: "50 millis", times: 20 },
	);
	notes.write("responses/broken.md", readFileSync(join(notes.root, `responses/${saved.id}.md`), "utf8"));
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain("Response history is unknown or ambiguous"))),
		{ interval: "50 millis", times: 20 },
	);
});

it.live("rejects ambiguous result identities and non-result work rather than guessing a reviewed item", function* () {
	yield* open();
	notes.write("items/duplicate.md", reviewResult("Duplicate"));
	yield* Effect.promise(async () => expect.poll(async () => (await fetch(board.url + REVIEW_PATH)).status).toBe(409));
	expect((yield* Effect.promise(() => fetch(`${board.url}/_board/result?item=work.keyboard`))).status).toBe(409);
});

it.live("uses safe rich report rendering and never promotes source markup to response controls", function* () {
	yield* open();
	notes.write(
		"items/result.md",
		`${reviewResult()}\n## Updated safe context\n<script>window.injected=true</script><form id="response-form"><button>Forge acceptance</button></form>\n`,
	);
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain("Updated safe context"))),
		{ interval: "50 millis", times: 20 },
	);
	const body = yield* html();
	expect(body).not.toContain('<form id="response-form">');
	expect(body).not.toContain("<script>window.injected=true</script>");
	expect(body).toContain("diagram-source");
	expect(body).toContain("Respond to this request");
});

it.live("pins CRLF source feedback to exact bytes rather than a normalized report", function* () {
	yield* open();
	const source = reviewResult().replaceAll("\n", "\r\n");
	notes.write("items/result.md", source);
	yield* eventually(
		Effect.flatMap(html(), (rendered) => Effect.try(() => expect(rendered).toContain(revisionOf(source)))),
		{ interval: "50 millis", times: 20 },
	);
	const saved = yield* record("response.crlf", "accept");
	expect(saved.response.reviewedRevision).toBe(revisionOf(source));
	expect(yield* html()).toContain("Feedback on this exact result revision");
	expect(readFileSync(join(notes.root, "items/result.md"), "utf8")).toBe(source);
});

it.live("keeps duplicate criterion identities unresolved instead of assigning claims to either criterion", function* () {
	yield* open();
	notes.write("items/task.md", REVIEW_TASK.replace("id: narrow", "id: focus"));
	yield* eventually(
		Effect.flatMap(html(), (rendered) =>
			Effect.try(() => expect(rendered).toContain("criterion identity is ambiguous; evidence association unavailable")),
		),
		{ interval: "50 millis", times: 20 },
	);
});
