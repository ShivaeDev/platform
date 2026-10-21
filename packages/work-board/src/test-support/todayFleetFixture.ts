import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";

export function todayFleetFixture(): FleetItemsProjection {
	const stages = ["working", "reviewing"] as const;
	const otherStages = ["queued", "waiting", "released"] as const;
	return {
		completed: [{ completedAt: 100, document: null, stage: "done", stageEnteredAt: 0, updatedAt: 100, workId: "task.delivered" }],
		items: [
			...Array.from({ length: 9 }, (_, index) => ({
				document: {
					file: `tasks/work-${index}.md`,
					metadata: { id: `task.sample.${index}`, kind: "task" as const },
					title: `Workspace task ${index}`,
				},
				prUrl: `https://github.com/example/project/pull/${index + 1}`,
				stage: stages[index % stages.length] ?? "working",
				stageEnteredAt: 0,
				updatedAt: 100,
				workId: `task.sample.${index}`,
			})),
			...otherStages.map((stage) => ({ document: null, stage, stageEnteredAt: 0, updatedAt: 100, workId: `task.${stage}` })),
		],
		state: "ready",
	};
}
