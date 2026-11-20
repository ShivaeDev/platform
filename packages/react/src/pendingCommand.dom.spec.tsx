import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { firstSucceededSecondToggled, pendingCommands, toggledOn, toggleScreen, toggleSucceeded } from "#test/pendingCommandStories.tsx";
import { reflectedSwitch, switchTheServerKeepsOff, switchWithHeldUpdate } from "#test/reflected-switch/story.tsx";

pendingCommands.it(
	"a toggled row shows the wanted value before its command answers",
	[toggleScreen()],
	function* ({ command, serverRows, shown, toggle, toggleState }) {
		yield* toggle();

		yield* outcomes([
			["command", () => command(), "not answered"],
			["server rows", () => serverRows(), ["disabled"]],
			["shown", () => shown(), "enabled"],
			["toggle", () => toggleState(), "waiting"],
		]);
	},
);

pendingCommands.it(
	"a command the server accepted keeps the wanted value and stays unanswered while the server reruns the queries it changed",
	[toggledOn()],
	function* ({ command, commandSucceeds, serverRows, shown, toggleState }) {
		yield* commandSucceeds();

		yield* outcomes([
			["command", () => command(), "not answered"],
			["server rows", () => serverRows(), ["disabled"]],
			["shown", () => shown(), "enabled"],
			["toggle", () => toggleState(), "waiting"],
		]);
	},
);

for (const first of ["list", "count"] as const) {
	pendingCommands.it(
		`the wanted value stays while the server has not rerun the ${first === "list" ? "count" : "list"} yet`,
		[toggleSucceeded()],
		function* ({ countResponds, listResponds, shown, toggleState }) {
			yield* first === "list" ? listResponds(false) : countResponds(0);

			yield* outcomes([
				["shown", () => shown(), "enabled"],
				["toggle", () => toggleState(), "waiting"],
			]);
		},
	);
}

for (const enabled of [false, true]) {
	const value = enabled ? "enabled" : "disabled";
	pendingCommands.it(
		`after both reruns the command succeeds and the row shows the server's ${value} value`,
		[toggleSucceeded()],
		function* ({ command, countResponds, listResponds, serverRows, shown, toggleState }) {
			yield* listResponds(enabled);
			yield* countResponds(enabled ? 1 : 0);

			yield* outcomes([
				["command", () => command(), "succeeded"],
				["server rows", () => serverRows(), [value]],
				["shown", () => shown(), value],
				["toggle", () => toggleState(), "available"],
			]);
		},
	);
}

pendingCommands.it(
	"a typed command rejection reverts the toggle and shows its reason",
	[toggledOn()],
	function* ({ command, commandFails, serverRows, shown, toggleState }) {
		yield* commandFails("This row is locked");

		yield* outcomes([
			["command", () => command(), "rejected (ToggleRejected: This row is locked)"],
			["server rows", () => serverRows(), ["disabled"]],
			["shown", () => shown(), "disabled"],
			["toggle", () => toggleState(), "available"],
		]);
	},
);

pendingCommands.it(
	"another row's rejection leaves an accepted toggle waiting for its reruns",
	[firstSucceededSecondToggled()],
	function* ({ command, commandFails, shown, toggleState }) {
		yield* commandFails("Row 2 is locked", 2);

		yield* outcomes([
			["row 1 command", () => command(1), "not answered"],
			["row 1 shown", () => shown(1), "enabled"],
			["row 1 toggle", () => toggleState(1), "waiting"],
			["row 2 command", () => command(2), "rejected (ToggleRejected: Row 2 is locked)"],
			["row 2 shown", () => shown(2), "disabled"],
			["row 2 toggle", () => toggleState(2), "available"],
		]);
	},
);

reflectedSwitch.it(
	"a switch turned on shows On while its accepted command waits for the server's update, and is free once the update is on the screen",
	[switchWithHeldUpdate()],
	function* ({ commandAccepted, commandResult, shown, shownSinceOpening, switchState, toggle, updateArrives }) {
		yield* toggle();
		yield* commandAccepted();
		yield* outcomes([
			["command", () => commandResult(), "not answered"],
			["shown", () => shown(), "on"],
			["switch", () => switchState(), "waiting"],
		]);

		yield* updateArrives();

		yield* outcomes([
			["command", () => commandResult(), "succeeded"],
			["shown", () => shown(), "on"],
			["shown since opening", () => shownSinceOpening(), ["off", "on"]],
			["switch", () => switchState(), "available"],
		]);
	},
);

reflectedSwitch.it(
	"a switch the server keeps off returns to Off and is free once its command is reflected, though the server pushes no update",
	[switchTheServerKeepsOff()],
	function* ({ commandResult, settle, shown, shownSinceOpening, switchState, toggle }) {
		yield* toggle();

		yield* settle();

		yield* outcomes([
			["command", () => commandResult(), "succeeded"],
			["shown", () => shown(), "off"],
			["shown since opening", () => shownSinceOpening(), ["off", "on", "off"]],
			["switch", () => switchState(), "available"],
		]);
	},
);
