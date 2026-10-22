import type { Metadata } from "#metadata/schema.ts";
import type { FleetItemsProjection } from "./FleetItemsProjection.ts";
import { heldPhase, type WorkPhase, workPhase, workPhases } from "./workStatus.ts";

export const nowLanes = [
	"Queued",
	"Working",
	"Reviewing",
	"Waiting on you",
	"Waiting on orchestrator",
	"Waiting on automation",
	"Done in the last 7 days",
] as const;
export type NowLane = (typeof nowLanes)[number];
export type FleetWork = Extract<FleetItemsProjection, { state: "ready" }>["items"][number];
const phaseLanes: Record<WorkPhase, NowLane | undefined> = {
	deferred: undefined,
	done: undefined,
	draft: undefined,
	dropped: undefined,
	queued: "Queued",
	ready: "Queued",
	released: undefined,
	reviewing: "Reviewing",
	waiting: "Waiting on automation",
	working: "Working",
};
export const heldLanes: ReadonlySet<NowLane> = new Set(workPhases.filter(heldPhase).flatMap((phase) => phaseLanes[phase] ?? []));

export function isWork(metadata: Metadata): boolean {
	return metadata.kind === "task" && !metadata.requestReceipt;
}

export function waitsForFleet(fleet: FleetWork | undefined, answered: boolean): boolean {
	return answered && (fleet === undefined || fleet.stage === "waiting");
}

export function laneOf(metadata: Metadata, fleet: FleetWork | undefined, approved = false, answered = false, asked = false): NowLane | undefined {
	if (metadata.kind !== "task" || metadata.requestReceipt) {
		return undefined;
	}
	if (asked) {
		return "Waiting on you";
	}
	if (waitsForFleet(fleet, answered)) {
		return "Waiting on automation";
	}
	if (fleet) {
		return fleetLane(fleet);
	}
	return approved && workPhase(metadata.status) === "draft" ? "Queued" : phaseLane(metadata.status);
}

function fleetLane(fleet: FleetWork): NowLane | undefined {
	if (fleet.stage === "done") {
		return "Done in the last 7 days";
	}
	if (fleet.stage !== "waiting") {
		return phaseLane(fleet.stage);
	}
	const owner = fleet.attentionOwner ?? "automation";
	const lanes: Record<NonNullable<FleetWork["attentionOwner"]>, NowLane> = {
		automation: "Waiting on automation",
		maintainer: "Waiting on you",
		orchestrator: "Waiting on orchestrator",
	};
	return lanes[owner];
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
