import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { closedStatus } from "./workStatus.ts";

type Stage = FleetItems["items"][number]["stage"];
export const goalWorkGroups = ["Needs you", "In progress", "Planned", "Done", "Deferred"] as const;
export type GoalWorkGroup = (typeof goalWorkGroups)[number];
const queued = new Set(["planned", "prepared", "ready"]);
const needsYou = new Set(["needs-human", "needs-you"]);
export function goalState(status: string | undefined, stage: Stage | undefined): string | undefined {
	return stage && stage !== "released" ? stage : status;
}
export function goalWorkGroup(status: string | undefined, stage: Stage | undefined): GoalWorkGroup {
	const state = goalState(status, stage)?.trim().toLowerCase();
	if (closedStatus(state)) {
		return "Done";
	}
	if (!state || queued.has(state)) {
		return "Planned";
	}
	if (needsYou.has(state)) {
		return "Needs you";
	}
	return state === "deferred" ? "Deferred" : "In progress";
}
