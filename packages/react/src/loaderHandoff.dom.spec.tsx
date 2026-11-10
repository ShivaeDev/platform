import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { loaderScreen } from "#test/loaderScreen.tsx";
import { noteLeftAfterShowing, noteLoadedButNotMounted, noteLoadWaiting, noteMountedAfterIdleWindow, noteShown } from "#test/loaderTraits.ts";

loaderScreen.it(
	"leaving a route whose loader is waiting shows the other screen and releases the query source after the idle window",
	[noteLoadWaiting()],
	function* ({ idleWindowPasses, leave, loaderSource, shownTitle }) {
		expect(yield* loaderSource()).toBe("held");

		yield* leave();
		yield* idleWindowPasses();

		yield* outcomes([
			["shown title", () => shownTitle(), "Other screen"],
			["loader source", () => loaderSource(), "released"],
		]);
	},
);

loaderScreen.it(
	"a route that mounts after the idle window passed renders its loader's value from one server read",
	[noteMountedAfterIdleWindow("Delayed note")],
	function* ({ firstRenders, serverCalls }) {
		yield* outcomes([
			["first renders", () => firstRenders(), ["Delayed note"]],
			["server calls", () => serverCalls(), ["get"]],
		]);
	},
);

loaderScreen.it(
	"leaving a route before it renders holds its completed loader's query only until the hand-over window passes",
	[noteLoadedButNotMounted("Unread note")],
	function* ({ handOverWindowPasses, leave, loaderSource }) {
		yield* leave();

		expect(yield* loaderSource()).toBe("held");

		yield* handOverWindowPasses();

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

		yield* outcomes([
			["server calls", () => serverCalls(), ["get", "get"]],
			["shown title", () => shownTitle(), "Refreshed note"],
		]);
	},
);

loaderScreen.it("clicking a removed Home link fails as missing Home link", [noteShown("Original note")], function* ({ clickLink, removeLink }) {
	yield* removeLink("Home");

	const outcome = yield* Effect.flip(clickLink("Home"));

	expect(outcome).toBe("missing Home link");
});

loaderScreen.it(
	"returning to a loaded route shows its stale title before the server answers its revalidation",
	[noteLeftAfterShowing("Original note")],
	function* ({ nextReadWaits, returnToNote, shownTitle, stale, respond }) {
		yield* nextReadWaits();

		yield* returnToNote();

		yield* outcomes([
			["shown title", shownTitle, "Original note"],
			["stale", stale, true],
		]);

		yield* respond("Fresh note");

		yield* outcomes([
			["shown title", shownTitle, "Fresh note"],
			["stale", stale, false],
		]);
	},
);
