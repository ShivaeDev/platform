import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { viewsFixture } from "#test/viewsFixture.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(viewsFixture());
	board = yield* startBoard(notes.root, "legacy.md");
	page = yield* openPage(board, "/_board/work");
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

function click(selector: string) {
	const target = page.document.querySelector(selector);
	if (!target) {
		throw new Error(`Missing ${selector}`);
	}
	target.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}

function filter(id: string, value: string) {
	const target = page.document.getElementById(id);
	if (!(target instanceof page.window.HTMLSelectElement || target instanceof page.window.HTMLInputElement)) {
		throw new Error(`Missing ${id}`);
	}
	target.value = value;
	return target;
}

function submit() {
	page.document.getElementById("work-filters")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
}

effectApp("navigates boards and selected detail in place and restores URL context through Back and Forward", function* () {
	page.document.body.dataset.visit = "kept";
	filter("work-board", "board.review");
	filter("work-status", "value:in-review");
	submit();
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".work-total")?.textContent).toContain("1 shown · 3 items")));
	click('[data-item="work.search"] h3 a');
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("work-detail")));
	expect(new URLSearchParams(page.window.location.search).get("item")).toBe("work.search");
	page.document.querySelector("#work-detail article details")?.setAttribute("open", "");
	click("#work-detail header a:last-child");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("work.search")));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#work-detail article details")?.hasAttribute("open")).toBe(true)));
	expect(page.document.querySelector(".work-total")?.textContent).toContain("1 shown · 3 items");
	expect(page.document.getElementById("work-open")?.getAttribute("aria-current")).toBe("page");
	expect(page.document.body.dataset.visit).toBe("kept");
	page.window.history.forward();
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("work.search")));
});

effectApp("keeps filters and unsent search input through live edits and explains removed selection", function* () {
	filter("work-board", "board.review");
	filter("work-status", "value:in-review");
	submit();
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".work-total")?.textContent).toContain("1 shown · 3 items")));
	click('[data-item="work.search"] h3 a');
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("work-detail")));
	filter("work-query", "unsent search").focus();
	notes.write("items/search & review.md", viewsFixture()["items/search & review.md"]?.replace("status: in-review", "status: done") ?? "");
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".work-total")?.textContent).toContain("0 shown · 3 items")));
	expect(page.document.activeElement?.id).toBe("work-query");
	expect(page.document.getElementById("work-query")).toHaveProperty("value", "unsent search");
	expect(page.document.getElementById("work-status")).toHaveProperty("value", "value:in-review");
	expect(page.document.querySelector(".detail-notice")?.textContent).toContain("outside the current board or filters");
	rmSync(join(notes.root, "items/search & review.md"));
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("work-detail")?.textContent).toContain("is missing or its identity changed")),
	);
	expect(new URLSearchParams(page.window.location.search).get("item")).toBe("work.search");
});
