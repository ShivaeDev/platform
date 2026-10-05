import { rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { afterEach, expect, it } from "vitest";
import { changesUntil, type Folder, folder, type RunningBoard, rawGet, startBoard, subscribe } from "#test/board.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});
async function search(query: string) {
	const response = await fetch(`${board.url}/_board/search?q=${encodeURIComponent(query)}`);
	expect(response.status).toBe(200);
	return response.json();
}

it("finds fixture phrases, encoded paths, duplicate headings, and reports bounded/empty results", async () => {
	notes = folder({ ...workspaceFixture(), "plans/home & more.md": "# Board\n\n## Evidence\n\nFirst.\n\n## Evidence\n\nUnique second phrase." });
	board = await startBoard(notes.root, "plans/home & more.md");
	const found = await search("unique second phrase");
	expect(found.results[0].href).toBe("/plans/home%20%26%20more.md#heading-evidence-2");
	expect((await search("project note")).results.length).toBeGreaterThan(0);
	expect((await search("project note")).results.length).toBeLessThanOrEqual(40);
	expect((await search("impossible-asdf")).total).toBe(0);
	expect(found.unavailable).toEqual([]);
	const blocked = await rawGet(board, "/_board/search?q=Unique", "evil.example");
	expect(blocked.status).toBe(403);
});

it("invalidates cached text after edits, additions, and deletions", async () => {
	notes = folder({ "note.md": "# Note\n\nOld phrase." });
	board = await startBoard(notes.root);
	const events = await subscribe(board);
	try {
		await events.next();
		expect((await search("old phrase")).total).toBe(1);
		notes.write("note.md", "# Note\n\nFresh phrase.");
		await changesUntil(events, "note.md");
		expect((await search("old phrase")).total).toBe(0);
		expect((await search("fresh phrase")).total).toBe(1);
		notes.write("new.md", "# New\n\nAdded phrase.");
		await changesUntil(events, "new.md");
		expect((await search("added phrase")).total).toBe(1);
		rmSync(join(notes.root, "new.md"));
		await changesUntil(events, "new.md");
		expect((await search("added phrase")).total).toBe(0);
	} finally {
		events.close();
	}
});

it("excludes hidden files and root-escaping symlinks and discloses unreadable files", async () => {
	const outside = folder({ "outside.md": "# Outside secret" });
	notes = folder({ ".hidden.md": "# Hidden secret", "note.md": "# Visible", "unreadable.md": "# Unreadable secret" });
	symlinkSync(join(outside.root, "outside.md"), join(notes.root, "escape.md"));
	try {
		board = await startBoard(notes.root, undefined, (fs) => ({
			...fs,
			readFileString: (file, options) =>
				file.endsWith("unreadable.md")
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
		}));
		const found = await search("secret");
		expect(found.total).toBe(0);
		expect(found.unavailable).toEqual(["unreadable.md"]);
	} finally {
		outside.remove();
	}
});
