import type { Metadata } from "#metadata/schema.ts";
import type { FleetItemsProjection } from "./FleetItemsProjection.ts";
import { heldPhase, type WorkPhase, workPhase, workPhases } from "./workStatus.ts";

export const nowLanes = ["Queued", "Executing", "Reviewing", "Delivering", "Waiting on a person", "Done in the last 7 days"] as const;
export type NowLane = (typeof nowLanes)[number];
export type FleetWork = Extract<FleetItemsProjection, { state: "ready" }>["items"][number];

const phaseLanes: Record<WorkPhase, NowLane | undefined> = {
	closed: undefined,
	deferred: undefined,
	delivering: "Delivering",
	executing: "Executing",
	"needs-you": "Waiting on a person",
	planned: undefined,
	queued: "Queued",
	reviewing: "Reviewing",
	waiting: "Waiting on a person",
};
export const heldLanes: ReadonlySet<NowLane> = new Set(workPhases.filter(heldPhase).flatMap((phase) => phaseLanes[phase] ?? []));

export function isWork(metadata: Metadata): boolean {
	return !(metadata.requestReceipt || ["board", "decision", "question", "response", "result"].includes(metadata.kind ?? ""));
}

export function waitsForFleet(fleet: FleetWork | undefined, answered: boolean): boolean {
	return answered && (fleet === undefined || fleet.stage === "needs-human");
}

export function laneOf(metadata: Metadata, fleet: FleetWork | undefined, approved = false, answered = false, asked = false): NowLane | undefined {
	if (metadata.kind !== "task" || metadata.requestReceipt) {
		return undefined;
	}
	if (asked) {
		return "Waiting on a person";
	}
	if (waitsForFleet(fleet, answered)) {
		return "Queued";
	}
	if (fleet) {
		return fleet.stage === "completed" ? "Done in the last 7 days" : phaseLane(fleet.stage);
	}
	return approved && workPhase(metadata.status) === "planned" ? "Queued" : phaseLane(metadata.status);
}

function phaseLane(status: string | undefined): NowLane | undefined {
	const phase = workPhase(status);
	return phase && phaseLanes[phase];
}

export function compareStatuses(left: string | undefined, right: string | undefined): number {
	function rank(status: string | undefined) {
		const phase = status ? workPhase(status) : undefined;
		return phase === undefined ? workPhases.length : workPhases.indexOf(phase);
	}
	return rank(left) - rank(right) || (left ?? "\uffff").localeCompare(right ?? "\uffff", "en");
}
