import { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

function observeGoals(api: BoardTestApi, registry: AtomRegistry.AtomRegistry, receive: (data: GoalsProjection) => void) {
	registry.subscribe(
		api.goals.query(),
		(result) => {
			if (result._tag === "Success") {
				receive(result.value);
			}
		},
		{ immediate: true },
	);
}

const fleet: FleetItemsProjection = {
	completed: [],
	items: [
		{ document: null, prUrl: "https://github.com/example/project/pull/1", stage: "reviewing", stageEnteredAt: 0, updatedAt: 0, workId: "task.first" },
	],
	state: "ready",
};

it.live.each(["active", "In Review"])(
	"opens a goal with query counts, visible criteria and each implementing item in one status group before prose (%s)",
	function* (authoredStatus) {
		let goals: GoalsProjection | undefined;
		const view = yield* Effect.promise(() =>
			renderBoard(
				{ ...goalPageFixture(), "first.md": goalPageFixture()["first.md"]?.replace("status: active", `status: ${authoredStatus}`) ?? "" },
				(api, registry) => {
					observeGoals(api, registry, (data) => {
						goals = data;
					});
					return (
						<FleetItemsContext.Provider value={fleet}>
							<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
						</FleetItemsContext.Provider>
					);
				},
			),
		);
		try {
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(5)));
			const goal = goals?.goals.find((entry) => entry.id === "project.example");
			expect(goal).toBeDefined();
			const counts = Object.fromEntries(
				[...view.container.querySelectorAll<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [
					segment.dataset.status,
					Number(segment.dataset.count),
				]),
			);
			expect(counts).toEqual(goal?.counts);
			expect(view.container.querySelector('[data-goal-section="progress"]')?.textContent).toContain(
				`${goal?.linked} linked items · ${goal?.openAsks} open asks`,
			);
			for (const [status, count] of Object.entries(goal?.counts ?? {})) {
				const legend = [...view.container.querySelectorAll("[data-goal-counts] li")].find(
					(entry) => entry.querySelector("[data-status-token]")?.textContent === status,
				);
				expect(legend?.querySelector("strong")?.textContent).toBe(String(count));
			}
			expect(view.container.querySelector(".goal-page")?.textContent).not.toContain("%");
			for (const [id, group] of [
				["first", "Active"],
				["second", "Planned"],
				["fourth", "Done"],
				["third", "Deferred"],
				["fifth", "Not recorded"],
			]) {
				const rows = view.container.querySelectorAll(`[data-goal-item="task.${id}"]`);
				expect(rows).toHaveLength(1);
				expect(rows[0]?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(group);
				expect(rows[0]?.querySelector("[data-status-token]")).not.toBeNull();
			}
			const unlinked = view.container.querySelector("#criterion-second");
			expect(unlinked?.textContent).toContain("Second criterion");
			expect(unlinked?.textContent).toContain("not linked");
			expect(unlinked?.closest("details, [hidden]")).toBeNull();
			expect(unlinked?.querySelector('a[href$="#recorded-evidence-0"]')).not.toBeNull();
			const criterion = view.container.querySelector("#criterion-first");
			expect(criterion?.querySelectorAll("[data-status-token]")).toHaveLength(2);
			expect(criterion?.textContent).toContain("Fleet · reviewing");
			const row = view.container.querySelector('[data-goal-item="task.first"]');
			expect(row?.textContent).toContain("reviewing");
			expect(row?.querySelector('a[href="https://github.com/example/project/pull/1"]')).not.toBeNull();
			expect(view.container.querySelector('[data-goal-item="task.fifth"]')?.textContent).toContain("Not recorded");
			const done = view.container.querySelector<HTMLDetailsElement>('[data-goal-group="Done"]');
			expect(done?.open).toBe(false);

			expect(view.container.querySelector("article.doc")?.firstElementChild?.className).toContain("goal-page");
			yield* Effect.promise(() =>
				eventually(() => expect(view.container.querySelector('.document-outline a[href="#heading-why-this-goal-matters"]')).not.toBeNull()),
			);
		} finally {
			yield* Effect.promise(() => view.unmount());
		}
	},
);

it.live("keeps an unlinked goal empty and does not infer an overall success state", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/empty.md" />),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".goal-page")?.textContent).toContain("Goal is unlinked.")));
		expect(view.container.querySelectorAll("[data-goal-item], [data-goal-counts] [data-count]")).toHaveLength(0);
		expect(view.container.querySelector("#criterion-untouched")?.textContent).toContain("not linked");
		expect(view.container.querySelector(".goal-page")?.textContent).toContain("0 linked items · 0 open asks");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("keeps closed projects outside the open-goals query and still shows criteria and work", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".goal-page")?.textContent).toContain("Progress unavailable.")));
		expect(view.container.querySelector('[data-goal-section="criteria"]')).not.toBeNull();
		expect(view.container.querySelector('[data-goal-section="work"]')).not.toBeNull();
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
