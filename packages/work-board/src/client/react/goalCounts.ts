import type { GoalCounts } from "#browser/views/GoalsProjection.ts";

export const goalCountOrder = ["done", "running", "blocked", "scheduled", "parked"] as const satisfies readonly (keyof GoalCounts)[];
export function goalTotal(counts: GoalCounts) {
	return goalCountOrder.reduce((total, key) => total + counts[key], 0);
}

export const goalStateLabels = { blocked: "Blocked", done: "Done", parked: "Parked", running: "Running", scheduled: "Scheduled" } as const;
export const goalStateColors = {
	blocked: "bg-destructive",
	done: "bg-done",
	parked: "bg-deferred",
	running: "bg-goal-running",
	scheduled: "bg-agent-working",
} as const;
