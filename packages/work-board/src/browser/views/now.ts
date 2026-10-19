import type { Metadata } from "#metadata/schema.ts";
import type { FleetItemsProjection } from "./FleetItemsProjection.ts";
import { closedStatus, deferredStatus } from "./workStatus.ts";

export const nowLanes = ["Queued", "Executing", "Reviewing", "Delivering", "Waiting on a person", "Done in the last 7 days"] as const;
export type NowLane = (typeof nowLanes)[number];
export type FleetWork = Extract<FleetItemsProjection, { state: "ready" }>["items"][number];

const stages: Record<FleetWork["stage"], NowLane | undefined> = {
	adopting: "Executing",
	completed: "Done in the last 7 days",
	delivering: "Delivering",
	executing: "Executing",
	"needs-human": "Waiting on a person",
	prepared: "Queued",
	released: undefined,
	repairing: "Reviewing",
	reviewing: "Reviewing",
	validating: "Reviewing",
};

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
		return stages[fleet.stage];
	}
	if (closedStatus(metadata.status) || deferredStatus(metadata.status)) {
		return undefined;
	}
	return authoredLane(metadata.status, approved);
}

function authoredLane(status: string | undefined, approved: boolean): NowLane | undefined {
	if (["active", "running", "in-progress", "agent-working", "executing", "adopting"].includes(status ?? "")) {
		return "Executing";
	}
	if (["blocked", "needs-human", "needs-you", "waiting-on-person"].includes(status ?? "")) {
		return "Waiting on a person";
	}
	if (status === "in-review") {
		return "Reviewing";
	}
	if (status === "approved" || (approved && [undefined, "planned", "received"].includes(status))) {
		return "Queued";
	}
	return Object.entries(stages).find(([stage]) => stage === status)?.[1];
}

const statusOrder = [
	"planned",
	"received",
	"active",
	"running",
	"in-progress",
	"reviewing",
	"repairing",
	"validating",
	"delivering",
	"blocked",
	"needs-human",
	"needs-you",
	"done",
	"deferred",
	"superseded",
];
export function compareStatuses(left: string | undefined, right: string | undefined): number {
	function rank(status: string | undefined) {
		const index = statusOrder.indexOf(status ?? "");
		return index < 0 ? statusOrder.length : index;
	}
	return rank(left) - rank(right) || (left ?? "\uffff").localeCompare(right ?? "\uffff", "en");
}
