import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { changesUntil, rpcDocument, rpcWatcher } from "#test/nativeRpc.ts";
import { unwritableRoot } from "#test/unwritableRoot.ts";

boardStory.it(
	"delivers live document edits to a connected client when the board cannot write its root",
	[projectFiles({ "note.md": "# Before" }), unwritableRoot("EACCES")],
	function* ({ board, editFile, watchProject }) {
		const events = yield* watchProject();
		yield* outcomes({
			"document before edit": [rpcDocument(board, "/note.md").pipe(Effect.map((document) => document.source)), "# Before"],
			"initial live event": [events.next(), { _tag: "Resync" }],
			"watcher ready": [rpcWatcher(board).pipe(Effect.map((state) => state.watching)), true],
		});

		editFile("note.md", "# After");

		yield* outcomes({
			"change announcement": [
				changesUntil(events, "note.md"),
				expect.objectContaining({
					_tag: "Changed",
					keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "note.md" }]),
				}),
			],
			"document after edit": [rpcDocument(board, "/note.md").pipe(Effect.map((document) => document.source)), "# After"],
		});
		yield* events.close();
	},
);
