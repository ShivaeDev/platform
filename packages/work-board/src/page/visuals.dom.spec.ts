import { afterEach, beforeEach, expect, it } from "vitest";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { diagramDownloads, visualWorkspace } from "#test/visuals.ts";

let workspace: Awaited<ReturnType<typeof visualWorkspace>>;
let page: OpenPage;
beforeEach(async () => {
	workspace = await visualWorkspace();
	page = await openPage(workspace.board);
	await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live"));
});
afterEach(async () => {
	await page.close();
	await workspace.stop();
});
function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}
function images() {
	return [...page.document.querySelectorAll("img")].filter((image) => image.hasAttribute("data-local-image"));
}

it("opens an image gallery by keyboard, bounds navigation and zoom, and returns focus to the source", () => {
	const image = images()[0];
	image?.focus();
	image?.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
	const dialog = page.document.getElementById("visual-dialog");
	expect(dialog?.hasAttribute("open")).toBe(true);
	expect(page.document.getElementById("visual-context")?.textContent).toContain("1 of 3");
	click("visual-next");
	expect(page.document.getElementById("visual-context")?.textContent).toContain("Second screenshot · 2 of 3");
	click("visual-next");
	expect(page.document.getElementById("visual-download")?.getAttribute("download")).toBe("work-board-image");
	for (let count = 0; count < 10; count += 1) {
		click("visual-in");
	}
	expect(page.document.querySelector("#visual-content")?.getAttribute("style")).toBe("width: 800%;");
	click("visual-fit");
	expect(page.document.querySelector("#visual-content")?.getAttribute("style")).toBe("width: 100%;");
	dialog?.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
	expect(dialog?.hasAttribute("open")).toBe(false);
	expect(page.document.activeElement).toBe(image);
	const link = page.document.querySelector('a[href="/_board/attachment/shots/second.png"]');
	link?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	expect(dialog?.hasAttribute("open")).toBe(true);
	expect(page.document.getElementById("visual-context")?.textContent).toContain("Open reference");
	click("visual-close");
	expect(page.document.activeElement).toBe(link);
});

it("refreshes an edited image through native reconciliation and discloses an already-open preview as older", async () => {
	const image = images()[1];
	const src = image?.src;
	image?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	workspace.replaceImage();
	await waitFor(() => expect(images()[1]?.src).not.toBe(src));
	expect(page.document.getElementById("visual-status")?.textContent).toContain("Source updated");
	expect(page.document.getElementById("visual-download")?.hasAttribute("href")).toBe(false);
	click("visual-close");
	expect(page.document.activeElement).toBe(image);
});

it("keeps failed images readable with a useful local-path message", () => {
	const image = images()[2];
	image?.dispatchEvent(new page.window.Event("error"));
	expect(image?.nextElementSibling?.textContent).toContain("workspace boundary and 16 MiB limit");
	expect(image?.getAttribute("alt")).toBe("Missing screenshot");
});

it("inspects a rendered diagram, exposes a local SVG export and releases it on keyboard dismissal", async () => {
	const downloads = diagramDownloads(page);
	try {
		await waitFor(() => expect(page.document.querySelector("figure.diagram")?.getAttribute("data-state")).toBe("drawn"));
		const trigger = page.document.querySelector("figure.diagram button");
		trigger?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
		expect(page.document.querySelector("#visual-content svg")).not.toBeNull();
		expect(downloads.types).toEqual(["image/svg+xml"]);
		expect(page.document.getElementById("visual-download")?.getAttribute("download")).toBe("work-board-diagram.svg");
		click("visual-fullscreen");
		await waitFor(() => expect(page.document.getElementById("visual-status")?.textContent).toContain("Fullscreen is unavailable"));
		page.document.getElementById("visual-dialog")?.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
		expect(downloads.released).toEqual(["blob:local-diagram"]);
		expect(page.document.activeElement).toBe(trigger);
		page.document
			.querySelector('a[href="/nested/result.md"]')
			?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
		await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("nested/result.md"));
		page.window.history.back();
		await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("nested/home.md"));
		page.document.querySelector("figure.diagram button")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
		expect(page.document.getElementById("visual-dialog")?.hasAttribute("open")).toBe(true);
		click("visual-close");
	} finally {
		downloads.restore();
	}
});
