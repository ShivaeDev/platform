import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { bootstrapPage } from "#client/react/mainLocation.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { expectTitleInFirstScreen } from "#test/expectTitleInFirstScreen.ts";
import { followLink } from "#test/followLink.ts";
import { itemFixture } from "#test/itemFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* (width: number, path = "/_board/item/work.release/") {
	notes = folder(itemFixture());
	board = yield* startBoard(notes.root, "home.md");
	page = yield* openPage(board, path, (window) => {
		window.innerWidth = width;
		window.innerHeight = 844;
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
});

function context() {
	const element = page.document.querySelector(".item-context");
	if (!(element instanceof page.window.HTMLElement)) {
		throw new Error("Missing item context");
	}
	return element;
}

it.live.each([1440, 390])("starts document content with title, authored status and next action before context and prose at %ipx", function* (width) {
	yield* open(width);
	expectTitleInFirstScreen(page);
	const layout = page.document.querySelector("#doc > .document-layout");
	expect([...(layout?.children ?? [])].map((element) => element.classList[0])).toEqual(["item-introduction", "item-context", "doc"]);
	const introduction = layout?.firstElementChild;
	expect(introduction?.firstElementChild?.tagName).toBe("H1");
	expect(introduction?.firstElementChild?.textContent).toBe("Release plan");
	expect(introduction?.querySelector("strong")?.textContent).toBe("Release");
	expect(introduction?.querySelector("[data-status-token]")?.textContent).toBe("in-review");
	expect(introduction?.querySelector(".item-summary")?.textContent).toContain("Owner: editor · Next action: Review the compatibility notes");
	expect(introduction?.querySelector(".meta, .work-meta, .work-context, .reading-tools")).toBeNull();
	expect(page.document.querySelectorAll("#doc h1")).toHaveLength(1);
	expect(context().tagName).toBe("ASIDE");
	expect(context().querySelector('[aria-label="Document source"]')?.textContent).toContain("Source: release.md");
	const backlink = context().querySelector('.work-context a[href="/compatibility.md"]');
	expect(backlink?.textContent).toBe("Compatibility notes");
	expect(backlink?.getAttribute("title")).toBe("compatibility.md");
	expect(introduction?.querySelector("#favorite-toggle")).not.toBeNull();
	expect(context().querySelector('a[href="#heading-evidence"]')).not.toBeNull();
	expect(page.document.querySelector('.doc a[href="/compatibility.md"]')).not.toBeNull();
	notes.write("release.md", `${itemFixture()["release.md"]}\nUpdated prose.\n`);
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".doc")?.textContent).toContain("Updated prose.")));
	expect(context().closest("[hidden]")).toBeNull();
});

it.live.each([1440, 390])("rejects title spacing that pushes the CSS placement bound below the first screen at %ipx", function* (width) {
	yield* open(width);
	expectTitleInFirstScreen(page);
	const introduction = page.document.querySelector(".item-introduction");
	if (!(introduction instanceof page.window.HTMLElement)) {
		throw new Error("Missing introduction");
	}
	introduction.style.marginTop = `${page.window.innerHeight}px`;
	expect(() => expectTitleInFirstScreen(page)).toThrow();
});

it.live("shows unknown authored values, moves a top-level title before preamble and keeps unique heading anchors", function* () {
	yield* open(390, "/_board/item/work.unknown/");
	expect(page.document.querySelector(".item-introduction h1")?.textContent).toBe("Unknown status");
	expect(page.document.querySelector(".item-summary")?.textContent).not.toMatch(/not recorded/iu);
	expect(page.document.querySelector(".doc > p")?.textContent).toBe("A preamble remains readable.");
	expect(page.document.querySelector(".doc h2:last-child")?.id).toBe("heading-unknown-status-2");
	const plain = bootstrapPage((yield* rawGet(board, "/plain.md")).body);
	expect(plain.querySelector(".item-introduction h1")?.textContent).toBe("plain.md");
	expect(plain.querySelector(".item-summary")).toBeNull();
	expect(plain.querySelector(".doc")?.textContent).toBe("An ordinary note without a heading.");
});

it.live("keeps criteria open on narrow screens and reveals a referenced criterion after navigation", function* () {
	yield* open(390);
	expect(context().querySelector("#criterion-review")?.closest("details")).toBeNull();
	followLink(page, "/unknown.md");
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".item-introduction h1")?.textContent).toBe("Unknown status")));
	const link = page.document.createElement("a");
	link.href = "/_board/item/work.release/#criterion-review";
	page.document.getElementById("doc")?.append(link);
	link.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-review")));
	expect(context().querySelector("#criterion-review")?.closest("[hidden]")).toBeNull();
});
