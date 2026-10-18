import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import { GoalProgress } from "./GoalProgress.tsx";

it.each([false, true])("shows three progress groups and a quiet done count (compact: %s)", async (compact) => {
	const view = await render(<GoalProgress compact={compact} counts={{ active: 7, done: 31, planned: 2 }} title="A goal" />);
	try {
		expect(view.container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("A goal: 31 of 40 done");
		expect(view.container.querySelector('[role="img"]')?.getAttribute("title")).toBe("A goal: 31 of 40 done");
		expect(view.container.querySelector("p")?.textContent).toBe(compact ? "31/40" : "31 of 40 done");
		expect(view.container.querySelectorAll("[data-status-token]")).toHaveLength(0);
		expect(view.container.querySelectorAll('[role="img"] > span')).toHaveLength(3);
	} finally {
		await view.unmount();
	}
});

it("includes all linked statuses in the total without claiming deferred or unrecorded work is done", async () => {
	const view = await render(<GoalProgress counts={{ accepted: 1, blocked: 1, completed: 1, deferred: 1, "not recorded": 1 }} title="A goal" />);
	try {
		expect(view.container.querySelector("p")?.textContent).toBe("2 of 5 done");
		expect(view.container.querySelector('[role="img"]')?.getAttribute("aria-description")).toContain("in progress: 1, planned: 2");
	} finally {
		await view.unmount();
	}
});

it("shows zero linked work without a not-linked label", async () => {
	const view = await render(<GoalProgress counts={{}} title="Empty goal" />);
	try {
		expect(view.container.textContent).toBe("0 of 0 done");
		expect(view.container.querySelectorAll('[role="img"] > span')).toHaveLength(0);
	} finally {
		await view.unmount();
	}
});
