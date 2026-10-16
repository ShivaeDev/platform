import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer, PlatformError } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { changesUntil, subscribe } from "#test/nativeRpc.ts";
import { viewsFixture } from "#test/viewsFixture.ts";

let notes: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	notes = folder(viewsFixture());
	board = yield* startBoard(notes.root, "legacy.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

effectApp("projects explicitly shared items without inferring work from legacy headings or board definitions", function* () {
	const all = yield* rawGet(board, "/_board/work?view=board");
	expect(all.body).toContain("2 shown · 2 items");
	expect(all.body).not.toContain('data-item="board.review"');
	expect(all.body).not.toContain("Plain item");
	const review = yield* rawGet(board, "/_board/work?view=board&board=board.review&item=work.search");
	expect(review.body).toContain("2 shown · 2 items");
	expect(review.body).toContain('data-item="work.search"');
	expect(review.body).toContain('href="/evidence.md"');
	expect(review.body).toContain("not independently verified");
	const shared = yield* rawGet(board, "/_board/work?view=board&board=board.shared&item=work.search");
	expect(shared.body).toContain("1 shown · 1 items");
	expect(shared.body).toContain('data-key="detail:work.search"');
	expect((yield* rawGet(board, "/")).body).toContain('class="item"');
	expect((yield* rawGet(board, "/boards/review.md")).body).toContain("View this board");
});

effectApp("filters exact recorded fields, sorts consistently, and retains detail outside the current projection", function* () {
	const result = yield* rawGet(
		board,
		"/_board/work?view=board&board=board.review&owner=value%3Aagent-navigation&status=value%3Ain-review&q=search&item=work.other",
	);
	expect(result.body).toContain("1 shown · 2 items");
	expect(result.body).toContain("outside the current board or filters");
	expect(result.body).toContain('data-key="detail:work.other"');
	const missing = yield* rawGet(board, "/_board/work?view=board&board=board.review&owner=missing&status=missing");
	expect(missing.body).toContain("1 shown · 2 items");
	expect(missing.body).toContain('data-item="work.unassigned"');
	const sorted = yield* rawGet(board, "/_board/work?view=board&board=board.shared&sort=title");
	expect(sorted.body).not.toContain('data-item="decision.search"');
	expect(sorted.body).toContain('data-item="work.search"');
	const empty = yield* rawGet(board, "/_board/work?view=board&board=board.review&status=value%3Agone");
	expect(empty.body).toContain("0 shown · 2 items");
	expect(empty.body).toContain("gone (no current matches)");
});

effectApp("explains missing and ambiguous members and selections without silently choosing a source", function* () {
	notes.write("duplicate.md", "---\nid: work.search\n---\n# Duplicate");
	notes.write("boards/review.md", "---\nid: board.review\nkind: board\nitems: [work.search, work.other, work.other, gone]\n---\n# Review work");
	const result = yield* rawGet(board, "/_board/work?view=board&board=board.review&item=work.search");
	expect(result.body).toContain("0 shown · 0 items");
	expect(result.body).toContain("repeated membership, shown once");
	expect(result.body).toContain("gone: missing or invalid ID");
	expect(result.body).toContain("work.search: ambiguous ID");
	expect(result.body).toContain("No source was selected");
	expect(result.body).not.toContain('data-item="work.search"');
	expect((yield* rawGet(board, "/_board/work?view=board&board=gone")).status).toBe(404);
});

effectApp("refreshes counts and explains a removed selection while keeping URL filters", function* () {
	const events = yield* subscribe(board);
	yield* events.next();
	try {
		const path = "/_board/work?view=board&board=board.review&status=value%3Ain-review&item=work.search";
		expect((yield* rawGet(board, path)).body).toContain("1 shown · 2 items");
		notes.write("items/search & review.md", viewsFixture()["items/search & review.md"]?.replace("status: in-review", "status: done") ?? "");
		yield* changesUntil(events, "items/search & review.md");
		const changed = yield* rawGet(board, path);
		expect(changed.body).toContain("0 shown · 2 items");
		expect(changed.body).toContain("in-review (no current matches)");
		expect(changed.body).toContain("outside the current board or filters");
		rmSync(join(notes.root, "items/search & review.md"));
		yield* changesUntil(events, "items/search & review.md");
		expect((yield* rawGet(board, path)).body).toContain("is missing or its identity changed");
	} finally {
		yield* events.close();
	}
});

effectApp("refuses validated view counts when the workspace index is incomplete", function* () {
	yield* board.stop();
	board = yield* startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("other.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	const result = yield* rawGet(board, "/_board/work?view=board&board=board.review");
	expect(result.status).toBe(503);
	expect(result.body).toContain("Work identity and view counts cannot be validated");
	expect(result.body).not.toContain("shown ·");
});
