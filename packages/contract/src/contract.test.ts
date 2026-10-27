import { Effect, Option, Schema } from "effect";
import { describe, expect } from "vitest";
import { Follow } from "#test/edgeEngine.ts";
import { Get, Note, NoteMissing } from "#test/notes.ts";
import { denied, notesStory, signedIn, storedNotes } from "#test/notesStory.ts";

describe("contract", () => {
	notesStory.it(
		"round-trips successes and declared rejections through the bound native client and handlers",
		[signedIn()],
		function* ({ get, rename, create, list, deny }) {
			expect(yield* get(1)).toMatchObject({ id: 1, title: "One" });
			expect(yield* Effect.flip(get(9))).toBeInstanceOf(NoteMissing);
			expect(yield* Effect.flip(rename(1, " "))).toMatchObject({ _tag: "Invalid", field: "title" });
			expect(yield* create("Three", "b")).toMatchObject({ id: 3, title: "Three" });
			expect((yield* list()).map((note) => note.title)).toEqual(["One", "Two", "Three"]);
			yield* deny();
			expect(yield* Effect.flip(list())).toMatchObject({ _tag: "Denied" });
		},
	);

	notesStory.it("serves a contract without middleware through toLayer", [], function* ({ plainList }) {
		expect(yield* plainList()).toEqual([]);
	});
});

notesStory.it("streams decode payloads and elements with declared read keys through bound native RPC", [], function* ({ follow }) {
	expect(yield* follow(2)).toEqual(["note:2", "done"]);
	expect(Follow.reads({ id: 2 })).toEqual(Get.reads({ id: 2 }, Option.none()));
	expect(Follow.error).toBe(Schema.Never);
});

notesStory.it(
	"denied sessions cannot read seeded notes",
	[denied(), storedNotes(new Note({ body: "private", id: 1, title: "Secret" }))],
	function* ({ get, reads }) {
		expect(yield* Effect.flip(get(1))).toMatchObject({ _tag: "Denied" });
		expect(reads()).toEqual([]);
	},
);
