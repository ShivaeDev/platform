import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { reasoningFixture } from "#test/reasoningFixture.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(reasoningFixture());
	board = yield* startBoard(notes.root, "legacy.md");
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

const open = Effect.fn("Test.open")(function* (path: string) {
	page = yield* openPage(board, path);
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
});

effectApp("reaches a decision rationale from a result in two navigation steps and follows its backlink context", function* () {
	yield* open("/_board/item/result.search/");
	click('.work-meta a[href="/_board/item/plan.search/"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("plan.search")));
	click('.work-meta a[href="/_board/item/decision.search/"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("decision.search")));
	expect(page.document.getElementById("heading-rationale")?.textContent).toContain("Rationale");
	expect(page.document.querySelector("article table")?.textContent).toContain("Rebuild a local index");
	click('.work-context a[href="/_board/item/plan.search/"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("plan.search")));
});

effectApp("opens a cross-file criterion claim at its recorded evidence with focus and expanded source context", function* () {
	yield* open("/_board/item/work.search/");
	click('#criterion-keyboard a[href="/_board/item/result.search/#recorded-evidence-0"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("recorded-evidence-0")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true)));
	expect(page.document.getElementById("recorded-evidence-0")?.textContent).toContain("2025-10-04T00:00:00Z");
	click('#recorded-evidence-0 a[href="/evidence.md"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#doc h1")?.textContent).toBe("Browser walkthrough")));
	expect(page.document.querySelector(".work-context")?.textContent).toContain("Evidence source");
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("recorded-evidence-0")).not.toBeNull()));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true)));
});
