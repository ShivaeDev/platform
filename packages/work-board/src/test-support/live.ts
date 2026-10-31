import { vi } from "vitest";
import type { OpenPage } from "./browser.ts";

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

export function steps(text: string) {
	return `<details>\n<summary>Steps</summary>\n\n${text}\n\n</details>`;
}

export const MIXED = `# Mixed\n\nBefore.\n\n${steps("Inside.")}\n\n${DIAGRAM}\n\nAfter.\n`;

export const TWINS = `# Twins\n\n${steps("First.")}\n\n${steps("Second.")}\n`;

export const FILES = { "board.md": BOARD, "flow.md": WITH_DIAGRAM, "mixed.md": MIXED, "plan.md": PLAN, "twins.md": TWINS };

export function waitFor(check: () => void | Promise<void>) {
	return vi.waitFor(check, { interval: 10, timeout: 5000 });
}

export function paragraphOf(page: OpenPage, text: string) {
	return [...page.document.querySelectorAll("#doc p")].find((element) => element.textContent === text);
}
