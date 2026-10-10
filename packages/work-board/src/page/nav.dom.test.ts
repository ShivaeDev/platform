import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { type Folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import type { OpenPage } from "#test/browser.ts";
import { openLive, waitFor } from "#test/live.ts";
import { sidebarPaths as files, referenceTree } from "#test/sidebarFixture.ts";
import { navHtml } from "./nav.ts";

let notes: Folder;
let reference: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
	reference?.remove();
});

it("renders shared ancestry, direct files, escaped names, stable URLs and home first", () => {
	const nav = document.createElement("nav");
	nav.innerHTML = navHtml(
		files.map((path) => ({ modified: 123, path })),
		"packages/form/README.md",
		"packages/README.md",
	);
	expect(nav.querySelector("a")?.getAttribute("href")).toBe("/packages/README.md");
	const packages = nav.querySelector('details[data-key="folder:packages"]');
	expect(packages?.querySelector(":scope > summary")?.textContent).toBe("packages/ (2)");
	expect(packages?.hasAttribute("open")).toBe(true);
	expect(packages?.querySelectorAll("details")).toHaveLength(2);
	expect(packages?.querySelector('details[data-key="folder:packages/form"]')?.hasAttribute("open")).toBe(true);
	expect(packages?.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/packages/form/README.md");
	expect(nav.querySelectorAll("a[aria-current]")).toHaveLength(1);
	expect(nav.querySelectorAll('[data-modified="123"]')).toHaveLength(files.length);
	expect(nav.querySelector('details[data-key="folder:docs"] summary')?.textContent).toBe("docs/ (1)");
	expect([...nav.querySelectorAll("summary")].map((item) => item.textContent)).toContain('<long & "name>/ (1)');
	expect(nav.querySelector('a[href="/docs/%3Clong%20%26%20%22name%3E/a%20%23%3F.md"]')?.textContent).toBe("a #?");
	expect(nav.querySelector("script")).toBe(null);
	const mixed = document.createElement("nav");
	mixed.innerHTML = navHtml(
		files.map((path) => ({ modified: 123, path })),
		"root.md",
		undefined,
	);
	expect(mixed.querySelector('details[data-key="folder:packages"] > ul > li > a')?.getAttribute("href")).toBe("/packages/README.md");
	expect([...mixed.querySelectorAll(":scope > ul > li.file-folder > details > summary")].map((item) => item.textContent)).toEqual([
		"docs/ (1)",
		"packages/ (3)",
	]);
	expect(
		[...mixed.querySelectorAll('details[data-key="folder:packages"] > ul > li.file-folder > details > summary')].map((item) => item.textContent),
	).toEqual(["changes/ (1)", "form/ (1)"]);
	expect(navHtml([], "", undefined)).toBe("<ul></ul>");
});

it("serves a native reference tree and preserves parent and child state through live changes and navigation", async () => {
	({ notes, reference } = referenceTree());
	board = await startBoard(notes.root, "root.md");
	const response = await rawGet(board, "/packages/form/README.md");
	expect(response.status).toBe(200);
	const html = document.createElement("div");
	html.innerHTML = response.body;
	expect(html.querySelector('#files details[data-key="folder:packages"] details[data-key="folder:packages/form"] a[aria-current="page"]')).not.toBe(
		null,
	);
	expect(html.querySelector('#files details[data-key="folder:reference"] details[data-key="folder:reference/guide"] a')?.getAttribute("href")).toBe(
		"/reference/guide/start.md",
	);
	expect(html.querySelector('details[data-key="folder:empty"]')).toBe(null);
	expect((await rawGet(board, "/reference/guide/start.md")).status).toBe(200);
	page = await openLive(board, "/packages/form/README.md");
	function folderAt(path: string) {
		const item = page.document.querySelector(`#files details[data-key="folder:${path}"]`);
		if (!(item instanceof page.window.HTMLDetailsElement)) {
			throw new Error(`Missing folder ${path}`);
		}
		return item;
	}
	folderAt("packages").open = false;
	folderAt("packages/form").open = false;
	folderAt("packages/changes").open = true;
	notes.write("packages/form/new.md", "# Added\n");
	await waitFor(() => expect(page.document.querySelector('#files a[href="/packages/form/new.md"]')).not.toBe(null));
	expect(folderAt("packages").open).toBe(false);
	expect(folderAt("packages/form").open).toBe(false);
	expect(folderAt("packages/changes").open).toBe(true);
	function age() {
		return page.document.querySelector('#files a[href="/root.md"] + [data-modified]')?.getAttribute("data-modified");
	}
	const previous = age();
	notes.write("root.md", "# Unrelated update\n");
	await waitFor(() => expect(age()).not.toBe(previous));
	expect(folderAt("packages").open).toBe(false);
	rmSync(join(notes.root, "packages/form/new.md"));
	await waitFor(() => expect(page.document.querySelector('#files a[href="/packages/form/new.md"]')).toBe(null));
	expect(folderAt("packages").open).toBe(false);
	page.document
		.querySelector('#files a[href="/packages/changes/guide.md"]')
		?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	await waitFor(() => expect(page.window.location.pathname).toBe("/packages/changes/guide.md"));
	await waitFor(() => expect(folderAt("packages").open).toBe(true));
	expect(folderAt("packages/changes").open).toBe(true);
	expect(page.document.querySelector('#files a[aria-current="page"]')?.getAttribute("href")).toBe("/packages/changes/guide.md");
});
