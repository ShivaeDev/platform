import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";

const SOURCE =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [reviewer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";
let notes: Folder;
const boards: RunningBoard[] = [];
const clients: ReturnType<typeof browserClient>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		client.registry.dispose();
	}
	await Promise.all(boards.splice(0).map((board) => board.stop()));
	notes?.remove();
});
async function connectBoard() {
	const board = await startBoard(notes.root, undefined, undefined, true);
	boards.push(board);
	const result = browserClient(board.url);
	clients.push(result);
	return result;
}
it("preserves the winning response across concurrent HTTP servers and retries after restart", async () => {
	notes = folder({ "task.md": SOURCE });
	const first = await connectBoard();
	const second = await connectBoard();
	const preview = await first.run(first.responses.question.run({ item: "task.choice", request: "direction" }));
	const question = await first.mutate(
		first.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
	);
	const input = { author: "reviewer", body: "First direction", id: "response.concurrent", question: question.id, type: "answer" as const };
	const attempts = await Promise.allSettled([
		first.mutate(first.responses.recordResponse.run(input)),
		second.mutate(second.responses.recordResponse.run({ ...input, body: "Other direction" })),
	]);
	expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
	expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
	const winner = (await first.run(first.responses.responses.run({ question: question.id }))).responses[0];
	expect(winner).toBeDefined();
	const bytes = await readFile(join(notes.root, "responses/response.concurrent.md"), "utf8");
	for (const running of boards.splice(0)) {
		await running.stop();
	}
	const restarted = await connectBoard();
	expect(await restarted.mutate(restarted.responses.recordResponse.run({ ...input, body: winner?.body ?? "" }))).toEqual(winner);
	expect(await readFile(join(notes.root, "responses/response.concurrent.md"), "utf8")).toBe(bytes);
	expect(await readFile(join(notes.root, "task.md"), "utf8")).toBe(SOURCE);
	expect(
		await restarted.mutate(
			restarted.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
		),
	).toEqual(question);
});
