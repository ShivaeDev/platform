import { chmodSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});

it("returns an empty tree with a known zero Inbox count for an empty workspace", async () => {
	notes = folder({});
	board = await startBoard(notes.root);
	client = browserClient(board.url);
	expect(await client.run(client.api.navigation.run({ current: "" }))).toEqual({
		inboxCount: 0,
		records: { active: false, count: 0, files: [] },
		tree: { active: false, count: 0, files: [], folders: [], name: "", path: "" },
	});
});

it("retains listed files with an unknown Inbox count when a source cannot be indexed", async () => {
	notes = folder({ "note.md": "# Note", "question.md": inboxQuestion });
	board = await startBoard(notes.root);
	client = browserClient(board.url);
	chmodSync(join(notes.root, "note.md"), 0o000);
	try {
		const data = await client.run(client.api.navigation.run({ current: "note.md" }));
		expect(data.inboxCount).toBeNull();
		expect(data.tree).toMatchObject({
			active: true,
			count: 2,
			files: [
				{ current: true, path: "note.md" },
				{ current: false, path: "question.md" },
			],
		});
	} finally {
		chmodSync(join(notes.root, "note.md"), 0o644);
	}
});
