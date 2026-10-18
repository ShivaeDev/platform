import { Effect } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardHome, boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { rpcCall } from "#test/rpc.ts";

const HOME = "# Home board\n\n## Plans\n\n### Task\n\nRead the source.\n";
function task(title: string) {
	return `---\nid: task.fixture\nkind: task\nstatus: planned\nowner: reader\nnext_action: Read evidence\nattention:\n  - id: direction\n    kind: decision\n    reason: Choose a direction\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.fixture]\n---\n# ${title}\n`;
}
const routes = [
	{ file: "task.md", next: task("Updated task"), selector: ".today-row a", text: "Updated task", url: "/" },
	{ file: "home.md", next: HOME.replace("Home board", "Updated board"), selector: ".board-head h1", text: "Updated board", url: "/home.md" },
	{ file: "task.md", next: task("Updated task"), selector: ".work-card h3", text: "Updated task", url: "/_board/work?view=board" },
	{ file: "task.md", next: task("Updated task"), selector: ".work-table tbody th a", text: "Updated task", url: "/_board/work?view=table" },
];
for (const { file, next, selector, text, url } of routes) {
	boardStory.it(
		`updates ${url} through native projection invalidation without requesting page HTML`,
		[projectFiles({ "home.md": HOME, "task.md": task("A task") }), boardHome("home.md"), responsesEnabled(false), boardFilesystem(undefined)],
		function* ({ notes, reader }) {
			const reads: string[] = [];
			const page = yield* reader.open(url, (window) => {
				const fetch = window.fetch.bind(window);
				window.fetch = async (input, init) => {
					const call = await rpcCall(window, input, init);
					if (call) {
						reads.push(call.tag);
					}
					return fetch(input, init);
				};
			});
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live")));
			notes.write(file, next);
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(selector)?.textContent).toBe(text)));
			expect(page.document.querySelector("[data-legacy-main]")).toBeNull();
			expect(reads).not.toContain("work-board.page");
		},
	);
}
