import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});

it("serves a large workspace with board and document layouts and escaped file location", async () => {
	notes = folder(workspaceFixture());
	board = await startBoard(notes.root, "board.md");
	const home = await (await fetch(board.url)).text();
	expect(home).toContain('class="board-view"');
	expect(home.match(/class="item"/gu)).toHaveLength(100);
	expect(home.match(/class="age short"/gu)).toHaveLength(50);
	expect(home).toContain('aria-label="Project files"');
	expect(home).toContain('class="skip" href="#doc"');
	const document = await (await fetch(`${board.url}/notes/flow%20%26%20details.md`)).text();
	expect(document).toContain('class="document-view"');
	expect(document).toContain('<span>notes</span><span class="separator">/</span><span>flow &amp; details.md</span>');
	expect(document).toContain('aria-current="page"');
	expect(document).toContain('class="diagram"');
});
