import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { noticesStory } from "#test/notices/story.tsx";
import { noticeScreen, removalNoticed, twoRemovalNotices, twoRemovalsHeld } from "#test/notices/traits.ts";
import { conflictingUndoWaiting, undoHeldAcrossSessionChange, undoInterruptedByClosingHost, undoWaiting } from "#test/notices/undoTraits.ts";

const ONE_MINUTE = 60_000;

noticesStory.it("each held removal publishes its own notice when it completes", [twoRemovalsHeld(true)], function* ({ completeRemove, notices }) {
	expect(yield* notices()).toEqual(["Removed second"]);

	yield* completeRemove("first");

	expect(yield* notices()).toEqual(["Removed second", "Removed first"]);
});

noticesStory.it("closing the screens inside the notice host keeps their notices", [twoRemovalNotices()], function* ({ closeScreens, notices }) {
	yield* closeScreens();

	expect(yield* notices()).toEqual(["Removed second", "Removed first"]);
});

noticesStory.it("dismissing a notice removes only that notice", [twoRemovalNotices()], function* ({ dismiss, notices }) {
	yield* dismiss("Removed second");

	expect(yield* notices()).toEqual(["Removed first"]);
});

noticesStory.it(
	"Undo sends the application's expected version and shows itself pending",
	[removalNoticed("first")],
	function* ({ notice, restoreCalls, undo }) {
		yield* undo("first");

		yield* outcomes([
			["notice", () => notice("Removed first"), { outcome: "", undo: "pending" }],
			["restore calls", () => restoreCalls(), [{ expectedVersion: 8, title: "first" }]],
		]);
	},
);

noticesStory.it(
	"a completed Undo shows its outcome on its notice and the restored row",
	[undoWaiting("first")],
	function* ({ completeRestore, notice, rows }) {
		yield* completeRestore("first");

		yield* outcomes([
			["notice", () => notice("Removed first"), { outcome: "Restored first", undo: "ready" }],
			["rows", () => rows(), "existing, first@9"],
		]);
	},
);

noticesStory.it(
	"a conflicting Undo shows its conflict on its own notice and restores nothing",
	[conflictingUndoWaiting()],
	function* ({ completeRestore, notice, notices, rows }) {
		yield* completeRestore("first");

		yield* outcomes([
			["notice", () => notice("Removed first"), { outcome: expect.stringContaining("Conflict"), undo: "ready" }],
			["notices", () => notices(), ["Removed first"]],
			["rows", () => rows(), "existing"],
		]);
	},
);

noticesStory.it(
	"closing the notice host interrupts a pending Undo and removes its notice",
	[undoWaiting("first")],
	function* ({ closeHost, notices, restoresReleased }) {
		yield* closeHost();

		yield* outcomes([
			["notices", () => notices(), []],
			["restores released", () => restoresReleased(), ["first"]],
		]);
	},
);

noticesStory.it(
	"opening the notice host again shows no notice its closing released",
	[undoInterruptedByClosingHost()],
	function* ({ notices, reopenHost }) {
		yield* reopenHost();

		expect(yield* notices()).toEqual([]);
	},
);

noticesStory.it("dismissing a notice interrupts its pending Undo", [undoWaiting("first")], function* ({ dismiss, notices, restoresReleased }) {
	yield* dismiss("Removed first");

	yield* outcomes([
		["notices", () => notices(), []],
		["restores released", () => restoresReleased(), ["first"]],
	]);
});

noticesStory.it(
	"a notice with a pending Undo is still shown one millisecond before its minute passes on the host's clock",
	[undoWaiting("first", { expiresIn: ONE_MINUTE })],
	function* ({ hostClockAdvances, notices, restoresReleased }) {
		yield* hostClockAdvances(ONE_MINUTE - 1);

		yield* outcomes([
			["notices", () => notices(), ["Removed first"]],
			["restores released", () => restoresReleased(), []],
		]);
	},
);

noticesStory.it(
	"a notice whose minute passes on the host's clock expires and interrupts its pending Undo",
	[undoWaiting("first", { expiresIn: ONE_MINUTE })],
	function* ({ noticeExpires, notices, restoresReleased }) {
		yield* noticeExpires("Removed first", ONE_MINUTE);

		yield* outcomes([
			["notices", () => notices(), []],
			["restores released", () => restoresReleased(), ["first"]],
		]);
	},
);

noticesStory.it(
	"an Undo that finishes after bob's session replaced alice's publishes nothing",
	[undoHeldAcrossSessionChange()],
	function* ({ completeRestore, notices, restoresReleased }) {
		expect(yield* notices()).toEqual([]);

		yield* completeRestore("first");

		yield* outcomes([
			["notices", () => notices(), []],
			["restores released", () => restoresReleased(), ["first"]],
		]);
	},
);

noticesStory.it(
	"a command without a notice host completes and publishes nothing",
	[noticeScreen({ host: false })],
	function* ({ commandShown, completeRemove, notices, remove }) {
		yield* remove("first");

		yield* completeRemove("first");

		yield* outcomes([
			["command", () => commandShown(), "first"],
			["notices", () => notices(), []],
		]);
	},
);

noticesStory.it(
	"a query's failed first load publishes once, even across renders",
	[noticeScreen({ queryFailure: true })],
	function* ({ notices, renderAgain }) {
		expect(yield* notices()).toEqual(["Initial load failed"]);

		yield* renderAgain();

		expect(yield* notices()).toEqual(["Initial load failed"]);
	},
);

noticesStory.it("a failed command publishes its failure notice", [noticeScreen()], function* ({ notices, remove }) {
	yield* remove("blocked");

	expect(yield* notices()).toEqual(["Command failed"]);
});

noticesStory.it(
	"a failed form submission publishes its failure notice through the submission",
	[noticeScreen()],
	function* ({ notices, submitForm }) {
		yield* submitForm();

		expect(yield* notices()).toEqual(["Command failed"]);
	},
);
