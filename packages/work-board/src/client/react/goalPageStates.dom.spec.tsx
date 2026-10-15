import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { renderBoard } from "#test/react.tsx";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

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

it.live("keeps closed projects outside the open-goals query and still shows criteria and work", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(
			{
				...goalPageFixture(),
				"closed-result.md":
					"---\nid: result.closed\nkind: result\nstatus: done\nrelationships:\n - kind: implements\n   target: project.closed\n---\n# Closed result",
			},
			(api) => <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />,
		),
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
		expect(view.container.querySelectorAll('[data-goal-item="result.closed"]')).toHaveLength(1);
		expect(view.container.querySelector('[data-goal-item="result.closed"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(
			"Done",
		);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
