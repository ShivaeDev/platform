import { Effect } from "effect";
import { expect, it } from "vitest";
import { expectNoReactWarnings, render } from "@shivaedev/effect-react/client/testing.ts";
import { goals } from "#server/views/goals.ts";
import { fixtureSnapshot } from "#test/fixtureSnapshot.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { GoalsPage } from "./GoalsPage.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

async function renderGoals(files = goalsFixture()) {
	const snapshot = await Effect.runPromise(fixtureSnapshot(files, undefined));
	return render(<GoalsPage data={goals(snapshot)} />);
}

it("shows linked criterion progress and next actions without zero-count metadata or untargeted criteria", async () => {
	const view = await renderGoals({ ...goalsFixture(), "claims.md": "" });
	try {
		expect(view.container.textContent).not.toMatch(/0 linked|0 evidence|0 open|0 of 0|0\/0/u);
		const card = view.container.querySelector('[data-goal-id="project.example"]');
		expect(card?.textContent).toContain("2 of 5 done");
		expect(card?.textContent).toContain("Review linked work");
		expect(card?.textContent).toContain("2 open asks");
		const criteria = card?.querySelectorAll("li");
		expect([...(criteria ?? [])].map((row) => row.textContent)).toEqual(["First criterion1/2", "Second criterion0/1"]);
		expect(card?.querySelector('a[href="/_board/item/project.example/#criterion-first"]')).not.toBeNull();
		expect(view.container.textContent).not.toContain("No linked work");
		expect(view.container.querySelector('[data-goal-id="project.empty"]')?.textContent).toBe("Empty goal");
	} finally {
		await view.unmount();
	}
});

it("keeps closed goals in one collapsed section after active goals", async () => {
	const view = await renderGoals();
	try {
		const closed = view.container.querySelector<HTMLDetailsElement>("details");
		expect(closed).not.toBeNull();
		expect(closed?.open).toBe(false);
		expect(closed?.querySelector("summary")?.textContent).toBe("Closed goals");
		expect(closed?.querySelector('[data-goal-id="project.closed"]')?.textContent).toBe("Closed goal1 open ask");
		expect(closed?.previousElementSibling?.querySelectorAll("[data-goal-id]")).toHaveLength(2);
	} finally {
		await view.unmount();
	}
});

it("omits an empty closed section and keeps the empty active state", async () => {
	const view = await renderGoals({});
	try {
		expect(view.container.textContent).toContain("No active goals.");
		expect(view.container.querySelector("details")).toBeNull();
	} finally {
		await view.unmount();
	}
});
