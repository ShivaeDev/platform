import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { pollingScreen } from "#test/pollingScreen.tsx";
import { intervalClock } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
screenStory.it(
	"polls only while resumed and removes its interval when the view leaves",
	[intervalClock(), pollingScreen()],
	function* ({ advanceTime, pauseUpdates, readText, readTimerCount, click }) {
		expect(readTimerCount()).toBe(1);
		yield* Effect.promise(() => advanceTime(15_000));
		expect(readText("[data-diagnostics]")).toBe("1");
		yield* Effect.promise(() => pauseUpdates(false));
		expect(readText("[data-diagnostics]")).toBe("2");
		yield* Effect.promise(() => advanceTime(15_000));
		expect(readText("[data-diagnostics]")).toBe("3");
		expect(readText("[data-fleet]")).toBe("3");
		yield* Effect.promise(() => pauseUpdates(true));
		yield* Effect.promise(() => advanceTime(15_000));
		expect(readText("[data-diagnostics]")).toBe("3");
		yield* Effect.promise(() => pauseUpdates(false));
		expect(readText("[data-diagnostics]")).toBe("4");
		click("button");
		expect(readTimerCount()).toBe(0);
		yield* Effect.promise(() => advanceTime(30_000));
		expect(readText("[data-diagnostics]")).toBe("4");
	},
);
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
