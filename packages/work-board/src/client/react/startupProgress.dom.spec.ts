import { Effect, Fiber } from "effect";
import { describe, expect } from "vitest";
import { boardStory, heldRequest, projectFiles, readerArrivesEarly } from "#test/boardStory.ts";
import { linkedProject } from "#test/linkedProject.ts";
import { pageTraffic } from "#test/pageTraffic.ts";
import { heldWorkspaceListing, readsOneByOne, slowRepositoryLookup } from "#test/readTraits.ts";

const project = projectFiles({
	"goals/launch.md": "---\nid: goal.launch\nkind: goal\nstatus: ready\n---\n# Launch the notes\n",
	"plan.md": "# Plan\n\nA plain document.\n",
	"tasks/intro.md": "---\nid: task.intro\nkind: task\nstatus: ready\ngoal: goal.launch\n---\n# Write the intro\n",
});

describe("startup", () => {
	boardStory.it(
		"While the board indexes, the page counts the files it has read",
		[project, readsOneByOne(), pageTraffic(), readerArrivesEarly("/")],
		function* ({ indexingReaches, releaseRead, startupScreen }) {
			yield* indexingReaches(0, 3);
			expect(yield* startupScreen()).toEqual({ heading: "none", indexing: "Reading 0 of 3 files…", live: "Updating…", needsYou: ["", ""] });

			yield* releaseRead();

			yield* indexingReaches(1, 3);
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ indexing: "Reading 1 of 3 files…" }));
		},
	);

	boardStory.it(
		"Once the board has read every file, Today replaces the indexing progress and the page is live",
		[project, readsOneByOne(), pageTraffic(), readerArrivesEarly("/")],
		function* ({ indexingReaches, pageReceives, releaseReads, startupScreen }) {
			yield* indexingReaches(0, 3);

			yield* releaseReads();

			yield* pageReceives("inbox");
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ heading: "Today", indexing: "none", live: "Live" }));
		},
	);

	boardStory.it(
		"Today opens without waiting for the repository lookup, which then links pull requests",
		[
			project,
			projectFiles({ "package.json": JSON.stringify({ repository: "example/project" }) }, "the workspace's package.json names its repository"),
			slowRepositoryLookup(),
			pageTraffic(),
			readerArrivesEarly("/"),
		],
		function* ({ pageReceives, readDocument, releaseRepositoryLookup, startupScreen }) {
			yield* pageReceives("inbox");
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ heading: "Today" }));
			const opened = yield* Effect.forkChild(readDocument("plan.md"));

			yield* releaseRepositoryLookup();

			expect((yield* Fiber.join(opened)).pullRequests).toBe("https://github.com/example/project/pull/");
		},
	);

	boardStory.it(
		"The page says it is reading a workspace with a linked folder before it knows how many files there are",
		[project, linkedProject, heldWorkspaceListing(), pageTraffic(), readerArrivesEarly("/")],
		function* ({ indexingReaches, pageReceives, releaseReads, startupScreen }) {
			yield* indexingReaches(0);
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ heading: "none", indexing: "Reading the workspace…" }));

			yield* releaseReads();

			yield* pageReceives("inbox");
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ heading: "Today" }));
		},
	);

	boardStory.it(
		"Today opens without waiting for the sidebar's navigation read, which then fills the needs-you badges",
		[project, heldRequest("work-board.navigation"), pageTraffic(), readerArrivesEarly("/")],
		function* ({ pageReceives, pageSettles, reader, startupScreen }) {
			yield* pageSettles();
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ heading: "Today", needsYou: ["", ""] }));

			reader.releaseRequest("work-board.navigation");

			yield* pageReceives("navigation");
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ needsYou: ["0", "0"] }));
		},
	);

	boardStory.it(
		"The live status says Updating… while the page reads and Live once it has",
		[project, heldRequest("work-board.inbox"), pageTraffic(), readerArrivesEarly("/")],
		function* ({ pageReceives, pageSettles, reader, startupScreen }) {
			yield* pageSettles();
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ live: "Updating…" }));

			reader.releaseRequest("work-board.inbox");

			yield* pageReceives("inbox");
			expect(yield* startupScreen()).toEqual(expect.objectContaining({ live: "Live" }));
		},
	);
});
