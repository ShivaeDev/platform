import { afterEach, expect, it } from "vitest";
import { fleetHealth } from "#diagnostics/fleetHealth.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { health, syntheticSources } from "#test/diagnostics.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});

it("navigates from the sidebar, polls native page reads, pauses, resumes, and stops polling after navigation", async () => {
	notes = folder({ "fleet/health.json": JSON.stringify(health), "home.md": "# Home" });
	board = await startBoard(notes.root, "home.md", undefined, false, syntheticSources({ fleet: fleetHealth(notes.root) }));
	let poll: () => void = () => undefined;
	page = await openPage(board, "/", (window) => {
		const interval = window.setInterval.bind(window);
		window.setInterval = (callback, delay, ...args) => {
			if (delay === 15_000 && typeof callback === "function") {
				poll = () => callback();
			}
			return interval(callback, delay, ...args);
		};
	});
	await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live"));
	page.document.getElementById("diagnostics-open")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("3 / 8"));
	expect(page.window.location.pathname).toBe("/_board/diagnostics");
	expect(page.document.getElementById("diagnostics-open")?.getAttribute("aria-current")).toBe("page");
	page.document.getElementById("updates-toggle")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	notes.write("fleet/health.json", JSON.stringify({ ...health, running: 7 }));
	poll();
	expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("3 / 8");
	page.document.getElementById("updates-toggle")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("7 / 8"));
	notes.write("fleet/health.json", JSON.stringify({ ...health, running: 6 }));
	poll();
	await waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("6 / 8"));
	page.document.querySelector('#files a[href="/home.md"]')?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
	await waitFor(() => expect(page.window.location.pathname).toBe("/home.md"));
	await waitFor(() => expect(page.document.querySelector(".diagnostics")).toBeNull());
	poll();
	expect(page.document.querySelector(".diagnostics")).toBeNull();
});
