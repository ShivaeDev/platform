import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { nowAsksFixture } from "#test/nowAsksFixture.ts";
import { nowScreen } from "#test/nowScreen.tsx";
import { nowWork } from "#test/nowWork.ts";
import { screenMedia, screenResultsLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";

expectNoReactWarnings();

const SHOWN_ROWS = 40;

for (const [name, View] of [
	["All work", WorkCards],
	["Table", WorkTable],
] as const) {
	screenStory.it(`leaves vertical scrolling to the page in ${name}`, [nowScreen(SHOWN_ROWS, View)], ({ findElements, readInnerScrollers }) => {
		expect(findElements("[data-item]")).toHaveLength(SHOWN_ROWS);
		expect(readInnerScrollers("body")).toEqual([]);
	});
}

screenStory.it(
	"leaves vertical scrolling to the page in the phone's Now lane",
	[screenMedia(["(max-width: 767px)"]), nowScreen(SHOWN_ROWS, WorkNow)],
	({ findElements, readInnerScrollers }) => {
		expect(findElements("[data-item]").length).toBeGreaterThan(0);
		expect(readInnerScrollers("body")).toEqual([]);
	},
);

for (const [layout, top, scrolls] of [
	["Table", 314, false],
	["All work", 314, false],
	["Table", 800, true],
	["All work", 20, true],
] as const) {
	screenStory.it(
		`${scrolls ? "brings" : "keeps"} the work results ${scrolls ? "into view" : "in place"} when ${layout} opens with them ${top} pixels down`,
		[observedBrowserMotion(), screenResultsLayout(top), routedScreen(nowAsksFixture, "/_board/work", { home: "home.md" })],
		function* ({ clearMotion, click, findByRole, findElement, readFocus, readPassageTargets }) {
			yield* Effect.promise(() => eventually(() => expect(findElement("[data-item]")).not.toBeNull()));
			clearMotion();
			click(findByRole("link", layout, findByRole("navigation", "Work layout")));
			yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("work-results")));
			expect(readPassageTargets().includes("work-results")).toBe(scrolls);
		},
	);
}

screenStory.it(
	"marks the focused work results with the Board's control focus ring instead of the browser outline",
	[routedScreen(nowAsksFixture, "/_board/work?view=table", { home: "home.md" })],
	function* ({ findElement }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#work-results")).not.toBeNull()));
		const results = [...(findElement("#work-results")?.classList ?? [])];
		expect(results).toEqual(expect.arrayContaining(["outline-none", "focus-visible:ring-3", "focus-visible:ring-ring/50"]));
	},
);

screenStory.it(
	"names a goal's kind on its All work card the way search and the item header do",
	[
		componentScreen(
			<WorkCards
				data={(() => {
					const data = nowWork(1);
					const rows = data.rows.map((item) => ({ ...item, metadata: { ...item.metadata, kind: "project" as const } }));
					return { ...data, items: rows, rows };
				})()}
			/>,
		),
	],
	({ readText }) => {
		expect(readText(".work-kind")).toBe("Goal");
	},
);
