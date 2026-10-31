import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { GoalProgress } from "./GoalProgress.tsx";

const counts = { blocked: 2, done: 31, parked: 2, running: 1, scheduled: 4 };

screenStory.it(
	"a goal's progress bar tells a screen reader its done share and the count in every state",
	[componentScreen(<GoalProgress counts={counts} title="A goal" />)],
	function* ({ goalProgressBar }) {
		expect(yield* goalProgressBar()).toMatchObject({
			label: "A goal: 31 of 40 done",
			spoken: "31 of 40 done, 31 done, 1 running, 2 blocked, 4 scheduled, 2 parked",
			value: "31 of 40",
		});
	},
);

screenStory.it(
	"each state's segment of a goal's progress bar is as wide as its share of the linked work",
	[componentScreen(<GoalProgress counts={counts} title="A goal" />)],
	function* ({ goalProgressBar }) {
		expect(yield* goalProgressBar()).toMatchObject({ widths: { blocked: "5%", done: "77.5%", parked: "5%", running: "2.5%", scheduled: "10%" } });
	},
);

for (const [compact, shown] of [
	[false, "31/40 done"],
	[true, "31/40"],
] as const) {
	screenStory.it(
		`a ${compact ? "compact" : "full"} goal progress bar shows ${shown} under the bar`,
		[componentScreen(<GoalProgress compact={compact} counts={counts} title="A goal" />)],
		function* ({ goalProgressBar }) {
			expect(yield* goalProgressBar()).toMatchObject({ shown });
		},
	);
}

screenStory.it(
	"a goal with no linked work shows an empty bar at 0/0 done",
	[componentScreen(<GoalProgress counts={{ blocked: 0, done: 0, parked: 0, running: 0, scheduled: 0 }} title="Empty goal" />)],
	function* ({ goalProgressBar }) {
		expect(yield* goalProgressBar()).toMatchObject({
			shown: "0/0 done",
			value: "0 of 1",
			widths: { blocked: "0%", done: "0%", parked: "0%", running: "0%", scheduled: "0%" },
		});
	},
);
