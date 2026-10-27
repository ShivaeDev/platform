import { expect } from "vitest";
import { loaderScreen } from "#test/loaderScreen.tsx";

loaderScreen.it(
	"a link after invalidation renders the changed query on the target's first frame with one handler call per navigation",
	[],
	function* ({ respond, click, settle, text, firstRenders, calls, unmounted, rename }) {
		yield* respond("Original note");
		yield* settle();
		expect(text("h1")).toBe("Original note");
		expect(calls()).toEqual(["get"]);
		yield* click('a[href="/"]');
		yield* settle();
		yield* unmounted();
		yield* rename("Changed note");
		const before = firstRenders().length;
		yield* click('a[href="/note"]');
		yield* settle();
		expect(text("h1")).toBe("Changed note");
		expect(firstRenders()[before]).toBe("Changed note");
		expect(
			firstRenders()
				.slice(before)
				.every((title) => title === "Changed note"),
		).toBe(true);
		expect(calls()).toEqual(["get", "get"]);
	},
);
