import type { FleetItems } from "#diagnostics/fleetItems.ts";

type Stage = FleetItems["items"][number]["stage"];
const done = new Set(["closed", "done", "superseded", "completed", "cancelled", "canceled", "resolved", "released"]);
export function goalState(status: string | undefined, stage: Stage | undefined): string | undefined {
	return stage && stage !== "released" ? stage : status;
}
export function goalWorkGroup(status: string | undefined, stage: Stage | undefined): "In progress" | "Planned" | "Done" | "Deferred" {
	const state = goalState(status, stage)?.trim().toLowerCase();
	if (state && done.has(state)) {
		return "Done";
	}
	if (!state || state === "planned" || state === "prepared") {
		return "Planned";
	}
	return state === "deferred" ? "Deferred" : "In progress";
}
