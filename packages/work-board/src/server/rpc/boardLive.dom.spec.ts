import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { observedSockets } from "#test/observedSockets.ts";

const project = projectFiles({
	"brief.md":
		"---\nid: task.brief\nkind: task\nstatus: ready\nrelationships:\n - kind: implements\n   target: goal.ship\n---\n# Write the brief\n\nFirst draft.",
	"goal.md": "---\nid: goal.ship\nkind: goal\nstatus: ready\n---\n# Ship the Board",
	"other.md": "# Unrelated document\n\nKeep this reading.",
});

boardStory.it(
	"shows a disk edit in the open page and plugin overview without refetching unrelated reads",
	[project, observedSockets, readerAt("/brief.md")],
	function* ({
		board,
		page,
		openPlugin,
		followDocument,
		browserReadCounts,
		browserSocketConnections,
		pluginSnapshot,
		socketRequests,
		socketConnections,
		editFile,
	}) {
		yield* openPlugin();
		yield* followDocument("/other.md");
		yield* Effect.promise(() => waitFor(() => expect(pluginSnapshot()).toMatchObject({ goals: { items: [{ done: 0, total: 1 }] }, kind: "ready" })));
		const before = socketRequests();
		const pageBefore = browserReadCounts();
		editFile(
			"brief.md",
			"---\nid: task.brief\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: goal.ship\n---\n# Write the brief\n\nReviewed draft.",
		);
		yield* Effect.promise(() =>
			waitFor(() => {
				expect(page.document.getElementById("doc")?.textContent).toContain("Reviewed draft.");
				expect(pluginSnapshot()).toMatchObject({ goals: { items: [{ done: 1, total: 1 }] }, kind: "ready" });
			}),
		);
		const requests = socketRequests()
			.slice(before.length)
			.filter(({ tag }) => !tag.endsWith(".$changes"));
		expect(requests.map(({ tag }) => tag).sort((left, right) => left.localeCompare(right))).toEqual(["work-board.inbox", "work-board.overview"]);
		const socket = `${board.url.replace(/^http/u, "ws")}/_board/rpc`;
		expect(socketConnections()).toEqual([socket, socket]);
		expect(browserSocketConnections()).toEqual([socket]);
		const after = browserReadCounts();
		expect(
			Object.keys(after)
				.filter((tag) => !tag.endsWith(".$changes") && after[tag] !== pageBefore[tag])
				.sort((left, right) => left.localeCompare(right)),
		).toEqual(["work-board.document", "work-board.fleetItems", "work-board.goals", "work-board.navigation"]);
		expect(after["work-board.server"]).toBe(pageBefore["work-board.server"]);
		expect(after["work-board.watcher"]).toBe(pageBefore["work-board.watcher"]);
		expect(after["work-board.document"]).toBe((pageBefore["work-board.document"] ?? 0) + 1);
	},
);
