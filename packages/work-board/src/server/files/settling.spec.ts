import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

fileWatcherStory.it(
	"waits for an observed edit to settle before returning a cached snapshot",
	[watchedFiles({ "note.md": "# Before" })],
	function* ({ readIndex, writeFile, holdStat, notify, statEntered, releaseStat }) {
		expect((yield* readIndex()).documents[0]?.parsed.body).toBe("# Before");
		writeFile("note.md", "# After");
		yield* holdStat("note.md");
		yield* notify(["note.md"]);
		yield* statEntered();
		const pending = yield* Effect.forkScoped(readIndex());
		yield* Effect.yieldNow;
		yield* releaseStat();
		expect((yield* Fiber.join(pending)).documents[0]?.parsed.body).toBe("# After");
	},
);
