import { expect } from "vitest";
import { nowFleet, nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkCard } from "./WorkCard.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkPage } from "./WorkPage.tsx";

for (const ready of [true, false]) {
	const data = nowWork(3);
	const rows = data.rows.map((item, index) => ({
		...item,
		metadata: { ...item.metadata, kind: (["goal", "project", "task"] as const)[index], status: "active" },
	}));
	screenStory.it(
		`keeps goals and projects outside Now with Fleet ready=${ready}`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={ready ? nowFleet(3) : undefined}>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		],
		({ findElements }) => {
			expect([...findElements("[data-item]")].map((card) => card.getAttribute("data-item"))).toEqual(["task-2"]);
		},
	);
}

{
	const data = nowWork(8);
	const statuses = ["superseded", "deferred", "done", "cancelled", "canceled", "completed", "planned", "active"];
	const rows = data.rows.map((item, index) => ({ ...item, fleetApproved: true, metadata: { ...item.metadata, status: statuses[index] } }));
	screenStory.it(
		"excludes inactive authored tasks without a Fleet item",
		[componentScreen(<WorkNow data={{ ...data, rows }} />)],
		({ findElements }) => {
			expect([...findElements("[data-item]")].map((card) => card.getAttribute("data-item"))).toEqual(["task-6", "task-7"]);
		},
	);
}

{
	const data = nowWork(5);
	const statuses = ["planned", undefined, "unknown", "approved", "planned"];
	const rows = data.rows.map((item, index) => ({ ...item, fleetApproved: index === 4, metadata: { ...item.metadata, status: statuses[index] } }));
	screenStory.it(
		"queues only approved waiting tasks without a Fleet item",
		[componentScreen(<WorkNow data={{ ...data, rows }} />)],
		({ findElements }) => {
			expect([...findElements('[aria-label="Queued"] [data-item]')].map((card) => card.getAttribute("data-item"))).toEqual(["task-3", "task-4"]);
		},
	);
}

for (const stage of [undefined, "needs-human", "reviewing"] as const) {
	const data = nowWork(1);
	const item = data.rows[0];
	if (!item) {
		throw new Error("Missing work fixture");
	}
	const fleet = stage ? { document: null, stage, stageEnteredAt: null, updatedAt: null, workId: item.id } : undefined;
	screenStory.it(
		`hides absent card facts and renders one state with Fleet ${stage}`,
		[
			componentScreen(
				<WorkCard fleet={fleet} item={{ ...item, metadata: { kind: "task", status: "planned" }, waiting: "Review needed" }} state={data.state} />,
			),
		],
		({ findElements, readText, findElement }) => {
			expect(findElements("[data-status-token]")).toHaveLength(1);
			expect(readText("[data-status-token]")).toBe(stage === "reviewing" ? "reviewing" : "needs-you");
			expect(readText()).not.toContain("PR not recorded");
			expect(readText()).not.toContain("Holder: Not recorded");
			expect(findElement(".work-owner") === null).toBe(stage === undefined);
			expect(findElement(".work-stage")).toBeNull();
			expect(findElement("svg.lucide-git-pull-request")).toBeNull();
		},
	);
}

screenStory.it(
	"collapses saved views and filters behind Filter on Now",
	[componentScreen(<WorkPage data={nowWork()} />)],
	({ findElement, readText }) => {
		expect(findElement(".work-options")).toHaveProperty("open", false);
		expect(readText(".work-options summary")).toBe("Filter");
		expect(findElement(".work-options #saved-work-views")).not.toBeNull();
		expect(findElement(".work-options .work-filters")).not.toBeNull();
		expect(readText()).not.toContain("Cards retain their authored status");
		expect(readText()).not.toContain("completed items have no recent completion time");
	},
);
