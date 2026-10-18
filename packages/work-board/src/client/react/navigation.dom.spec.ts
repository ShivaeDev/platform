import { realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage, openPage } from "#test/browser.ts";
import { followLink } from "#test/followLink.ts";
import { FILES, settle, waitFor } from "#test/live.ts";
import { REVIEW_TASK, reviewResult } from "#test/resultReview.ts";
import { rpcCall, rpcFailure } from "#test/rpc.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder({ ...FILES, "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK });
	board = yield* startBoard(notes.root, "board.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
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

const open = Effect.fn("Test.open")(function* (path = "/plan.md") {
	page = yield* openPage(board, path);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
});

function title() {
	return page.document.querySelector("#doc h1")?.textContent;
}

describe("document navigation", () => {
	effectApp.each(["/_board/attachment/shots/review.png", "/_board/unsupported"])(
		"leaves non-document links to browser navigation (%s)",
		function* (path) {
			yield* open();
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
			yield* Effect.promise(frame);
			expect(preventedByReader).toBe(false);
			yield* Effect.promise(() => settle());
			expect(page.window.location.pathname).toBe("/plan.md");
			expect(page.pageRequests.count).toBe(requests);
		},
	);

	effectApp("opens returned-result review through native navigation without reloading", function* () {
		yield* open("/items/result.md");
		page.document.body.dataset.visit = "kept";
		click('a[href="/_board/result?item=result.keyboard"]');
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Review returned result · result.keyboard")));
		expect(title()).toBe("Review returned result · result.keyboard");
		expect(page.document.body.dataset.visit).toBe("kept");
		expect(page.window.location.pathname).toBe("/_board/result");
		expect(page.window.location.search).toBe("?item=result.keyboard");
		expect(page.document.getElementById("doc")?.textContent).toContain("source status: in-review");
	});

	effectApp("opens templates through native navigation without losing the current reading page", function* () {
		yield* open();
		page.document.body.dataset.visit = "kept";
		followLink(page, "/_board/start");
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Project and report templates")));
		expect(title()).toBe("Project and report templates");
		expect(page.document.body.dataset.visit).toBe("kept");
		expect(page.window.location.pathname).toBe("/_board/start");
		page.window.history.back();
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Plan")));
	});

	effectApp("navigates without reloading and restores selection and open details through back and forward", function* () {
		yield* open();
		page.window.document.body.dataset.visit = "kept";
		const details = page.document.querySelector("article details");
		details?.setAttribute("open", "");
		const text = page.document.querySelector("article p")?.firstChild;
		if (text === undefined || text === null) {
			throw new Error("Missing text");
		}
		page.window.getSelection()?.setBaseAndExtent(text, 0, text, 5);
		followLink(page, "/flow.md");
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
		expect(page.document.body.dataset.visit).toBe("kept");
		expect(page.window.location.pathname).toBe("/flow.md");
		page.window.history.back();
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Plan")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true)));
		expect(page.window.getSelection()?.toString()).toBe("Intro");
		page.window.history.forward();
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
	});

	effectApp("stores workspace favorites and deduplicated recents while live updates keep the current title fresh", function* () {
		yield* open();
		click("#favorite-toggle");
		yield* Effect.promise(frame);
		expect(page.document.getElementById("favorite-toggle")?.getAttribute("aria-pressed")).toBe("true");
		followLink(page, "/flow.md");
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
		const saved = JSON.parse(page.window.localStorage.getItem(key()) ?? "null");
		expect(saved.favorites).toEqual([{ file: "plan.md", title: "Plan" }]);
		expect(saved.recents.map((item: { file: string }) => item.file)).toEqual(["flow.md", "plan.md"]);
		notes.write("flow.md", "# New flow\n\nUpdated evidence.");
		yield* Effect.promise(() => waitFor(() => expect(page.document.title).toBe("New flow · Work Board")));
		yield* Effect.promise(() =>
			waitFor(() =>
				expect(page.document.querySelector('section[aria-label="Recent"] a[aria-current="page"]')?.getAttribute("title")).toBe("New flow"),
			),
		);
	});

	effectApp.each([undefined, 503, "network"] as const)("ignores an old page refresh after newer navigation (%s)", function* (failWith) {
		yield* open();
		const response = held();
		const reads = page.pageRequests.count;
		page.pageRequests.gate = response.gate;
		page.pageRequests.failWith = failWith;
		page.streams[0]?.emit("change");
		yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.count).toBe(reads + 1)));
		followLink(page, "/flow.md");
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
		response.release();
		yield* Effect.promise(() => settle());
		expect(title()).toBe("Flow");
		expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live");
		expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("flow.md");
	});

	effectApp("keeps a deleted favorite visible and explains the missing target", function* () {
		yield* open();
		click("#favorite-toggle");
		yield* Effect.promise(frame);
		followLink(page, "/flow.md");
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
		click("#library-open");
		rmSync(join(notes.root, "plan.md"));
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.querySelector('#reading-library a[href="/plan.md"]')?.textContent).toContain("missing")),
		);
		click('#reading-library a[href="/plan.md"]');
		yield* Effect.promise(frame);
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.getElementById("navigation-status")?.textContent).toContain("missing or was renamed")),
		);
		expect(page.document.getElementById("doc")?.textContent).toContain("No markdown file at plan.md.");
	});
});

