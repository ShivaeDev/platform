import { inboxFixture } from "./inboxFixture.ts";
import { routedScreen } from "./screenTraits.ts";

const now = Date.UTC(2026, 9, 19, 12);
const files = {
	...inboxFixture(),
	"goal.md": "---\nid: project.calm\nkind: project\nstatus: active\n---\n# A calm workspace\n",
	"notes/note.md": "# A plain note\n",
	"results/second.md": "---\nid: fleet.second-result\nkind: result\nstatus: done\n---\n# Second result\n",
	"results/upload.md": "---\nid: board.upload-result\nkind: result\nstatus: done\n---\n# Upload result\n",
};
const modified = new Map([
	["goal.md", now - 4 * 60 * 60 * 1000],
	["notes/note.md", now - 60 * 1000],
	["results/second.md", now - 3 * 60 * 60 * 1000],
	["results/upload.md", now - 2 * 60 * 60 * 1000],
]);

export function libraryScreen(route = "/_board/library") {
	return routedScreen(files, route, { modified });
}

export function pagedLibraryScreen(count: number, route = "/_board/library?view=titles") {
	const pages = Object.fromEntries(
		Array.from({ length: count }, (_, index) => [`notes/doc-${String(index).padStart(3, "0")}.md`, `# Document ${String(index).padStart(3, "0")}\n`]),
	);
	return routedScreen(pages, route);
}

export function libraryParams() {
	const route = new URL(document.querySelector<HTMLElement>("#doc")?.dataset.route ?? "", "http://board");
	return route.pathname === "/_board/library" ? Object.fromEntries(route.searchParams) : undefined;
}

export function libraryTitles() {
	return [...document.querySelectorAll("#library-results li a")].map((link) => link.textContent);
}

export function pressedView() {
	return document.querySelector('#library-filters [role="group"] [aria-pressed="true"]')?.textContent;
}
