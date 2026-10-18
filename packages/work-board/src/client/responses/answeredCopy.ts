import type { AnswerSummary } from "#browser/responses/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";

function fleetLine(fleet: FleetItemsProjection | undefined) {
	if (fleet === undefined) {
		return "Waiting for Fleet to pick this up.";
	}
	return fleet.state === "unavailable" ? "Fleet isn't running. It picks this up when it starts again." : "Fleet picks this up on its next pass.";
}

export function answeredCopy(answer: AnswerSummary, fleet: FleetItemsProjection | undefined): string {
	const choice = answer.choice ? `: ${answer.choice}.` : ".";
	return `${answer.yours ? "You answered" : `Answered by ${answer.author}`}${choice} ${fleetLine(fleet)}`;
}
