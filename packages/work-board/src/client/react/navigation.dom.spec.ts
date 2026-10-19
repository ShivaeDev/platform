import { realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import type { Folder } from "#test/board.ts";
import { boardStory } from "#test/boardStory.ts";
import { held, type OpenPage } from "#test/browser.ts";
import { followLink } from "#test/followLink.ts";
import { settle, waitFor } from "#test/live.ts";
import { navigationWorkspace } from "#test/pageTraits.ts";
import type { BoardReader } from "#test/readerVerbs.ts";
import { rpcCall, rpcFailure } from "#test/rpc.ts";

function key(notes: Folder) {
	return `work-board:library:${realpathSync(notes.root)}`;
}

function* open(reader: BoardReader, path = "/plan.md") {
	const page = yield* reader.open(path);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	return page;
}

function title(page: OpenPage) {
	return page.document.querySelector("#doc h1")?.textContent;
}

describe("document navigation", () => {
	for (const path of ["/_board/attachment/shots/review.png", "/_board/unsupported"]) {
		boardStory.it(`leaves non-document links to browser navigation (${path})`, [navigationWorkspace()], function* ({ reader, page: initialPage }) {
			let page = initialPage;
			page = yield* open(reader);
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
			reader.clickSelector("#browser-link");
			yield* Effect.promise(() => frame(page));
			expect(preventedByReader).toBe(false);
			yield* Effect.promise(() => settle());
			expect(page.window.location.pathname).toBe("/plan.md");
			expect(page.pageRequests.count).toBe(requests);
		});
	}

	boardStory.it(
		"opens returned-result review through native navigation without reloading",
		[navigationWorkspace()],
		function* ({ reader, page: initialPage }) {
			let page = initialPage;
			page = yield* open(reader, "/items/result.md");
			page.document.body.dataset.visit = "kept";
			reader.clickSelector('a[href="/_board/result?item=result.keyboard"]');
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Review result")));
			expect(title(page)).toBe("Review result");
			expect(page.document.body.dataset.visit).toBe("kept");
			expect(page.window.location.pathname).toBe("/_board/result");
			expect(page.window.location.search).toBe("?item=result.keyboard");
			expect(page.document.getElementById("doc")?.textContent).toContain("In review");
		},
	);

	boardStory.it(
		"opens templates through native navigation without losing the current reading page",
		[navigationWorkspace()],
		function* ({ reader, page: initialPage }) {
			let page = initialPage;
			page = yield* open(reader);
			page.document.body.dataset.visit = "kept";
			followLink(page, "/_board/start");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Templates")));
			expect(title(page)).toBe("Templates");
			expect(page.document.body.dataset.visit).toBe("kept");
			expect(page.window.location.pathname).toBe("/_board/start");
			page.window.history.back();
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Plan")));
		},
	);

	boardStory.it(
		"navigates without reloading and restores selection and open details through back and forward",
		[navigationWorkspace()],
		function* ({ reader, page: initialPage }) {
			let page = initialPage;
			page = yield* open(reader);
			page.window.document.body.dataset.visit = "kept";
			const details = page.document.querySelector("article details");
			details?.setAttribute("open", "");
			const text = page.document.querySelector("article p")?.firstChild;
			if (text === undefined || text === null) {
				throw new Error("Missing text");
			}
			page.window.getSelection()?.setBaseAndExtent(text, 0, text, 5);
			followLink(page, "/flow.md");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
			expect(page.document.body.dataset.visit).toBe("kept");
			expect(page.window.location.pathname).toBe("/flow.md");
			page.window.history.back();
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Plan")));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true)));
			expect(page.window.getSelection()?.toString()).toBe("Intro");
			page.window.history.forward();
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
		},
	);

	boardStory.it(
		"stores workspace favorites and deduplicated recents while live updates keep the current title fresh",
		[navigationWorkspace()],
		function* ({ notes, reader, page: initialPage }) {
			let page = initialPage;
			page = yield* open(reader);
			reader.clickSelector("#favorite-toggle");
			yield* Effect.promise(() => frame(page));
			expect(page.document.getElementById("favorite-toggle")?.getAttribute("aria-pressed")).toBe("true");
			followLink(page, "/flow.md");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
			const saved = JSON.parse(page.window.localStorage.getItem(key(notes)) ?? "null");
			expect(saved.favorites).toEqual([{ file: "plan.md", title: "Plan" }]);
			expect(saved.recents.map((item: { file: string }) => item.file)).toEqual(["flow.md", "plan.md"]);
			notes.write("flow.md", "# New flow\n\nUpdated evidence.");
			yield* Effect.promise(() => waitFor(() => expect(page.document.title).toBe("New flow · Work Board")));
			yield* Effect.promise(() =>
				waitFor(() =>
					expect(page.document.querySelector('section[aria-label="Recent"] a[aria-current="page"]')?.getAttribute("title")).toBe("New flow"),
				),
			);
		},
	);

	for (const failWith of [undefined, 503, "network"] as const) {
		boardStory.it(
			`ignores an old page refresh after newer navigation (${failWith})`,
			[navigationWorkspace()],
			function* ({ reader, page: initialPage }) {
				let page = initialPage;
				page = yield* open(reader);
				const response = held();
				const reads = page.pageRequests.count;
				page.pageRequests.gate = response.gate;
				page.pageRequests.failWith = failWith;
				page.streams[0]?.emit("change");
				yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.count).toBe(reads + 1)));
				followLink(page, "/flow.md");
				yield* Effect.promise(() => frame(page));
				yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
				response.release();
				yield* Effect.promise(() => settle());
				expect(title(page)).toBe("Flow");
				expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live");
				expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("flow.md");
			},
		);
	}

	boardStory.it(
		"keeps a deleted favorite visible and explains the missing target",
		[navigationWorkspace()],
		function* ({ notes, reader, page: initialPage }) {
			let page = initialPage;
			page = yield* open(reader);
			reader.clickSelector("#favorite-toggle");
			yield* Effect.promise(() => frame(page));
			followLink(page, "/flow.md");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
			reader.clickSelector("#library-open");
			rmSync(join(notes.root, "plan.md"));
			yield* Effect.promise(() =>
				waitFor(() => expect(page.document.querySelector('#reading-library a[href="/plan.md"]')?.textContent).toContain("missing")),
			);
			reader.clickSelector('#reading-library a[href="/plan.md"]');
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() =>
				waitFor(() => expect(page.document.getElementById("navigation-status")?.textContent).toContain("missing or was renamed")),
			);
			expect(page.document.getElementById("doc")?.textContent).toContain("No markdown file at plan.md.");
		},
	);
});

