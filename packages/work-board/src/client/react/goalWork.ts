import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { type GoalWorkGroup, goalWorkGroup } from "#browser/views/goalWorkState.ts";

export type GoalWorkItem = GoalsProjection["items"][number];
type FleetReady = Extract<FleetItemsProjection, { readonly state: "ready" }>;
export type GoalRun = FleetReady["items"][number] | FleetReady["completed"][number];
export function goalRun(item: GoalWorkItem, fleet: FleetItemsProjection | undefined): GoalRun | undefined {
	return fleet?.state === "ready" ? [...fleet.items, ...fleet.completed].find((entry) => entry.workId === item.id) : undefined;
}
export function goalGroup(item: GoalWorkItem, run: GoalRun | undefined): GoalWorkGroup {
	return goalWorkGroup(item.metadata.status, run?.stage);
}

export function targetsGoal(item: GoalWorkItem, id: string, criterion?: string) {
	return item.metadata.relationships?.some(
		(link) =>
			link.kind === "implements" && (criterion ? link.target === `${id}#${criterion}` : link.target === id || link.target.startsWith(`${id}#`)),
	);
}
