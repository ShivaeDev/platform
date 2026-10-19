import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { routeQueryOptions } from "./routeQuery.ts";

for (const kind of ["result", "decision", "question", "response"] as const) {
	const id = `${kind}.linked`;
	let readProgress: () => GoalsProjection | undefined = () => undefined;
	screenStory.it(
		`shows an implementing ${kind} in its criterion and work group`,
		[
			boardScreen(
				{
					...goalPageFixture(),
					"linked.md": `---
id: ${id}
kind: ${kind}
status: done
relationships:
 - kind: implements
   target: project.example#first
 - kind: implements
   target: project.example
---
# Linked ${kind}`,
				},
				(api, registry) => {
					const query = api.goals.query(undefined, routeQueryOptions);
					readProgress = () => {
						const result = registry.get(query);
						return result._tag === "Success" ? result.value : undefined;
					};
					return <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />;
				},
			),
		],
		function* ({ click, findElements, readText }) {
			yield* Effect.promise(() => eventually(() => expect(findElements("[data-goal-item]")).toHaveLength(6)));
			const goal = readProgress()?.goals.find((entry) => entry.id === "project.example");
			expect(goal?.linked).toBe(6);
			const counts = Object.fromEntries(
				[...findElements<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [segment.dataset.status, Number(segment.dataset.count)]),
			);
			expect(counts).toEqual(goal?.counts);
			for (const [item, group] of [
				[id, "Done"],
				["task.first", "Needs you"],
				["task.second", "Planned"],
				["task.third", "Planned"],
				["task.fourth", "Done"],
				["task.fifth", "Needs you"],
			]) {
				const rows = findElements(`[data-goal-item="${item}"]`);
				expect(rows).toHaveLength(1);
				expect(rows[0]?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(group);
			}
			click("#criterion-first [data-slot=collapsible-trigger]");
			const links = findElements(`#criterion-first a[href="/_board/item/${id}/"]`);
			expect(links).toHaveLength(1);
			expect(readText("[data-status-token]", links[0]?.parentElement)).toBe("Done");
			expect(goal?.criteria[0]?.counts).toEqual({ done: 1, "in progress": 0, "needs you": 1, planned: 1 });
			expect(readText("#criterion-first [data-criterion-progress]")).toBe("1 done · 1 needs you · 1 planned");
			yield* Effect.promise(() => eventually(() => expect(readText("#criterion-second")).toBe("Second criterion")));
		},
	);
}
