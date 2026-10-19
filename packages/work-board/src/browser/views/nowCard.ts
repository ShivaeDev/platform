import type { Metadata } from "#metadata/schema.ts";
import { type FleetWork, waitsForFleet } from "./now.ts";

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

export function holderOf(metadata: Metadata, fleet: FleetWork | undefined, answered = false, asked = false): string | undefined {
	if (asked) {
		return "Waiting on your answer";
	}
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

const notRunningStages: ReadonlySet<FleetWork["stage"]> = new Set(["completed", "prepared", "released"]);

export function stageTime(stage: FleetWork["stage"]): { readonly label: string; readonly started: boolean } {
	return { label: stageNames[stage], started: !notRunningStages.has(stage) };
}

export function cardStatus(
	metadata: Metadata,
	fleet: FleetWork | undefined,
	waiting: string | undefined,
	answered = false,
	asked = false,
): string | undefined {
	if (asked) {
		return "needs-you";
	}
	if (waitsForFleet(fleet, answered && waiting === undefined)) {
		return "waiting-on-agents";
	}
	if (fleet && fleet.stage !== "needs-human") {
		return fleet.stage === "completed" ? "done" : fleet.stage;
	}
	return fleet || waiting ? "needs-you" : metadata.status;
}
