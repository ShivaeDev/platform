import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { failingRead, unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const files = { "home.md": "# Home" };

screenStory.it(
	"reads the workspace again when the reader reopens a Today page whose home file couldn't be read",
	[screenFiles(files, { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ follow, readInbox, readIndexReads }) {
		expect((yield* readInbox()).complete).toBe(false);
		const reads = yield* readIndexReads();

		yield* follow("/");

		expect(yield* readIndexReads()).toBeGreaterThan(reads);
	},
);

screenStory.it(
	"leaves a complete Today page's reads alone when the reader opens its link again",
	[screenFiles(files, { home: "home.md" }), openScreen()],
	function* ({ follow, readInbox, readIndexReads }) {
		expect((yield* readInbox()).complete).toBe(true);
		const reads = yield* readIndexReads();

		yield* follow("/");

		expect(yield* readIndexReads()).toBe(reads);
	},
);

screenStory.it(
	"reads a document again when the reader reopens the link whose read failed",
	[screenFiles(files), screenRoute("/home.md"), failingRead("/home.md"), openScreen()],
	function* ({ follow, readDocumentReads }) {
		const reads = (yield* readDocumentReads()).length;

		yield* follow("/home.md");

		expect((yield* readDocumentReads()).length).toBe(reads + 1);
	},
);
