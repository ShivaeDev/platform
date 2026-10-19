import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { GoalProgress } from "./GoalProgress.tsx";

for (const compact of [false, true]) {
	screenStory.it(
		`shows done work on the stock progress bar with a quiet done count (compact: ${compact})`,
		[componentScreen(<GoalProgress compact={compact} counts={{ done: 31, "in progress": 5, "needs you": 2, planned: 2 }} title="A goal" />)],
		({ readAttribute, readText, findElements }) => {
			expect(findElements('[data-slot="progress"][role="progressbar"]')).toHaveLength(1);
			expect(readAttribute('[role="progressbar"]', "aria-label")).toBe("A goal: 31 of 40 done");
			expect(readAttribute('[role="progressbar"]', "aria-valuetext")).toBe("31 of 40 done");
			expect(readAttribute('[role="progressbar"]', "aria-valuenow")).toBe("31");
			expect(readAttribute('[role="progressbar"]', "aria-valuemax")).toBe("40");
			expect(readText('[data-slot="progress-value"]')).toBe(compact ? "31/40" : "31 of 40 done");
			expect(findElements('[data-slot="progress-indicator"]')).toHaveLength(1);
		},
	);
}

screenStory.it(
	"shows zero linked work as an empty bar without dividing by zero",
	[componentScreen(<GoalProgress counts={{ done: 0, "in progress": 0, "needs you": 0, planned: 0 }} title="Empty goal" />)],
	({ readText, readAttribute }) => {
		expect(readText('[data-slot="progress-value"]')).toBe("0 of 0 done");
		expect(readAttribute('[role="progressbar"]', "aria-valuenow")).toBe("0");
		expect(readAttribute('[data-slot="progress-indicator"]', "style")).toContain("width: 0%");
	},
);
