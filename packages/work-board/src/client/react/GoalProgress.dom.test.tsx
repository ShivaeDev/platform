import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { GoalProgress } from "./GoalProgress.tsx";

for (const compact of [false, true]) {
	screenStory.it(
		`shows done work on the stock progress bar with a quiet done count (compact: ${compact})`,
		[componentScreen(<GoalProgress compact={compact} counts={{ blocked: 2, done: 31, parked: 2, running: 1, scheduled: 4 }} title="A goal" />)],
		({ readAttribute, readText, findElements }) => {
			expect(findElements('[data-slot="progress"][role="progressbar"]')).toHaveLength(1);
			expect(readAttribute('[role="progressbar"]', "aria-label")).toBe("A goal: 31 of 40 done");
			expect(readAttribute('[role="progressbar"]', "aria-valuetext")).toBe("31 of 40 done, 31 done, 1 running, 2 blocked, 4 scheduled, 2 parked");
			expect(readAttribute('[role="progressbar"]', "aria-valuenow")).toBe("31");
			expect(readAttribute('[role="progressbar"]', "aria-valuemax")).toBe("40");
			expect(readText('[data-slot="progress-value"]')).toBe(compact ? "31/40" : "31/40 done");
			expect(
				findElements("[data-goal-state]").map((segment) => [
					segment.dataset.goalState,
					segment.dataset.count,
					segment.getAttribute("title"),
					segment.style.width,
				]),
			).toEqual([
				["done", "31", "Done: 31", "77.5%"],
				["running", "1", "Running: 1", "2.5%"],
				["blocked", "2", "Blocked: 2", "5%"],
				["scheduled", "4", "Scheduled: 4", "10%"],
				["parked", "2", "Parked: 2", "5%"],
			]);
		},
	);
}

screenStory.it(
	"shows zero linked work as an empty bar without dividing by zero",
	[componentScreen(<GoalProgress counts={{ blocked: 0, done: 0, parked: 0, running: 0, scheduled: 0 }} title="Empty goal" />)],
	({ readText, readAttribute }) => {
		expect(readText('[data-slot="progress-value"]')).toBe("0/0 done");
		expect(readAttribute('[role="progressbar"]', "aria-valuenow")).toBe("0");
		expect(readAttribute('[data-goal-state="done"]', "style")).toContain("width: 0%");
	},
);
