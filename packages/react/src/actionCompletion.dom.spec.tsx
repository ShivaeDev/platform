import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	commands,
	firstAndSecondHeld,
	firstFinished,
	firstHeld,
	firstHeldAcrossSessionChange,
	firstSupersededBySecond,
	outgoingFinishedForBob,
	secondFinishedFirstHeld,
} from "#test/command-completion/story.tsx";

commands.it(
	"with concurrent dispatch, the action stays pending after a later command completes while an earlier one is held",
	[firstAndSecondHeld()],
	function* ({ actionPending, complete, notices }) {
		yield* complete("second", "B");

		yield* outcomes({
			"action pending": [actionPending(), "true"],
			notices: [notices(), ["original: second -> B"]],
		});
	},
);

commands.it(
	"with concurrent dispatch, an earlier command completing last reports its own input",
	[secondFinishedFirstHeld("completed")],
	function* ({ complete, notices }) {
		yield* complete("first", "A");

		expect(yield* notices()).toEqual(["original: second -> B", "original: first -> A"]);
	},
);

commands.it(
	"a completion presents through the callback of the latest committed render",
	[firstHeld()],
	function* ({ complete, notices, switchCallback }) {
		yield* switchCallback("current");

		yield* complete("first", "A");

		expect(yield* notices()).toEqual(["current: first -> A"]);
	},
);

commands.it("dispatching again interrupts the held command", [firstHeld()], function* ({ dispatch, finished }) {
	expect(yield* finished()).toEqual([]);

	yield* dispatch("second");

	expect(yield* finished()).toEqual(["first"]);
});

commands.it("only the superseding command reports its completion", [firstSupersededBySecond()], function* ({ complete, notices }) {
	yield* complete("second", "B");

	expect(yield* notices()).toEqual(["original: second -> B"]);
});

commands.it(
	"a command that finishes after bob's session replaced alice's reports nothing",
	[firstHeldAcrossSessionChange("bob")],
	function* ({ complete, notices }) {
		yield* complete("first", "A");

		expect(yield* notices()).toEqual([]);
	},
);

commands.it(
	"after the session change, bob's own command reports through bob's callback",
	[outgoingFinishedForBob()],
	function* ({ complete, dispatch, notices }) {
		yield* dispatch("second");

		yield* complete("second", "B");

		expect(yield* notices()).toEqual(["bob: second -> B"]);
	},
);

commands.it(
	"a rejection that arrives after bob's session replaced alice's reports nothing and asks for no recheck",
	[firstHeldAcrossSessionChange("original")],
	function* ({ notices, rechecks, reject }) {
		yield* reject("first", "Unauthorized");

		yield* outcomes({
			notices: [notices(), []],
			rechecks: [rechecks(), "never"],
		});
	},
);

commands.it(
	"a completion invalidates the list once and reports before the list's refetch answers",
	[firstHeld()],
	function* ({ complete, invalidations, listPending, listReads, notices }) {
		yield* outcomes({
			invalidations: [invalidations(), 0],
			"list reads": [listReads(), 1],
		});

		yield* complete("first", "A");

		yield* outcomes({
			invalidations: [invalidations(), 1],
			"list pending": [listPending(), "true"],
			"list reads": [listReads(), 2],
			notices: [notices(), ["original: first -> A"]],
		});
	},
);

commands.it(
	"rendering again after a completion neither replays its notice nor invalidates again",
	[firstFinished("completed")],
	function* ({ invalidations, notices, renderAgain }) {
		yield* renderAgain();

		yield* outcomes({
			invalidations: [invalidations(), 1],
			notices: [notices(), ["original: first -> A"]],
		});
	},
);

commands.it(
	"a typed rejection reports its input and error, invalidates nothing and asks for no recheck",
	[firstHeld()],
	function* ({ invalidations, notices, rechecks, reject }) {
		yield* reject("first", "Rejected");

		yield* outcomes({
			invalidations: [invalidations(), 0],
			notices: [notices(), ["original: first rejected: Rejected"]],
			rechecks: [rechecks(), "never"],
		});
	},
);

commands.it(
	"an Unauthorized rejection reports its input and asks the auth owner to recheck once",
	[firstHeld()],
	function* ({ notices, rechecks, reject }) {
		yield* reject("first", "Unauthorized");

		yield* outcomes({
			notices: [notices(), ["original: first rejected: Unauthorized"]],
			rechecks: [rechecks(), "once"],
		});
	},
);

commands.it(
	"rendering again after an Unauthorized rejection asks for no second recheck",
	[firstFinished("Unauthorized")],
	function* ({ rechecks, renderAgain }) {
		yield* renderAgain();

		expect(yield* rechecks()).toBe("once");
	},
);

commands.it(
	"concurrent Unauthorized rejections each report their own input and recheck once each",
	[secondFinishedFirstHeld("Unauthorized")],
	function* ({ notices, rechecks, reject }) {
		yield* reject("first", "Unauthorized");

		yield* outcomes({
			notices: [notices(), ["original: second rejected: Unauthorized", "original: first rejected: Unauthorized"]],
			rechecks: [rechecks(), "twice"],
		});
	},
);

commands.it(
	"a success callback that throws shows its defect and reports no rejection or recheck",
	[firstHeld({ defect: true })],
	function* ({ complete, defectShown, notices, rechecks }) {
		yield* complete("first", "A");

		yield* outcomes({
			defect: [defectShown(), "Error: Presentation failed"],
			notices: [notices(), []],
			rechecks: [rechecks(), "never"],
		});
	},
);

commands.it(
	"a render abandoned before commit never presents a completion",
	[firstHeld()],
	function* ({ complete, notices, renderedCallbacks, startAbandonedRender }) {
		yield* startAbandonedRender();
		expect(yield* renderedCallbacks()).toContain("uncommitted");

		yield* complete("first", "A");

		expect(yield* notices()).toEqual(["original: first -> A"]);
	},
);
