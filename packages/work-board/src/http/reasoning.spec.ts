import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { changesUntil, type Folder, folder, type RunningBoard, rawGet, startBoard, subscribe } from "#test/support/board.ts";
import { reasoningFixture } from "#test/support/reasoningFixture.ts";

let notes: Folder;
let board: RunningBoard;
beforeEach(async () => {
	notes = folder(reasoningFixture());
	board = await startBoard(notes.root, "legacy.md");
});
afterEach(async () => {
	await board.stop();
	notes.remove();
});

it("connects a result to its plan and decision options/rationale through explicit links", async () => {
	const result = await rawGet(board, "/_board/item/result.search/");
	expect(result.body).toContain('href="/_board/item/plan.search/"');
	expect(result.body).toContain('href="/_board/item/work.search/#criterion-keyboard"');
	expect(result.body).toContain("Unresolved reference missing.id");
	const plan = await rawGet(board, "/_board/item/plan.search/");
	expect(plan.body).toContain('href="/_board/item/decision.search/"');
	expect(plan.body).toContain("Referenced by");
	expect(plan.body).toContain("results/search.md:7");
	const decision = await rawGet(board, "/_board/item/decision.search/");
	expect(decision.body).toContain("Read files on every query");
	expect(decision.body).toContain('id="heading-rationale"');
	expect(decision.body).toContain("Prefer a rebuildable local index");
	const pane = await rawGet(board, "/_board/work?board=board.reasoning&view=table&item=result.search");
	expect(pane.body).toContain('data-key="detail:result.search"');
	expect(pane.body).toContain('href="/_board/item/plan.search/"');
});

it("associates criterion claims across source files without turning missing evidence or old revisions into acceptance", async () => {
	const task = await rawGet(board, "/_board/item/work.search/");
	expect(task.body).toContain("2 recorded claims, not verified acceptance");
	expect(task.body).toContain('href="/_board/item/result.search/#recorded-evidence-0"');
	expect(task.body).toContain("No recorded evidence naming this criterion");
	const result = await rawGet(board, "/_board/item/result.search/#recorded-evidence-0");
	expect(result.body).toContain('id="recorded-evidence-0" tabindex="-1"');
	expect(result.body).toContain("results/search.md:13");
	expect(result.body).toContain("2025-10-04T00:00:00Z");
	expect(result.body).toContain("b".repeat(40));
	expect(result.body).toContain("c".repeat(40));
	expect(result.body).toContain("missing Markdown source");
	expect(result.body).toContain("does not check recorded revisions against the current workspace");
	expect((await rawGet(board, "/missing%20evidence.md")).status).toBe(404);
});

it("finds Markdown, board, relationship and evidence-source backlinks, including plain and encoded files", async () => {
	const plain = await rawGet(board, "/evidence.md");
	expect(plain.body).toContain("Evidence source");
	expect(plain.body).toContain("Markdown link");
	expect(plain.body).toContain('href="/_board/item/work.search/"');
	expect(plain.body).toContain('href="/notes/backlink%20%26%20review.md"');
	expect(plain.body).not.toContain('class="work-meta"');
	const task = await rawGet(board, "/_board/item/work.search/");
	expect(task.body).toContain("Criterion evidence");
	expect(task.body).toContain("Board membership");
	expect(task.body).toContain("Depends on");
	const decision = await rawGet(board, "/decision.md");
	expect(decision.body).toContain("notes/backlink &amp; review.md");
	expect(decision.body).not.toContain("example.com/decision.md</a>");
	expect((await rawGet(board, "/")).body).toContain("notes/backlink &amp; review.md");
});

it("rebuilds backlinks and criterion claim associations after edits, deletion and restart", async () => {
	const events = await subscribe(board);
	await events.next();
	try {
		expect((await rawGet(board, "/_board/item/work.search/")).body).toContain("2 recorded claims");
		notes.write(
			"results/search.md",
			reasoningFixture()["results/search.md"]?.replace("criterion: work.search#keyboard", "criterion: work.search#passage") ?? "",
		);
		await changesUntil(events, "results/search.md");
		const changed = await rawGet(board, "/_board/item/work.search/");
		expect(changed.body).not.toContain("2 recorded claims");
		expect(changed.body).not.toContain("No recorded evidence naming this criterion");
		rmSync(join(notes.root, "results/search.md"));
		await changesUntil(events, "results/search.md");
		expect((await rawGet(board, "/_board/item/plan.search/")).body).not.toContain("results/search.md");
	} finally {
		events.close();
	}
	await board.stop();
	board = await startBoard(notes.root, "legacy.md");
	expect((await rawGet(board, "/_board/item/work.search/")).body).not.toContain("2 recorded claims");
});

it("refuses ambiguous criterion associations and discloses partial backlinks when the index is incomplete", async () => {
	notes.write("duplicate.md", "---\nid: work.search\n---\n# Duplicate");
	const ambiguous = await rawGet(board, "/items/search%20%26%20review.md");
	expect(ambiguous.body).toContain("Evidence association requires unique item/criterion IDs");
	expect(ambiguous.body).not.toContain("2 recorded claims");
	await board.stop();
	board = await startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("results/search.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	const task = await rawGet(board, "/items/search%20%26%20review.md");
	expect(task.body).toContain("Evidence association requires unique item/criterion IDs");
	expect(task.body).not.toContain("No recorded evidence naming this criterion");
	const plain = await rawGet(board, "/evidence.md");
	expect(plain.body).toContain("Available source references only");
	expect(plain.body).toContain('href="/items/search%20%26%20review.md"');
});
