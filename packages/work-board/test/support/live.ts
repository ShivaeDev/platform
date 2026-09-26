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

export const FILES = { "board.md": BOARD, "plan.md": PLAN, "flow.md": WITH_DIAGRAM, "mixed.md": MIXED, "twins.md": TWINS };

export const waitFor = (check: () => void) => vi.waitFor(check, { timeout: 5000, interval: 10 });

export const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

export const openLive = async (board: RunningBoard, path: string, beforeScripts?: () => Promise<void>): Promise<OpenPage> => {
	const page = await openPage(board, path, beforeScripts);
	await waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live"));
	await waitFor(() => expect(page.pageRequests.answered).toBe(1));
	await new Promise((resolve) => setTimeout(resolve, 20));
	return page;
};

export const paragraphOf = (page: OpenPage, text: string) =>
	[...page.document.querySelectorAll("#doc p")].find((element) => element.textContent === text);
