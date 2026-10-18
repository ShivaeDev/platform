import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

screenStory.it(
	"shows linked criterion progress and next actions without zero-count metadata or untargeted criteria",
	[],
	function* ({ renderGoals, read }) {
		const view = yield* Effect.promise(() => renderGoals({ ...goalsFixture(), "claims.md": "" }));

		expect(read().text).not.toMatch(/0 linked|0 evidence|0 open|0 of 0|0\/0/u);
		const card = view.container.querySelector('[data-goal-id="project.example"]');
		expect(card?.textContent).toContain("2 of 5 done");
		expect(card?.textContent).toContain("Review linked work");
		expect(card?.textContent).toContain("2 open asks");
		const criteria = card?.querySelectorAll("li");
		expect([...(criteria ?? [])].map((row) => row.textContent)).toEqual(["First criterion1/2", "Second criterion0/1"]);
		expect(card?.querySelector('a[href="/_board/item/project.example/#criterion-first"]')).not.toBeNull();
		expect(read().text).not.toContain("No linked work");
		expect(view.container.querySelector('[data-goal-id="project.empty"]')?.textContent).toBe("Empty goal");
	},
);

screenStory.it("keeps closed goals in one collapsed section after active goals", [], function* ({ renderGoals }) {
	const view = yield* Effect.promise(() => renderGoals());

	const closed = view.container.querySelector<HTMLDetailsElement>("details");
	expect(closed).not.toBeNull();
	expect(closed?.open).toBe(false);
	expect(closed?.querySelector("summary")?.textContent).toBe("Closed goals");
	expect(closed?.querySelector('[data-goal-id="project.closed"]')?.textContent).toBe("Closed goal1 open ask");
	expect(closed?.previousElementSibling?.querySelectorAll("[data-goal-id]")).toHaveLength(2);
});

screenStory.it("omits an empty closed section and keeps the empty active state", [], function* ({ renderGoals, read }) {
	const view = yield* Effect.promise(() => renderGoals({}));

	expect(read().text).toContain("No active goals.");
	expect(view.container.querySelector("details")).toBeNull();
});
