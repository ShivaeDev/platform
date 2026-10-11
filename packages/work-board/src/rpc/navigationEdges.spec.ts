import { chmodSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(() => {
	notes?.remove();
});
it.live("returns an empty tree with a known zero Inbox count for an empty workspace", function* () {
	notes = folder({});
	board = yield* startBoard(notes.root);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(resource) => Effect.sync(() => resource.registry.dispose()),
	);
	expect(yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "" })))).toEqual({
		inboxCount: 0,
		records: { active: false, count: 0, files: [] },
		tree: { active: false, count: 0, files: [], folders: [], name: "", path: "" },
	});
});
it.live("retains listed files with an unknown Inbox count when a source cannot be indexed", function* () {
	notes = folder({ "note.md": "# Note", "question.md": inboxQuestion });
	board = yield* startBoard(notes.root);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(resource) => Effect.sync(() => resource.registry.dispose()),
	);
	chmodSync(join(notes.root, "note.md"), 0o000);
	try {
		const data = yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "note.md" })));
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
