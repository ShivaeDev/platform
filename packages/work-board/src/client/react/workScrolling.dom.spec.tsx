import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { nowAsksFixture } from "#test/nowAsksFixture.ts";
import { nowScreen } from "#test/nowScreen.tsx";
import { goalWork } from "#test/nowWork.ts";
import { screenMedia, screenResultsLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";

expectNoReactWarnings();

for (const [name, plan] of [
	["All work", [nowScreen(40, WorkCards)]],
	["Table", [nowScreen(40, WorkTable)]],
	["The phone's Now lane", [screenMedia(["(max-width: 767px)"]), nowScreen(40, WorkNow)]],
] as const) {
	screenStory.it(
		`${name} leaves vertical scrolling to the page instead of a height-bounded inner scroller`,
		plan,
		function* ({ readInnerScrollers, workItems }) {
			yield* outcomes({
				"inner scrollers": [readInnerScrollers("body"), []],
				"work shown": [workItems(), expect.arrayContaining(["task-0"])],
			});
		},
	);
}

for (const [layout, top, scrolls] of [
	["Table", 314, false],
	["All work", 314, false],
	["Table", 800, true],
	["All work", 20, true],
] as const) {
	screenStory.it(
		`Choosing ${layout} focuses the work results ${top} pixels down and ${scrolls ? "brings them into view" : "leaves them in place"}`,
		[observedBrowserMotion(), screenResultsLayout(top), routedScreen(nowAsksFixture, "/_board/work", { home: "home.md" })],
		function* ({ chooseWorkLayout, clearMotion, focusedId, readPassageTargets }) {
			yield* clearMotion();
			expect(yield* focusedId()).not.toBe("work-results");

			yield* chooseWorkLayout(layout);

			yield* outcomes({
				focus: [focusedId(), "work-results"],
				"scrolled into view": [readPassageTargets(), scrolls ? ["work-results"] : []],
			});
		},
	);
}

for (const [name, View] of [
	["An All work card", WorkCards],
	["A Table row", WorkTable],
] as const) {
	screenStory.it(
		`${name} names a goal's kind the way search and the item header do`,
		[componentScreen(<View data={goalWork()} />)],
		function* ({ nowCard }) {
			expect(yield* nowCard("task-0")).toEqual(expect.objectContaining({ kind: "Goal" }));
		},
	);
}
