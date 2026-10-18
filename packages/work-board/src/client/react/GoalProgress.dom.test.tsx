import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { GoalProgress } from "./GoalProgress.tsx";

for (const compact of [false, true]) {
	screenStory.it(
		`shows three progress groups and a quiet done count (compact: ${compact})`,
		[componentScreen(<GoalProgress compact={compact} counts={{ active: 7, done: 31, planned: 2 }} title="A goal" />)],
		({ screen }) => {
			const view = screen();

			expect(view.container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("A goal: 31 of 40 done");
			expect(view.container.querySelector('[role="img"]')?.getAttribute("title")).toBe("A goal: 31 of 40 done");
			expect(view.container.querySelector("p")?.textContent).toBe(compact ? "31/40" : "31 of 40 done");
			expect(view.container.querySelectorAll("[data-status-token]")).toHaveLength(0);
			expect(view.container.querySelectorAll('[role="img"] > span')).toHaveLength(3);
		},
	);
}

screenStory.it(
	"includes all linked statuses in the total without claiming deferred or unrecorded work is done",
	[componentScreen(<GoalProgress counts={{ accepted: 1, blocked: 1, completed: 1, deferred: 1, "not recorded": 1 }} title="A goal" />)],
	({ screen }) => {
		const view = screen();

		expect(view.container.querySelector("p")?.textContent).toBe("2 of 5 done");
		expect(view.container.querySelector('[role="img"]')?.getAttribute("aria-description")).toContain("in progress: 1, planned: 2");
	},
);

screenStory.it(
	"shows zero linked work without a not-linked label",
	[componentScreen(<GoalProgress counts={{}} title="Empty goal" />)],
	({ screen }) => {
		const view = screen();

		expect(view.container.textContent).toBe("0 of 0 done");
		expect(view.container.querySelectorAll('[role="img"] > span')).toHaveLength(0);
	},
);
