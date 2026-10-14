import type { WorkProjection } from "#browser/views/schema.ts";

export type GoalWorkItem = WorkProjection["items"][number];
export const goalGroups = ["Active", "Planned", "Done", "Deferred", "Not recorded"] as const;
const done = new Set(["closed", "done", "superseded", "completed", "cancelled", "canceled", "resolved", "released"]);
export function goalGroup(status: string | undefined): (typeof goalGroups)[number] {
	const value = status?.trim().toLowerCase();
	if (!value) {
		return "Not recorded";
	}
	if (done.has(value)) {
		return "Done";
	}
	if (value === "planned") {
		return "Planned";
	}
	return value === "deferred" ? "Deferred" : "Active";
}
export function targetsGoal(item: GoalWorkItem, id: string, criterion?: string) {
	return item.metadata.relationships?.some(
		(link) =>
			link.kind === "implements" && (criterion ? link.target === `${id}#${criterion}` : link.target === id || link.target.startsWith(`${id}#`)),
	);
}
