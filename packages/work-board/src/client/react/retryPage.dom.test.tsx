import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { pageRetryOptions } from "#test/pageRetryOptions.ts";
import { failingRead, unreadableHome } from "#test/screenEnvironment.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
const board = storyKit(pageRetryOptions());
const files = { "home.md": "# Home" };

board.it(
	"retries an incomplete Today page even when its queries returned successfully",
	[screenFiles(files, { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ readAttribute, readIndexReads, readInbox, readGoals, follow }) {
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/")));
		expect((yield* Effect.promise(readInbox)).complete).toBe(false);
		yield* Effect.promise(readGoals);
		const reads = readIndexReads();
		yield* Effect.promise(() => follow("/"));
		yield* Effect.promise(() => eventually(() => expect(readIndexReads()).toBeGreaterThan(reads)));
	},
);

board.it(
	"leaves a healthy Today page's queries alone when its link is opened again",
	[screenFiles(files, { home: "home.md" }), openScreen()],
	function* ({ readAttribute, readIndexReads, readInbox, readGoals, follow, frame }) {
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/")));
		expect((yield* Effect.promise(readInbox)).complete).toBe(true);
		yield* Effect.promise(readGoals);
		const reads = readIndexReads();
		yield* Effect.promise(() => follow("/"));
		yield* Effect.promise(() => frame());
		expect(readIndexReads()).toBe(reads);
	},
);

board.it(
	"retries a failed document query when the reader opens the same link",
	[screenFiles(files), screenRoute("/home.md"), failingRead("/home.md"), openScreen()],
	function* ({ readAttribute, readDocumentReads, follow }) {
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/home.md")));
		const reads = readDocumentReads().length;
		yield* Effect.promise(() => follow("/home.md"));
		yield* Effect.promise(() => eventually(() => expect(readDocumentReads().length).toBeGreaterThan(reads)));
	},
);
