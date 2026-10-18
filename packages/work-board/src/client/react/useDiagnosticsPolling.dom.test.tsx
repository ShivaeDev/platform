import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { pollingScreen } from "#test/pollingScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
screenStory.it(
	"refreshes diagnostics and fleet when updates resume, then unsubscribes",
	[pollingScreen()],
	function* ({ pauseUpdates, readText, click }) {
		expect(readText("[data-diagnostics]")).toBe("1");
		expect(readText("[data-fleet]")).toBe("1");
		yield* Effect.promise(() => pauseUpdates(false));
		expect(readText("[data-diagnostics]")).toBe("2");
		expect(readText("[data-fleet]")).toBe("2");
		yield* Effect.promise(() => pauseUpdates(true));
		expect(readText("[data-diagnostics]")).toBe("2");
		click("button");
		yield* Effect.promise(() => pauseUpdates(false));
		expect(readText("[data-diagnostics]")).toBe("2");
		expect(readText("[data-fleet]")).toBe("2");
	},
);
