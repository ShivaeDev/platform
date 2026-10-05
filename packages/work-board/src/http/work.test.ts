import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { changesUntil, type Folder, folder, type RunningBoard, rawGet, startBoard, subscribe } from "#test/support/board.ts";
import { viewsFixture } from "#test/support/viewsFixture.ts";

let notes: Folder;
let board: RunningBoard;
beforeEach(async () => {
	notes = folder(viewsFixture());
	board = await startBoard(notes.root, "legacy.md");
});
afterEach(async () => {
	await board.stop();
	notes.remove();
});

it("projects explicitly shared items without inferring work from legacy headings or board definitions", async () => {
	const all = await rawGet(board, "/_board/work");
	expect(all.body).toContain("4 shown · 4 items");
	expect(all.body).not.toContain('data-item="board.review"');
	expect(all.body).not.toContain("Plain item");
	const review = await rawGet(board, "/_board/work?board=board.review&item=work.search");
	expect(review.body).toContain("3 shown · 3 items");
	expect(review.body).toContain('data-item="work.search"');
	expect(review.body).toContain('href="/evidence.md"');
	expect(review.body).toContain("not independently verified");
	const shared = await rawGet(board, "/_board/work?board=board.shared&item=work.search");
	expect(shared.body).toContain("2 shown · 2 items");
	expect(shared.body).toContain('data-key="detail:work.search"');
	expect((await rawGet(board, "/")).body).toContain('class="item"');
	expect((await rawGet(board, "/boards/review.md")).body).toContain("View this board");
});

it("filters exact recorded fields, sorts consistently, and retains detail outside the current projection", async () => {
	const result = await rawGet(
		board,
		"/_board/work?board=board.review&owner=value%3Aagent-navigation&status=value%3Ain-review&q=search&item=work.other",
	);
	expect(result.body).toContain("1 shown · 3 items");
	expect(result.body).toContain("outside the current board or filters");
	expect(result.body).toContain('data-key="detail:work.other"');
	const missing = await rawGet(board, "/_board/work?board=board.review&owner=missing&status=missing");
	expect(missing.body).toContain("1 shown · 3 items");
	expect(missing.body).toContain('data-item="work.unassigned"');
	const sorted = await rawGet(board, "/_board/work?board=board.shared&sort=title");
	expect(sorted.body.indexOf('data-item="decision.search"')).toBeLessThan(sorted.body.indexOf('data-item="work.search"'));
	const empty = await rawGet(board, "/_board/work?board=board.review&status=value%3Agone");
	expect(empty.body).toContain("0 shown · 3 items");
	expect(empty.body).toContain("gone (no current matches)");
});

it("explains missing and ambiguous members and selections without silently choosing a source", async () => {
	notes.write("duplicate.md", "---\nid: work.search\n---\n# Duplicate");
	notes.write("boards/review.md", "---\nid: board.review\nkind: board\nitems: [work.search, work.other, work.other, gone]\n---\n# Review work");
	const result = await rawGet(board, "/_board/work?board=board.review&item=work.search");
	expect(result.body).toContain("1 shown · 1 items");
	expect(result.body).toContain("repeated membership, shown once");
	expect(result.body).toContain("gone: missing or invalid ID");
	expect(result.body).toContain("work.search: ambiguous ID");
	expect(result.body).toContain("No source was selected");
	expect(result.body).not.toContain('data-item="work.search"');
	expect((await rawGet(board, "/_board/work?board=gone")).status).toBe(404);
});

it("refreshes counts and explains a removed selection while keeping URL filters", async () => {
	const events = await subscribe(board);
	await events.next();
	try {
		const path = "/_board/work?board=board.review&status=value%3Ain-review&item=work.search";
		expect((await rawGet(board, path)).body).toContain("1 shown · 3 items");
		notes.write("items/search & review.md", viewsFixture()["items/search & review.md"]?.replace("status: in-review", "status: done") ?? "");
		await changesUntil(events, "items/search & review.md");
		const changed = await rawGet(board, path);
		expect(changed.body).toContain("0 shown · 3 items");
		expect(changed.body).toContain("in-review (no current matches)");
		expect(changed.body).toContain("outside the current board or filters");
		rmSync(join(notes.root, "items/search & review.md"));
		await changesUntil(events, "items/search & review.md");
		expect((await rawGet(board, path)).body).toContain("is missing or its identity changed");
	} finally {
		events.close();
	}
});

it("refuses validated view counts when the workspace index is incomplete", async () => {
	await board.stop();
	board = await startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("other.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	const result = await rawGet(board, "/_board/work?board=board.review");
	expect(result.status).toBe(503);
	expect(result.body).toContain("Work identity and view counts cannot be validated");
	expect(result.body).not.toContain("shown ·");
});
