import { realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage, openPage } from "#test/browser.ts";
import { FILES, settle, waitFor } from "#test/live.ts";
import { REVIEW_TASK, reviewResult } from "#test/resultReview.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
beforeEach(async () => {
	notes = folder({ ...FILES, "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK });
	board = await startBoard(notes.root, "board.md");
});
afterEach(async () => {
	await page?.close();
	await board.stop();
	notes.remove();
});
function key() {
	return `work-board:library:${realpathSync(notes.root)}`;
}
function click(selector: string) {
	const target = page.document.querySelector(selector);
	if (target === null) {
		throw new Error(`Missing ${selector}`);
	}
	target.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}
async function open(path = "/plan.md") {
	page = await openPage(board, path);
	await waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false));
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
}
function title() {
	return page.document.querySelector("#doc h1")?.textContent;
}

describe("document navigation", () => {
	it.each(["/_board/attachment/shots/review.png", "/_board/unsupported"])("leaves non-document links to browser navigation (%s)", async (path) => {
		await open();
		const requests = page.pageRequests.count;
		const link = page.document.createElement("a");
		link.id = "browser-link";
		link.href = path;
		page.document.body.append(link);
		let preventedByReader: boolean | undefined;
		page.document.addEventListener(
			"click",
			(event) => {
				preventedByReader = event.defaultPrevented;
				event.preventDefault();
			},
			{ once: true },
		);
		click("#browser-link");
		expect(preventedByReader).toBe(false);
		await settle();
		expect(page.window.location.pathname).toBe("/plan.md");
		expect(page.pageRequests.count).toBe(requests);
	});

	it("opens returned-result review through native navigation without reloading", async () => {
		await open("/items/result.md");
		page.document.body.dataset.visit = "kept";
		click('a[href="/_board/result?item=result.keyboard"]');
		await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-view")).toBe("result"));
		expect(title()).toBe("Review returned result · result.keyboard");
		expect(page.document.body.dataset.visit).toBe("kept");
		expect(page.window.location.pathname).toBe("/_board/result");
		expect(page.window.location.search).toBe("?item=result.keyboard");
		expect(page.document.getElementById("doc")?.textContent).toContain("source status: in-review");
	});

	it("opens templates through native navigation without losing the current reading page", async () => {
		await open();
		page.document.body.dataset.visit = "kept";
		click("#start-open");
		await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-view")).toBe("start"));
		expect(title()).toBe("Project and report templates");
		expect(page.document.body.dataset.visit).toBe("kept");
		expect(page.window.location.pathname).toBe("/_board/start");
		page.window.history.back();
		await waitFor(() => expect(title()).toBe("Plan"));
	});

	it("navigates without reloading and restores selection and open details through back and forward", async () => {
		await open();
		page.window.document.body.dataset.visit = "kept";
		const details = page.document.querySelector("article details");
		details?.setAttribute("open", "");
		const text = page.document.querySelector("article p")?.firstChild;
		if (text === undefined || text === null) {
			throw new Error("Missing text");
		}
		page.window.getSelection()?.setBaseAndExtent(text, 0, text, 5);
		click('#files a[href="/flow.md"]');
		await settle();
		await waitFor(() => expect(title()).toBe("Flow"));
		expect(page.document.body.dataset.visit).toBe("kept");
		expect(page.window.location.pathname).toBe("/flow.md");
		page.window.history.back();
		await settle();
		await waitFor(() => expect(title()).toBe("Plan"));
		expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true);
		expect(page.window.getSelection()?.toString()).toBe("Intro");
		page.window.history.forward();
		await settle();
		await waitFor(() => expect(title()).toBe("Flow"));
	});

	it("stores workspace favorites and deduplicated recents while live updates keep the current title fresh", async () => {
		await open();
		click("#favorite-toggle");
		expect(page.document.getElementById("favorite-toggle")?.getAttribute("aria-pressed")).toBe("true");
		click('#files a[href="/flow.md"]');
		await settle();
		await waitFor(() => expect(title()).toBe("Flow"));
		const saved = JSON.parse(page.window.localStorage.getItem(key()) ?? "null");
		expect(saved.favorites).toEqual([{ file: "plan.md", title: "Plan" }]);
		expect(saved.recents.map((item: { file: string }) => item.file)).toEqual(["flow.md", "plan.md"]);
		notes.write("flow.md", "# New flow\n\nUpdated evidence.");
		await waitFor(() => expect(page.document.title).toBe("New flow · Work Board"));
		expect(page.document.querySelector('#files a[aria-current="page"]')?.getAttribute("title")).toBe("New flow");
	});

	it.each([undefined, 503, "network"] as const)("ignores an old page refresh after newer navigation (%s)", async (failWith) => {
		await open();
		const response = held();
		page.pageRequests.gate = response.gate;
		page.pageRequests.failWith = failWith;
		page.streams[0]?.emit("change");
		await waitFor(() => expect(page.pageRequests.count).toBe(2));
		click('#files a[href="/flow.md"]');
		await settle();
		await waitFor(() => expect(title()).toBe("Flow"));
		response.release();
		await settle();
		expect(title()).toBe("Flow");
		expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live");
		expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("flow.md");
	});

	it("keeps a deleted favorite visible and explains the missing target", async () => {
		await open();
		click("#favorite-toggle");
		click('#files a[href="/flow.md"]');
		await settle();
		await waitFor(() => expect(title()).toBe("Flow"));
		rmSync(join(notes.root, "plan.md"));
		await waitFor(() => expect(page.document.querySelector('#reading-library a[href="/plan.md"]')?.textContent).toContain("missing"));
		click('#reading-library a[href="/plan.md"]');
		await waitFor(() => expect(page.document.getElementById("navigation-status")?.textContent).toContain("missing or was renamed"));
		expect(page.document.getElementById("doc")?.textContent).toContain("No markdown file at plan.md.");
	});
});

it("restores this workspace's library and tab reading record while ignoring unrelated and malformed entries", async () => {
	page = await openPage(board, "/plan.md", (window) => {
		window.localStorage.setItem(`${key()}-other`, JSON.stringify({ favorites: [{ file: "twins.md", title: "Twins" }] }));
		window.localStorage.setItem(key(), JSON.stringify({ favorites: [{ file: "flow.md", title: "Flow" }, { file: "twins.md" }], recents: "invalid" }));
		window.history.replaceState({ workBoard: { id: "restored" } }, "");
		window.sessionStorage.setItem(
			`work-board:reading:${realpathSync(notes.root)}`,
			JSON.stringify({ restored: { details: [false, true], scroll: [0, 0], selection: null, sidebar: 0 } }),
		);
	});
	await waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true));
	expect(page.document.querySelector('#reading-library a[href="/flow.md"]')?.textContent).toBe("Flow");
	expect(page.document.querySelector('#reading-library a[href="/twins.md"]')).toBe(null);
});

it("keeps favorites usable across document navigation when browser storage is blocked", async () => {
	page = await openPage(board, "/plan.md", (window) => {
		Object.defineProperty(window, "localStorage", {
			get: () => {
				throw new Error("Blocked storage");
			},
		});
	});
	await waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false));
	click("#favorite-toggle");
	expect(page.document.getElementById("favorite-toggle")?.getAttribute("aria-pressed")).toBe("true");
	click('#files a[href="/flow.md"]');
	await waitFor(() => expect(title()).toBe("Flow"));
	expect(page.document.querySelector('#reading-library a[href="/plan.md"]')?.textContent).toBe("Plan");
	expect(page.document.querySelector(".library-status")?.textContent).toContain("this page only");
});
