import type { Metadata } from "#metadata/schema.ts";
import { type FleetWork, waitsForFleet } from "./now.ts";

const fleetHolders: Record<FleetWork["stage"], string> = {
	done: "Fleet finished this",
	queued: "Queued for Fleet",
	released: "Fleet handed this back",
	reviewing: "Fleet is working on this",
	waiting: "Waiting on automation",
	working: "Fleet is working on this",
};

export function fleetHolder(fleet: FleetWork): string {
	if (fleet.attentionOwner === "maintainer") {
		return "Waiting on you";
	}
	return fleet.attentionOwner === "orchestrator" ? "Waiting on orchestrator" : fleetHolders[fleet.stage];
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
	if (metadata.owner === "marvin") {
		return "Assigned to you";
	}
	return metadata.owner === "claude" ? "Assigned to the orchestrator" : undefined;
}

const stageNames: Record<FleetWork["stage"], string> = {
	done: "Done",
	queued: "Queued",
	released: "Released",
	reviewing: "Reviewing",
	waiting: "Waiting",
	working: "Working",
};
const notRunningStages: ReadonlySet<FleetWork["stage"]> = new Set(["done", "queued", "released"]);

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
	if (fleet) {
		return fleet.stage;
	}
	return metadata.status;
}

// Now's lane titles name the stage, so a card calls held work by the one word every page uses for it.
export function cardLabelStatus(status: string | undefined): string | undefined {
	return status;
}
