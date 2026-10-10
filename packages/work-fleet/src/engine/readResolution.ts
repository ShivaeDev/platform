import { Effect } from "effect";
import type { BoardGateway, Decision } from "#policy.ts";
import { FleetFailure } from "#policy.ts";

export const readResolution = Effect.fn("Fleet.readResolution")(function* (
	board: typeof BoardGateway.Service,
	decision: Decision,
	responseId: string,
) {
	const published = decision.published;
	if (published === undefined) {
		return yield* Effect.fail(new FleetFailure({ message: "Board decision publication must be reconciled first", reason: "stale" }));
	}
	const reading = yield* board.readDecision(published);
	if (reading._tag !== "Response" || reading.response.id !== responseId) {
		return yield* Effect.fail(
			new FleetFailure({ message: "Board response is missing, ambiguous, superseded or belongs to changed context", reason: "stale" }),
		);
	}
	const response = reading.response;
	if (response.response.question !== published.questionId || response.response.reviewedRevision !== published.revision) {
		return yield* Effect.fail(new FleetFailure({ message: "Response does not match the exact Board question", reason: "stale" }));
	}
	if (response.response.type !== "answer") {
		return { action: undefined, published, response };
	}
	const answers = response.response.answers?.filter((answer) => answer.prompt === "fleet-action") ?? [];
	const selected = answers[0]?.selected;
	const action = selected?.[0];
	if (answers.length !== 1 || selected?.length !== 1 || (action !== "retry" && action !== "release")) {
		return yield* Effect.fail(
			new FleetFailure({ message: "Choose one guided Fleet retry or release action; free text cannot authorize it", reason: "invalid" }),
		);
	}
	return { action, published, response } as const;
});
