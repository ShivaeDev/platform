import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, rawPost, startBoard } from "#test/board.ts";
import { changesUntil, rpcSearch, subscribe } from "#test/nativeRpc.ts";
import { searchPrivacyFixture } from "#test/searchPrivacyFixture.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});
function search(query: string) {
	return rpcSearch(board, query);
}

it("finds fixture phrases, encoded paths, duplicate headings, and reports bounded/empty results", async () => {
	notes = folder({ ...workspaceFixture(), "plans/home & more.md": "# Board\n\n## Evidence\n\nFirst.\n\n## Evidence\n\nUnique second phrase." });
	board = await startBoard(notes.root, "plans/home & more.md");
	const found = await search("unique second phrase");
	expect(found.results[0]?.href).toBe("/plans/home%20%26%20more.md#heading-evidence-2");
	expect((await search("project note")).results.length).toBeGreaterThan(0);
	expect((await search("project note")).results.length).toBeLessThanOrEqual(40);
	expect((await search("impossible-asdf")).total).toBe(0);
	expect(found.unavailable).toEqual([]);
	const blocked = await rawPost(board, "/_board/rpc", { host: "evil.example" });
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
	const privacy = searchPrivacyFixture();
	notes = privacy.notes;
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
		privacy.outside.remove();
	}
});
