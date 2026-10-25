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
		metadata: { ...item.metadata, kind: (["goal", "goal", "task"] as const)[index], status: "ready" as const },
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
	const statuses = ["dropped", "deferred", "done", "dropped", "dropped", "done", "draft", "ready"] as const;
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
	const statuses = ["draft", undefined, "draft", "ready", "draft"] as const;
	const rows = data.rows.map((item, index) => ({ ...item, fleetApproved: index === 4, metadata: { ...item.metadata, status: statuses[index] } }));
	screenStory.it(
		"queues only approved waiting tasks without a Fleet item",
		[componentScreen(<WorkNow data={{ ...data, rows }} />)],
		({ findElements }) => {
			expect([...findElements('[aria-label="Queued"] [data-item]')].map((card) => card.getAttribute("data-item"))).toEqual(["task-3", "task-4"]);
		},
	);
}

for (const [stage, owner, label] of [
	[undefined, undefined, "Draft"],
	["waiting", "Waiting on you", "Waiting"],
	["reviewing", "Fleet is working on this", "Reviewing"],
] as const) {
	const data = nowWork(1);
	const item = data.rows[0];
	if (!item) {
		throw new Error("Missing work fixture");
	}
	const fleet = stage
		? {
				attentionOwner: stage === "waiting" ? ("maintainer" as const) : undefined,
				document: null,
				stage,
				stageEnteredAt: null,
				updatedAt: null,
				workId: item.id,
			}
		: undefined;
	screenStory.it(
		`hides absent card facts and renders one state with Fleet ${stage}`,
		[
			componentScreen(
				<WorkCard fleet={fleet} item={{ ...item, metadata: { kind: "task", status: "draft" }, waiting: "Review needed" }} state={data.state} />,
			),
		],
		({ findElements, readText, findElement }) => {
			expect(findElements("[data-status-token]").map((token) => token.textContent)).toEqual([label]);
			expect(readText()).not.toContain("PR not recorded");
			expect(readText(".work-owner")).toBe(owner);
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
		expect(findElement(".work-options #work-filters")).not.toBeNull();
		expect(readText()).not.toContain("Cards retain their authored status");
		expect(readText()).not.toContain("completed items have no recent completion time");
	},
);
