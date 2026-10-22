import type { GoalCounts } from "#browser/views/GoalsProjection.ts";

export const goalCountOrder = ["done", "deferred", "ready", "draft", "dropped"] as const satisfies readonly (keyof GoalCounts)[];
export function goalTotal(counts: GoalCounts) {
	return goalCountOrder.reduce((total, key) => total + counts[key], 0);
}
