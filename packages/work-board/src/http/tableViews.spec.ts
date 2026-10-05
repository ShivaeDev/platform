import { afterEach, beforeEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { viewsFixture } from "#test/viewsFixture.ts";

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
function ids(body: string) {
	return [...body.matchAll(/data-item="(?<id>[^"]+)"/gu)].map((match) => match.groups?.id);
}

it("uses the same item projection, counts, filters and selected source in board and table layouts", async () => {
	const state = "board=board.review&owner=value%3Aagent-navigation&item=work.search&sort=owner";
	const cards = await rawGet(board, `/_board/work?view=board&${state}`);
	const table = await rawGet(board, `/_board/work?view=table&${state}`);
	expect(ids(cards.body)).toEqual(ids(table.body));
	expect(table.body).toContain("1 shown · 3 items");
	expect(table.body).toContain('<table class="work-table">');
	expect(table.body).toContain('data-key="detail:work.search"');
	expect(table.body).toContain('name="view" value="table"');
	expect(table.body).toContain("view=board&amp;board=board.review&amp;item=work.search");
	expect(table.body).toContain("Save board, filters, sort, and layout locally");
});

it("orders table rows by recorded fields with missing fields last and escapes source text", async () => {
	notes.write("unsafe.md", "---\nid: work.unsafe\nowner: '<img src=x onerror=alert(1)>'\n---\n# Unsafe field");
	const result = await rawGet(board, "/_board/work?view=table&sort=owner");
	expect(ids(result.body).slice(-2)).toEqual(["decision.search", "work.unassigned"]);
	expect(result.body).toContain("&lt;img src=x onerror=alert(1)&gt;");
	expect(result.body).not.toContain("<img src=x");
	const empty = await rawGet(board, "/_board/work?view=table&status=value%3Aabsent");
	expect(empty.body).toContain("0 shown · 5 items");
	expect(empty.body).toContain("No work matches these filters");
	const unknown = await rawGet(board, "/_board/work?view=unsupported");
	expect(unknown.body).toContain("WORK · BOARD VIEW");
});
