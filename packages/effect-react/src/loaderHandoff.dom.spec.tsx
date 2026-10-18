import { expect } from "vitest";
import { loaderScreen } from "#test/loaderScreen.tsx";

loaderScreen.it(
	"a route mounted beyond the idle window reads its loader value on its first render with one server execution",
	[],
	function* ({ respond, settle, calls, text, firstRenders }) {
		yield* respond("Delayed note");
		yield* settle();
		expect(text("h1")).toBe("Delayed note");
		expect(firstRenders()[0]).toBe("Delayed note");
		expect(calls()).toEqual(["get"]);
	},
);

loaderScreen.it(
	"leaving an unread loader releases its atom after the session registry's idle window",
	[],
	function* ({ respond, loaded, leave, hasQuery, hasSource, idle, text, firstRenders, calls }) {
		yield* respond("Unread note");
		yield* loaded();
		expect(firstRenders()).toEqual([]);
		expect(hasQuery()).toBe(true);
		yield* leave();
		expect(text("h1")).toBe("Other screen");
		expect(hasSource()).toBe(true);
		yield* idle();
		expect(hasQuery()).toBe(false);
		expect(hasSource()).toBe(false);
		expect(firstRenders()).toEqual([]);
		expect(calls()).toEqual(["get"]);
	},
);

loaderScreen.it("a later refresh keeps the loaded value while the server is pending", [], function* ({ respond, settle, next, click, text, calls }) {
	yield* respond("Original note");
	yield* settle();
	yield* next();
	yield* click("button");
	expect(text("h1")).toBe("Original note");
	yield* respond("Refreshed note");
	yield* settle();
	expect(text("h1")).toBe("Refreshed note");
	expect(calls()).toEqual(["get", "get"]);
});
