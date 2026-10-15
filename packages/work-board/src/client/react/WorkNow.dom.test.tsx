import { Clock, Effect } from "effect";
import { act } from "react";
import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { compareStatuses, nowLanes } from "#browser/views/now.ts";
import { stateOf } from "#browser/views/state.ts";
import { nowFleet, nowWork } from "#test/nowWork.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";

it.each(["title", "owner", "status"] as const)("keeps stage lanes fixed under %s sorting and renders Fleet card facts", async (sort) => {
	const data = nowWork();
	const authored = data.rows.map((item, index) => ({
		...item,
		metadata: { ...item.metadata, status: ["planned", "planned", "active", "blocked", "reviewing", "done"][index] },
	}));
	const rows = [...authored].sort((left, right) =>
		sort === "title" ? left.title.localeCompare(right.title) : (left.metadata[sort] ?? "").localeCompare(right.metadata[sort] ?? ""),
	);
	const fleet = nowFleet(6, Effect.runSync(Clock.currentTimeMillis));
	const view = await render(
		<FleetItemsContext.Provider value={fleet}>
			<WorkNow data={{ ...data, rows, state: { ...data.state, sort } }} />
		</FleetItemsContext.Provider>,
	);
	try {
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
		await act(async () => button?.click());
		expect(view.container.querySelector('[aria-label="Done in the last 7 days"] [data-item="task-5"]')).not.toBeNull();
	} finally {
		await view.unmount();
	}
});

it.each([undefined, { reason: "Stopped daemon", state: "unavailable" } as const])(
	"discloses missing Fleet data and uses authored status",
	async (fleet) => {
		const data = nowWork();
		const statuses = ["approved", "active", "reviewing", "delivering", "needs-human", "done"];
		const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
		const view = await render(
			<FleetItemsContext.Provider value={fleet}>
				<WorkNow data={{ ...data, rows }} />
			</FleetItemsContext.Provider>,
		);
		try {
			expect(view.container.textContent).toContain("Fleet is unavailable");
			for (const [index, lane] of nowLanes.entries()) {
				if (index !== 5) {
					expect(view.container.querySelector(`[aria-label="${lane}"] [data-item="task-${index}"]`)).not.toBeNull();
				}
			}
			expect(view.container.textContent).not.toContain("no recent completion time");
			expect(view.container.querySelector(".work-stage")).toBeNull();
		} finally {
			await view.unmount();
		}
	},
);

it.each(["title", "owner", "status"] as const)("keeps All work status columns fixed under %s sorting", async (sort) => {
	const data = nowWork();
	const rows = data.rows.map((item, index) => ({
		...item,
		metadata: { ...item.metadata, status: ["done", "active", "planned", "blocked", "custom", undefined][index] },
	}));
	const sorted = [...rows].sort((left, right) =>
		sort === "title" ? left.title.localeCompare(right.title) : (left.metadata[sort] ?? "").localeCompare(right.metadata[sort] ?? ""),
	);
	const view = await render(<WorkCards data={{ ...data, rows: sorted }} />);
	try {
		expect([...view.container.querySelectorAll(".work-column")].map((lane) => lane.getAttribute("aria-label"))).toEqual([
			"planned",
			"active",
			"blocked",
			"done",
			"custom",
			"Status not recorded",
		]);
		expect(compareStatuses("done", "planned")).toBeGreaterThan(0);
	} finally {
		await view.unmount();
	}
});

it("opens Work on Now while keeping All work and Table explicit", () => {
	expect(stateOf("/_board/work").view).toBe("now");
	expect(stateOf("/_board/work?view=board").view).toBe("board");
	expect(stateOf("/_board/work?view=table").view).toBe("table");
});

it.each(["reviewing", "repairing", "validating"] as const)("places Fleet %s in Reviewing", async (stage) => {
	const fleet = nowFleet();
	if (fleet.state !== "ready") {
		throw new Error("Missing Fleet fixture");
	}
	const items = fleet.items.map((item) => ({ ...item, stage }));
	const view = await render(
		<FleetItemsContext.Provider value={{ ...fleet, items }}>
			<WorkNow data={nowWork()} />
		</FleetItemsContext.Provider>,
	);
	try {
		expect(view.container.querySelectorAll('[aria-label="Reviewing"] [data-item]')).toHaveLength(5);
	} finally {
		await view.unmount();
	}
});

it("keeps older Fleet completions outside the last-seven-days lane", async () => {
	const view = await render(
		<FleetItemsContext.Provider value={nowFleet(6, Effect.runSync(Clock.currentTimeMillis) - 691_200_000)}>
			<WorkNow data={nowWork()} />
		</FleetItemsContext.Provider>,
	);
	try {
		act(() => view.container.querySelector<HTMLButtonElement>('[aria-expanded="false"]')?.click());
		expect(view.container.querySelector('[data-item="task-5"]')).toBeNull();
		expect(view.container.querySelector('[aria-label="Done in the last 7 days"] .work-count')?.textContent).toBe("0");
	} finally {
		await view.unmount();
	}
});
