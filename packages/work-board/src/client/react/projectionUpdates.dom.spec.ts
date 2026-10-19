import { Effect } from "effect";
import { expect } from "vitest";
import { boardHome, boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { projectionTask } from "#test/projectionTask.ts";
import { rpcCall } from "#test/rpc.ts";

const HOME = "# Home board\n\n## Plans\n\n### Task\n\nRead the source.\n";
const routes = [
	{ file: "task.md", next: projectionTask("Updated task"), selector: ".today-row a", tag: "work-board.inbox", text: "Updated task", url: "/" },
	{
		file: "home.md",
		next: HOME.replace("Home board", "Updated board"),
		selector: ".board-head h1",
		tag: "work-board.board",
		text: "Updated board",
		url: "/home.md",
	},
	{
		file: "task.md",
		next: projectionTask("Updated task"),
		selector: ".work-card h3",
		tag: "work-board.work",
		text: "Updated task",
		url: "/_board/work?view=board",
	},
	{
		file: "task.md",
		next: projectionTask("Updated task"),
		selector: ".work-table tbody th a",
		tag: "work-board.work",
		text: "Updated task",
		url: "/_board/work?view=table",
	},
];
for (const { file, next, selector, tag, text, url } of routes) {
	boardStory.it(
		`updates ${url} through native projection invalidation`,
		[readerAt("/"), projectFiles({ "home.md": HOME, "task.md": projectionTask("A task") }), boardHome("home.md")],
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
			const before = reads.filter((read) => read === tag).length;
			expect(before).toBeGreaterThan(0);
			notes.write(file, next);
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(selector)?.textContent).toBe(text)));
			expect(reads.filter((read) => read === tag).length).toBeGreaterThan(before);
		},
	);
}
