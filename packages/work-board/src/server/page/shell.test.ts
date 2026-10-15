import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

let notes: Folder;
let board: RunningBoard;

afterEach(() => {
	notes?.remove();
});

it.live("serves a large workspace with board and document layouts and escaped file location", function* () {
	notes = folder(workspaceFixture());
	board = yield* startBoard(notes.root, "board.md");
	const html = yield* Effect.promise(async () => (await fetch(board.url)).text());
	const home = /<template id="board-legacy-page">(?<content>[\s\S]*?)<\/template>/u.exec(html)?.groups?.content ?? "";
	expect(html).toContain(
		`<noscript data-board-fallback><style>html:not([data-js]) figure.diagram .diagram-source{display:block}html:not([data-js]) figure.diagram[data-state="pending"]{min-height:0}</style>${home}</noscript>`,
	);
	expect(home).toContain('class="board-view"');
	expect(home.match(/class="item"/gu)).toHaveLength(100);
	expect(home).not.toContain('data-key="folder:');
	expect(home).toContain('href="/_board/library"');
	expect(home).toContain('class="skip" href="#doc"');
	const document = yield* Effect.promise(async () => (await fetch(`${board.url}/notes/flow%20%26%20details.md`)).text());
	expect(document).toContain('class="document-view"');
	expect(document).toContain('<span>notes</span><span class="separator">/</span><span>flow &amp; details.md</span>');
	expect(document).toContain('href="/_board/library"');
	expect(document).toContain('class="diagram"');
});
