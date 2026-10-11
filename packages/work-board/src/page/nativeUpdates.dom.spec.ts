import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

function click(id: string) {
	return page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}

function live() {
	return page.document.getElementById("live")?.textContent;
}

function text() {
	return page.document.getElementById("doc")?.textContent;
}

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "nested/home.md": "# Home\n\nReading.\n\n<details><summary>Keep open</summary>Context</details>", "other.md": "# Other" });
	board = yield* startBoard(notes.root, "nested/home.md");
	page = yield* openPage(board);
	yield* Effect.promise(() => waitFor(() => expect(live()).toBe("live")));
});

it.live("keeps unrelated documents intact and catches up paused source changes with restrained highlighting", function* () {
	yield* open();
	const paragraph = page.document.querySelector("#doc p");
	const count = page.pageRequests.count;
	const modified = page.document.querySelector('#files a[href="/other.md"] + [data-modified]')?.getAttribute("data-modified");
	notes.write("other.md", "# Other changed");
	yield* Effect.promise(() =>
		waitFor(() =>
			expect(page.document.querySelector('#files a[href="/other.md"] + [data-modified]')?.getAttribute("data-modified")).not.toBe(modified),
		),
	);
	expect(page.pageRequests.count).toBe(count);
	expect(page.document.querySelector("#doc p")).toBe(paragraph);
	page.document.querySelector("#doc details")?.setAttribute("open", "");
	click("updates-toggle");
	notes.write("nested/home.md", "# Home\n\nNew reading.\n\n<details><summary>Keep open</summary>Context</details>");
	yield* Effect.promise(() => waitFor(() => expect(live()).toMatch(/paused · [1-9]/u)));
	expect(text()).toContain("Reading.");
	expect(text()).not.toContain("New reading.");
	click("updates-toggle");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("New reading.")));
	yield* Effect.promise(() => waitFor(() => expect(live()).toBe("live")));
	expect(page.document.querySelector("#doc details")?.hasAttribute("open")).toBe(true);
	expect(page.document.querySelector("#doc [data-live-change]")?.textContent).toBe("New reading.");
	expect(page.document.querySelector("#doc [data-modified][data-live-change]")).toBeNull();
});

it.live("disposes on pagehide and recreates native reads on persisted pageshow", function* () {
	yield* open();
	page.window.dispatchEvent(new page.window.Event("pagehide"));
	notes.write("nested/home.md", "# Home\n\nChanged while frozen.");
	page.window.dispatchEvent(Object.assign(new page.window.Event("pageshow"), { persisted: true }));
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("Changed while frozen.")));
	yield* Effect.promise(() => waitFor(() => expect(live()).toBe("live")));
	notes.write("nested/home.md", "# Home\n\nChanged after return.");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("Changed after return.")));
});

it.live("caps the pending hint count and labels the bound without pretending it counts source edits", function* () {
	yield* open();
	click("updates-toggle");
	for (let i = 0; i < 300; i += 1) {
		page.streams[0]?.emit("change");
	}
	yield* Effect.promise(() => waitFor(() => expect(live()).toContain("256+ pending updates")));
	click("updates-toggle");
	yield* Effect.promise(() => waitFor(() => expect(live()).toBe("live")));
});
