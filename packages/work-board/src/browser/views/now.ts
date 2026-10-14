import type { Metadata } from "#metadata/schema.ts";
import type { FleetItemsProjection } from "./FleetItemsProjection.ts";

export const nowLanes = ["Queued", "Executing", "Reviewing", "Delivering", "Waiting on a person", "Done in the last 7 days"] as const;
export type NowLane = (typeof nowLanes)[number];
export type FleetWork = Extract<FleetItemsProjection, { state: "ready" }>["items"][number];

const stages: Record<FleetWork["stage"], NowLane> = {
	adopting: "Executing",
	completed: "Done in the last 7 days",
	delivering: "Delivering",
	executing: "Executing",
	"needs-human": "Waiting on a person",
	prepared: "Queued",
	released: "Queued",
	repairing: "Reviewing",
	reviewing: "Reviewing",
	validating: "Reviewing",
};

export function isWork(metadata: Metadata): boolean {
	return !(metadata.requestReceipt || ["board", "decision", "question", "response", "result"].includes(metadata.kind ?? ""));
}

export function laneOf(metadata: Metadata, fleet: FleetWork | undefined): NowLane {
	if (fleet) {
		return stages[fleet.stage];
	}
	const status = metadata.status ?? "planned";
	if (["active", "running", "in-progress", "agent-working", "executing", "adopting"].includes(status)) {
		return "Executing";
	}
	if (["blocked", "needs-human", "needs-you", "waiting-on-person"].includes(status)) {
		return "Waiting on a person";
	}
	if (status === "done" || status === "completed") {
		return "Done in the last 7 days";
	}
	if (status === "in-review") {
		return "Reviewing";
	}
	return Object.entries(stages).find(([stage]) => stage === status)?.[1] ?? "Queued";
}

export function holderOf(metadata: Metadata, fleet: FleetWork | undefined): string {
	if (fleet) {
		return fleet.attentionOwner && fleet.attentionOwner !== "automation" ? fleet.attentionOwner : "Fleet";
	}
	return ["maintainer", "orchestrator"].includes(metadata.owner ?? "") ? (metadata.owner ?? "Not recorded") : "Not recorded";
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
