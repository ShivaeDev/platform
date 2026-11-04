import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { undoableChangeStory as changes } from "#test/undoable-change/story.tsx";

changes.it(
	"Undo restores the removed row using the version returned by the change and clears its notice",
	[],
	function* ({ open, remove, completeRemove, undo, completeUndo, row, notice }) {
		yield* open();
		yield* remove("first");
		yield* completeRemove("first");
		yield* outcomes([
			["row before Undo", () => row("first"), "first: removed @8"],
			["notice before Undo", () => notice(), "Removed first"],
		]);

		yield* undo("first");
		yield* completeUndo("first");

		yield* outcomes([
			["restored row", () => row("first"), "first: visible @9"],
			["notice after Undo", () => notice(), ""],
		]);
	},
);

changes.it(
	"Undo after a later edit fails with a typed conflict and preserves the edit and notice",
	[],
	function* ({ open, remove, completeRemove, edit, undo, row, undoFailure, notice }) {
		yield* open();
		yield* remove("first");
		yield* completeRemove("first");
		yield* edit("first");
		expect(yield* row("first")).toBe("first: removed @9");

		yield* undo("first");

		yield* outcomes([
			["Undo failure", () => undoFailure(), "Conflict"],
			["later edit", () => row("first"), "first: removed @9"],
			["retained notice", () => notice(), "Removed first"],
		]);
	},
);

changes.it(
	"an older reply arriving last keeps the newer notice and its Undo target",
	[],
	function* ({ open, remove, completeRemove, notice, undo, completeUndo, row }) {
		yield* open();
		yield* remove("first");
		yield* remove("second");
		yield* completeRemove("second");
		expect(yield* notice()).toBe("Removed second");

		yield* completeRemove("first");
		expect(yield* notice()).toBe("Removed second");
		yield* undo("second");
		yield* completeUndo("second");

		yield* outcomes([
			["older row", () => row("first"), "first: removed @8"],
			["newer row", () => row("second"), "second: visible @9"],
		]);
	},
);

changes.it(
	"a hidden tab holds its staged update until all overlapping removals finish",
	[],
	function* ({ open, remove, completeRemove, hide, status, activations }) {
		yield* open();
		yield* remove("first");
		yield* remove("second");
		yield* hide();
		yield* completeRemove("second");
		yield* outcomes([
			["pending removal", () => status(), JSON.stringify({ blocked: true, pending: true, removing: true, undoing: false })],
			["held update", () => activations(), []],
		]);

		yield* completeRemove("first");

		yield* outcomes([
			["completed removals", () => status(), JSON.stringify({ blocked: false, pending: false, removing: false, undoing: false })],
			["activated update", () => activations(), ["build-b"]],
		]);
	},
);

changes.it(
	"a hidden tab holds its staged update while Undo is pending",
	[],
	function* ({ open, remove, completeRemove, undo, completeUndo, hide, status, activations }) {
		yield* open();
		yield* remove("first");
		yield* completeRemove("first");
		yield* undo("first");
		yield* hide();
		yield* outcomes([
			["pending Undo", () => status(), JSON.stringify({ blocked: true, pending: true, removing: false, undoing: true })],
			["held update", () => activations(), []],
		]);

		yield* completeUndo("first");

		expect(yield* activations()).toEqual(["build-b"]);
	},
);

changes.it(
	"an older Undo finishing after a newer removal keeps the newer notice",
	[],
	function* ({ open, remove, completeRemove, undo, completeUndo, notice }) {
		yield* open();
		yield* remove("first");
		yield* completeRemove("first");
		yield* undo("first");
		yield* remove("second");
		yield* completeRemove("second");
		expect(yield* notice()).toBe("Removed second");

		yield* completeUndo("first");

		expect(yield* notice()).toBe("Removed second");
	},
);

changes.it(
	"a refused Undo releases the pending write and deployment hold",
	[],
	function* ({ open, remove, completeRemove, edit, undo, hide, status, activations }) {
		yield* open();
		yield* remove("first");
		yield* completeRemove("first");
		yield* edit("first");

		yield* undo("first");
		yield* hide();

		yield* outcomes([
			["released write", () => status(), JSON.stringify({ blocked: false, pending: false, removing: false, undoing: false })],
			["activated update", () => activations(), ["build-b"]],
		]);
	},
);
