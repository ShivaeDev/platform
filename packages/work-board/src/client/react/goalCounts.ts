import type { GoalCounts } from "#browser/views/GoalsProjection.ts";

export const goalCountOrder = ["done", "running", "blocked", "scheduled", "parked"] as const satisfies readonly (keyof GoalCounts)[];
export function goalTotal(counts: GoalCounts) {
	return goalCountOrder.reduce((total, key) => total + counts[key], 0);
}

export const goalStateLabels = { blocked: "Blocked", done: "Done", parked: "Parked", running: "Running", scheduled: "Scheduled" } as const;

export const goalColors = {
	blocked: "#ce0030",
	done: "#00a83b",
	parked: "#767676",
	running: "#b56b00",
	scheduled: "#0065ff",
} as const;
