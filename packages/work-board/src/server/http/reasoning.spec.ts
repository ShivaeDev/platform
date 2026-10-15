import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer, PlatformError } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { changesUntil, subscribe } from "#test/nativeRpc.ts";
import { reasoningFixture } from "#test/reasoningFixture.ts";

let notes: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	notes = folder(reasoningFixture());
	board = yield* startBoard(notes.root, "legacy.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

effectApp("connects a result to its plan and decision options/rationale through explicit links", function* () {
	const result = yield* rawGet(board, "/_board/item/result.search/");
	expect(result.body).toContain('href="/_board/item/plan.search/"');
	expect(result.body).toContain('href="/_board/item/work.search/#criterion-keyboard"');
	expect(result.body).toContain("Unresolved reference missing.id");
	const plan = yield* rawGet(board, "/_board/item/plan.search/");
	expect(plan.body).toContain('href="/_board/item/decision.search/"');
	expect(plan.body).toContain("Referenced by");
	expect(plan.body).toContain("results/search.md:7");
	const decision = yield* rawGet(board, "/_board/item/decision.search/");
	expect(decision.body).toContain("Read files on every query");
	expect(decision.body).toContain('id="heading-rationale"');
	expect(decision.body).toContain("Prefer a rebuildable local index");
	const pane = yield* rawGet(board, "/_board/work?board=board.reasoning&view=table&item=result.search");
	expect(pane.body).toContain('data-key="detail:result.search"');
	expect(pane.body).toContain('href="/_board/item/plan.search/"');
});

effectApp("associates criterion claims across source files without turning missing evidence or old revisions into acceptance", function* () {
	const task = yield* rawGet(board, "/_board/item/work.search/");
	expect(task.body).toContain("2 recorded claims, not verified acceptance");
	expect(task.body).toContain('href="/_board/item/result.search/#recorded-evidence-0"');
	expect(task.body).toContain("1 of 2 criteria have recorded evidence");
	expect(task.body).not.toContain("No recorded evidence naming this criterion");
	const result = yield* rawGet(board, "/_board/item/result.search/#recorded-evidence-0");
	expect(result.body).toContain('id="recorded-evidence-0" tabindex="-1"');
	expect(result.body).toContain("results/search.md:13");
	expect(result.body).toContain("2025-10-04T00:00:00Z");
	expect(result.body).toContain("b".repeat(40));
	expect(result.body).toContain("c".repeat(40));
	expect(result.body).toContain("missing Markdown source");
	expect(result.body).toContain("does not check recorded revisions against the current workspace");
	expect((yield* rawGet(board, "/missing%20evidence.md")).status).toBe(404);
});

effectApp("finds Markdown, board, relationship and evidence-source backlinks, including plain and encoded files", function* () {
	const plain = yield* rawGet(board, "/evidence.md");
	expect(plain.body).toContain("Evidence source");
	expect(plain.body).toContain("Markdown link");
	expect(plain.body).toContain('href="/_board/item/work.search/"');
	expect(plain.body).toContain('href="/notes/backlink%20%26%20review.md"');
	expect(plain.body).not.toContain('class="work-meta"');
	const task = yield* rawGet(board, "/_board/item/work.search/");
	expect(task.body).toContain("Criterion evidence");
	expect(task.body).toContain("Board membership");
	expect(task.body).toContain("Depends on");
	const decision = yield* rawGet(board, "/decision.md");
	expect(decision.body).toContain("notes/backlink &amp; review.md");
	expect(decision.body).not.toContain("example.com/decision.md</a>");
	expect((yield* rawGet(board, "/")).body).toContain("notes/backlink &amp; review.md");
});

effectApp("rebuilds backlinks and criterion claim associations after edits, deletion and restart", function* () {
	const events = yield* subscribe(board);
	yield* events.next();
	try {
		expect((yield* rawGet(board, "/_board/item/work.search/")).body).toContain("2 recorded claims");
		notes.write(
			"results/search.md",
			reasoningFixture()["results/search.md"]?.replace("criterion: work.search#keyboard", "criterion: work.search#passage") ?? "",
		);
		yield* changesUntil(events, "results/search.md");
		const changed = yield* rawGet(board, "/_board/item/work.search/");
		expect(changed.body).not.toContain("2 recorded claims");
		expect(changed.body).not.toContain("No recorded evidence naming this criterion");
		rmSync(join(notes.root, "results/search.md"));
		yield* changesUntil(events, "results/search.md");
		expect((yield* rawGet(board, "/_board/item/plan.search/")).body).not.toContain("results/search.md");
	} finally {
		yield* events.close();
	}
	yield* board.stop();
	board = yield* startBoard(notes.root, "legacy.md");
	expect((yield* rawGet(board, "/_board/item/work.search/")).body).not.toContain("2 recorded claims");
});

effectApp("refuses ambiguous criterion associations and discloses partial backlinks when the index is incomplete", function* () {
	notes.write("duplicate.md", "---\nid: work.search\n---\n# Duplicate");
	const ambiguous = yield* rawGet(board, "/items/search%20%26%20review.md");
	expect(ambiguous.body).toContain("Evidence association requires unique item/criterion IDs");
	expect(ambiguous.body).not.toContain("2 recorded claims");
	yield* board.stop();
	board = yield* startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("results/search.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	const task = yield* rawGet(board, "/items/search%20%26%20review.md");
	expect(task.body).toContain("Evidence association requires unique item/criterion IDs");
	expect(task.body).not.toContain("No recorded evidence naming this criterion");
	const plain = yield* rawGet(board, "/evidence.md");
	expect(plain.body).toContain("Available source references only");
	expect(plain.body).toContain('href="/items/search%20%26%20review.md"');
});
