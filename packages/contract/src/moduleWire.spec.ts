import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { clockReads, noteStored, watchingList, wireStory } from "#test/wireStory.ts";

wireStory.it(
	"a success with a Schema.Date field reaches the browser as a Date equal to the one run returned",
	[clockReads("2026-11-10T09:30:00.000Z")],
	function* ({ create, storedCreation }) {
		const answer = yield* create("Groceries");

		yield* outcomes([
			["browser's answer", () => Effect.succeed(answer), "note 1 Groceries created at 2026-11-10T09:30:00.000Z as a Date"],
			["stored creation time", () => storedCreation(), ["note 1 stored at 2026-11-10T09:30:00.000Z"]],
		]);
	},
);

wireStory.it("a rejection declared only by the wire reaches the browser decoded as its class", [noteStored("Groceries")], function* ({ create }) {
	expect(yield* create("Groceries")).toBe("rejected with its TitleTaken class on title: You already have a note with that title");
});

wireStory.it(
	"a command's invalidates on the client contract refreshes the browser's cached list",
	[clockReads("2026-11-10T09:30:00.000Z"), watchingList()],
	function* ({ create, listShown }) {
		expect(yield* listShown()).toEqual([]);

		yield* create("Groceries");

		expect(yield* listShown()).toEqual(["note 1 Groceries created at 2026-11-10T09:30:00.000Z as a Date"]);
	},
);
