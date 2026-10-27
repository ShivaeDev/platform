import type { WorkboardFlight } from "#types/index.d.ts";
import { goalColors } from "./goalProgress.ts";

export const flightStates = ["working", "dependency", "checks", "you", "orchestrator", "automation", "waiting"] as const;
export type FlightState = (typeof flightStates)[number];

export const flightLabels = {
	automation: "Waiting on automation",
	checks: "Waiting on CI or review",
	dependency: "Waiting on task or area",
	orchestrator: "Waiting on orchestrator",
	waiting: "Waiting (reason unavailable)",
	working: "Working",
	you: "Waiting on you",
} as const;

export const flightColors = {
	automation: "#00868b",
	checks: "#00868b",
	dependency: "#9467cd",
	orchestrator: "#9467cd",
	waiting: goalColors.parked,
	working: goalColors.running,
	you: goalColors.scheduled,
} as const;

export function flightState(flight: WorkboardFlight): FlightState {
	if (flight.attentionOwner === "maintainer") {
		return "you";
	}
	if (/^waiting for (?:dependency|area) /u.test(flight.waitingReason ?? "")) {
		return "dependency";
	}
	if (flight.stage === "reviewing" || /\b(?:CI|checks|review)\b/iu.test(flight.waitingReason ?? "")) {
		return "checks";
	}
	if (flight.stage === "working") {
		return "working";
	}
	if (flight.attentionOwner === "orchestrator" || flight.attentionOwner === "automation") {
		return flight.attentionOwner;
	}
	return "waiting";
}

export function flightReason(flight: WorkboardFlight): string | null {
	return flight.waitingReason ?? (flight.stage === "reviewing" ? "Reviewing" : null);
}
