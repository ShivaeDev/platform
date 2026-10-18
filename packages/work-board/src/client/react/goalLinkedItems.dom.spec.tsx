import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { renderBoard } from "#test/react.tsx";
import { DocumentMain } from "./DocumentMain.tsx";
import { routeQueryOptions } from "./routeQuery.ts";

it.live.each(["result", "decision", "question", "response"] as const)("shows an implementing %s in its criterion and work group", function* (kind) {
	const id = `${kind}.linked`;
	let readProgress: () => GoalsProjection | undefined = () => undefined;
	const view = yield* Effect.promise(() =>
		renderBoard(
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
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(6)));
		const goal = readProgress()?.goals.find((entry) => entry.id === "project.example");
		expect(goal?.linked).toBe(6);
		const counts = Object.fromEntries(
			[...view.container.querySelectorAll<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [
				segment.dataset.status,
				Number(segment.dataset.count),
			]),
		);
		expect(counts).toEqual(goal?.counts);
		for (const [item, group] of [
			[id, "Done"],
			["task.first", "Planned"],
			["task.second", "Planned"],
			["task.third", "Deferred"],
			["task.fourth", "Done"],
			["task.fifth", "Planned"],
		]) {
			const rows = view.container.querySelectorAll(`[data-goal-item="${item}"]`);
			expect(rows).toHaveLength(1);
			expect(rows[0]?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(group);
		}
		const links = view.container.querySelectorAll(`#criterion-first a[href="/_board/item/${id}/"]`);
		expect(links).toHaveLength(1);
		expect(links[0]?.parentElement?.querySelector("[data-status-token]")?.textContent).toBe("done");
		expect(goal?.criteria[0]?.counts).toEqual({ done: 1, "in progress": 0, planned: 2 });
		expect(view.container.querySelector("#criterion-first [data-criterion-progress]")?.textContent).toBe("1 done · 0 in progress · 2 planned");
		expect(view.container.querySelector("#criterion-second")?.textContent).toBe("Second criterion");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
