import { Effect, Layer } from "effect";
import { expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { diagramDownloads, visualWorkspace } from "#test/visuals.ts";

let workspace: Effect.Success<ReturnType<typeof visualWorkspace>>;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	workspace = yield* visualWorkspace();
	page = yield* openPage(workspace.board, "/nested/home.md");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}

function images() {
	return [...page.document.querySelectorAll("img")].filter((image) => image.hasAttribute("data-local-image"));
}

effectApp("opens an image gallery by keyboard, bounds navigation and zoom, and returns focus to the source", function* () {
	yield* Effect.promise(async () => {
		const image = images()[0];
		image?.focus();
		image?.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
		await frame();
		const dialog = page.document.getElementById("visual-dialog");
		await waitFor(() => expect(dialog?.hasAttribute("open")).toBe(true));
		expect(page.document.getElementById("visual-context")?.textContent).toContain("1 of 3");
		click("visual-next");
		await frame();
		expect(page.document.getElementById("visual-context")?.textContent).toContain("Second screenshot · 2 of 3");
		click("visual-next");
		await frame();
		expect(page.document.getElementById("visual-download")?.getAttribute("download")).toBe("work-board-image");
		for (let count = 0; count < 10; count += 1) {
			click("visual-in");
			await frame();
		}
		expect(page.document.querySelector("#visual-content")?.getAttribute("style")).toBe("width: 800%;");
		click("visual-fit");
		await frame();
		expect(page.document.querySelector("#visual-content")?.getAttribute("style")).toBe("width: 100%;");
		dialog?.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
		await frame();
		await waitFor(() => expect(dialog?.hasAttribute("open")).toBe(false));
		expect(page.document.activeElement).toBe(image);
		const link = page.document.querySelector('a[href="/_board/attachment/shots/second.png"]');
		link?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
		await frame();
		await waitFor(() => expect(dialog?.hasAttribute("open")).toBe(true));
		expect(page.document.getElementById("visual-context")?.textContent).toContain("Open reference");
		click("visual-close");
		await frame();
		expect(page.document.activeElement).toBe(link);
	});
});

effectApp("refreshes an edited image through native reconciliation and discloses an already-open preview as older", function* () {
	const image = images()[1];
	const src = image?.src;
	image?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	yield* Effect.promise(frame);
	workspace.replaceImage();
	yield* Effect.promise(() => waitFor(() => expect(images()[1]?.src).not.toBe(src)));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("visual-status")?.textContent).toContain("Source updated")));
	expect(page.document.getElementById("visual-download")?.hasAttribute("href")).toBe(false);
	click("visual-close");
	yield* Effect.promise(frame);
	expect(page.document.activeElement).toBe(image);
});

effectApp("keeps failed images readable with a useful local-path message", function* () {
	yield* Effect.promise(async () => {
		const image = images()[2];
		image?.dispatchEvent(new page.window.Event("error"));
		await frame();
		expect(image?.nextElementSibling?.textContent).toContain("workspace boundary and 16 MiB limit");
		expect(image?.getAttribute("alt")).toBe("Missing screenshot");
	});
});

effectApp("inspects a rendered diagram, exposes a local SVG export and releases it on keyboard dismissal", function* () {
	const downloads = diagramDownloads(page);
	try {
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure.diagram")?.getAttribute("data-state")).toBe("drawn")));
		const trigger = page.document.querySelector("figure.diagram button");
		trigger?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#visual-content svg")).not.toBeNull()));
		expect(downloads.types).toEqual(["image/svg+xml"]);
		expect(page.document.getElementById("visual-download")?.getAttribute("download")).toBe("work-board-diagram.svg");
		click("visual-fullscreen");
		yield* Effect.promise(frame);
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.getElementById("visual-status")?.textContent).toContain("Fullscreen is unavailable")),
		);
		page.document.getElementById("visual-dialog")?.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
		yield* Effect.promise(frame);
		expect(downloads.released).toEqual(["blob:local-diagram"]);
		expect(page.document.activeElement).toBe(trigger);
		page.document
			.querySelector('a[href="/nested/result.md"]')
			?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("nested/result.md")));
		page.window.history.back();
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("nested/home.md")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure.diagram")?.getAttribute("data-state")).toBe("drawn")));
		page.document.querySelector("figure.diagram button")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("visual-dialog")?.hasAttribute("open")).toBe(true)));
		click("visual-close");
		yield* Effect.promise(frame);
	} finally {
		downloads.restore();
	}
});

function frame() {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
