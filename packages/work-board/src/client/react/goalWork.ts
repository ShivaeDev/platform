import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { WorkProjection } from "#browser/views/schema.ts";

export type GoalWorkItem = WorkProjection["items"][number];
export const goalGroups = ["Active", "Planned", "Done", "Deferred", "Not recorded"] as const;
const done = new Set(["closed", "done", "superseded", "completed", "cancelled", "canceled", "resolved", "released"]);
type FleetReady = Extract<FleetItemsProjection, { readonly state: "ready" }>;
export type GoalRun = FleetReady["items"][number] | FleetReady["completed"][number];
export function goalRun(item: GoalWorkItem, fleet: FleetItemsProjection | undefined): GoalRun | undefined {
	return fleet?.state === "ready" ? [...fleet.items, ...fleet.completed].find((entry) => entry.workId === item.id) : undefined;
}
export function goalGroup(item: GoalWorkItem, run: GoalRun | undefined): (typeof goalGroups)[number] {
	if (run !== undefined && run.stage !== "released") {
		if (run.stage === "completed") {
			return "Done";
		}
		return run.stage === "prepared" ? "Planned" : "Active";
	}
	const value = item.metadata.status?.trim().toLowerCase();
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
