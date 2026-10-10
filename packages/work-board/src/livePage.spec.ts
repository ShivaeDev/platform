import { rmSync, statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changesUntil, type Folder, folder, type RunningBoard, startBoard, subscribe } from "#test/board.ts";
import { held, type OpenPage } from "#test/browser.ts";
import { faultyWatch } from "#test/faults.ts";
import { BOARD, FILES, openLive, PLAN, paragraphOf, STEPS, settle, TWINS, waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

beforeEach(async () => {
	notes = folder(FILES);
	board = await startBoard(notes.root, "board.md");
});

afterEach(async () => {
	await page.close();
	await board.stop();
	notes.remove();
});

async function open(path: string, beforeScripts?: () => Promise<void>) {
	page = await openLive(board, path, beforeScripts);
	return page;
}

function paragraph(text: string) {
	return paragraphOf(page, text);
}
function status() {
	return page.document.getElementById("live")?.textContent;
}

describe("live page", () => {
	it("swaps an edited file into the open page without reloading it", async () => {
		await open("/plan.md");
		const intro = paragraph("Intro.");
		const details = page.document.querySelector("#doc details");
		if (details === null) {
			throw new Error("the page has no details block");
		}
		details.setAttribute("open", "");
		page.document.body.dataset.visit = "first";
		notes.write("plan.md", PLAN.replace("A closing line.", "A changed line."));
		await waitFor(() => expect(paragraph("A changed line.")).toBeDefined());
		expect(page.document.body.dataset.visit).toBe("first");
		expect(paragraph("Intro.")).toBe(intro);
		expect(page.document.querySelector("#doc details")?.hasAttribute("open")).toBe(true);
	});

	it("updates the board's counts and the top bar when files change", async () => {
		await open("/");
		notes.write("board.md", `${BOARD}\n### \`ops\` Rotate the key\n`);
		notes.write("later/idea.md", "# Idea\n");
		await waitFor(() => expect(page.document.querySelector(".counts")?.textContent).toBe("2 to do"));
		await waitFor(() => expect(page.document.querySelector('#files a[href="/later/idea.md"]')?.textContent).toBe("idea"));
	});

	it("shows that it is reconnecting and catches up once the connection is back", async () => {
		await open("/plan.md");
		const [stream] = page.streams;
		stream?.drop();
		await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("reconnecting"));
		const events = await subscribe(board);
		notes.write("plan.md", PLAN.replace("Intro.", "Written while offline."));
		await changesUntil(events, "plan.md");
		events.close();
		stream?.connect();
		await waitFor(() => expect(paragraph("Written while offline.")).toBeDefined());
		await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live"));
	});

	it("shows that it is reconnecting while the folder is not watched and catches up after", async () => {
		await board.stop();
		const faults = faultyWatch();
		board = await startBoard(notes.root, "board.md", faults.wrap);
		await open("/plan.md");
		faults.fail();
		await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("reconnecting"));
		notes.write("plan.md", PLAN.replace("Intro.", "Written while unwatched."));
		faults.heal();
		await waitFor(() => expect(paragraph("Written while unwatched.")).toBeDefined());
		await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live"));
	});

	it("catches up on a change made between loading the page and connecting", async () => {
		await open("/plan.md", async () => {
			const events = await subscribe(board);
			notes.write("plan.md", PLAN.replace("Intro.", "Written before connecting."));
			await changesUntil(events, "plan.md");
			events.close();
		});
		await waitFor(() => expect(paragraph("Written before connecting.")).toBeDefined());
	});

	it("keeps the page and says so when a refresh gets an error or no answer", async () => {
		await open("/plan.md");
		page.pageRequests.failWith = 500;
		page.streams[0]?.emit("change");
		await waitFor(() => expect(status()).toBe("refresh failed"));
		expect(paragraph("Intro.")).toBeDefined();
		expect(page.document.body.textContent).not.toContain("An error page from a proxy");
		page.pageRequests.failWith = "network";
		page.streams[0]?.emit("change");
		await waitFor(() => expect(status()).toBe("refresh failed"));
		expect(paragraph("Intro.")).toBeDefined();
		page.pageRequests.failWith = undefined;
		notes.write("plan.md", PLAN.replace("Intro.", "Back again."));
		await waitFor(() => expect(paragraph("Back again.")).toBeDefined());
		await waitFor(() => expect(status()).toBe("live"));
	});

	it("shows the not-found page and a top bar without the file when the open file is deleted", async () => {
		await open("/plan.md");
		rmSync(join(notes.root, "plan.md"));
		await waitFor(() => expect(page.document.querySelector("#doc .empty")?.textContent).toBe("No markdown file at plan.md."));
		expect(page.document.querySelector('#files a[href="/plan.md"]')).toBeNull();
		expect(status()).toBe("live");
	});

	it("newer invalidation replaces a held read and the late result cannot overwrite it", async () => {
		await open("/plan.md");
		const before = page.pageRequests.answered;
		const older = held();
		page.pageRequests.responseGate = older.gate;
		notes.write("plan.md", PLAN.replace("Intro.", "Older source."));
		await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThan(before));
		page.pageRequests.responseGate = undefined;
		notes.write("plan.md", PLAN.replace("Intro.", "Newest source."));
		await waitFor(() => expect(paragraph("Newest source.")).toBeDefined());
		older.release();
		await settle();
		expect(paragraph("Newest source.")).toBeDefined();
		expect(paragraph("Older source.")).toBeUndefined();
	});

	it("keeps each of two same-named details blocks open or closed as it was", async () => {
		await open("/twins.md");
		const [, second] = page.document.querySelectorAll("#doc article details");
		second?.setAttribute("open", "");
		notes.write("twins.md", TWINS.replace("First.", "First, edited."));
		await waitFor(() => expect(paragraph("First, edited.")).toBeDefined());
		const [first, again] = page.document.querySelectorAll("#doc article details");
		expect(first?.hasAttribute("open")).toBe(false);
		expect(again?.hasAttribute("open")).toBe(true);
	});

	it("keeps the open state with its block when a same-named details block is inserted above", async () => {
		await open("/twins.md");
		const [, second] = page.document.querySelectorAll("#doc article details");
		second?.setAttribute("open", "");
		notes.write("twins.md", TWINS.replace("# Twins\n\n", `# Twins\n\n${STEPS("Zero.")}\n\n`));
		await waitFor(() => expect(paragraph("Zero.")).toBeDefined());
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

	it("shows how long ago each file changed", async () => {
		const file = join(notes.root, "plan.md");
		const twoHoursEarlier = statSync(file).mtimeMs / 1000 - 2 * 60 * 60;
		utimesSync(file, twoHoursEarlier, twoHoursEarlier);
		await open("/plan.md");
		expect(page.document.querySelector('#files a[href="/plan.md"] + .age')?.textContent).toBe("2h");
		expect(page.document.querySelector("#doc .meta .age")?.textContent).toBe("updated 2h ago");
	});
});
