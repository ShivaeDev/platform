import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { renderBoard } from "#test/react.tsx";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

it.live.each(["executing", "reviewing", "needs-human"] as const)(
	"counts Fleet %s work as in progress and keeps each linked row in one group",
	function* (stage) {
		const files = { ...goalPageFixture() };
		files["goal.md"] = (files["goal.md"] ?? "").replace(
			"owner: agent",
			"owner: agent\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Review the goal\n   unblocks: [project.example]",
		);
		const view = yield* Effect.promise(() =>
			renderBoard(files, (api) => (
				<FleetItemsContext.Provider value={goalFleetFixture(stage)}>
					<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
				</FleetItemsContext.Provider>
			)),
		);
		try {
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(5)));
			expect(view.container.querySelector(".item-introduction")?.nextElementSibling?.className).toContain("answer-cards");
			const counts = Object.fromEntries(
				[...view.container.querySelectorAll<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [
					segment.dataset.status,
					Number(segment.dataset.count),
				]),
			);
			expect(counts).toEqual({ done: 2, "in progress": 1, planned: 2 });
			expect(view.container.querySelector('[data-goal-section="progress"]')?.textContent).toContain("5 linked items");
			expect(view.container.querySelector(".goal-page")?.textContent).not.toMatch(/open asks|%|not linked|No recorded evidence naming/u);
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
			expect(row?.querySelector("[data-status-token]")?.textContent).toBe(stage);
			expect(row?.querySelector('a[href="https://github.com/example/project/pull/1"]')).not.toBeNull();
			for (const id of ["second", "third", "fourth", "fifth"]) {
				expect(view.container.querySelector(`[data-goal-item="task.${id}"] td:last-child`)?.textContent).toBe("");
			}
			expect(view.container.querySelector('[data-goal-group="Deferred"]')).toBeNull();
			expect(view.container.querySelector("#criterion-first [data-criterion-progress]")?.textContent).toContain(
				"Fleet 1 of 2 done · 1 in progress · 0 planned",
			);
			expect(view.container.querySelectorAll('#criterion-first a[href*="#recorded-evidence-"]')).toHaveLength(2);
			expect(view.container.querySelector("#criterion-second")?.textContent).toBe("Second criterion");
			expect(view.container.querySelector("#criterion-second")?.closest("details, [hidden]")).toBeNull();
			expect(view.container.querySelector<HTMLDetailsElement>('[data-goal-group="Done"]')?.open).toBe(false);
			expect(view.container.querySelector("article.doc")?.firstElementChild?.className).toContain("goal-page");
			yield* Effect.promise(() =>
				eventually(() => expect(view.container.querySelector('.document-outline a[href="#heading-why-this-goal-matters"]')).not.toBeNull()),
			);
		} finally {
			yield* Effect.promise(() => view.unmount());
		}
	},
);

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

it.live("falls back to authored state when Fleet is unavailable and hides an empty Active group", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll("[data-goal-item]")).toHaveLength(5)));
		expect(view.container.querySelector('[data-goal-group="Active"]')).toBeNull();
		expect(view.container.querySelector('[data-goal-item="task.first"] [data-status-token]')?.textContent).toBe("planned");
		expect(view.container.querySelector("#criterion-first [data-criterion-progress]")?.textContent).toContain(
			"Work 0 of 2 done · 0 in progress · 2 planned",
		);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("shows an empty goal without empty groups or per-criterion placeholders", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/empty.md" />),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector('[data-goal-section="progress"]')?.textContent).toContain("0 linked items")),
		);
		expect(view.container.querySelectorAll("[data-goal-item], [data-goal-group]")).toHaveLength(0);
		expect(view.container.querySelector("#criterion-untouched")?.textContent).toBe("No linked work");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("keeps closed projects outside the open-goals query and still shows criteria and work", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(view.container.querySelector('[data-goal-section="progress"]')?.textContent).toContain(
					"Progress is available for uniquely identified open projects.",
				),
			),
		);
		expect(view.container.querySelector('[data-goal-section="criteria"]')).not.toBeNull();
		expect(view.container.querySelector('[data-goal-section="work"]')).not.toBeNull();
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
