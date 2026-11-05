import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { batchUndoStory as changes, portionsScaledBy } from "#test/batch-undo/story.tsx";

for (const scale of [0.5, 2]) {
	changes.it(
		`Undo restores portions scaled by ${scale} under each row's returned version and clears the notice`,
		[portionsScaledBy(scale)],
		function* ({ open, scale: apply, undo, rows, notice }) {
			yield* open();
			expect(yield* rows()).toBe("first: 1 @2, second: 2 @7, third: 3 @11");
			yield* apply();
			yield* outcomes([
				["scaled portions", () => rows(), `first: ${scale} @3, second: ${2 * scale} @8, third: ${3 * scale} @12`],
				["available Undo", () => notice(), "Changed 3 rows"],
			]);

			yield* undo();

			yield* outcomes([
				["restored portions", () => rows(), "first: 1 @4, second: 2 @9, third: 3 @13"],
				["cleared notice", () => notice(), ""],
			]);
		},
	);
}

changes.it("Undo removes the copies created by the batch and restores its changed portions", [], function* ({ open, copy, undo, rows }) {
	yield* open();
	yield* copy();
	expect(yield* rows()).toBe("first: 0.5 @3, first-copy: 0.5 @0, second: 1 @8, second-copy: 1 @0, third: 1.5 @12, third-copy: 1.5 @0");

	yield* undo();

	expect(yield* rows()).toBe("first: 1 @4, second: 2 @9, third: 3 @13");
});

for (const id of ["third", "third-copy"]) {
	changes.it(
		`Undo refuses a stale version of ${id} with a typed conflict and leaves the entire batch intact`,
		[],
		function* ({ open, copy, edit, undo, rows, refresh, failure, notice }) {
			yield* open();
			yield* copy();
			yield* edit(id);
			const before = yield* rows();
			expect(before).toBe(
				`first: 0.5 @3, first-copy: 0.5 @0, second: 1 @8, second-copy: 1 @0, third: ${id === "third" ? "3 @13" : "1.5 @12"}, third-copy: ${id === "third-copy" ? "3 @1" : "1.5 @0"}`,
			);

			yield* undo();
			yield* refresh();

			yield* outcomes([
				["typed stale-version refusal", () => failure(), `Conflict: Stale version for ${id}`],
				["unchanged batch", () => rows(), before],
				["retained Undo", () => notice(), "Changed 6 rows"],
			]);
		},
	);
}
