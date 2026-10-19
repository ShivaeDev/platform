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
	const data = nowWork();
	const authored = data.rows.map((item, index) => ({
		...item,
		metadata: { ...item.metadata, status: ["planned", "planned", "active", "blocked", "reviewing", "done"][index] },
	}));
	const rows = [...authored].sort((left, right) =>
		sort === "title" ? left.title.localeCompare(right.title) : (left.metadata[sort] ?? "").localeCompare(right.metadata[sort] ?? ""),
	);
	const fleet = nowFleet(6, Effect.runSync(Clock.currentTimeMillis));
	screenStory.it(
		`keeps stage lanes fixed under ${sort} sorting and renders Fleet card facts`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={fleet}>
					<WorkNow data={{ ...data, rows, state: { ...data.state, sort } }} />
				</FleetItemsContext.Provider>,
			),
		],
		({ click, findElement, findElements, readText }) => {
			expect(findElement(".work-total")).toBeNull();
			expect([...findElements(".work-column")].map((lane) => lane.getAttribute("aria-label"))).toEqual(nowLanes);
			const card = findElement('[aria-label="Executing"] [data-item="task-1"]');
			expect(readText("h3", card)).toBe("Work 5");
			expect(readText("[data-status-token]", card)).toBe("Executing");
			expect(readText(".work-owner", card)).toBe("Fleet is working on this");
			expect(readText(".work-stage", card)).toMatch(/^Executing for /u);
			expect(findElement('a[href="https://github.com/example/project/pull/1"]', card)).not.toBeNull();
			expect(readText('[aria-label="Waiting on a person"] .work-owner')).toBe("Needs you");
			expect(findElement('[data-item="task-5"]')).toBeNull();
			const button = findElement<HTMLButtonElement>('[aria-expanded="false"]');
			click(button);
			expect(findElement('[aria-label="Done in the last 7 days"] [data-item="task-5"]')).not.toBeNull();
		},
	);
}

for (const [storyCase, fleet] of [undefined, { reason: "Stopped daemon", state: "unavailable" } as const].entries()) {
	const data = nowWork();
	const statuses = ["approved", "active", "reviewing", "delivering", "needs-human", "done"];
	const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
	screenStory.it(
		`discloses missing Fleet data and uses authored status (${storyCase + 1})`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={fleet}>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		],
		({ read, findElement, readText }) => {
			expect(read().text).toContain("Lanes show the status written in each file.");
			expect(read().text).not.toContain("How to start Fleet");
			expect(readText('[aria-label="Done in the last 7 days"]')).toBe("Done in the last 7 daysNeeds Fleet to show finished work.");
			for (const [index, lane] of nowLanes.entries()) {
				if (index !== 5) {
					expect(findElement(`[aria-label="${lane}"] [data-item="task-${index}"]`)).not.toBeNull();
				}
			}
			expect(read().text).not.toContain("no recent completion time");
			expect(findElement(".work-stage")).toBeNull();
		},
	);
}

for (const sort of ["title", "owner", "status"] as const) {
	const data = nowWork();
	const rows = data.rows.map((item, index) => ({
		...item,
		metadata: { ...item.metadata, status: ["done", "active", "planned", "blocked", "custom", undefined][index] },
	}));
	const sorted = [...rows].sort((left, right) =>
		sort === "title" ? left.title.localeCompare(right.title) : (left.metadata[sort] ?? "").localeCompare(right.metadata[sort] ?? ""),
	);
	screenStory.it(
		`keeps All work status columns fixed under ${sort} sorting`,
		[componentScreen(<WorkCards data={{ ...data, rows: sorted }} />)],
		({ findElements }) => {
			expect([...findElements(".work-column")].map((lane) => lane.getAttribute("aria-label"))).toEqual([
				"Planned",
				"Active",
				"Blocked",
				"Done",
				"Custom",
				"",
			]);
			expect(compareStatuses("done", "planned")).toBeGreaterThan(0);
		},
	);
}

for (const stage of ["reviewing", "repairing", "validating"] as const) {
	const fleet = nowFleet();
	if (fleet.state !== "ready") {
		throw new Error("Missing Fleet fixture");
	}
	const items = fleet.items.map((item) => ({ ...item, stage }));
	screenStory.it(
		`places Fleet ${stage} in Reviewing`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={{ ...fleet, items }}>
					<WorkNow data={nowWork()} />
				</FleetItemsContext.Provider>,
			),
		],
		({ findElements }) => {
			expect(findElements('[aria-label="Reviewing"] [data-item]')).toHaveLength(5);
		},
	);
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
	({ click, findElement, readText }) => {
		click(findElement<HTMLButtonElement>('[aria-expanded="false"]'));
		expect(findElement('[data-item="task-5"]')).toBeNull();
		expect(readText('[aria-label="Done in the last 7 days"] .work-count')).toBe("0");
	},
);
