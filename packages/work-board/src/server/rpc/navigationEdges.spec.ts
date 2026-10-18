import { chmodSync } from "node:fs";
import { join } from "node:path";
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
	function* ({ notes, start, connectClient }) {
		yield* start();
		const client = connectClient();
		chmodSync(join(notes.root, "note.md"), 0o000);
		try {
			const data = yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "note.md" })));
			expect(data.inboxCount).toBeNull();
			expect(data.counts.library).toBe(2);
		} finally {
			chmodSync(join(notes.root, "note.md"), 0o644);
		}
	},
);
