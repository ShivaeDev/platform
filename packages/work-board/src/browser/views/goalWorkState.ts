import type { FleetItems } from "#diagnostics/fleetItems.ts";
import type { Metadata } from "#metadata/schema.ts";

type Stage = FleetItems["items"][number]["stage"];
export const goalWorkGroups = ["Ready", "Draft", "Done", "Deferred", "Dropped"] as const;
export type GoalWorkGroup = (typeof goalWorkGroups)[number];
export function goalState(status: string | undefined, stage: Stage | undefined): string | undefined {
	return stage && stage !== "released" ? stage : status;
}
const groups = { deferred: "Deferred", done: "Done", draft: "Draft", dropped: "Dropped", ready: "Ready" } as const;
export function goalWorkGroup(status: Metadata["status"]): GoalWorkGroup {
	return groups[status ?? "draft"];
}
