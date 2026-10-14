import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(attentionFixture());
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

effectApp("opens the overview from legacy Markdown and preserves queue reading context across source navigation and Back", function* () {
	page = yield* openPage(board, "/");
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	click("#overview-open");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-route")).toBe("/_board/overview")));
	expect(page.document.getElementById("overview-open")?.getAttribute("aria-current")).toBe("page");
	page.document.querySelector(".view-issues")?.setAttribute("open", "");
	click('[data-request="keyboard-review"] h3 a');
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("attention-request-keyboard-review")));
	expect(page.document.getElementById("overview-open")?.getAttribute("aria-current")).toBeNull();
	expect(page.document.getElementById("attention-request-keyboard-review")?.textContent).toContain("maintainer, agent-navigation");
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
	click('#attention-request-keyboard-review a[href="/_board/item/work.search/#criterion-keyboard"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-keyboard")));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("request.search")));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-route")).toBe("/_board/overview")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".view-issues")?.hasAttribute("open")).toBe(true)));
	expect(page.document.getElementById("overview-open")?.getAttribute("aria-current")).toBe("page");
});

effectApp("updates explicit open requests in place and keeps issue disclosure open during source edits", function* () {
	page = yield* openPage(board, "/_board/overview");
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	page.document.querySelector(".view-issues")?.setAttribute("open", "");
	notes.write("attention/review.md", (attentionFixture()["attention/review.md"] ?? "").replaceAll("state: open", "state: closed"));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelectorAll(".attention-card").length).toBe(1)));
	expect(page.document.querySelector(".view-issues")?.hasAttribute("open")).toBe(true);
	expect(page.document.querySelector(".attention-total")?.textContent).toBe("1 validated open request");
	notes.write("attention/blocker.md", (attentionFixture()["attention/blocker.md"] ?? "").replace("work.search#keyboard", "missing.id"));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelectorAll(".attention-card").length).toBe(0)));
	expect(page.document.querySelector(".view-issues")?.textContent).toContain("Unresolved reference missing.id");
	expect(page.document.querySelector(".attention-total")?.textContent).not.toContain("All quiet");
});
