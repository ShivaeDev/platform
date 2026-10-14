import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, startBoard } from "#test/board.ts";
import { openPage } from "#test/browser.ts";
import { closedInboxFixture } from "#test/closedInboxFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
afterEach(() => notes?.remove());

it.live("refreshes grouped rows, badges and collapsed groups when target statuses change without editing asks", function* () {
	const files = closedInboxFixture();
	notes = folder(files);
	const board = yield* startBoard(notes.root);
	const page = yield* openPage(board, "/_board/inbox");
	function counts(waiting: number, resolved: number, parked: number) {
		expect(page.document.querySelectorAll(".inbox-list .inbox-row")).toHaveLength(waiting);
		for (const id of ["inbox-count", "inbox-topbar-count"]) {
			expect(page.document.getElementById(id)?.textContent).toBe(String(waiting));
		}
		expect([...page.document.querySelectorAll(".inbox-group summary")].map((summary) => summary.textContent)).toEqual([
			`Resolved elsewhere (${resolved})`,
			`Parked (${parked})`,
		]);
	}
	yield* Effect.promise(() => waitFor(() => counts(2, 4, 1)));
	expect(page.document.querySelector(".inbox-list")?.textContent).toContain("1 earlier ask");
	notes.write("planned.md", files["planned.md"]?.replace("status: planned", "status: done") ?? "");
	yield* Effect.promise(() => waitFor(() => counts(1, 6, 1)));
	notes.write("planned.md", files["planned.md"]?.replace("status: planned", "status: deferred") ?? "");
	yield* Effect.promise(() => waitFor(() => counts(1, 4, 3)));
	for (const [file, source] of Object.entries(files).filter(([path]) => path.startsWith("asks/"))) {
		expect(readFileSync(join(notes.root, file), "utf8")).toBe(source);
	}
});
