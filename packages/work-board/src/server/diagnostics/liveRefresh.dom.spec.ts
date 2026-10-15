import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { fleetHealth } from "#server/diagnostics/fleetHealth.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { health, syntheticSources } from "#test/diagnostics.ts";
import { followLink } from "#test/followLink.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

it.live("navigates from the fixed sidebar, polls native page reads, pauses, resumes, and stops polling after navigation", function* () {
	notes = folder({ "fleet/health.json": JSON.stringify(health), "home.md": "# Home" });
	board = yield* startBoard(notes.root, "home.md", undefined, false, syntheticSources({ fleet: fleetHealth(notes.root) }));
	let poll: () => void = () => undefined;
	page = yield* openPage(board, "/", (window) => {
		window.Date.prototype.toLocaleTimeString = () => "14:20";
		const interval = window.setInterval.bind(window);
		window.setInterval = (callback, delay, ...args) => {
			if (delay === 15_000 && typeof callback === "function") {
				poll = () => callback();
			}
			return interval(callback, delay, ...args);
		};
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
	page.document.getElementById("diagnostics-open")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("3 / 8")));
	expect(page.window.location.pathname).toBe("/_board/diagnostics");
	expect(page.document.querySelector("#primary-navigation #diagnostics-open")).not.toBeNull();
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("time[data-reset]")?.textContent).toContain(", 14:20")));
	expect(page.document.getElementById("diagnostics-open")?.getAttribute("aria-current")).toBe("page");
	page.document.getElementById("updates-toggle")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	notes.write("fleet/health.json", JSON.stringify({ ...health, running: 7 }));
	poll();
	expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("3 / 8");
	page.document.getElementById("updates-toggle")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("7 / 8")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("time[data-reset]")?.textContent).toContain(", 14:20")));
	notes.write("fleet/health.json", JSON.stringify({ ...health, running: 6 }));
	poll();
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("6 / 8")));
	followLink(page, "/home.md");
	yield* Effect.promise(() => waitFor(() => expect(page.window.location.pathname).toBe("/home.md")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".diagnostics")).toBeNull()));
	poll();
	expect(page.document.querySelector(".diagnostics")).toBeNull();
});
