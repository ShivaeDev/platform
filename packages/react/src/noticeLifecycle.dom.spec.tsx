import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	conflictingUndoWaiting,
	noticeScreen,
	notifications,
	removalNoticed,
	twoRemovalNotices,
	twoRemovalsHeld,
	undoHeldAcrossSessionChange,
	undoInterruptedByClosingHost,
	undoWaiting,
} from "#test/notices/story.tsx";

notifications.it("each held removal publishes its own notice when it completes", [twoRemovalsHeld(true)], function* ({ completeRemove, notices }) {
	expect(yield* notices()).toEqual(["Removed second"]);

	yield* completeRemove("first");

	expect(yield* notices()).toEqual(["Removed second", "Removed first"]);
});

notifications.it("closing the screens inside the notice host keeps their notices", [twoRemovalNotices()], function* ({ closeScreens, notices }) {
	yield* closeScreens();

	expect(yield* notices()).toEqual(["Removed second", "Removed first"]);
});

notifications.it("dismissing a notice removes only that notice", [twoRemovalNotices()], function* ({ dismiss, notices }) {
	yield* dismiss("Removed second");

	expect(yield* notices()).toEqual(["Removed first"]);
});

notifications.it(
	"Undo sends the application's expected version and shows itself pending",
	[removalNoticed("first")],
	function* ({ notice, restoreCalls, undo }) {
		yield* undo("first");

		yield* outcomes({
			notice: [notice("Removed first"), { outcome: "", undo: "pending" }],
			"restore calls": [restoreCalls(), [{ expectedVersion: 8, title: "first" }]],
		});
	},
);

notifications.it("clicking a pending Undo again sends no second restore", [undoWaiting("first")], function* ({ clickPendingUndo, restoreCalls }) {
	yield* clickPendingUndo("first");

	expect(yield* restoreCalls()).toEqual([{ expectedVersion: 8, title: "first" }]);
});

notifications.it(
	"a completed Undo shows its outcome on its notice and the restored row",
	[undoWaiting("first")],
	function* ({ completeRestore, notice, rows }) {
		yield* completeRestore("first");

		yield* outcomes({
			notice: [notice("Removed first"), { outcome: "Restored first", undo: "ready" }],
			rows: [rows(), "existing, first@9"],
		});
	},
);

notifications.it(
	"a conflicting Undo shows its conflict on its own notice and restores nothing",
	[conflictingUndoWaiting()],
	function* ({ completeRestore, notice, notices, rows }) {
		yield* completeRestore("first");

		yield* outcomes({
			notice: [notice("Removed first"), { outcome: expect.stringContaining("Conflict"), undo: "ready" }],
			notices: [notices(), ["Removed first"]],
			rows: [rows(), "existing"],
		});
	},
);

notifications.it(
	"closing the notice host interrupts a pending Undo and removes its notice",
	[undoWaiting("first")],
	function* ({ closeHost, notices, restoresReleased }) {
		yield* closeHost();

		yield* outcomes({
			notices: [notices(), []],
			"restores released": [restoresReleased(), ["first"]],
		});
	},
);

notifications.it(
	"opening the notice host again shows no notice its closing released",
	[undoInterruptedByClosingHost()],
	function* ({ notices, reopenHost }) {
		yield* reopenHost();

		expect(yield* notices()).toEqual([]);
	},
);

notifications.it("dismissing a notice interrupts its pending Undo", [undoWaiting("first")], function* ({ dismiss, notices, restoresReleased }) {
	yield* dismiss("Removed first");

	yield* outcomes({
		notices: [notices(), []],
		"restores released": [restoresReleased(), ["first"]],
	});
});

notifications.it(
	"an expiring notice interrupts its pending Undo",
	[undoWaiting("first", { expiresIn: 500 })],
	function* ({ noticeExpires, notices, restoresReleased }) {
		yield* noticeExpires("Removed first");

		yield* outcomes({
			notices: [notices(), []],
			"restores released": [restoresReleased(), ["first"]],
		});
	},
);

notifications.it(
	"an Undo that finishes after bob's session replaced alice's publishes nothing",
	[undoHeldAcrossSessionChange()],
	function* ({ completeRestore, notices, restoresReleased }) {
		expect(yield* notices()).toEqual([]);

		yield* completeRestore("first");

		yield* outcomes({
			notices: [notices(), []],
			"restores released": [restoresReleased(), ["first"]],
		});
	},
);

notifications.it(
	"a command without a notice host completes and publishes nothing",
	[noticeScreen({ host: false })],
	function* ({ commandShown, completeRemove, notices, remove }) {
		yield* remove("first");

		yield* completeRemove("first");

		yield* outcomes({
			command: [commandShown(), "first"],
			notices: [notices(), []],
		});
	},
);

notifications.it(
	"a query's failed first load publishes once, even across renders",
	[noticeScreen({ queryFailure: true })],
	function* ({ notices, renderAgain }) {
		expect(yield* notices()).toEqual(["Initial load failed"]);

		yield* renderAgain();

		expect(yield* notices()).toEqual(["Initial load failed"]);
	},
);

notifications.it("a failed command publishes its failure notice", [noticeScreen()], function* ({ notices, remove }) {
	yield* remove("blocked");

	expect(yield* notices()).toEqual(["Command failed"]);
});

notifications.it(
	"a failed form submission publishes its failure notice through the submission",
	[noticeScreen()],
	function* ({ notices, submitForm }) {
		yield* submitForm();

		expect(yield* notices()).toEqual(["Command failed"]);
	},
);
