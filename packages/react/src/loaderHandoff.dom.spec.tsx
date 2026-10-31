import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { loaderScreen, noteLoadedButNotMounted, noteMountedAfterIdleWindow, noteShown } from "#test/loaderScreen.tsx";

loaderScreen.it(
	"a route that mounts after the idle window passed renders its loader's value first, with one server read",
	[noteMountedAfterIdleWindow("Delayed note")],
	function* ({ firstRenders, serverCalls }) {
		yield* outcomes({
			"first render": [Effect.map(firstRenders(), (titles) => titles[0]), "Delayed note"],
			"server calls": [serverCalls(), ["get"]],
		});
	},
);

loaderScreen.it(
	"leaving a loaded route before it renders releases its loader's query source once the idle window passes",
	[noteLoadedButNotMounted("Unread note")],
	function* ({ idleWindowPasses, leave, loaderSource }) {
		yield* leave();
		expect(yield* loaderSource()).toBe("held");

		yield* idleWindowPasses();

		expect(yield* loaderSource()).toBe("released");
	},
);

loaderScreen.it(
	"while a refresh waits for the server, the note keeps showing its loaded title",
	[noteShown("Original note")],
	function* ({ refresh, shownTitle }) {
		yield* refresh();

		expect(yield* shownTitle()).toBe("Original note");
	},
);

loaderScreen.it(
	"a refresh the server answers shows the new title after a second server read",
	[noteShown("Original note")],
	function* ({ refresh, respond, serverCalls, shownTitle }) {
		yield* refresh();

		yield* respond("Refreshed note");

		yield* outcomes({
			"server calls": [serverCalls(), ["get", "get"]],
			"shown title": [shownTitle(), "Refreshed note"],
		});
	},
);
