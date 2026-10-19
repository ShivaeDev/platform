import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { closedStatus, deferredStatus } from "./workStatus.ts";

type Stage = FleetItems["items"][number]["stage"];
export const goalWorkGroups = ["Needs you", "In progress", "Planned", "Done"] as const;
export type GoalWorkGroup = (typeof goalWorkGroups)[number];
const queued = new Set(["planned", "prepared", "ready"]);
const needsYou = new Set(["needs-human", "needs-you"]);
export function goalState(status: string | undefined, stage: Stage | undefined): string | undefined {
	return stage && stage !== "released" ? stage : status;
}
export function goalWorkGroup(status: string | undefined, stage: Stage | undefined, waiting: boolean): GoalWorkGroup {
	const state = goalState(status, stage)?.trim().toLowerCase();
	if (closedStatus(state)) {
		return "Done";
	}
	if (waiting || (state && needsYou.has(state))) {
		return "Needs you";
	}
	return !state || queued.has(state) || deferredStatus(state) ? "Planned" : "In progress";
}
