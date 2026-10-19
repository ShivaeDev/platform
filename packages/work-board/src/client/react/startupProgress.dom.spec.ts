import { Effect, Fiber } from "effect";
import { describe, expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { boardStory, heldRequest, projectFiles, readerArrivesEarly } from "#test/boardStory.ts";
import { linkedProject } from "#test/linkedProject.ts";
import { heldWorkspaceListing, readsOneByOne, slowRepositoryLookup } from "#test/readTraits.ts";

const project = projectFiles({
	"goals/launch.md": "---\nid: goal.launch\nkind: goal\nstatus: active\n---\n# Launch the notes\n",
	"plan.md": "# Plan\n\nA plain document.\n",
	"tasks/intro.md": "---\nid: task.intro\nkind: task\nstatus: active\ngoal: goal.launch\n---\n# Write the intro\n",
});

describe("startup", () => {
	boardStory.it(
		"says how many files the board has read while it indexes, then replaces that with Today",
		[project, readsOneByOne(), readerArrivesEarly("/")],
		function* ({ liveStatus, reader, releaseRead, releaseReads }) {
			yield* Effect.promise(() => eventually(() => expect(reader.indexingProgress()).toBe("Reading 0 of 3 files…")));
			expect(liveStatus()).toBe("Connecting…");
			expect(reader.inboxCounts()).toEqual(["", ""]);
			yield* releaseRead();
			yield* Effect.promise(() => eventually(() => expect(reader.indexingProgress()).toBe("Reading 1 of 3 files…")));
			yield* releaseReads();
			yield* Effect.promise(() => eventually(() => expect(reader.heading()).toBe("Today")));
			expect(reader.indexingProgress()).toBeUndefined();
			expect(liveStatus()).toBe("Live");
		},
	);

	boardStory.it(
		"indexes and opens Today without waiting for the repository lookup, which then links pull requests",
		[
			project,
			projectFiles({ "package.json": JSON.stringify({ repository: "example/project" }) }, "the workspace's package.json names its repository"),
			readsOneByOne(),
			slowRepositoryLookup(),
			readerArrivesEarly("/"),
		],
		function* ({ readDocument, reader, releaseRead, releaseReads, releaseRepositoryLookup }) {
			yield* Effect.promise(() => eventually(() => expect(reader.indexingProgress()).toBe("Reading 0 of 3 files…")));
			yield* releaseRead();
			yield* Effect.promise(() => eventually(() => expect(reader.indexingProgress()).toBe("Reading 1 of 3 files…")));
			yield* releaseReads();
			yield* Effect.promise(() => eventually(() => expect(reader.heading()).toBe("Today")));
			const opened = yield* Effect.forkChild(readDocument("plan.md"));
			yield* releaseRepositoryLookup();
			expect((yield* Fiber.join(opened)).pullRequests).toBe("https://github.com/example/project/pull/");
		},
	);

	boardStory.it(
		"says it is reading a workspace with a linked folder before it knows how many files there are",
		[project, linkedProject, heldWorkspaceListing(), readerArrivesEarly("/")],
		function* ({ reader, releaseReads }) {
			yield* Effect.promise(() => eventually(() => expect(reader.indexingProgress()).toBe("Reading the workspace…")));
			yield* releaseReads();
			yield* Effect.promise(() => eventually(() => expect(reader.heading()).toBe("Today")));
		},
	);

	boardStory.it(
		"opens Today without waiting for the sidebar's navigation read",
		[project, heldRequest("work-board.navigation"), readerArrivesEarly("/")],
		function* ({ reader }) {
			yield* Effect.promise(() => eventually(() => expect(reader.heading()).toBe("Today")));
			expect(reader.inboxCounts()).toEqual(["", ""]);
			reader.releaseRequest("work-board.navigation");
			yield* Effect.promise(() => eventually(() => expect(reader.inboxCounts()).toEqual(["0", "0"])));
		},
	);

	boardStory.it(
		"names the connection in plain words while the page reads and once it is live",
		[project, heldRequest("work-board.inbox"), readerArrivesEarly("/")],
		function* ({ liveStatus, page, reader }) {
			yield* Effect.promise(() => eventually(() => expect(liveStatus()).toBe("Updating…")));
			expect(page.document.getElementById("live")?.className).not.toContain("font-mono");
			reader.releaseRequest("work-board.inbox");
			yield* Effect.promise(() => eventually(() => expect(liveStatus()).toBe("Live")));
		},
	);
});
