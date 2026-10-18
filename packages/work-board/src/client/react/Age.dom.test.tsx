import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { ageScreen } from "#test/ageScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
screenStory.it(
	"ticks mounted ages and updates a refreshed timestamp without replacing its span",
	[ageScreen()],
	function* ({ advanceTime, refreshAge, findElement, readText }) {
		const span = findElement("span");
		expect(readText("span")).toBe("0s");
		yield* Effect.promise(() => advanceTime(5000));
		expect(readText("span")).toBe("5s");
		yield* Effect.promise(() => refreshAge(60_000));
		expect(findElement("span")).toBe(span);
		expect(readText("span")).toBe("1m");
	},
);
