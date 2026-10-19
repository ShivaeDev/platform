import type { Metadata } from "#metadata/schema.ts";
import type { FleetItemsProjection } from "./FleetItemsProjection.ts";

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

export function laneOf(metadata: Metadata, fleet: FleetWork | undefined, approved = false, answered = false): NowLane | undefined {
	if (metadata.kind !== "task" || metadata.requestReceipt) {
		return undefined;
	}
	if (waitsForFleet(fleet, answered)) {
		return "Queued";
	}
	if (fleet) {
		return stages[fleet.stage];
	}
	if (["superseded", "deferred", "cancelled", "canceled", "done", "completed"].includes(metadata.status ?? "")) {
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

const fleetHolders: Record<FleetWork["stage"], string> = {
	adopting: "Fleet is working on this",
	completed: "Fleet finished this",
	delivering: "Fleet is working on this",
	executing: "Fleet is working on this",
	"needs-human": "Waiting on a person",
	prepared: "Queued for Fleet",
	released: "Fleet handed this back",
	repairing: "Fleet is working on this",
	reviewing: "Fleet is working on this",
	validating: "Fleet is working on this",
};

export function fleetHolder(fleet: FleetWork): string {
	if (fleet.attentionOwner === "maintainer") {
		return "Needs you";
	}
	return fleet.attentionOwner === "orchestrator" ? "Waiting on the orchestrator" : fleetHolders[fleet.stage];
}

export function holderOf(metadata: Metadata, fleet: FleetWork | undefined, answered = false): string | undefined {
	if (waitsForFleet(fleet, answered)) {
		return "Waiting for Fleet";
	}
	if (fleet) {
		return fleetHolder(fleet);
	}
	if (metadata.owner === "maintainer") {
		return "Assigned to you";
	}
	return metadata.owner === "orchestrator" ? "Assigned to the orchestrator" : undefined;
}

const stageNames: Record<FleetWork["stage"], string> = {
	adopting: "Adopting",
	completed: "Done",
	delivering: "Delivering",
	executing: "Executing",
	"needs-human": "Waiting",
	prepared: "Queued",
	released: "Handed back",
	repairing: "Repairing",
	reviewing: "Reviewing",
	validating: "Validating",
};

export function stageTime(stage: FleetWork["stage"]): { readonly ended: boolean; readonly label: string } {
	return { ended: stage === "completed" || stage === "released", label: stageNames[stage] };
}

export function cardStatus(metadata: Metadata, fleet: FleetWork | undefined, waiting: string | undefined, answered = false): string | undefined {
	if (waitsForFleet(fleet, answered && waiting === undefined)) {
		return "waiting-on-agents";
	}
	if (fleet && fleet.stage !== "needs-human") {
		return fleet.stage === "completed" ? "done" : fleet.stage;
	}
	return fleet || waiting ? "needs-you" : metadata.status;
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