boardStory.it(
	"restores this workspace's library and tab reading record while ignoring unrelated and malformed entries",
	[navigationWorkspace()],
	function* ({ notes, reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/plan.md", (window) => {
			window.localStorage.setItem(`${key(notes)}-other`, JSON.stringify({ favorites: [{ file: "twins.md", title: "Twins" }] }));
			window.localStorage.setItem(
				key(notes),
				JSON.stringify({ favorites: [{ file: "flow.md", title: "Flow" }, { file: "twins.md" }], recents: "invalid" }),
			);
			window.history.replaceState({ workBoard: { id: "restored" } }, "");
			window.sessionStorage.setItem(
				`work-board:reading:${realpathSync(notes.root)}`,
				JSON.stringify({ restored: { details: [false, true], scroll: [0, 0], selection: null, sidebar: 0 } }),
			);
		});
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true)));
		expect(page.document.querySelector('section[aria-label="Pinned"] a[href="/flow.md"]')?.textContent).toBe("Flow");
		expect(page.document.querySelector('section[aria-label="Pinned"] a[href="/twins.md"]')).toBe(null);
	},
);

boardStory.it(
	"keeps favorites usable across document navigation when browser storage is blocked",
	[navigationWorkspace()],
	function* ({ reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/plan.md", (window) => {
			Object.defineProperty(window, "localStorage", {
				get: () => {
					throw new Error("Blocked storage");
				},
			});
		});
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
		reader.clickSelector("#favorite-toggle");
		yield* Effect.promise(() => frame(page));
		expect(page.document.getElementById("favorite-toggle")?.getAttribute("aria-pressed")).toBe("true");
		followLink(page, "/flow.md");
		yield* Effect.promise(() => frame(page));
		yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
		expect(page.document.querySelector('section[aria-label="Pinned"] a[href="/plan.md"]')?.textContent).toBe("Plan");
		expect(page.document.querySelector(".library-status")?.textContent).toContain("this page only");
	},
);

boardStory.it("retains reading history when the selected file is opened again", [navigationWorkspace()], function* ({ reader, page: initialPage }) {
	let page = initialPage;
	page = yield* reader.open("/plan.md", (window) => {
		window.history.replaceState({ workBoard: { id: "selected-file" } }, "");
	});
	page.document.querySelector("article details")?.setAttribute("open", "");
	followLink(page, "/plan.md");
	yield* Effect.promise(() => frame(page));
	yield* Effect.promise(() => settle());
	expect(page.window.history.state).toMatchObject({ workBoard: { id: "selected-file" } });
	followLink(page, "/flow.md");
	yield* Effect.promise(() => frame(page));
	yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Plan")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true)));
});

boardStory.it("retries the same route after a navigation request fails", [navigationWorkspace()], function* ({ reader, page: initialPage }) {
	let page = initialPage;
	let fail = false;
	page = yield* reader.open("/plan.md", (window) => {
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
	yield* Effect.promise(() => frame(page));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("navigation-status")?.textContent).toContain("Could not open")));
	expect(title(page)).toBeUndefined();
	expect(page.window.location.pathname).toBe("/flow.md");
	expect(page.document.getElementById("doc")?.textContent).toContain("This document could not be opened");
	fail = false;
	followLink(page, "/flow.md");
	yield* Effect.promise(() => frame(page));
	yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Flow")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("navigation-status")?.textContent).toBe("")));
});

function frame(page: OpenPage) {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
