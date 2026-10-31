import { expect } from "vitest";
import { loaderScreen } from "#test/loaderScreen.tsx";

loaderScreen.it(
	"the screen stays pending while the router finishes a route whose query has answered",
	[],
	function* ({ respond, loaded, pending, settle, text }) {
		yield* respond("Routed note");
		yield* loaded();

		expect(yield* pending()).toBe(true);

		yield* settle();

		expect(yield* pending()).toBe(false);
		expect(text("h1")).toBe("Routed note");
	},
);

loaderScreen.it(
	"a refresh on a settled route keeps the screen pending until the server answers",
	[],
	function* ({ respond, settle, next, click, pending }) {
		yield* respond("Original note");
		yield* settle();
		yield* next();

		yield* click("button");

		expect(yield* pending()).toBe(true);
		yield* respond("Refreshed note");
		yield* settle();
		expect(yield* pending()).toBe(false);
	},
);

loaderScreen.it(
	"a refresh left behind by a screen that is gone does not keep the screen pending",
	[],
	function* ({ respond, settle, next, click, leave, pending, text }) {
		yield* respond("Original note");
		yield* settle();
		yield* next();
		yield* click("button");
		expect(yield* pending()).toBe(true);

		yield* leave();

		expect(text("h1")).toBe("Other screen");
		expect(yield* pending()).toBe(false);
	},
);
