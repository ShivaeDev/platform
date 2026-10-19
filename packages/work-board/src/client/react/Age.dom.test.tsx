import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { ageScreen } from "#test/ageScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
screenStory.it(
	"ticks mounted ages and updates a refreshed timestamp without replacing its element",
	[ageScreen()],
	function* ({ advanceTime, refreshAge, findElement, readText }) {
		const age = findElement("time");
		expect(readText("time")).toBe("0s");
		yield* Effect.promise(() => advanceTime(5000));
		expect(readText("time")).toBe("5s");
		yield* Effect.promise(() => refreshAge(60_000));
		expect(findElement("time")).toBe(age);
		expect(readText("time")).toBe("1m");
	},
);
