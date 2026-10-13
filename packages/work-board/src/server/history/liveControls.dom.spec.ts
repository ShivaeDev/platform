import { Clock, Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { baselineJson } from "#test/historyFixture.ts";
import { historyObservation } from "#test/historyObservation.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

it.live.each([false, true])("retains Changes control state at the instant of live refresh with an observation pending: %s", function* (pending) {
	notes = folder({ "home.md": "# Home", "item.md": "# Current" });
	board = yield* startBoard(notes.root, "home.md");
	const observation = historyObservation();
	const now = yield* Clock.currentTimeMillis;
	page = yield* openPage(board, "/_board/changes", (window) => {
		window.localStorage.setItem(`work-board:changes:${notes.root}`, baselineJson({ "home.md": "# Home", "item.md": "# Older" }, now - 1000));
		observation.install(window);
	});
	yield* Effect.promise(() =>
		waitFor(() => {
			expect(page.document.getElementById("history-mark")?.hasAttribute("disabled")).toBe(false);
			expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live");
		}),
	);
	if (pending) {
		page.document.getElementById("history-mark")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
		yield* Effect.promise(() => observation.started);
	}

	const states: {
		clearDisabled: boolean;
		markDisabled: boolean;
		label: string | null;
	}[] = [];
	page.document.addEventListener("board-page", () => {
		states.push({
			clearDisabled: page.document.getElementById("history-clear")?.hasAttribute("disabled") ?? true,
			label: page.document.getElementById("history-mark")?.textContent ?? null,
			markDisabled: page.document.getElementById("history-mark")?.hasAttribute("disabled") ?? true,
		});
	});
	try {
		notes.write("home.md", "# Changed during refresh");
		yield* Effect.promise(() => waitFor(() => expect(states.length).toBeGreaterThan(0)));
		for (const state of states) {
			expect(state).toEqual({ clearDisabled: pending, label: "Mark current workspace seen", markDisabled: pending });
		}
	} finally {
		observation.release();
	}
	if (pending) {
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("changes-content")?.textContent).toContain("No source changes")));
	}
});
