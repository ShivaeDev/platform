import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});

it("keeps recorded answers readable when a question closes or its option labels become duplicated", async () => {
	notes = folder({ "question.md": inboxQuestion });
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	const client = browserClient(board.url);
	try {
		const preview = await client.run(client.responses.question.run({ item: "question.storage", request: "answer" }));
		const captured = await client.mutate(
			client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
		);
		await client.mutate(
			client.responses.recordResponse.run({
				answers: [{ prompt: "answer", selected: ["option-1"], text: "Keep readable project files." }],
				author: "Casey",
				body: "",
				id: "response.storage",
				question: captured.id,
				type: "answer",
			}),
		);
		for (const [source, message] of [
			[inboxQuestion.replace("status: open", "status: closed"), "Question closed"],
			[inboxQuestion.replace("label: Use a database", "label: Keep local files"), "Question option labels must be unique."],
		]) {
			notes.write("question.md", source ?? "");
			const page = await rawGet(board, "/_board/item/question.storage/");
			expect(page.status).toBe(200);
			expect(page.body).toContain(message);
			expect(page.body).toContain("Recorded responses");
			expect(page.body).toContain("Keep readable project files.");
			expect(page.body).toContain("Earlier reviewed context");
			expect(page.body).not.toContain("ResponseFailed");
			expect(page.body).not.toContain('id="response-form"');
		}
	} finally {
		client.registry.dispose();
	}
});
