import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	automatic,
	firstRenamedByAnotherHost,
	notesShown,
	secondHiddenThenRenamed,
	separateScreenOpen,
	socketDropped,
} from "#test/automatic/automatic.ts";

expectNoReactWarnings();

automatic.it("queries from two contracts share one tab socket", [notesShown()], function* ({ reads, sockets }) {
	yield* outcomes({
		reads: [reads(), [1, 2]],
		sockets: [sockets(), ["tab socket"]],
	});
});

automatic.it(
	"showing a hidden query again reads its current title over the same socket without reading the other query",
	[secondHiddenThenRenamed()],
	function* ({ reads, showSecond, shown, sockets }) {
		yield* showSecond();

		yield* outcomes({
			"note 2": [shown(2), "While unmounted"],
			reads: [reads(), [1, 2, 2]],
			sockets: [sockets(), ["tab socket"]],
		});
	},
);

automatic.it("a rename from the screen refreshes its note over the same socket", [notesShown()], function* ({ renameFromScreen, shown, sockets }) {
	yield* renameFromScreen("From this tab");

	yield* outcomes({
		"note 1": [shown(1), "From this tab"],
		sockets: [sockets(), ["tab socket"]],
	});
});

automatic.it("another host's write refreshes only the affected query", [notesShown()], function* ({ anotherHostRenamesShown, reads, shown }) {
	yield* anotherHostRenamesShown(1, "From another host");

	yield* outcomes({
		"note 1": [shown(1), "From another host"],
		reads: [reads(), [1, 1, 2]],
	});
});

automatic.it(
	"a refresh that reads an equal note keeps the query's value",
	[firstRenamedByAnotherHost("From another host")],
	function* ({ anotherHostRenamesShown, queryValue }) {
		yield* anotherHostRenamesShown(1, "From another host");

		expect(yield* queryValue(1)).toBe("the same value");
	},
);

automatic.it("a dropped socket shows Reconnecting", [notesShown()], function* ({ connection, dropSocket }) {
	expect(yield* connection()).toBe("live");

	yield* dropSocket();

	expect(yield* connection()).toBe("Reconnecting");
});

automatic.it(
	"after reconnecting on a new socket, the screen reads the change it missed",
	[socketDropped(true)],
	function* ({ reads, reconnected, shown, sockets }) {
		expect(yield* shown(1)).toBe("First");

		yield* reconnected();

		yield* outcomes({
			"note 1": [shown(1), "Changed while disconnected"],
			reads: [reads(), [1, 1, 2]],
			sockets: [sockets(), ["tab socket", "tab socket"]],
		});
	},
);

automatic.it(
	"a screen in an independent registry shares the tab socket and reads only its own query",
	[notesShown()],
	function* ({ openSeparateScreen, reads, separateShown, sockets }) {
		yield* openSeparateScreen();

		yield* outcomes({
			reads: [reads(), [1, 2, 2]],
			"second screen": [separateShown(), "Second"],
			sockets: [sockets(), ["tab socket"]],
		});
	},
);

automatic.it(
	"after the first registry closes, the other screen still receives changes over the shared socket",
	[separateScreenOpen(true)],
	function* ({ separateRenamed, separateShown, sockets }) {
		yield* separateRenamed("The remaining screen");

		yield* outcomes({
			"second screen": [separateShown(), "The remaining screen"],
			sockets: [sockets(), ["tab socket"]],
		});
	},
);
