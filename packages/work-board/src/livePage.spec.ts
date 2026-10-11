import { rmSync, statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage } from "#test/browser.ts";
import { faultyWatch } from "#test/faults.ts";
import { BOARD, FILES, openLive, PLAN, paragraphOf, STEPS, settle, TWINS, waitFor } from "#test/live.ts";
import { changesUntil, subscribe } from "#test/nativeRpc.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(FILES);
	board = yield* startBoard(notes.root, "board.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

const open = Effect.fn("Test.open")(function* (path: string, beforeScripts?: Parameters<typeof openLive>[2]) {
	page = yield* openLive(board, path, beforeScripts);
	return page;
});

function paragraph(text: string) {
	return paragraphOf(page, text);
}

function status() {
	return page.document.getElementById("live")?.textContent;
}

describe("live page", () => {
	effectApp("swaps an edited file into the open page without reloading it", function* () {
		yield* open("/plan.md");
		const intro = paragraph("Intro.");
		const details = page.document.querySelector("#doc details");
		if (details === null) {
			throw new Error("the page has no details block");
		}
		details.setAttribute("open", "");
		page.document.body.dataset.visit = "first";
		notes.write("plan.md", PLAN.replace("A closing line.", "A changed line."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("A changed line.")).toBeDefined()));
		expect(page.document.body.dataset.visit).toBe("first");
		expect(paragraph("Intro.")).toBe(intro);
		expect(page.document.querySelector("#doc details")?.hasAttribute("open")).toBe(true);
	});

	effectApp("updates the board's counts and the top bar when files change", function* () {
		yield* open("/");
		notes.write("board.md", `${BOARD}\n### \`ops\` Rotate the key\n`);
		notes.write("later/idea.md", "# Idea\n");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".counts")?.textContent).toBe("2 to do")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('#files a[href="/later/idea.md"]')?.textContent).toBe("idea")));
	});

	effectApp("shows that it is reconnecting and catches up once the connection is back", function* () {
		yield* open("/plan.md");
		const [stream] = page.streams;
		stream?.drop();
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("reconnecting")));
		const events = yield* subscribe(board);
		notes.write("plan.md", PLAN.replace("Intro.", "Written while offline."));
		yield* changesUntil(events, "plan.md");
		yield* events.close();
		stream?.connect();
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Written while offline.")).toBeDefined()));
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
	});

	effectApp("shows that it is reconnecting while the folder is not watched and catches up after", function* () {
		yield* board.stop();
		const faults = faultyWatch();
		board = yield* startBoard(notes.root, "board.md", faults.wrap);
		yield* open("/plan.md");
		yield* faults.fail();
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("reconnecting")));
		notes.write("plan.md", PLAN.replace("Intro.", "Written while unwatched."));
		faults.heal();
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Written while unwatched.")).toBeDefined()));
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
	});

	effectApp("catches up on a change made between loading the page and connecting", function* () {
		yield* open("/plan.md", () =>
			Effect.gen(function* () {
				const events = yield* subscribe(board);
				notes.write("plan.md", PLAN.replace("Intro.", "Written before connecting."));
				yield* changesUntil(events, "plan.md");
				yield* events.close();
			}),
		);
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Written before connecting.")).toBeDefined()));
	});

	effectApp("keeps the page and says so when a refresh gets an error or no answer", function* () {
		yield* open("/plan.md");
		page.pageRequests.failWith = 500;
		page.streams[0]?.emit("change");
		yield* Effect.promise(() => waitFor(() => expect(status()).toBe("refresh failed")));
		expect(paragraph("Intro.")).toBeDefined();
		expect(page.document.body.textContent).not.toContain("An error page from a proxy");
		page.pageRequests.failWith = "network";
		page.streams[0]?.emit("change");
		yield* Effect.promise(() => waitFor(() => expect(status()).toBe("refresh failed")));
		expect(paragraph("Intro.")).toBeDefined();
		page.pageRequests.failWith = undefined;
		notes.write("plan.md", PLAN.replace("Intro.", "Back again."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Back again.")).toBeDefined()));
		yield* Effect.promise(() => waitFor(() => expect(status()).toBe("live")));
	});

	effectApp("shows the not-found page and a top bar without the file when the open file is deleted", function* () {
		yield* open("/plan.md");
		rmSync(join(notes.root, "plan.md"));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#doc .empty")?.textContent).toBe("No markdown file at plan.md.")));
		expect(page.document.querySelector('#files a[href="/plan.md"]')).toBeNull();
		expect(status()).toBe("live");
	});

	effectApp("newer invalidation replaces a held read and the late result cannot overwrite it", function* () {
		yield* open("/plan.md");
		const before = page.pageRequests.answered;
		const older = held();
		page.pageRequests.responseGate = older.gate;
		notes.write("plan.md", PLAN.replace("Intro.", "Older source."));
		yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThan(before)));
		page.pageRequests.responseGate = undefined;
		notes.write("plan.md", PLAN.replace("Intro.", "Newest source."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Newest source.")).toBeDefined()));
		older.release();
		yield* Effect.promise(() => settle());
		expect(paragraph("Newest source.")).toBeDefined();
		expect(paragraph("Older source.")).toBeUndefined();
	});

	effectApp("keeps each of two same-named details blocks open or closed as it was", function* () {
		yield* open("/twins.md");
		const [, second] = page.document.querySelectorAll("#doc article details");
		second?.setAttribute("open", "");
		notes.write("twins.md", TWINS.replace("First.", "First, edited."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("First, edited.")).toBeDefined()));
		const [first, again] = page.document.querySelectorAll("#doc article details");
		expect(first?.hasAttribute("open")).toBe(false);
		expect(again?.hasAttribute("open")).toBe(true);
	});

	effectApp("keeps the open state with its block when a same-named details block is inserted above", function* () {
		yield* open("/twins.md");
		const [, second] = page.document.querySelectorAll("#doc article details");
		second?.setAttribute("open", "");
		notes.write("twins.md", TWINS.replace("# Twins\n\n", `# Twins\n\n${STEPS("Zero.")}\n\n`));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Zero.")).toBeDefined()));
		const state = [...page.document.querySelectorAll("#doc article details")].map((details) => [
			details.querySelector("p")?.textContent,
			details.hasAttribute("open"),
		]);
		expect(state).toEqual([
			["Zero.", false],
			["First.", false],
			["Second.", true],
		]);
	});

	effectApp("shows how long ago each file changed", function* () {
		const file = join(notes.root, "plan.md");
		const twoHoursEarlier = statSync(file).mtimeMs / 1000 - 2 * 60 * 60;
		utimesSync(file, twoHoursEarlier, twoHoursEarlier);
		yield* open("/plan.md");
		expect(page.document.querySelector('#files a[href="/plan.md"] + .age')?.textContent).toBe("2h");
		expect(page.document.querySelector("#doc .meta .age")?.textContent).toBe("updated 2h ago");
	});
});
