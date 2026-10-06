import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
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
async function open() {
	notes = folder({ "nested/home.md": "# Home\n\nReading.\n\n<details><summary>Keep open</summary>Context</details>", "other.md": "# Other" });
	board = await startBoard(notes.root, "nested/home.md");
	page = await openPage(board);
	await waitFor(() => expect(live()).toBe("live"));
}
it("keeps unrelated documents intact and catches up paused source changes with restrained highlighting", async () => {
	await open();
	const paragraph = page.document.querySelector("#doc p");
	const count = page.pageRequests.count;
	const modified = page.document.querySelector('#files a[href="/other.md"] + [data-modified]')?.getAttribute("data-modified");
	notes.write("other.md", "# Other changed");
	await waitFor(() =>
		expect(page.document.querySelector('#files a[href="/other.md"] + [data-modified]')?.getAttribute("data-modified")).not.toBe(modified),
	);
	expect(page.pageRequests.count).toBe(count);
	expect(page.document.querySelector("#doc p")).toBe(paragraph);
	page.document.querySelector("#doc details")?.setAttribute("open", "");
	click("updates-toggle");
	notes.write("nested/home.md", "# Home\n\nNew reading.\n\n<details><summary>Keep open</summary>Context</details>");
	await waitFor(() => expect(live()).toMatch(/paused · [1-9]/u));
	expect(text()).toContain("Reading.");
	expect(text()).not.toContain("New reading.");
	click("updates-toggle");
	await waitFor(() => expect(text()).toContain("New reading."));
	await waitFor(() => expect(live()).toBe("live"));
	expect(page.document.querySelector("#doc details")?.hasAttribute("open")).toBe(true);
	expect(page.document.querySelector("#doc [data-live-change]")?.textContent).toBe("New reading.");
	expect(page.document.querySelector("#doc [data-modified][data-live-change]")).toBeNull();
});
it("disposes on pagehide and recreates native reads on persisted pageshow", async () => {
	await open();
	page.window.dispatchEvent(new page.window.Event("pagehide"));
	notes.write("nested/home.md", "# Home\n\nChanged while frozen.");
	page.window.dispatchEvent(Object.assign(new page.window.Event("pageshow"), { persisted: true }));
	await waitFor(() => expect(text()).toContain("Changed while frozen."));
	await waitFor(() => expect(live()).toBe("live"));
	notes.write("nested/home.md", "# Home\n\nChanged after return.");
	await waitFor(() => expect(text()).toContain("Changed after return."));
});

it("caps the pending hint count and labels the bound without pretending it counts source edits", async () => {
	await open();
	click("updates-toggle");
	for (let i = 0; i < 300; i += 1) {
		page.streams[0]?.emit("change");
	}
	await waitFor(() => expect(live()).toContain("256+ pending updates"));
	click("updates-toggle");
	await waitFor(() => expect(live()).toBe("live"));
});
