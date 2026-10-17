import { Effect, Schema } from "effect";
import { describe, expect } from "vitest";
import { contract } from "#contract.ts";
import { type CommandShape, command, type QueryShape, type StreamShape, stream } from "#operation.ts";
import { Follow } from "#test/edgeEngine.ts";
import { Create, Get, List, Note, NoteMissing, Rename } from "#test/notes.ts";
import { denied, notesStory, signedIn, storedNotes } from "#test/notesStory.ts";

describe("contract", () => {
	notesStory.it("rejects duplicate operation names at construction when the compiler cannot see them", [], () => {
		const queries: readonly QueryShape[] = [List, Get, List];
		expect(() => contract("dupes", { queries })).toThrow("Operation names must be unique; duplicated: list");
		const commands: readonly CommandShape[] = [command("get", { invalidates: () => [] })];
		expect(() => contract("dupes", { commands, queries: [Get] })).toThrow("Operation names must be unique; duplicated: get");
		const streams: readonly StreamShape[] = [stream("get", { reads: () => [], success: Schema.String })];
		expect(() => contract("dupes", { queries: [Get], streams })).toThrow("Operation names must be unique; duplicated: get");
		expect(() => contract("dupes", { streams: [...streams, ...streams] })).toThrow("Operation names must be unique; duplicated: get");
	});

	notesStory.it("reuses declared rejection classes and generates classes for field specs", [], function* () {
		expect(Get.Rejection.NoteMissing).toBe(NoteMissing);
		expect(Rename.Rejection.NoteMissing).toBe(NoteMissing);
		const invalid = yield* Effect.flip(Rename.reject.Invalid({ field: "title", message: "Enter a title" }));
		expect(invalid).toBeInstanceOf(Rename.Rejection.Invalid);
		expect(invalid).toMatchObject({ _tag: "Invalid", field: "title", message: "Enter a title" });
		expect(Create.Rejection.Invalid).not.toBe(Rename.Rejection.Invalid);
	});

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
	expect(Follow.reads({ id: 2 })).toEqual(Get.reads({ id: 2 }));
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
