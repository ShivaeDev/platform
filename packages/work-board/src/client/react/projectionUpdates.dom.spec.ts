import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { folder, startBoard } from "#test/board.ts";
import { openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { rpcCall } from "#test/rpc.ts";

const HOME = "# Home board\n\n## Plans\n\n### Task\n\nRead the source.\n";
function task(title: string) {
	return `---\nid: task.fixture\nkind: task\nstatus: planned\nowner: reader\nnext_action: Read evidence\nattention:\n  - id: direction\n    kind: decision\n    reason: Choose a direction\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.fixture]\n---\n# ${title}\n`;
}
const routes = [
	{ file: "home.md", next: HOME.replace("Home board", "Updated board"), selector: ".board-head h1", text: "Updated board", url: "/" },
	{ file: "task.md", next: task("Updated task"), selector: ".work-card h3", text: "Updated task", url: "/_board/work?view=board" },
	{ file: "task.md", next: task("Updated task"), selector: ".work-table tbody th a", text: "Updated task", url: "/_board/work?view=table" },
	{ file: "task.md", next: task("Updated task"), selector: ".attention-card h3", text: "Updated task", url: "/_board/overview" },
	{ file: "task.md", next: task("Updated task"), selector: ".inbox-row h3", text: "Updated task", url: "/_board/inbox" },
];
it.live.each(routes)(
	"updates $url through native projection invalidation without requesting page HTML",
	function* ({ file, next, selector, text, url }) {
		const notes = folder({ "home.md": HOME, "task.md": task("A task") });
		yield* Effect.addFinalizer(() => Effect.sync(() => notes.remove()));
		const board = yield* startBoard(notes.root, "home.md");
		const reads: string[] = [];
		const page = yield* openPage(board, url, (window) => {
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
