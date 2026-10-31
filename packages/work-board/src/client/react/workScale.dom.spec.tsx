import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nowScreen } from "#test/nowScreen.tsx";
import { screenStory } from "#test/screenStory.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";

const ROWS = 1500;
const LATER_ROW = expect.stringMatching(/^task-[1-9]/u);

for (const [name, View] of [
	["Now", WorkNow],
	["All work", WorkCards],
	["Table", WorkTable],
] as const) {
	screenStory.it(
		`${name} renders a window of 1,500 work rows and moves it to later work as the reader scrolls`,
		[nowScreen(ROWS, View)],
		function* ({ scrollWorkList, workListWindow }) {
			expect(yield* workListWindow(ROWS)).toEqual({ first: "task-0", renders: "a window" });

			yield* scrollWorkList(22_400);

			yield* outcomes([["the rendered rows", () => workListWindow(ROWS), { first: LATER_ROW, renders: "a window" }]]);
		},
	);
}
