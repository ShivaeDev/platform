import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceBusy, bobNoticedAfterBusyAlice, bobReplacedBusyAlice, feedback } from "#test/feedback-path/story.tsx";

feedback.it(
	"replacing a busy session empties its registry and starts bob's notes fresh",
	[aliceBusy()],
	function* ({ heldAtoms, loading, notices, reads, replaceSession }) {
		expect(yield* heldAtoms("alice")).toBe("holds atoms");

		yield* replaceSession("bob");

		yield* outcomes({
			"alice's atoms": [heldAtoms("alice"), "empty"],
			"bob's reads": [reads("bob"), 1],
			loading: [loading(), "Loading notes"],
			notices: [notices(), []],
		});
	},
);

feedback.it("bob's notes show without alice's draft or notices", [bobReplacedBusyAlice(false)], function* ({ answerRead, draft, notices, rows }) {
	yield* answerRead();

	yield* outcomes({
		draft: [draft(), ""],
		notices: [notices(), []],
		rows: [rows(), "existing"],
	});
});

feedback.it(
	"alice's held uninterruptible work finishes after the switch without reaching bob's screen",
	[bobReplacedBusyAlice(true)],
	function* ({ callbacks, completeRemove, completeRestore, notices, restoresReleased }) {
		yield* completeRemove("second", "alice");
		yield* completeRestore("first", "alice");

		yield* outcomes({
			"alice's callbacks": [callbacks("alice"), ["alice: first"]],
			"alice's restores released": [restoresReleased("alice"), ["first"]],
			"bob's notices": [notices(), []],
		});
	},
);

feedback.it(
	"running alice's retained Undo after the switch sends nothing",
	[bobReplacedBusyAlice(true)],
	function* ({ heldAtoms, restoreCalls, runRetainedAction }) {
		yield* runRetainedAction();

		yield* outcomes({
			"alice's atoms": [heldAtoms("alice"), "empty"],
			"alice's restore calls": [restoreCalls("alice"), [{ expectedVersion: 8, title: "first" }]],
		});
	},
);

feedback.it(
	"bob's removal publishes through his own notice host and callback",
	[bobReplacedBusyAlice(true)],
	function* ({ callbacks, completeRemove, notices, remove }) {
		yield* remove("first");

		yield* completeRemove("first");

		yield* outcomes({
			"bob's callbacks": [callbacks("bob"), ["bob: first"]],
			notices: [notices(), ["Removed first"]],
		});
	},
);

feedback.it(
	"dismissing alice's retained notice after the switch leaves bob's notice",
	[bobNoticedAfterBusyAlice()],
	function* ({ dismissRetainedNotice, notices }) {
		yield* dismissRetainedNotice();

		expect(yield* notices()).toEqual(["Removed first"]);
	},
);

feedback.it("bob's Undo runs his own restore, not alice's", [bobNoticedAfterBusyAlice()], function* ({ restoreCalls, undo }) {
	yield* undo("first");

	yield* outcomes({
		"alice's restore calls": [restoreCalls("alice"), [{ expectedVersion: 8, title: "first" }]],
		"bob's restore calls": [restoreCalls("bob"), [{ expectedVersion: 8, title: "first" }]],
	});
});
