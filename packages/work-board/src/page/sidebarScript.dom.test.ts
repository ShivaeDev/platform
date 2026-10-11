import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* (width: number) {
	notes = folder(workspaceFixture());
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

it.live.each([1440, 390])(
	"keeps primary rows and the tree independent of five visits at %ipx",
	function* (width) {
		yield* open(width);
		const navigation = element("primary-navigation");
		const rows = [...navigation.children];
		expect(rows.map((row) => row.id)).toEqual(["home-open", "inbox-open", "overview-open", "work-open", "changes-open", "diagnostics-open"]);
		const files = element("files");
		for (let index = 2; index <= 6; index += 1) {
			click(`#files a[href="/notes/topic-${index}.md"]`);
			yield* Effect.promise(() => waitFor(() => expect(element("doc").dataset.file).toBe(`notes/topic-${index}.md`)));
			expect([...navigation.children]).toEqual(rows);
			expect(element("files")).toBe(files);
			expect(files.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe(`/notes/topic-${index}.md`);
			expect(element("library-dialog").hasAttribute("open")).toBe(false);
		}
		expect(element("sidebar").contains(element("reading-library"))).toBe(false);
		expect(page.window.getComputedStyle(files).overflowY).toBe("auto");
		if (width === 390) {
			click("#sidebar-toggle");
		}
		click("#library-open");
		expect(element("library-dialog").hasAttribute("open")).toBe(true);
		expect(element("reading-library").querySelectorAll("a")).toHaveLength(6);
		click("#library-close");
		expect(element("library-dialog").hasAttribute("open")).toBe(false);
		expect(page.document.activeElement).toBe(element("library-open"));
	},
	{ timeout: 10_000 },
);

it.live("dismisses the narrow drawer with Escape or outside tap and restores focus without changing desktop preferences", function* () {
	yield* open(390);
	const sidebar = element("sidebar");
	const opener = element("sidebar-toggle");
	expect(sidebar.hidden).toBe(true);
	for (const dismiss of ["escape", "outside"]) {
		opener.focus();
		click("#sidebar-toggle");
		expect(sidebar.hidden).toBe(false);
		expect(sidebar.getAttribute("aria-modal")).toBe("true");
		expect(element("sidebar-backdrop").hidden).toBe(false);
		expect(page.document.querySelector(".page")?.hasAttribute("inert")).toBe(true);
		expect(sidebar.contains(page.document.activeElement)).toBe(true);
		if (dismiss === "escape") {
			page.document.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
		} else {
			click("#sidebar-backdrop");
		}
		expect(sidebar.hidden).toBe(true);
		expect(opener.getAttribute("aria-expanded")).toBe("false");
		expect(page.document.activeElement).toBe(opener);
	}
	page.window.innerWidth = 1440;
	page.window.dispatchEvent(new page.window.Event("resize"));
	yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(false)));
	expect(sidebar.hasAttribute("aria-modal")).toBe(false);
	page.window.innerWidth = 390;
	page.window.dispatchEvent(new page.window.Event("resize"));
	yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(true)));
});

it.live("scrolls the project tree to reveal the selected file after navigation", function* () {
	yield* open(1440);
	const files = element("files");
	function rect(top: number, bottom: number) {
		return new page.window.DOMRect(0, top, 240, bottom - top);
	}
	files.getBoundingClientRect = () => rect(0, 100);
	page.window.HTMLAnchorElement.prototype.getBoundingClientRect = () => rect(400 - files.scrollTop, 420 - files.scrollTop);
	files.scrollTop = 0;
	click('#files a[href="/notes/topic-6.md"]');
	yield* Effect.promise(() => waitFor(() => expect(element("doc").dataset.file).toBe("notes/topic-6.md")));
	yield* Effect.promise(() => waitFor(() => expect(files.scrollTop).toBe(320)));
});
