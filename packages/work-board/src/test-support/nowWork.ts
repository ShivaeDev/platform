import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import { stateOf } from "#browser/views/state.ts";

export function nowWork(count = 6): WorkProjection {
	const rows = Array.from({ length: count }, (_, index) => ({
		file: `task-${index}.md`,
		id: `task-${index}`,
		metadata: { kind: "task" as const, owner: index % 2 ? "maintainer" : "orchestrator", status: "planned" },
		title: `Work ${count - index}`,
	}));
	return { boards: [], issues: [], items: rows, rows, selectedOutside: false, state: stateOf("/_board/work"), title: "Now", validBoard: true };
}

export function nowFleet(count = 6, at = 0): FleetItemsProjection {
	const stages = ["prepared", "executing", "reviewing", "delivering", "needs-human"] as const;
	return {
		completed: [{ completedAt: at, document: null, stage: "completed", stageEnteredAt: at, updatedAt: at, workId: "task-5" }],
		items: Array.from({ length: count }, (_, index) => ({
			attentionOwner: index % 5 === 4 ? ("maintainer" as const) : ("automation" as const),
			document: null,
			prUrl: "https://github.com/example/project/pull/1",
			stage: stages[index % 5] ?? "prepared",
			stageEnteredAt: at,
			updatedAt: at,
			workId: `task-${index}`,
		})).filter((item) => item.workId !== "task-5"),
		state: "ready",
	};
}
