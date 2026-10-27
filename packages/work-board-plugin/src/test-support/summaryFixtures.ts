import type { WorkboardFlight, WorkboardGoal } from "#types/index.d.ts";

export function goal(id: string, done: number, running: number, total: number): WorkboardGoal {
	return {
		achieved: false,
		blocked: 0,
		done,
		id,
		parked: total - done - running,
		running,
		scheduled: 0,
		standing: false,
		title: id.replace("goal.", ""),
		total,
	};
}

export function flight(workId: string, stage: string, goalId: string | null): WorkboardFlight {
	return {
		agents: [],
		goal: goalId === null ? null : { id: goalId, title: goalId.replace("goal.", "") },
		prUrl: null,
		stage,
		title: workId,
		workId,
	};
}
