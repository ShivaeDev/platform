import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";

boardStory.it(
	"returns empty destination counts with a known zero Inbox count for an empty workspace",
	[projectFiles({}), deferredServing],
	function* ({ start, connectClient }) {
		yield* start();
		const client = connectClient();
		expect(yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "" })))).toEqual({
			counts: { goals: 0, library: 0, now: 0, system: 0 },
			inboxCount: 0,
		});
	},
);
boardStory.it(
	"retains listed files with an unknown Inbox count when a source cannot be indexed",
	[projectFiles({ "note.md": "# Note", "question.md": inboxQuestion }), deferredServing],
	function* ({ permissions, start, connectClient }) {
		permissions("note.md", 0o000);
		yield* start();
		const client = connectClient();
		const data = yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "note.md" })));
		expect(data.inboxCount).toBeNull();
		const library = yield* Effect.promise(() => client.run(client.api.library.run({})));
		expect(library.files.map((file) => file.path).sort()).toEqual(["note.md", "question.md"]);
		expect(data.counts.library).toBe(library.files.length);
	},
);
