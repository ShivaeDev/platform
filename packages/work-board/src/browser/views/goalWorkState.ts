import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { type WorkPhase, workPhase } from "./workStatus.ts";

type Stage = FleetItems["items"][number]["stage"];
export const goalWorkGroups = ["Needs you", "In progress", "Planned", "Done"] as const;
export type GoalWorkGroup = (typeof goalWorkGroups)[number];
const phaseGroups: Record<WorkPhase, GoalWorkGroup> = {
	closed: "Done",
	deferred: "Planned",
	delivering: "In progress",
	executing: "In progress",
	"needs-you": "Needs you",
	planned: "Planned",
	queued: "Planned",
	reviewing: "In progress",
	waiting: "In progress",
};
export function goalState(status: string | undefined, stage: Stage | undefined): string | undefined {
	return stage && stage !== "released" ? stage : status;
}
// An unknown status is listed as a source problem on System, so it is never counted as in progress here.
export function goalWorkGroup(status: string | undefined, stage: Stage | undefined, waiting: boolean): GoalWorkGroup {
	const group = phaseGroups[workPhase(goalState(status, stage)) ?? "planned"];
	return waiting && group !== "Done" ? "Needs you" : group;
}
