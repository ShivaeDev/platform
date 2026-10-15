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

export function laneOf(metadata: Metadata, fleet: FleetWork | undefined, approved = false): NowLane | undefined {
	if (metadata.kind !== "task" || metadata.requestReceipt) {
		return undefined;
	}
	if (fleet && ["adopting", "executing", "reviewing", "repairing", "validating", "delivering"].includes(fleet.stage)) {
		return stages[fleet.stage];
	}
	if (["superseded", "deferred", "cancelled", "canceled"].includes(metadata.status ?? "")) {
		return undefined;
	}
	if (["done", "completed"].includes(metadata.status ?? "") && fleet?.stage !== "completed") {
		return undefined;
	}
	if (fleet) {
		return stages[fleet.stage];
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

export function holderOf(metadata: Metadata, fleet: FleetWork | undefined): string | undefined {
	if (fleet) {
		return fleet.attentionOwner && fleet.attentionOwner !== "automation" ? fleet.attentionOwner : "Fleet";
	}
	return ["maintainer", "orchestrator"].includes(metadata.owner ?? "") ? metadata.owner : undefined;
}

export function cardStatus(metadata: Metadata, fleet: FleetWork | undefined, waiting: string | undefined): string | undefined {
	if (fleet) {
		if (fleet.stage === "needs-human") {
			return "needs-you";
		}
		return fleet.stage === "completed" ? "done" : fleet.stage;
	}
	return waiting ? "needs-you" : metadata.status;
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
