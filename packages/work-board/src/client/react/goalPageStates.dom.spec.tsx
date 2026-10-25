import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
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
		yield* Effect.promise(() =>
			eventually(() =>
				expect(
					findElements("[data-goal-item]")
						.map((item) => item.getAttribute("data-goal-item"))
						.sort(),
				).toEqual(["task.fifth", "task.first", "task.fourth", "task.second", "task.third"]),
			),
		);
		expect(findElements('[data-goal-group="Dropped"], [data-goal-group="Not recorded"]')).toHaveLength(0);
		expect(readText('[data-goal-item="task.fifth"] [data-status-token]')).toBe("Draft");
	},
);

screenStory.it(
	"falls back to authored state when Fleet is unavailable and hides an empty In progress group",
	[boardScreen({ ...goalPageFixture(), "asks.md": "# No open asks" }, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElements, findElement, readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(
					findElements("[data-goal-item]")
						.map((item) => item.getAttribute("data-goal-item"))
						.sort(),
				).toEqual(["task.fifth", "task.first", "task.fourth", "task.second", "task.third"]),
			),
		);
		expect(findElement('[data-goal-group="In progress"]')).toBeNull();
		expect(readText('[data-goal-item="task.first"] [data-status-token]')).toBe("Draft");
		expect(readText("#criterion-first [data-criterion-progress]")).toContain("2 draft");
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
		yield* Effect.promise(() =>
			eventually(() => expect(readText('[data-goal-section="progress"] [data-slot="empty-title"]')).toBe("No linked work")),
		);
		expect(findElements("[data-goal-item], [data-goal-group], [data-goal-counts], [data-goal-open-asks]")).toHaveLength(0);
		expect(findElement('[data-goal-section="work"]')).toBeNull();
		yield* Effect.promise(() => eventually(() => expect(readText("#criterion-untouched")).toBe("No linked work")));
	},
);

for (const status of ["done", "dropped"]) {
	screenStory.it(
		`shows query-derived goal and criterion counts for a ${status} project`,
		[boardScreen(closedGoalPageFixture(status), (api) => <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />)],
		function* ({ readText, findElements, readGoals }) {
			yield* Effect.promise(() => eventually(() => expect(readText('[data-goal-section="progress"]')).toContain("5 linked items")));
			const data = yield* Effect.promise(readGoals);
			const goal = data?.closedGoals.find((entry) => entry.id === "project.closed");
			expect(data?.goals.map((entry) => entry.id)).toEqual(["project.example"]);
			expect(goal?.counts).toEqual({ deferred: 1, done: 1, draft: 2, dropped: 0, ready: 1 });
			const counts = Object.fromEntries(
				[...findElements<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [segment.dataset.status, Number(segment.dataset.count)]),
			);
			expect(counts).toEqual(goal?.counts);
			expect(readText("[data-goal-open-asks]")).toBe(`${goal?.openAsks} open asks`);
			expect(goal?.criteria[0]?.counts).toEqual({ deferred: 0, done: 0, draft: 1, dropped: 0, ready: 1 });
			expect(readText("#criterion-first [data-criterion-progress]")).toBe("1 ready · 1 draft");
			yield* Effect.promise(() => eventually(() => expect(readText("#criterion-second")).toBe("Second criterion")));
			expect(findElements("[data-goal-item]")).toHaveLength(goal?.linked ?? 0);
			expect(findElements('[data-goal-item="result.closed"]')).toHaveLength(0);
		},
	);
}
