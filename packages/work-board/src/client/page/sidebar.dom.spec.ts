import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { followLink } from "#test/followLink.ts";
import { waitFor } from "#test/live.ts";
import { sidebarWorkspace } from "#test/sidebarFixture.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* (width: number) {
	notes = folder(sidebarWorkspace());
	board = yield* startBoard(notes.root, "board.md");
	page = yield* openPage(board, "/notes/topic-1.md", (window) => {
		window.innerWidth = width;
		window.innerHeight = 1000;
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
	page.window.dispatchEvent(new page.window.Event("resize"));
});

function element(id: string) {
	const found = page.document.getElementById(id);
	if (!(found instanceof page.window.HTMLElement)) {
		throw new Error(`Missing ${id}`);
	}
	return found;
}

function click(selector: string) {
	const found = page.document.querySelector(selector);
	if (!found) {
		throw new Error(`Missing ${selector}`);
	}
	found.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}

it.live.each([1440, 390])("keeps primary rows and recent documents independent of five visits at %ipx", function* (width) {
	yield* open(width);
	const navigation = element("primary-navigation");
	const rows = [...navigation.children];
	expect(rows.map((row) => row.id)).toEqual(["home-open", "goals-open", "work-open", "documents-open", "diagnostics-open"]);

	for (let index = 2; index <= 6; index += 1) {
		followLink(page, `/notes/topic-${index}.md`);
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(element("doc").dataset.file).toBe(`notes/topic-${index}.md`)));
		expect([...navigation.children]).toEqual(rows);
		expect(page.document.querySelector('section[aria-label="Recent"] a[aria-current="page"]')?.getAttribute("href")).toBe(`/notes/topic-${index}.md`);
		expect(element("library-dialog").hasAttribute("open")).toBe(false);
	}
	expect(element("sidebar").contains(element("reading-library"))).toBe(false);
	expect(page.document.querySelectorAll('section[aria-label="Recent"] a')).toHaveLength(5);
	if (width === 390) {
		click("#sidebar-toggle");
		yield* Effect.promise(frame);
	}
	click("#library-open");
	yield* Effect.promise(frame);
	expect(element("library-dialog").hasAttribute("open")).toBe(true);
	expect(element("reading-library").querySelectorAll("a")).toHaveLength(6);
	click("#library-close");
	yield* Effect.promise(frame);
	expect(element("library-dialog").hasAttribute("open")).toBe(false);
	expect(page.document.activeElement).toBe(element("library-open"));
});

it.live("dismisses the narrow drawer with Escape or outside tap and restores focus without changing desktop preferences", function* () {
	yield* open(390);
	const sidebar = element("sidebar");
	const opener = element("sidebar-toggle");
	yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(true)));
	for (const dismiss of ["escape", "outside"]) {
		opener.focus();
		click("#sidebar-toggle");
		yield* Effect.promise(frame);
		expect(sidebar.hidden).toBe(false);
		expect(sidebar.getAttribute("aria-modal")).toBe("true");
		expect(element("sidebar-backdrop").hidden).toBe(false);
		expect(page.document.querySelector("[data-board-page]")?.hasAttribute("inert")).toBe(true);
		expect(sidebar.contains(page.document.activeElement)).toBe(true);
		if (dismiss === "escape") {
			page.document.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
		} else {
			click("#sidebar-backdrop");
			yield* Effect.promise(frame);
		}
		yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(true)));
		expect(opener.getAttribute("aria-expanded")).toBe("false");
		yield* Effect.promise(focusReturned);
	}
	page.window.innerWidth = 1440;
	page.window.dispatchEvent(new page.window.Event("resize"));
	yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(false)));
	expect(sidebar.hasAttribute("aria-modal")).toBe(false);
	page.window.innerWidth = 390;
	page.window.dispatchEvent(new page.window.Event("resize"));
	yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(true)));
});

function frame() {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}

function focusReturned() {
	return waitFor(() => expect(page.document.activeElement).toBe(element("sidebar-toggle")));
}
