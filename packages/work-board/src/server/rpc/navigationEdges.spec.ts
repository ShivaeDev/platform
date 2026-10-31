import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { unreadableFile } from "#test/servingStoryTraits.ts";

boardStory.it(
	"navigation for an empty workspace answers zero counts and a known zero Inbox count",
	[projectFiles({})],
	function* ({ navigationRead }) {
		expect(yield* navigationRead("")).toEqual({ counts: { goals: 0, library: 0, now: 0, system: 0 }, inboxCount: 0 });
	},
);

boardStory.it(
	"when a file cannot be indexed, navigation still lists every file but reports the Inbox count as unknown",
	[projectFiles({ "note.md": "# Note", "question.md": inboxQuestion }), unreadableFile("note.md")],
	function* ({ libraryFiles, navigationRead }) {
		yield* outcomes([
			["navigation", () => navigationRead("note.md"), expect.objectContaining({ counts: expect.objectContaining({ library: 2 }), inboxCount: null })],
			["the library", () => libraryFiles(false), expect.arrayContaining(["note.md", "question.md"])],
		]);
	},
);
