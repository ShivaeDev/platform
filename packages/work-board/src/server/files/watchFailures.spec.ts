import { Effect } from "effect";
import { expect } from "vitest";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { anEndedWatcher, fileReadingStory, readableFiles } from "#test/fileReadingStory.ts";

fileReadingStory.it(
	"fails a prematurely ended watcher so the host can retry",
	[readableFiles({ "note.md": "# Note" }), anEndedWatcher()],
	function* ({ watchDirectory }) {
		const failure = yield* watchDirectory().pipe(Effect.flip);
		expect(failure).toBeInstanceOf(ServiceUnavailable);
		expect(failure.message).toBe("The workspace watcher ended. Retrying the watch automatically.");
	},
);
