import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { renderBoard } from "#test/react.tsx";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

it.live.each(["executing", "reviewing", "needs-human"] as const)(
	"renders goals-query counts alongside authored status and Fleet %s stage",
	function* (stage) {
		const files = { ...goalPageFixture() };
		files["goal.md"] = (files["goal.md"] ?? "").replace(
			"owner: agent",
			"owner: agent\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Review the goal\n   unblocks: [project.example]",
		);
		let readProgress: () => GoalsProjection | undefined = () => undefined;
		const view = yield* Effect.promise(() =>
			renderBoard(files, (api, registry) => {
				const query = api.goals.query(undefined, routeQueryOptions);
				readProgress = () => {
					const result = registry.get(query);
					return result._tag === "Success" ? result.value : undefined;
				};
				return (
					<FleetItemsContext.Provider value={goalFleetFixture(stage)}>
						<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
					</FleetItemsContext.Provider>
				);
			}),
		);
		try {
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(5)));
			const header = view.container.querySelector(".item-introduction");
			const progress = view.container.querySelector('[data-goal-section="progress"]');
			const answers = view.container.querySelector(".answer-cards");
			expect(header?.nextElementSibling).toBe(progress);
			expect(progress?.nextElementSibling).toBe(answers);
			expect(answers).not.toBeNull();
			expect(answers?.compareDocumentPosition(view.container.querySelector("article.doc") ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("[data-goal-open-asks]")).not.toBeNull()));
			const goal = readProgress()?.goals.find((entry) => entry.id === "project.example");
			if (!goal) {
				throw new Error("Missing fixture goal query result");
			}
			const counts = Object.fromEntries(
				[...view.container.querySelectorAll<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [
					segment.dataset.status,
					Number(segment.dataset.count),
				]),
			);
			expect(goal.counts).toEqual({ deferred: 1, done: 1, "not recorded": 1, planned: 2 });
			expect(counts).toEqual(goal.counts);
			expect(view.container.querySelector('[data-goal-section="progress"]')?.textContent).toContain("5 linked items");
			expect(view.container.querySelector("[data-goal-open-asks]")?.textContent).toBe(`${goal.openAsks} open asks`);
			expect(progress?.textContent).not.toContain("%");
			expect(view.container.querySelector(".goal-page")?.textContent).not.toContain("No recorded evidence naming");
			for (const [status, count] of Object.entries(counts)) {
				const legend = [...view.container.querySelectorAll("[data-goal-counts] li")].find(
					(entry) => entry.querySelector("[data-status-token]")?.textContent === status,
				);
				expect(legend?.querySelector("strong")?.textContent).toBe(String(count));
			}
			for (const [id, group] of [
				["first", "Active"],
				["second", "Done"],
				["fourth", "Done"],
				["third", "Planned"],
				["fifth", "Not recorded"],
			]) {
				const rows = view.container.querySelectorAll(`[data-goal-item="task.${id}"]`);
				expect(rows).toHaveLength(1);
				expect(rows[0]?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(group);
				expect(rows[0]?.querySelectorAll("td")).toHaveLength(2);
			}
			const row = view.container.querySelector('[data-goal-item="task.first"]');
			expect([...(row?.querySelectorAll("[data-status-token]") ?? [])].map((chip) => chip.textContent)).toEqual(["planned", stage]);
			expect(view.container.querySelector('[data-goal-item="task.fifth"] [data-goal-fleet-stage]')?.textContent).toBe("Fleet released");
			expect(view.container.querySelector('[data-goal-item="task.fifth"] td [data-status-token]')?.textContent).toBe("Not recorded");
			expect(row?.querySelector('a[href="https://github.com/example/project/pull/1"]')).not.toBeNull();
			for (const id of ["second", "third", "fourth", "fifth"]) {
				expect(view.container.querySelector(`[data-goal-item="task.${id}"] td:last-child`)?.textContent).toBe("");
			}
			expect(view.container.querySelector('[data-goal-group="Deferred"]')).toBeNull();
			expect(view.container.querySelector("#criterion-first [data-criterion-progress]")?.textContent).toBe(
				Object.entries(goal.criteria[0]?.counts ?? {})
					.map(([status, count]) => `${count} ${status}`)
					.join(" · "),
			);
			expect(
				[...view.container.querySelectorAll("#criterion-first li:first-child [data-status-token]")].slice(0, 2).map((chip) => chip.textContent),
			).toEqual(["planned", stage]);
			expect(view.container.querySelectorAll('#criterion-first a[href*="#recorded-evidence-"]')).toHaveLength(2);
			expect(view.container.querySelector("#criterion-second")?.textContent).toBe("Second criterionnot linked");
			expect(view.container.querySelector("#criterion-second")?.closest("details, [hidden]")).toBeNull();
			expect(view.container.querySelector<HTMLDetailsElement>('[data-goal-group="Done"]')?.open).toBe(false);
			expect(view.container.querySelector("article.doc")?.firstElementChild?.className).toContain("goal-page");
			yield* Effect.promise(() =>
				eventually(() => {
					expect(view.container.querySelector('.document-outline a[href="#heading-why-this-goal-matters"]')).not.toBeNull();
					expect(view.container.querySelector(`.document-outline a[href="#${progress?.querySelector("h2")?.id}"]`)).not.toBeNull();
				}),
			);
		} finally {
			yield* Effect.promise(() => view.unmount());
		}
	},
);
