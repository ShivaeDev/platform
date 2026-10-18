import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { compareStatuses, nowLanes } from "#browser/views/now.ts";
import { nowFleet, nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";

for (const sort of ["title", "owner", "status"] as const) {
	screenStory.it(`keeps stage lanes fixed under ${sort} sorting and renders Fleet card facts`, [], function* ({ render, click }) {
		const data = nowWork();
		const authored = data.rows.map((item, index) => ({
			...item,
			metadata: { ...item.metadata, status: ["planned", "planned", "active", "blocked", "reviewing", "done"][index] },
		}));
		const rows = [...authored].sort((left, right) =>
			sort === "title" ? left.title.localeCompare(right.title) : (left.metadata[sort] ?? "").localeCompare(right.metadata[sort] ?? ""),
		);
		const fleet = nowFleet(6, Effect.runSync(Clock.currentTimeMillis));
		const view = yield* Effect.promise(() =>
			render(
				<FleetItemsContext.Provider value={fleet}>
					<WorkNow data={{ ...data, rows, state: { ...data.state, sort } }} />
				</FleetItemsContext.Provider>,
			),
		);

		expect(view.container.querySelector(".work-total")).toBeNull();
		expect([...view.container.querySelectorAll(".work-column")].map((lane) => lane.getAttribute("aria-label"))).toEqual(nowLanes);
		const card = view.container.querySelector('[aria-label="Executing"] [data-item="task-1"]');
		expect(card?.querySelector("h3")?.textContent).toBe("Work 5");
		expect(card?.querySelector("[data-status-token]")?.textContent).toBe("executing");
		expect(card?.textContent).toContain("Holder: Fleet");
		expect(card?.textContent).toContain("In executing for");
		expect(card?.querySelector('a[href="https://github.com/example/project/pull/1"]')).not.toBeNull();
		expect(view.container.querySelector('[aria-label="Waiting on a person"]')?.textContent).toContain("Holder: maintainer");
		expect(view.container.querySelector('[data-item="task-5"]')).toBeNull();
		const button = view.container.querySelector<HTMLButtonElement>('[aria-expanded="false"]');
		click(button);
		expect(view.container.querySelector('[aria-label="Done in the last 7 days"] [data-item="task-5"]')).not.toBeNull();
	});
}

for (const [storyCase, fleet] of [undefined, { reason: "Stopped daemon", state: "unavailable" } as const].entries()) {
	screenStory.it(`discloses missing Fleet data and uses authored status (${storyCase + 1})`, [], function* ({ render, read }) {
		const data = nowWork();
		const statuses = ["approved", "active", "reviewing", "delivering", "needs-human", "done"];
		const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
		const view = yield* Effect.promise(() =>
			render(
				<FleetItemsContext.Provider value={fleet}>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		);

		expect(read().text).toContain("Fleet is unavailable");
		for (const [index, lane] of nowLanes.entries()) {
			if (index !== 5) {
				expect(view.container.querySelector(`[aria-label="${lane}"] [data-item="task-${index}"]`)).not.toBeNull();
			}
		}
		expect(read().text).not.toContain("no recent completion time");
		expect(view.container.querySelector(".work-stage")).toBeNull();
	});
}

for (const sort of ["title", "owner", "status"] as const) {
	screenStory.it(`keeps All work status columns fixed under ${sort} sorting`, [], function* ({ render }) {
		const data = nowWork();
		const rows = data.rows.map((item, index) => ({
			...item,
			metadata: { ...item.metadata, status: ["done", "active", "planned", "blocked", "custom", undefined][index] },
		}));
		const sorted = [...rows].sort((left, right) =>
			sort === "title" ? left.title.localeCompare(right.title) : (left.metadata[sort] ?? "").localeCompare(right.metadata[sort] ?? ""),
		);
		const view = yield* Effect.promise(() => render(<WorkCards data={{ ...data, rows: sorted }} />));

		expect([...view.container.querySelectorAll(".work-column")].map((lane) => lane.getAttribute("aria-label"))).toEqual([
			"planned",
			"active",
			"blocked",
			"done",
			"custom",
			"",
		]);
		expect(compareStatuses("done", "planned")).toBeGreaterThan(0);
	});
}

for (const stage of ["reviewing", "repairing", "validating"] as const) {
	screenStory.it(`places Fleet ${stage} in Reviewing`, [], function* ({ render }) {
		const fleet = nowFleet();
		if (fleet.state !== "ready") {
			throw new Error("Missing Fleet fixture");
		}
		const items = fleet.items.map((item) => ({ ...item, stage }));
		const view = yield* Effect.promise(() =>
			render(
				<FleetItemsContext.Provider value={{ ...fleet, items }}>
					<WorkNow data={nowWork()} />
				</FleetItemsContext.Provider>,
			),
		);

		expect(view.container.querySelectorAll('[aria-label="Reviewing"] [data-item]')).toHaveLength(5);
	});
}

screenStory.it(
	"keeps older Fleet completions outside the last-seven-days lane",
	[
		componentScreen(
			<FleetItemsContext.Provider value={nowFleet(6, Effect.runSync(Clock.currentTimeMillis) - 691_200_000)}>
				<WorkNow data={nowWork()} />
			</FleetItemsContext.Provider>,
		),
	],
	({ screen, click }) => {
		const view = screen();

		click(view.container.querySelector<HTMLButtonElement>('[aria-expanded="false"]'));
		expect(view.container.querySelector('[data-item="task-5"]')).toBeNull();
		expect(view.container.querySelector('[aria-label="Done in the last 7 days"] .work-count')?.textContent).toBe("0");
	},
);
