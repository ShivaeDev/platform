import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { rpcCall, rpcResponse } from "#test/rpc.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

function click(selector: string) {
	page.document.querySelector(selector)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}

function query(text: string) {
	const input = page.document.querySelector("#search-query");
	if (!(input instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing input");
	}
	input.value = text;
	input.dispatchEvent(new page.window.Event("input", { bubbles: true }));
}

it.live("ignores a delayed older search even when its transport ignores cancellation", function* () {
	notes = folder({ "note.md": "# Plan" });
	board = yield* startBoard(notes.root);
	const delayed = held();
	let requested = false;
	page = yield* openPage(board, "/note.md", (window) => {
		const original = window.fetch.bind(window);
		window.fetch = async (url, options) => {
			const call = await rpcCall(window, url, options);
			if (call?.tag !== "work-board.search") {
				return original(url, options);
			}
			const old = JSON.stringify(call.payload).includes("old");
			if (old) {
				requested = true;
				await delayed.gate;
			}
			return rpcResponse(window, call, {
				results: [{ file: "note.md", href: "/note.md", kind: "document", snippet: "note", text: "note", title: old ? "Old" : "New" }],
				total: 1,
				unavailable: [],
			});
		};
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
	click("#search-open");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("search-query")).not.toBeNull()));
	query("old");
	yield* Effect.promise(() => waitFor(() => expect(requested).toBe(true)));
	query("new");
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-results strong")?.textContent).toBe("New")));
	delayed.release();
	yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 100)));
	expect(page.document.querySelector("#search-results strong")?.textContent).toBe("New");
});

it.live("reports search failures, allows retry, and renders snippets as text", function* () {
	notes = folder({ "note.md": "# Plan" });
	board = yield* startBoard(notes.root);
	let failed = true;
	page = yield* openPage(board, "/note.md", (window) => {
		const original = window.fetch.bind(window);
		window.fetch = async (url, options) => {
			const call = await rpcCall(window, url, options);
			if (call?.tag !== "work-board.search") {
				return original(url, options);
			}
			if (failed) {
				return Promise.resolve(new window.Response("failure", { status: 503 }));
			}
			return rpcResponse(window, call, {
				results: [{ file: "note.md", href: "/note.md", kind: "passage", snippet: "<script>bad()</script>", text: "note", title: "<img src=x>" }],
				total: 1,
				unavailable: ["unreadable.md"],
			});
		};
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
	click("#search-open");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("search-query")).not.toBeNull()));
	query("phrase");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("search-status")?.textContent).toContain("retry")));
	failed = false;
	page.document.getElementById("search-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-results strong")?.textContent).toBe("<img src=x>")));
	expect(page.document.querySelector("#search-results script, #search-results img")).toBe(null);
	expect(page.document.getElementById("search-status")?.textContent).toContain("results are incomplete");
});
