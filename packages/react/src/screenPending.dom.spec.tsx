import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { loaderScreen, noteLoadedButNotMounted, refreshHeld } from "#test/loaderScreen.tsx";

loaderScreen.it(
	"a route whose query has answered keeps the screen pending until the router mounts it",
	[noteLoadedButNotMounted("Routed note")],
	function* ({ routeMounts, screenWork, shownTitle }) {
		expect(yield* screenWork()).toBe("pending");

		yield* routeMounts();

		yield* outcomes({
			"screen work": [screenWork(), "settled"],
			shown: [shownTitle(), "Routed note"],
		});
	},
);

loaderScreen.it(
	"a refresh the server still holds keeps the settled route's screen pending until the answer arrives",
	[refreshHeld("Original note")],
	function* ({ respond, screenWork, shownTitle }) {
		expect(yield* screenWork()).toBe("pending");

		yield* respond("Refreshed note");

		yield* outcomes({
			"screen work": [screenWork(), "settled"],
			shown: [shownTitle(), "Refreshed note"],
		});
	},
);

loaderScreen.it(
	"a refresh left behind by a screen that is gone does not keep the screen pending",
	[refreshHeld("Original note")],
	function* ({ leave, screenWork, shownTitle }) {
		expect(yield* screenWork()).toBe("pending");

		yield* leave();

		yield* outcomes({
			"screen work": [screenWork(), "settled"],
			shown: [shownTitle(), "Other screen"],
		});
	},
);
