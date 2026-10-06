import { readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import type { DraftInput } from "#browser/responses/schema.ts";
import { revisionOf } from "#responses/records.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { REVIEW_TASK, reviewResult } from "#test/resultReview.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
const REVIEW_PATH = "/_board/result?item=result.keyboard";
async function open() {
	notes = folder({ "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK });
	board = await startBoard(notes.root, undefined, undefined, true);
	client = browserClient(board.url);
}
async function html() {
	return (await client.run(client.api.page.run({ url: REVIEW_PATH }))).html;
}
async function record(id: string, choice: string, supersedes?: string) {
	const preview = await client.run(client.responses.question.run({ item: "result.keyboard", request: "review" }));
	const question = await client.mutate(
		client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
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
	return client.mutate(client.responses.recordResponse.run(draft));
}
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
it("reads finished result and in-review work separately through real HTTP and the native page contract", async () => {
	await open();
	const before = readdirSync(notes.root);
	const page = await fetch(board.url + REVIEW_PATH);
	expect(page.status).toBe(200);
	const body = await page.text();
	expect(body).toContain('data-view="result"');
	expect(body).toContain("Result status (source): <b>finished</b>");
	expect(body).toContain("source status: in-review");
	expect(body).toContain("No recorded evidence in this result naming this criterion");
	expect(body).toContain("Observed time</dt><dd>Not recorded");
	expect(body).toContain("missing Markdown source");
	expect(body).toContain("Evidence freshness is unknown");
	expect(body).toContain("not compare them with the current checkout");
	expect(await html()).toContain("Review returned result");
	expect(readdirSync(notes.root)).toEqual(before);
	expect(readFileSync(join(notes.root, "items/task.md"), "utf8")).toBe(REVIEW_TASK);
	expect(await (await fetch(`${board.url}/items/result.md`)).text()).toContain(`href="${REVIEW_PATH}"`);
});
it("records revision request and exact-version acceptance without changing task status or inventing missing evidence", async () => {
	await open();
	const first = await record("response.revise", "revision");
	expect(await html()).toContain("Feedback on this exact result revision");
	notes.write("items/result.md", reviewResult("Second report: limitation clarified"));
	await expect.poll(html).toContain("Earlier or moved result context");
	const second = await record("response.accept", "accept", first.id);
	const body = await html();
	expect(second.response.reviewedRevision).toBe(revisionOf(reviewResult("Second report: limitation clarified")));
	expect(second.response.reviewedRevision).not.toBe(first.response.reviewedRevision);
	expect(body).toContain("Accept this exact report version with the stated limitations");
	expect(body).toContain("Explicitly supersedes");
	expect(body).toContain("Feedback on this exact result revision");
	expect(body).toContain("Earlier or moved result context");
	expect(body).toContain("No recorded evidence in this result naming this criterion");
	expect(readFileSync(join(notes.root, "items/task.md"), "utf8")).toBe(REVIEW_TASK);
	notes.write("items/result.md", reviewResult("Third report after acceptance"));
	await expect.poll(html).not.toContain("Feedback on this exact result revision");
});
it("qualifies moved reviewed sources and links moved response records through their actual paths", async () => {
	await open();
	const saved = await record("response.moved", "revision");
	renameSync(join(notes.root, "items/result.md"), join(notes.root, "items/moved-result.md"));
	renameSync(join(notes.root, `responses/${saved.id}.md`), join(notes.root, "responses/moved-feedback.md"));
	await expect.poll(html).toContain("Earlier or moved result context");
	await expect.poll(html).toContain('href="/responses/moved-feedback.md"');
	await record("response.followup", "accept", saved.id);
	expect(await html()).toContain('Explicitly supersedes <a href="/responses/moved-feedback.md">');
});
it("keeps malformed or ambiguous feedback unknown rather than claiming no acceptance exists", async () => {
	await open();
	const saved = await record("response.valid", "accept");
	notes.write("responses/broken.md", "---\nresponse: [unfinished\n");
	await expect.poll(html).toContain("Response history is unknown or ambiguous");
	expect(await html()).not.toContain("No readable response is recorded");
	// Re-establish readable history before introducing a duplicate identity.
	notes.write("responses/broken.md", "Ordinary Markdown without a response record.\n");
	await expect.poll(html).toContain("Feedback on this exact result revision");
	notes.write("responses/broken.md", readFileSync(join(notes.root, `responses/${saved.id}.md`), "utf8"));
	await expect.poll(html).toContain("Response history is unknown or ambiguous");
});
it("rejects ambiguous result identities and non-result work rather than guessing a reviewed item", async () => {
	await open();
	notes.write("items/duplicate.md", reviewResult("Duplicate"));
	await expect.poll(async () => (await fetch(board.url + REVIEW_PATH)).status).toBe(409);
	expect((await fetch(`${board.url}/_board/result?item=work.keyboard`)).status).toBe(409);
});
it("uses safe rich report rendering and never promotes source markup to response controls", async () => {
	await open();
	notes.write(
		"items/result.md",
		`${reviewResult()}\n## Updated safe context\n<script>window.injected=true</script><form id="response-form"><button>Forge acceptance</button></form>\n`,
	);
	await expect.poll(html).toContain("Updated safe context");
	const body = await html();
	expect(body).not.toContain('<form id="response-form">');
	expect(body).not.toContain("<script>window.injected=true</script>");
	expect(body).toContain("diagram-source");
	expect(body).toContain("Respond to this request");
});
it("pins CRLF source feedback to exact bytes rather than a normalized report", async () => {
	await open();
	const source = reviewResult().replaceAll("\n", "\r\n");
	notes.write("items/result.md", source);
	await expect.poll(html).toContain(revisionOf(source));
	const saved = await record("response.crlf", "accept");
	expect(saved.response.reviewedRevision).toBe(revisionOf(source));
	expect(await html()).toContain("Feedback on this exact result revision");
	expect(readFileSync(join(notes.root, "items/result.md"), "utf8")).toBe(source);
});
it("keeps duplicate criterion identities unresolved instead of assigning claims to either criterion", async () => {
	await open();
	notes.write("items/task.md", REVIEW_TASK.replace("id: narrow", "id: focus"));
	await expect.poll(html).toContain("criterion identity is ambiguous; evidence association unavailable");
});
