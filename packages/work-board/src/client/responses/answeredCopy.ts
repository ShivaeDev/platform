import type { AnswerSummary } from "#browser/responses/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";

export function answeredCopy(answer: AnswerSummary, fleet: FleetItemsProjection | undefined): string {
	const author = answer.yours ? "You" : answer.author;
	const answered = answer.choice ? `${author} answered: ${answer.choice}.` : `${author} answered.`;
	return fleet?.state === "unavailable"
		? `${answered} Fleet is unavailable, so it picks this up once it runs again.`
		: `${answered} Fleet picks this up on its next pass.`;
}
