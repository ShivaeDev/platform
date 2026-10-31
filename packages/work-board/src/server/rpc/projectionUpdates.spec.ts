import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { projectionTask } from "#test/projectionTask.ts";

const HOME = "# Home board\n\n## Plans\n\n### Task\n\nRead the source.\n";
for (const url of ["/", "/home.md", "/_board/work?view=board", "/_board/work?view=table"]) {
	boardStory.it(
		`invalidates the mounted projection for ${url} through native HTTP`,
		[projectFiles({ "home.md": HOME, "task.md": projectionTask("A task") }), boardHome("home.md")],
		function* ({ client, edited, mountedRead, nextRead, waitForConnection }) {
			if (url === "/") {
				const query = client.api.inbox.query();
				const before = yield* mountedRead(query);
				yield* waitForConnection();
				expect(before.you[0]?.title).toBe("A task");

				yield* edited("task.md", projectionTask("Updated task"));

				expect((yield* nextRead(query, before)).you[0]?.title).toBe("Updated task");
			} else if (url === "/home.md") {
				const query = client.api.board.query({ url });
				const before = yield* mountedRead(query);
				yield* waitForConnection();
				expect(before.document.source).toContain("Home board");

				yield* edited("home.md", HOME.replace("Home board", "Updated board"));

				expect((yield* nextRead(query, before)).document.source).toContain("Updated board");
			} else {
				const query = client.api.work.query({ url });
				const before = yield* mountedRead(query);
				yield* waitForConnection();
				expect(before.items[0]?.title).toBe("A task");

				yield* edited("task.md", projectionTask("Updated task"));

				expect((yield* nextRead(query, before)).items[0]?.title).toBe("Updated task");
			}
		},
	);
}
