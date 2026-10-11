import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { inboxFixture } from "#test/inboxFixture.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});

it("counts registered questions on ordinary attention sources without counting the captured copy twice", async () => {
	const source = inboxFixture()["responses/decision.md"]?.replace("managed: true", "managed: false") ?? "";
	notes = folder({ "decision.md": source, "fleet.md": "---\nid: task.fleet\n---\n# Work\n" });
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	const client = browserClient(board.url);
	try {
		const preview = await client.run(client.responses.question.run({ item: "decision.delivery", request: "delivery" }));
		const question = await client.mutate(
			client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
		);
		expect((await rawGet(board, "/_board/inbox")).body).toContain("1 waiting");
		await client.mutate(
			client.responses.recordResponse.run({
				author: "Casey",
				body: "Proceed with local delivery",
				id: "response.delivery",
				question: question.id,
				type: "answer",
			}),
		);
		expect((await rawGet(board, "/_board/inbox")).body).toContain("0 waiting");
	} finally {
		client.registry.dispose();
	}
});

it("serves the Inbox count on reader pages and exposes waiting work in Overview, cards and tables", async () => {
	notes = folder(inboxFixture());
	board = await startBoard(notes.root);
	for (const path of ["/_board/inbox", "/question.md", "/_board/work?view=board", "/_board/overview", "/_board/changes", "/_board/start"]) {
		const response = await rawGet(board, path);
		expect(response.status).toBe(200);
		expect(response.body).toContain('id="inbox-count" class="inbox-count" aria-label="4 waiting">4</span>');
	}
	const inbox = (await rawGet(board, "/_board/inbox")).body;
	expect(inbox).toContain("4 waiting");
	expect(inbox).toContain("Review keyboard behavior");
	expect(inbox).toContain('data-modified="');
	for (const path of ["/_board/overview", "/_board/work?view=board", "/_board/work?view=table"]) {
		const view = (await rawGet(board, path)).body;
		expect(view).toContain("Waiting on you");
		expect(view).not.toContain("All quiet");
	}
	const question = (await rawGet(board, "/question.md")).body;
	expect(question).toContain("Keep local files · Recommended");
	expect(question).toContain('data-choice="option-1"');
	expect(question).toContain("Read-only mode");
	expect(question).toContain("Fleet records (1)");
	expect(question).toContain('<details data-key="fleet-records">');
});
