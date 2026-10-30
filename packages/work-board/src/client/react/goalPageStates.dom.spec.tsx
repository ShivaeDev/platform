import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { closedGoalPageFixture, goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

const files = goalPageFixture();
screenStory.it(
	"hides empty groups and leaves evidence-free criteria quiet",
	[
		boardScreen({ ...files, "fifth.md": files["fifth.md"]?.replace("kind: task", "kind: task\nstatus: draft") ?? "" }, (api) => (
			<FleetItemsContext.Provider value={goalFleetFixture()}>
				<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
			</FleetItemsContext.Provider>
		)),
	],
	function* ({ findElements, readText }) {
		yield* eventually(() =>
			expect(
				findElements("[data-goal-item]")
					.map((item) => item.getAttribute("data-goal-item"))
					.sort(),
			).toEqual(["task.fifth", "task.first", "task.fourth", "task.second", "task.third"]),
		);
		expect(findElements('[data-goal-group="Dropped"], [data-goal-group="Not recorded"]')).toHaveLength(0);
		expect(readText('[data-goal-item="task.fifth"] [data-status-token]')).toBe("Draft");
	},
);

screenStory.it(
	"falls back to authored state when Fleet is unavailable and hides an empty In progress group",
	[boardScreen({ ...goalPageFixture(), "asks.md": "# No open asks" }, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElements, findElement, readText }) {
		yield* eventually(() =>
			expect(
				findElements("[data-goal-item]")
					.map((item) => item.getAttribute("data-goal-item"))
					.sort(),
			).toEqual(["task.fifth", "task.first", "task.fourth", "task.second", "task.third"]),
		);
		expect(findElement('[data-goal-group="In progress"]')).toBeNull();
		expect(readText('[data-goal-item="task.first"] [data-status-token]')).toBe("Draft");
		expect(readText("#criterion-first [data-criterion-progress]")).toContain("2 parked");
		expect(readText('[data-goal-item="task.fifth"] td:nth-of-type(2)')).toBe("");
		expect(findElement('[data-goal-item="task.fifth"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Draft");
		expect(findElement('[data-goal-item="task.third"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Deferred");
		expect(readText('[data-goal-item="task.third"] [data-status-token]')).toBe("Deferred");
	},
);

screenStory.it(
	"shows an empty state instead of zero progress and keeps untargeted criteria quiet",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/empty.md" />)],
	function* ({ findElement, readText, findElements }) {
		yield* eventually(() => expect(readText('[data-goal-section="progress"] [data-slot="empty-title"]')).toBe("No linked work"));
		expect(findElements("[data-goal-item], [data-goal-group], [data-goal-counts], [data-goal-open-asks]")).toHaveLength(0);
		expect(findElement('[data-goal-section="work"]')).toBeNull();
		yield* eventually(() => expect(readText("#criterion-untouched")).toBe("No linked work"));
	},
);

for (const status of ["done", "dropped"]) {
	screenStory.it(
		`shows query-derived goal and criterion counts for a ${status} project`,
		[boardScreen(closedGoalPageFixture(status), (api) => <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />)],
		function* ({ readText, findElements, readGoals }) {
			yield* eventually(() => expect(readText('[data-goal-section="progress"]')).toContain("5 linked items"));
			const data = yield* Effect.promise(readGoals);
			const goal = data?.closedGoals.find((entry) => entry.id === "project.closed");
			expect(data?.goals.map((entry) => entry.id)).toEqual(["project.example"]);
			expect(goal?.counts).toEqual({ blocked: 2, done: 1, parked: 2, running: 0, scheduled: 0 });
			const counts = Object.fromEntries(
				[...findElements<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [segment.dataset.status, Number(segment.dataset.count)]),
			);
			expect(counts).toEqual(goal?.counts);
			expect(readText("[data-goal-open-asks]")).toBe(`${goal?.openAsks} open asks`);
			expect(goal?.criteria[0]?.counts).toEqual({ blocked: 1, done: 0, parked: 1, running: 0, scheduled: 0 });
			expect(readText("#criterion-first [data-criterion-progress]")).toBe("1 blocked · 1 parked");
			yield* eventually(() => expect(readText("#criterion-second")).toBe("Second criterion"));
			expect(findElements("[data-goal-item]")).toHaveLength(goal?.linked ?? 0);
			expect(findElements('[data-goal-item="result.closed"]')).toHaveLength(0);
		},
	);
}
