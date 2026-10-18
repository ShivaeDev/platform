import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { closedGoalPageFixture, goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { routeQueryOptions } from "./routeQuery.ts";

const files = goalPageFixture();
screenStory.it(
	"hides empty groups and leaves evidence-free criteria quiet",
	[
		boardScreen({ ...files, "fifth.md": files["fifth.md"]?.replace("kind: task", "kind: task\nstatus: planned") ?? "" }, (api) => (
			<FleetItemsContext.Provider value={goalFleetFixture()}>
				<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
			</FleetItemsContext.Provider>
		)),
	],
	function* ({ findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElements("[data-goal-item]")).toHaveLength(5)));
		expect(findElements('[data-goal-group="Deferred"], [data-goal-group="Not recorded"]')).toHaveLength(0);
		expect(readText('[data-goal-item="task.fifth"] [data-status-token]')).toBe("planned");
	},
);

screenStory.it(
	"falls back to authored state when Fleet is unavailable and hides an empty In progress group",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElements, findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElements("[data-goal-item]")).toHaveLength(5)));
		expect(findElement('[data-goal-group="In progress"]')).toBeNull();
		expect(readText('[data-goal-item="task.first"] [data-status-token]')).toBe("planned");
		expect(readText("#criterion-first [data-criterion-progress]")).toContain("2 planned");
		expect(readText('[data-goal-item="task.fifth"] td')).toBe("");
		expect(findElement('[data-goal-item="task.fifth"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Planned");
		expect(findElement('[data-goal-item="task.third"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Deferred");
	},
);

screenStory.it(
	"shows zero open asks and keeps untargeted criteria quiet",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/empty.md" />)],
	function* ({ readText, findElements }) {
		yield* Effect.promise(() => eventually(() => expect(readText('[data-goal-section="progress"]')).toContain("0 linked items")));
		expect(findElements("[data-goal-item], [data-goal-group]")).toHaveLength(0);
		expect(readText("[data-goal-open-asks]")).toBe("0 open asks");
		expect(readText("#criterion-untouched")).toBe("No linked work");
	},
);

for (const status of ["completed", "closed"]) {
	let readProgress: () => GoalsProjection | undefined = () => undefined;
	screenStory.it(
		`shows query-derived goal and criterion counts for a ${status} project`,
		[
			boardScreen(closedGoalPageFixture(status), (api, registry) => {
				const query = api.goals.query(undefined, routeQueryOptions);
				readProgress = () => {
					const result = registry.get(query);
					return result._tag === "Success" ? result.value : undefined;
				};
				return <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />;
			}),
		],
		function* ({ readText, findElements, findElement }) {
			yield* Effect.promise(() => eventually(() => expect(readText('[data-goal-section="progress"]')).toContain("6 linked items")));
			const data = readProgress();
			const goal = data?.closedGoals.find((entry) => entry.id === "project.closed");
			expect(data?.goals.map((entry) => entry.id)).toEqual(["project.empty", "project.example"]);
			expect(goal?.counts).toEqual({ done: 2, "in progress": 1, planned: 3 });
			const counts = Object.fromEntries(
				[...findElements<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [segment.dataset.status, Number(segment.dataset.count)]),
			);
			expect(counts).toEqual(goal?.counts);
			expect(readText("[data-goal-open-asks]")).toBe(`${goal?.openAsks} open asks`);
			expect(goal?.criteria[0]?.counts).toEqual({ done: 1, "in progress": 1, planned: 1 });
			expect(readText("#criterion-first [data-criterion-progress]")).toBe("1 done · 1 in progress · 1 planned");
			expect(readText("#criterion-second")).toBe("Second criterion");
			expect(findElements("[data-goal-item]")).toHaveLength(goal?.linked ?? 0);
			expect(findElements('[data-goal-item="result.closed"]')).toHaveLength(1);
			expect(findElement('[data-goal-item="result.closed"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Done");
		},
	);
}
