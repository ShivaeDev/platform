import { expect } from "@effect/vitest";
import { boardFileStory } from "#test/boardFileStory.ts";

const SUMMARY = "Done; PR #7 merged.";

boardFileStory.it(
	"a completion at the saved path is refused when that file now holds another identity, and the file is kept",
	[],
	function* ({ completion }) {
		const other = completion.source.replace("id: one", "id: other");
		yield* completion.writeTask(other);

		const completed = yield* completion.complete("one", `${completion.root}/tasks/one.md`, SUMMARY);

		expect(completed).toBe("Board failure: Board item no longer exists: one");
		expect(yield* completion.taskSource()).toBe(other);
	},
);
