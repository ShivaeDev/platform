import type { WorkboardFlight } from "#types/index.d.ts";
import { goalColors } from "./goalProgress.ts";

export const flightStates = ["working", "blocked", "queued", "checks", "you", "orchestrator", "automation", "waiting"] as const;
export type FlightState = (typeof flightStates)[number];

export const flightLabels = {
	automation: "Waiting on automation",
	blocked: "Blocked",
	checks: "Waiting on CI or review",
	orchestrator: "Waiting on orchestrator",
	queued: "Queued",
	waiting: "Waiting (reason unavailable)",
	working: "Working",
	you: "Waiting on you",
} as const;

export const flightColors = {
	automation: "#00868b",
	blocked: goalColors.blocked,
	checks: "#00868b",
	orchestrator: "#9467cd",
	queued: goalColors.scheduled,
	waiting: goalColors.parked,
	working: goalColors.running,
	you: goalColors.scheduled,
} as const;

export function notStartedState(flight: WorkboardFlight): "blocked" | "queued" | null {
	if (flight.prUrl !== null) {
		return null;
	}
	const reason = flight.waitingReason ?? "";
	if (reason.startsWith("waiting for dependency ")) {
		return "blocked";
	}
	if (
		flight.stage === "queued"
		|| reason.startsWith("waiting for area ")
		|| reason.startsWith("execution capacity is occupied")
		|| reason.startsWith("waiting for open PRs to merge:")
		|| /^waiting for \d+ review or repair launches to go first/u.test(reason)
	) {
		return "queued";
	}
	return null;
}

export function flightState(flight: WorkboardFlight): FlightState {
	const admission = notStartedState(flight);
	if (admission !== null) {
		return admission;
	}
	if (flight.attentionOwner === "maintainer") {
		return "you";
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
	if (flight.waitingReason !== undefined) {
		return flight.waitingReason;
	}
	if (flight.stage === "queued") {
		return "Waiting for a worker slot";
	}
	return flight.stage === "reviewing" ? "Reviewing" : null;
}
