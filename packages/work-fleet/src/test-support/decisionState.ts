import type { BoardDecisionReading } from "#board/schema.ts";

export function decisionState(reading: BoardDecisionReading) {
	switch (reading._tag) {
		case "Response":
			return `answered by ${reading.response.id}`;
		case "Ambiguous":
			return `ambiguous between ${reading.responseIds.join(", ")}`;
		default:
			return reading._tag.toLowerCase();
	}
}
