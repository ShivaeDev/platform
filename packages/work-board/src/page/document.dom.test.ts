import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { expectTitleInFirstScreen } from "#test/expectTitleInFirstScreen.ts";
import { itemFixture } from "#test/itemFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});

async function open(width: number, path = "/_board/item/work.release/") {
	notes = folder(itemFixture());
	board = await startBoard(notes.root, "home.md");
	page = await openPage(board, path, (window) => {
		window.innerWidth = width;
		window.innerHeight = 844;
	});
	await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live"));
}

function context() {
	const element = page.document.querySelector(".item-context");
	if (!(element instanceof page.window.HTMLDetailsElement)) {
		throw new Error("Missing item context");
	}
	return element;
}

it.each([1440, 390])("starts document content with title, authored status and next action before context and prose at %ipx", async (width) => {
	await open(width);
	expectTitleInFirstScreen(page);
	const layout = page.document.querySelector("#doc > .document-layout");
	expect([...(layout?.children ?? [])].map((element) => element.className)).toEqual(["item-introduction", "item-context", "doc"]);
	const introduction = layout?.firstElementChild;
	expect(introduction?.firstElementChild?.tagName).toBe("H1");
	expect(introduction?.firstElementChild?.textContent).toBe("Release plan");
	expect(introduction?.querySelector("strong")?.textContent).toBe("Release");
	expect([...(introduction?.querySelectorAll(".item-summary p") ?? [])].map((element) => element.textContent)).toEqual([
		"Status (source): in-review · Owner: editor",
		"Next action: Review the compatibility notes",
	]);
	expect(introduction?.querySelector(".meta, .work-meta, .work-context, .reading-tools")).toBeNull();
	expect(page.document.querySelectorAll("#doc h1")).toHaveLength(1);
	expect(context().open).toBe(width === 1440);
	expect(context().querySelector(".meta")?.textContent).toContain("Source: release.md");
	expect(context().querySelector(".work-context")?.textContent).toContain("compatibility.md");
	expect(context().querySelector("#favorite-toggle")).not.toBeNull();
	expect(context().querySelector('a[href="#heading-evidence"]')).not.toBeNull();
	expect(page.document.querySelector('.doc a[href="/compatibility.md"]')).not.toBeNull();
	context().open = true;
	notes.write("release.md", `${itemFixture()["release.md"]}\nUpdated prose.\n`);
	await waitFor(() => expect(page.document.querySelector(".doc")?.textContent).toContain("Updated prose."));
	expect(context().open).toBe(true);
});

it.each([1440, 390])("rejects title spacing that pushes the CSS placement bound below the first screen at %ipx", async (width) => {
	await open(width);
	expectTitleInFirstScreen(page);
	const introduction = page.document.querySelector(".item-introduction");
	if (!(introduction instanceof page.window.HTMLElement)) {
		throw new Error("Missing introduction");
	}
	introduction.style.marginTop = `${page.window.innerHeight}px`;
	expect(() => expectTitleInFirstScreen(page)).toThrow();
});

it.each([1440, 1100, 390])("keeps the question form in the text column and allocates rail height to the prose row at %ipx", async (width) => {
	await open(width, "/_board/item/question.storage/");
	expectTitleInFirstScreen(page);
	const panel = page.document.querySelector("#doc > .response-panel");
	expect(panel?.querySelector("h2")?.textContent).toBe("Answer this question");
	if (!panel) {
		throw new Error("Missing question form");
	}
	const style = page.window.getComputedStyle(panel);
	expect(style.maxWidth).toBe("72ch");
	expect(style.getPropertyValue("margin-inline")).toBe("0");
	const layout = page.document.querySelector(".document-layout");
	if (!layout) {
		throw new Error("Missing document layout");
	}
	const grid = page.window.getComputedStyle(layout);
	expect(grid.gridTemplateRows).toBe(width >= 1100 ? "auto 1fr" : "");
	expect(page.window.getComputedStyle(context()).gridRow).toBe(width >= 1100 ? "1 / span 2" : "");
});

it("shows unknown authored values, moves a top-level title before preamble and keeps unique heading anchors", async () => {
	await open(390, "/_board/item/work.unknown/");
	expect(page.document.querySelector(".item-introduction h1")?.textContent).toBe("Unknown status");
	expect(page.document.querySelector(".item-summary")?.textContent).toBe("Status (source): Not recordedNext action: Not recorded");
	expect(page.document.querySelector(".doc > p")?.textContent).toBe("A preamble remains readable.");
	expect(page.document.querySelector(".doc h2:last-child")?.id).toBe("heading-unknown-status-2");
	const plain = document.createElement("div");
	plain.innerHTML = (await rawGet(board, "/plain.md")).body;
	expect(plain.querySelector(".item-introduction h1")?.textContent).toBe("plain.md");
	expect(plain.querySelector(".item-summary")).toBeNull();
	expect(plain.querySelector(".doc")?.textContent).toBe("An ordinary note without a heading.");
});

it("opens the desktop context on resize, keeps it after navigation and reveals it for a source passage", async () => {
	await open(390);
	page.window.innerWidth = 1440;
	page.window.dispatchEvent(new page.window.Event("resize"));
	await waitFor(() => expect(context().open).toBe(true));
	page.window.innerWidth = 390;
	page.window.dispatchEvent(new page.window.Event("resize"));
	await waitFor(() => expect(context().open).toBe(false));
	page.document
		.querySelector('#files a[href="/unknown.md"]')
		?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	await waitFor(() => expect(page.document.querySelector(".item-introduction h1")?.textContent).toBe("Unknown status"));
	expect(context().open).toBe(false);
	const link = page.document.createElement("a");
	link.href = "/_board/item/work.release/#criterion-review";
	page.document.getElementById("doc")?.append(link);
	link.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	await waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-review"));
	expect(context().open).toBe(true);
	expect(context().querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
});
