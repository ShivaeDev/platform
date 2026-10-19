import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { projectionTask } from "#test/projectionTask.ts";

const HOME = "# Home board\n\n## Plans\n\n### Task\n\nRead the source.\n";
for (const url of ["/", "/home.md", "/_board/work?view=board", "/_board/work?view=table"]) {
	boardStory.it(
		`invalidates the mounted projection for ${url} through native HTTP`,
		[projectFiles({ "home.md": HOME, "task.md": projectionTask("A task") }), boardHome("home.md")],
		function* ({ client, editFile, waitForConnection }) {
			let atom: Atom.Atom<unknown>;
			if (url === "/") {
				atom = client.api.inbox.query();
			} else if (url === "/home.md") {
				atom = client.api.board.query({ url });
			} else {
				atom = client.api.work.query({ url });
			}
			const release = client.registry.mount(atom);
			yield* Effect.addFinalizer(() => Effect.sync(release));
			yield* waitForConnection();
			if (url === "/") {
				const query = client.api.inbox.query();
				expect((yield* Effect.promise(() => client.read(query))).you[0]?.title).toBe("A task");
				editFile("task.md", projectionTask("Updated task"));
				yield* Effect.promise(() =>
					waitFor(() => {
						const next = client.registry.get(query);
						expect(next._tag === "Success" && next.value.you[0]?.title).toBe("Updated task");
					}),
				);
			} else if (url === "/home.md") {
				const query = client.api.board.query({ url });
				expect((yield* Effect.promise(() => client.read(query))).document.source).toContain("Home board");
				editFile("home.md", HOME.replace("Home board", "Updated board"));
				yield* Effect.promise(() =>
					waitFor(() => {
						const next = client.registry.get(query);
						expect(next._tag === "Success" && next.value.document.source).toContain("Updated board");
					}),
				);
			} else {
				const query = client.api.work.query({ url });
				expect((yield* Effect.promise(() => client.read(query))).items[0]?.title).toBe("A task");
				editFile("task.md", projectionTask("Updated task"));
				yield* Effect.promise(() =>
					waitFor(() => {
						const next = client.registry.get(query);
						expect(next._tag === "Success" && next.value.items[0]?.title).toBe("Updated task");
					}),
				);
			}
		},
	);
}