effectApp("restores this workspace's library and tab reading record while ignoring unrelated and malformed entries", function* () {
	page = yield* openPage(board, "/plan.md", (window) => {
		window.localStorage.setItem(`${key()}-other`, JSON.stringify({ favorites: [{ file: "twins.md", title: "Twins" }] }));
		window.localStorage.setItem(key(), JSON.stringify({ favorites: [{ file: "flow.md", title: "Flow" }, { file: "twins.md" }], recents: "invalid" }));
		window.history.replaceState({ workBoard: { id: "restored" } }, "");
		window.sessionStorage.setItem(
			`work-board:reading:${realpathSync(notes.root)}`,
			JSON.stringify({ restored: { details: [false, true], scroll: [0, 0], selection: null, sidebar: 0 } }),
		);
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true)));
	expect(page.document.querySelector('section[aria-label="Pinned"] a[href="/flow.md"]')?.textContent).toBe("Flow");
	expect(page.document.querySelector('section[aria-label="Pinned"] a[href="/twins.md"]')).toBe(null);
});

effectApp("keeps favorites usable across document navigation when browser storage is blocked", function* () {
	page = yield* openPage(board, "/plan.md", (window) => {
		Object.defineProperty(window, "localStorage", {
			get: () => {
				throw new Error("Blocked storage");
			},
		});
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
	click("#favorite-toggle");
	yield* Effect.promise(frame);
	expect(page.document.getElementById("favorite-toggle")?.getAttribute("aria-pressed")).toBe("true");
	followLink(page, "/flow.md");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
	expect(page.document.querySelector('section[aria-label="Pinned"] a[href="/plan.md"]')?.textContent).toBe("Plan");
	expect(page.document.querySelector(".library-status")?.textContent).toContain("this page only");
});

effectApp("retains reading history when the selected file is opened again", function* () {
	page = yield* openPage(board, "/plan.md", (window) => {
		window.history.replaceState({ workBoard: { id: "selected-file" } }, "");
	});
	page.document.querySelector("article details")?.setAttribute("open", "");
	followLink(page, "/plan.md");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => settle());
	expect(page.window.history.state).toMatchObject({ workBoard: { id: "selected-file" } });
	followLink(page, "/flow.md");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Plan")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true)));
});

effectApp("retries the same route after a navigation request fails", function* () {
	let fail = false;
	page = yield* openPage(board, "/plan.md", (window) => {
		const fetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			const call = await rpcCall(window, input, init);
			if (fail && call?.tag === "work-board.document" && JSON.stringify(call.payload).includes(JSON.stringify("/flow.md"))) {
				return rpcFailure(window, call, new InternalServerError({ message: "Page rendering is unavailable." }));
			}
			return fetch(input, init);
		};
	});
	fail = true;
	followLink(page, "/flow.md");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("navigation-status")?.textContent).toContain("Could not open")));
	expect(title()).toBeUndefined();
	expect(page.window.location.pathname).toBe("/flow.md");
	expect(page.document.getElementById("doc")?.textContent).toContain("This document could not be opened");
	fail = false;
	followLink(page, "/flow.md");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(title()).toBe("Flow")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("navigation-status")?.textContent).toBe("")));
});

function frame() {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
