import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { closedGoalPageFixture, goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { renderBoard } from "#test/react.tsx";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { routeQueryOptions } from "./routeQuery.ts";

it.live("hides empty groups and leaves evidence-free criteria quiet", function* () {
	const files = goalPageFixture();
	const view = yield* Effect.promise(() =>
		renderBoard({ ...files, "fifth.md": files["fifth.md"]?.replace("kind: task", "kind: task\nstatus: planned") ?? "" }, (api) => (
			<FleetItemsContext.Provider value={goalFleetFixture()}>
				<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
			</FleetItemsContext.Provider>
		)),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(5)));
		expect(view.container.querySelectorAll('[data-goal-group="Deferred"], [data-goal-group="Not recorded"]')).toHaveLength(0);
		expect(view.container.querySelector('[data-goal-item="task.fifth"] [data-status-token]')?.textContent).toBe("planned");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("falls back to authored state when Fleet is unavailable and hides an empty In progress group", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(5)));
		expect(view.container.querySelector('[data-goal-group="In progress"]')).toBeNull();
		expect(view.container.querySelector('[data-goal-item="task.first"] [data-status-token]')?.textContent).toBe("planned");
		expect(view.container.querySelector("#criterion-first [data-criterion-progress]")?.textContent).toContain("2 planned");
		expect(view.container.querySelector('[data-goal-item="task.fifth"] td')?.textContent).toBe("");
		expect(view.container.querySelector('[data-goal-item="task.fifth"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(
			"Planned",
		);
		expect(view.container.querySelector('[data-goal-item="task.third"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(
			"Deferred",
		);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("shows zero open asks and keeps untargeted criteria quiet", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/empty.md" />),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector('[data-goal-section="progress"]')?.textContent).toContain("0 linked items")),
		);
		expect(view.container.querySelectorAll("[data-goal-item], [data-goal-group]")).toHaveLength(0);
		expect(view.container.querySelector("[data-goal-open-asks]")?.textContent).toBe("0 open asks");
		expect(view.container.querySelector("#criterion-untouched")?.textContent).toBe("No linked work");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live.each(["completed", "closed"])("shows query-derived goal and criterion counts for a %s project", function* (status) {
	let readProgress: () => GoalsProjection | undefined = () => undefined;
	const view = yield* Effect.promise(() =>
		renderBoard(closedGoalPageFixture(status), (api, registry) => {
			const query = api.goals.query(undefined, routeQueryOptions);
			readProgress = () => {
				const result = registry.get(query);
				return result._tag === "Success" ? result.value : undefined;
			};
			return <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />;
		}),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector('[data-goal-section="progress"]')?.textContent).toContain("6 linked items")),
		);
		const data = readProgress();
		const goal = data?.closedGoals.find((entry) => entry.id === "project.closed");
		expect(data?.goals.map((entry) => entry.id)).toEqual(["project.empty", "project.example"]);
		expect(goal?.counts).toEqual({ done: 2, "in progress": 1, planned: 3 });
		const counts = Object.fromEntries(
			[...view.container.querySelectorAll<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [
				segment.dataset.status,
				Number(segment.dataset.count),
			]),
		);
		expect(counts).toEqual(goal?.counts);
		expect(view.container.querySelector("[data-goal-open-asks]")?.textContent).toBe(`${goal?.openAsks} open asks`);
		expect(goal?.criteria[0]?.counts).toEqual({ done: 1, "in progress": 1, planned: 1 });
		expect(view.container.querySelector("#criterion-first [data-criterion-progress]")?.textContent).toBe("1 done · 1 in progress · 1 planned");
		expect(view.container.querySelector("#criterion-second")?.textContent).toBe("Second criterion");
		expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(goal?.linked ?? 0);
		expect(view.container.querySelectorAll('[data-goal-item="result.closed"]')).toHaveLength(1);
		expect(view.container.querySelector('[data-goal-item="result.closed"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(
			"Done",
		);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
