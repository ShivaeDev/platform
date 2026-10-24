import type { WorkboardFlight, WorkboardGoal } from "#types/index.d.ts";

export function goal(id: string, done: number, ready: number, total: number): WorkboardGoal {
	return { done, id, ready, title: id.replace("goal.", ""), total };
}

export function flight(workId: string, stage: string, goalId: string | null): WorkboardFlight {
	return {
		goal: goalId === null ? null : { id: goalId, title: goalId.replace("goal.", "") },
		inStageMs: 0,
		prUrl: null,
		stage,
		title: workId,
		workId,
	};
}
