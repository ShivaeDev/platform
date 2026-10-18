import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { held } from "#test/browser.ts";
import { faultyWatch } from "#test/faults.ts";
import { BOARD, FILES, PLAN, settle, steps, TWINS, waitFor } from "#test/live.ts";
import { changesUntil, rpcNavigation } from "#test/nativeRpc.ts";

const liveProject = [projectFiles(FILES), boardHome("board.md")];

describe("live page", () => {
	boardStory.it("swaps an edited file into the open page without reloading it", liveProject, function* ({ openLivePage, paragraph, editFile }) {
		const page = yield* openLivePage("/plan.md");
		const intro = paragraph("Intro.");
		expect(intro).toBeDefined();
		const details = page.document.querySelector("#doc details");
		if (details === null) {
			throw new Error("the page has no details block");
		}
		details.setAttribute("open", "");
		page.document.body.dataset.visit = "first";
		editFile("plan.md", PLAN.replace("A closing line.", "A changed line."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("A changed line.")).toBeDefined()));
		expect(page.document.body.dataset.visit).toBe("first");
		expect(paragraph("Intro.")).toBe(intro);
		expect(page.document.querySelector("#doc details")?.hasAttribute("open")).toBe(true);
	});

	boardStory.it(
		"updates the board's counts and the top bar when files change",
		liveProject,
		function* ({ board, openLivePage, editFile, waitUntil }) {
			const page = yield* openLivePage("/board.md");
			editFile("board.md", `${BOARD}\n### \`ops\` Rotate the key\n`);
			editFile("later/idea.md", "# Idea\n");
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".counts")?.textContent).toBe("2 to do")));
			yield* waitUntil(async () => expect((await Effect.runPromise(rpcNavigation(board))).counts.library).toBe(Object.keys(FILES).length + 1));
		},
	);

	boardStory.it(
		"shows that it is reconnecting and catches up once the connection is back",
		liveProject,
		function* ({ openLivePage, paragraph, editFile, watchProject, dropConnection, reconnect }) {
			const page = yield* openLivePage("/plan.md");
			dropConnection();
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("reconnecting")));
			const events = yield* watchProject();
			editFile("plan.md", PLAN.replace("Intro.", "Written while offline."));
			yield* changesUntil(events, "plan.md");
			yield* events.close();
			reconnect();
			yield* Effect.promise(() => waitFor(() => expect(paragraph("Written while offline.")).toBeDefined()));
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
		},
	);

	boardStory.it(
		"shows that it is reconnecting while the folder is not watched and catches up after",
		liveProject,
		function* ({ board, start, openLivePage, paragraph, editFile }) {
			yield* board.stop();
			const faults = faultyWatch();
			board = yield* start({ home: "board.md", wrap: faults.wrap });
			const page = yield* openLivePage("/plan.md");
			yield* faults.fail();
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("reconnecting")));
			editFile("plan.md", PLAN.replace("Intro.", "Written while unwatched."));
			faults.heal();
			yield* Effect.promise(() => waitFor(() => expect(paragraph("Written while unwatched.")).toBeDefined()));
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
		},
	);

	boardStory.it(
		"catches up on a change made between loading the page and connecting",
		liveProject,
		function* ({ openLivePage, paragraph, editFile, watchProject }) {
			yield* openLivePage("/plan.md", () =>
				Effect.gen(function* () {
					const events = yield* watchProject();
					editFile("plan.md", PLAN.replace("Intro.", "Written before connecting."));
					yield* changesUntil(events, "plan.md");
					yield* events.close();
				}),
			);
			yield* Effect.promise(() => waitFor(() => expect(paragraph("Written before connecting.")).toBeDefined()));
		},
	);

	boardStory.it(
		"keeps the page and says so when a refresh gets an error or no answer",
		liveProject,
		function* ({ openLivePage, paragraph, liveStatus, editFile, requestResync }) {
			const page = yield* openLivePage("/plan.md");
			page.pageRequests.failWith = 500;
			requestResync();
			yield* Effect.promise(() => waitFor(() => expect(liveStatus()).toBe("refresh failed")));
			expect(paragraph("Intro.")).toBeDefined();
			expect(page.document.body.textContent).not.toContain("An error page from a proxy");
			page.pageRequests.failWith = "network";
			requestResync();
			yield* Effect.promise(() => waitFor(() => expect(liveStatus()).toBe("refresh failed")));
			expect(paragraph("Intro.")).toBeDefined();
			page.pageRequests.failWith = undefined;
			editFile("plan.md", PLAN.replace("Intro.", "Back again."));
			yield* Effect.promise(() => waitFor(() => expect(paragraph("Back again.")).toBeDefined()));
			yield* Effect.promise(() => waitFor(() => expect(liveStatus()).toBe("live")));
		},
	);

	boardStory.it(
		"shows the not-found page and a top bar without the file when the open file is deleted",
		liveProject,
		function* ({ board, openLivePage, liveStatus, removeFile }) {
			const page = yield* openLivePage("/plan.md");
			removeFile("plan.md");
			yield* Effect.promise(() =>
				waitFor(() => expect(page.document.querySelector("#doc .empty")?.textContent).toBe("No markdown file at plan.md.")),
			);
			expect((yield* rpcNavigation(board)).counts.library).toBe(Object.keys(FILES).length - 1);
			yield* Effect.promise(() => waitFor(() => expect(liveStatus()).toBe("live")));
		},
	);

	boardStory.it(
		"newer invalidation replaces a held read and the late result cannot overwrite it",
		liveProject,
		function* ({ openLivePage, paragraph, editFile }) {
			const page = yield* openLivePage("/plan.md");
			const before = page.pageRequests.answered;
			const older = held();
			page.pageRequests.responseGate = older.gate;
			editFile("plan.md", PLAN.replace("Intro.", "Older source."));
			yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThan(before)));
			page.pageRequests.responseGate = undefined;
			editFile("plan.md", PLAN.replace("Intro.", "Newest source."));
			yield* Effect.promise(() => waitFor(() => expect(paragraph("Newest source.")).toBeDefined()));
			older.release();
			yield* Effect.promise(() => settle());
			expect(paragraph("Newest source.")).toBeDefined();
			expect(paragraph("Older source.")).toBeUndefined();
		},
	);

	boardStory.it(
		"keeps each of two same-named details blocks open or closed as it was",
		liveProject,
		function* ({ openLivePage, paragraph, editFile, openDetails }) {
			const page = yield* openLivePage("/twins.md");
			openDetails(1);
			editFile("twins.md", TWINS.replace("First.", "First, edited."));
			yield* Effect.promise(() => waitFor(() => expect(paragraph("First, edited.")).toBeDefined()));
			const [first, again] = page.document.querySelectorAll("#doc article details");
			expect(first?.hasAttribute("open")).toBe(false);
			expect(again?.hasAttribute("open")).toBe(true);
		},
	);

	boardStory.it(
		"keeps the open state with its block when a same-named details block is inserted above",
		liveProject,
		function* ({ openLivePage, paragraph, editFile, openDetails }) {
			const page = yield* openLivePage("/twins.md");
			openDetails(1);
			editFile("twins.md", TWINS.replace("# Twins\n\n", `# Twins\n\n${steps("Zero.")}\n\n`));
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
		},
	);

	boardStory.it("shows how long ago each file changed", liveProject, function* ({ openLivePage, ageFile }) {
		ageFile("plan.md", 2 * 60 * 60);
		const page = yield* openLivePage("/_board/library");
		expect(page.document.querySelector('#doc li:has(a[href="/plan.md"]) [data-modified]')?.textContent).toBe("updated 2h ago");
	});
});
