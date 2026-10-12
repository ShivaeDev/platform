import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, rawPost, startBoard } from "#test/board.ts";
import { changesUntil, rpcSearch, subscribe } from "#test/nativeRpc.ts";
import { searchPrivacyFixture } from "#test/searchPrivacyFixture.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

let notes: Folder;
let board: RunningBoard;

afterEach(() => {
	notes?.remove();
});

function search(query: string) {
	return rpcSearch(board, query);
}

it.live("finds fixture phrases, encoded paths, duplicate headings, and reports bounded/empty results", function* () {
	notes = folder({ ...workspaceFixture(), "plans/home & more.md": "# Board\n\n## Evidence\n\nFirst.\n\n## Evidence\n\nUnique second phrase." });
	board = yield* startBoard(notes.root, "plans/home & more.md");
	const found = yield* search("unique second phrase");
	expect(found.results[0]?.href).toBe("/plans/home%20%26%20more.md#heading-evidence-2");
	expect((yield* search("project note")).results.length).toBeGreaterThan(0);
	expect((yield* search("project note")).results.length).toBeLessThanOrEqual(40);
	expect((yield* search("impossible-asdf")).total).toBe(0);
	expect(found.unavailable).toEqual([]);
	const blocked = yield* rawPost(board, "/_board/rpc", { host: "evil.example" });
	expect(blocked.status).toBe(403);
});

it.live("invalidates cached text after edits, additions, and deletions", function* () {
	notes = folder({ "note.md": "# Note\n\nOld phrase." });
	board = yield* startBoard(notes.root);
	const events = yield* subscribe(board);
	try {
		yield* events.next();
		expect((yield* search("old phrase")).total).toBe(1);
		notes.write("note.md", "# Note\n\nFresh phrase.");
		yield* changesUntil(events, "note.md");
		expect((yield* search("old phrase")).total).toBe(0);
		expect((yield* search("fresh phrase")).total).toBe(1);
		notes.write("new.md", "# New\n\nAdded phrase.");
		yield* changesUntil(events, "new.md");
		expect((yield* search("added phrase")).total).toBe(1);
		rmSync(join(notes.root, "new.md"));
		yield* changesUntil(events, "new.md");
		expect((yield* search("added phrase")).total).toBe(0);
	} finally {
		yield* events.close();
	}
});

it.live("excludes hidden files and root-escaping symlinks and discloses unreadable files", function* () {
	const privacy = searchPrivacyFixture();
	notes = privacy.notes;
	try {
		board = yield* startBoard(notes.root, undefined, (fs) => ({
			...fs,
			readFileString: (file, options) =>
				file.endsWith("unreadable.md")
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
		}));
		const found = yield* search("secret");
		expect(found.total).toBe(0);
		expect(found.unavailable).toEqual(["unreadable.md"]);
	} finally {
		privacy.outside.remove();
	}
});
