import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { noReader, recordedReads, unlistableWorkspace } from "#test/readTraits.ts";

boardStory.it(
	"indexes the workspace as the board starts, before any reader asks for a page",
	[projectFiles({ "index.md": "# Index\n", "plans/first.md": "# First\n", "plans/second.md": "# Second\n" }), noReader(), recordedReads()],
	function* ({ waitForReads }) {
		yield* waitForReads(["index.md", "plans/first.md", "plans/second.md"]);
	},
);

boardStory.it(
	"answers a search sent while the startup index is still reading with the whole workspace",
	[projectFiles({ "index.md": "# Index\n", "plans/guide.md": "# Guide\n\nLinked passage.\n" }), noReader(), recordedReads(true)],
	function* ({ releaseReads, search, waitForReads }) {
		yield* waitForReads(["index.md", "plans/guide.md"]);
		const pending = yield* Effect.forkChild(search("Linked passage"));
		yield* releaseReads();
		const result = yield* Fiber.join(pending);
		expect(result.results.map((entry) => entry.file)).toContain("plans/guide.md");
	},
);

boardStory.it(
	"fails a search with a typed error when the startup index cannot list the workspace",
	[projectFiles({ "index.md": "# Index\n" }), noReader(), unlistableWorkspace()],
	function* ({ search }) {
		const failure = yield* Effect.flip(search("Index"));
		expect(failure).toMatchObject({ _tag: "InternalServerError" });
	},
);
