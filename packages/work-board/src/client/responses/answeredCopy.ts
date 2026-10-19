import type { AnswerSummary } from "#browser/responses/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { RecentAnswer } from "#browser/views/schema.ts";

function fleetLine(fleet: FleetItemsProjection | undefined) {
	if (fleet === undefined) {
		return "Waiting for Fleet to pick this up.";
	}
	return fleet.state === "unavailable" ? "Fleet isn't running. It picks this up when it starts again." : "Fleet picks this up on its next pass.";
}

const outcomes = {
	applied: "Fleet applied it.",
	changed: "The question changed after the answer, so it asks again.",
	closed: "It's closed now.",
	superseded: "Fleet replaced this question with a newer one.",
	waiting: "Waiting on the agent.",
} as const;

function answeredLine(answer: AnswerSummary) {
	return `${answer.yours ? "You answered" : `Answered by ${answer.author}`}${answer.choice ? `: ${answer.choice}.` : "."}`;
}

export function answeredCopy(answer: AnswerSummary, fleet: FleetItemsProjection | undefined): string {
	return `${answeredLine(answer)} ${fleetLine(fleet)}`;
}

export function recentAnswerCopy(row: RecentAnswer, fleet: FleetItemsProjection | undefined): string {
	return `${answeredLine(row.answer)} ${row.state === "fleet" ? fleetLine(fleet) : outcomes[row.state]}`;
}
