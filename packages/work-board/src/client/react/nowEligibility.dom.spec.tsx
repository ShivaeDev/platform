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
		`Now leaves goals out and shows only tasks ${ready ? "while Fleet is ready" : "without Fleet"}`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={ready ? nowFleet(3) : undefined}>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		],
		function* ({ workItems }) {
			expect(yield* workItems()).toEqual(["task-2"]);
		},
	);
}

{
	const data = nowWork(8);
	const statuses = ["dropped", "deferred", "done", "dropped", "dropped", "done", "draft", "ready"] as const;
	const rows = data.rows.map((item, index) => ({ ...item, fleetApproved: true, metadata: { ...item.metadata, status: statuses[index] } }));
	screenStory.it(
		"Now leaves out closed tasks Fleet does not hold, even when they are approved",
		[componentScreen(<WorkNow data={{ ...data, rows }} />)],
		function* ({ workItems }) {
			expect(yield* workItems()).toEqual(["task-6", "task-7"]);
		},
	);
}

{
	const data = nowWork(5);
	const statuses = ["draft", undefined, "draft", "ready", "draft"] as const;
	const rows = data.rows.map((item, index) => ({ ...item, fleetApproved: index === 4, metadata: { ...item.metadata, status: statuses[index] } }));
	screenStory.it(
		"Now queues ready tasks and approved drafts that Fleet does not hold yet, and no other drafts",
		[componentScreen(<WorkNow data={{ ...data, rows }} />)],
		function* ({ nowLane }) {
			expect(yield* nowLane("Queued")).toEqual(expect.objectContaining({ cards: ["task-3", "task-4"] }));
		},
	);
}

for (const [stage, owner, label] of [
	[undefined, "none", "Draft"],
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
		`A work card ${stage ? `Fleet has ${stage}` : "without Fleet"} shows one state and leaves out facts nobody recorded`,
		[
			componentScreen(
				<WorkCard fleet={fleet} item={{ ...item, metadata: { kind: "task", status: "draft" }, waiting: "Review needed" }} state={data.state} />,
			),
		],
		function* ({ nowCard }) {
			expect(yield* nowCard("task-0")).toEqual(
				expect.objectContaining({ owner, stage: "none", states: [label], text: expect.not.stringContaining("PR") }),
			);
		},
	);
}

screenStory.it(
	"Now keeps saved views and filters folded behind Filter",
	[componentScreen(<WorkPage data={nowWork()} />)],
	function* ({ workOptions }) {
		expect(yield* workOptions()).toEqual({ holds: ["work-filters", "saved-work-views"], open: false, summary: "Filter" });
	},
);
