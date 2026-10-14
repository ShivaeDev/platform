import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

it.live.each([1440, 390])("keeps Inbox rows and live navigation counts in agreement at %ipx", function* (width) {
	const files = inboxAudienceFixture();
	notes = folder(files);
	board = yield* startBoard(notes.root);
	page = yield* openPage(board, "/_board/inbox", (window) => {
		window.innerWidth = width;
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live")));
	function counts(total: number) {
		expect(page.document.querySelectorAll(".inbox-list .inbox-row")).toHaveLength(total);
		for (const id of ["inbox-count", "inbox-topbar-count"]) {
			expect(page.document.getElementById(id)?.textContent).toBe(String(total));
			expect(page.document.getElementById(id)?.getAttribute("aria-label")).toBe(`${total} waiting`);
		}
	}
	counts(2);
	expect(page.document.querySelector(".inbox-list")?.textContent).toContain("Question for reader");
	expect(page.document.querySelector(".inbox-list")?.textContent).not.toContain("Question for orchestrator");
	notes.write("orchestrator.md", files["orchestrator.md"]?.replace("[orchestrator]", "[maintainer]") ?? "");
	yield* Effect.promise(() => waitFor(() => counts(3)));
	notes.write("reader.md", files["reader.md"]?.replace("[maintainer]", "[orchestrator]") ?? "");
	yield* Effect.promise(() => waitFor(() => counts(2)));
	expect(page.document.querySelector(".inbox-list")?.textContent).not.toContain("Question for reader");
	expect(page.document.querySelector(".inbox-list")?.textContent).toContain("Question for orchestrator");
	const badge = page.document.getElementById("inbox-topbar-count");
	expect(badge?.closest(".bar")?.hasAttribute("hidden")).toBe(false);
	expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(width === 390);
});
