import { Effect } from "effect";
import type { Window } from "happy-dom";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { screenFleet } from "#test/screenWorkspaceTraits.ts";

const LEGEND_LABELS: Readonly<Record<string, string>> = { done: "Done", "in progress": "In progress", planned: "Planned" };

declare const window: Window;

for (const [stage, label] of [
	["executing", "Executing"],
	["reviewing", "Reviewing"],
	["needs-human", "Needs you"],
] as const) {
	const files = { ...goalPageFixture() };
	files["goal.md"] = (files["goal.md"] ?? "").replace(
		"owner: agent",
		"owner: agent\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Review the goal\n   unblocks: [project.example]",
	);
	const fleet = goalFleetFixture(stage);
	screenStory.it(
		`renders Fleet-aware goals-query counts and a single ${stage} state`,
		[
			screenFleet({
				...fleet,
				completed: fleet.completed.map((item) => ({ ...item, document: null })),
				items: fleet.items.map((item) => ({ ...item, document: null })),
				state: "ready",
			}),
			routedScreen(files, "/_board/item/project.example/", { home: "home.md" }),
		],
		function* ({ readGoals, findElements, findElement, readText }) {
			yield* Effect.promise(() => eventually(() => expect(findElements("[data-goal-item]")).toHaveLength(5)));
			const header = findElement(".item-introduction");
			const progress = findElement('[data-goal-section="progress"]');
			const answers = findElement(".answer-cards");
			expect(header?.nextElementSibling).toBe(progress);
			expect(progress?.nextElementSibling).toBe(answers);
			expect(answers).not.toBeNull();
			expect(answers?.compareDocumentPosition(findElement("article.doc") ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			yield* Effect.promise(() => eventually(() => expect(findElement("[data-goal-open-asks]")).not.toBeNull()));
			const goal = (yield* Effect.promise(readGoals)).goals.find((entry) => entry.id === "project.example");
			if (!goal) {
				throw new Error("Missing fixture goal query result");
			}
			const counts = Object.fromEntries(
				[...findElements<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [segment.dataset.status, Number(segment.dataset.count)]),
			);
			expect(goal.counts).toEqual({ done: 2, "in progress": 1, planned: 2 });
			expect(counts).toEqual(goal.counts);
			expect(readText('[data-goal-section="progress"]')).toContain("5 linked items");
			expect(readText("[data-goal-open-asks]")).toBe(`${goal.openAsks} open asks`);
			expect(progress?.textContent).not.toContain("%");
			expect(readText(".goal-page")).not.toContain("No recorded evidence naming");
			for (const [status, count] of Object.entries(counts)) {
				const legend = [...findElements("[data-goal-counts] li")].find((entry) => readText("[data-status-token]", entry) === LEGEND_LABELS[status]);
				expect(readText("strong", legend)).toBe(String(count));
			}
			for (const [id, group] of [
				["first", "In progress"],
				["second", "Done"],
				["fourth", "Done"],
				["third", "Planned"],
				["fifth", "Planned"],
			]) {
				const rows = findElements(`[data-goal-item="task.${id}"]`);
				expect(rows).toHaveLength(1);
				expect(rows[0]?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(group);
				expect(findElements("td", rows[0])).toHaveLength(2);
				expect(findElements("[data-status-token]", rows[0])).toHaveLength(id === "fifth" ? 0 : 1);
			}
			const row = findElement('[data-goal-item="task.first"]');
			expect([...(findElements("[data-status-token]", row) ?? [])].map((chip) => chip.textContent)).toEqual([label]);
			expect(readText('[data-goal-item="task.fifth"] td')).toBe("");
			expect(readText('[data-goal-item="task.fifth"] td [data-status-token]')).toBeUndefined();
			expect(findElement('a[href="https://github.com/example/project/pull/1"]', row)).not.toBeNull();
			for (const id of ["second", "third", "fourth", "fifth"]) {
				expect(readText(`[data-goal-item="task.${id}"] td:last-child`)).toBe("");
			}
			expect(findElements('[data-goal-group="Deferred"], [data-goal-group="Active"], [data-goal-group="Not recorded"]')).toHaveLength(0);
			expect(readText("#criterion-first [data-criterion-progress]")).toBe(
				Object.entries(goal.criteria[0]?.counts ?? {})
					.map(([status, count]) => `${count} ${status}`)
					.join(" · "),
			);
			expect([...findElements("#criterion-first li:first-child [data-status-token]")].slice(0, 2).map((chip) => chip.textContent)).toEqual([label]);
			expect(findElements('#criterion-first a[href*="#recorded-evidence-"]')).toHaveLength(2);
			expect(readText("#criterion-second")).toBe("Second criterion");
			expect(findElement("#criterion-second")?.closest("details, [hidden]")).toBeNull();
			expect(findElement<HTMLDetailsElement>('[data-goal-group="Done"]')?.open).toBe(false);
			expect(findElement("article.doc")?.firstElementChild?.className).toContain("goal-page");
			yield* Effect.promise(() =>
				eventually(() => {
					expect(findElement('.document-outline a[href="#heading-why-this-goal-matters"]')).not.toBeNull();
					expect(findElement(`.document-outline a[href="#${findElement("h2", progress)?.id}"]`)).not.toBeNull();
				}),
			);
		},
	);
}
