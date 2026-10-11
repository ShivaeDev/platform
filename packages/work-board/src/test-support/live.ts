import { Effect } from "effect";
import { expect, vi } from "vitest";
import type { RunningBoard } from "./board.ts";
import { type OpenPage, openPage } from "./browser.ts";

export const PLAN = [
	"# Plan",
	"",
	"Intro.",
	"",
	"<details>",
	"<summary>Steps</summary>",
	"",
	"1. Open the notes.",
	"",
	"</details>",
	"",
	"A closing line.",
	"",
].join("\n");

export const BOARD = "# Board\n\n## To do\n\n### `docs` Write the intro\n";

export const DIAGRAM = "```mermaid\ngraph TD; A-->B\n```";

export const WITH_DIAGRAM = `# Flow\n\nBefore.\n\n${DIAGRAM}\n\nAfter.\n`;

export const STEPS = (text: string) => `<details>\n<summary>Steps</summary>\n\n${text}\n\n</details>`;

export const MIXED = `# Mixed\n\nBefore.\n\n${STEPS("Inside.")}\n\n${DIAGRAM}\n\nAfter.\n`;

export const TWINS = `# Twins\n\n${STEPS("First.")}\n\n${STEPS("Second.")}\n`;

export const FILES = { "board.md": BOARD, "flow.md": WITH_DIAGRAM, "mixed.md": MIXED, "plan.md": PLAN, "twins.md": TWINS };

export function waitFor(check: () => void | Promise<void>) {
	return vi.waitFor(check, { interval: 10, timeout: 5000 });
}

export function settle() {
	return new Promise((resolve) => setTimeout(resolve, 300));
}

export const openLive = Effect.fn("Test.openLive")(function* (board: RunningBoard, path: string, beforeScripts?: Parameters<typeof openPage>[2]) {
	const page = yield* openPage(board, path, beforeScripts);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 20)));
	return page;
});

export function paragraphOf(page: OpenPage, text: string) {
	return [...page.document.querySelectorAll("#doc p")].find((element) => element.textContent === text);
}
