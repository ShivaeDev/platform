import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { firstSucceededSecondToggled, pendingCommands, toggledOn, toggleScreen, toggleSucceeded } from "#test/pendingCommandStories.tsx";

pendingCommands.it(
	"a toggled row shows the wanted value before its command answers",
	[toggleScreen()],
	function* ({ command, serverRows, shown, toggle, toggleState }) {
		yield* toggle();

		yield* outcomes({
			command: [command(), "not answered"],
			"server rows": [serverRows(), ["disabled"]],
			shown: [shown(), "enabled"],
			toggle: [toggleState(), "waiting"],
		});
	},
);

pendingCommands.it(
	"a successful command keeps the wanted value while its invalidated queries refetch",
	[toggledOn()],
	function* ({ command, commandSucceeds, serverRows, shown, toggleState }) {
		yield* commandSucceeds();

		yield* outcomes({
			command: [command(), "succeeded"],
			"server rows": [serverRows(), ["disabled"]],
			shown: [shown(), "enabled"],
			toggle: [toggleState(), "waiting"],
		});
	},
);

for (const first of ["list", "count"] as const) {
	pendingCommands.it(
		`the wanted value stays while the ${first === "list" ? "count" : "list"} has not refetched yet`,
		[toggleSucceeded()],
		function* ({ countResponds, listResponds, shown, toggleState }) {
			yield* first === "list" ? listResponds(false) : countResponds(0);

			yield* outcomes({
				shown: [shown(), "enabled"],
				toggle: [toggleState(), "waiting"],
			});
		},
	);
}

for (const enabled of [false, true]) {
	const value = enabled ? "enabled" : "disabled";
	pendingCommands.it(
		`after both refetches the row shows the server's ${value} value`,
		[toggleSucceeded()],
		function* ({ countResponds, listResponds, serverRows, shown, toggleState }) {
			yield* listResponds(enabled);
			yield* countResponds(enabled ? 1 : 0);

			yield* outcomes({
				"server rows": [serverRows(), [value]],
				shown: [shown(), value],
				toggle: [toggleState(), "available"],
			});
		},
	);
}

pendingCommands.it(
	"a typed command rejection reverts the toggle and shows its reason",
	[toggledOn()],
	function* ({ command, commandFails, serverRows, shown, toggleState }) {
		yield* commandFails("This row is locked");

		yield* outcomes({
			command: [command(), "rejected (ToggleRejected: This row is locked)"],
			"server rows": [serverRows(), ["disabled"]],
			shown: [shown(), "disabled"],
			toggle: [toggleState(), "available"],
		});
	},
);

pendingCommands.it(
	"another row's rejection leaves a successful toggle waiting for its refetch",
	[firstSucceededSecondToggled()],
	function* ({ command, commandFails, shown, toggleState }) {
		yield* commandFails("Row 2 is locked", 2);

		yield* outcomes({
			"row 1 command": [command(1), "succeeded"],
			"row 1 shown": [shown(1), "enabled"],
			"row 1 toggle": [toggleState(1), "waiting"],
			"row 2 command": [command(2), "rejected (ToggleRejected: Row 2 is locked)"],
			"row 2 shown": [shown(2), "disabled"],
			"row 2 toggle": [toggleState(2), "available"],
		});
	},
);
